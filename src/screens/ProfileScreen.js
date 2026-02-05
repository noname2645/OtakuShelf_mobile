import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Dimensions,
  Share,
  Platform,
  RefreshControl,
  StatusBar,
  Animated
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../contexts/AuthContext';
import BottomNav from '../components/BottomNav';
import { Ionicons } from '@expo/vector-icons';
import { Svg, G, Path, Circle, Text as SvgText } from 'react-native-svg';
import axios from 'axios';
import AnimeModal from '../components/AnimeModal';

const { width } = Dimensions.get('window');

// Anime Genres Array
const ANIME_GENRES = [
  "Action", "Adventure", "Avant Garde", "Award Winning", "Boys Love",
  "Comedy", "Drama", "Fantasy", "Girls Love", "Gourmet",
  "Horror", "Mystery", "Romance", "Sci-Fi", "Slice of Life",
  "Sports", "Supernatural", "Suspense", "Thriller"
];

const COLORS = [
  '#FF6B6B', '#4ECDC4', '#FFD166', '#06D6A0', '#118AB2',
  '#EF476F', '#073B4C', '#7209B7', '#3A86FF', '#FB5607',
  '#8338EC', '#FF006E', '#FFBE0B', '#3A86FF', '#FB5607',
  '#FF595E', '#8AC926', '#1982C4', '#6A4C93'
];

const ANIME_DETAILS_QUERY = `
  query ($id: Int) {
    Media (id: $id, type: ANIME) {
      id
      idMal
      title { romaji english native }
      coverImage { extraLarge large medium }
      bannerImage
      description
      episodes
      status
      format
      genres
      averageScore
      studios { nodes { name } }
      startDate { year month day }
      endDate { year month day }
      trailer { id site }
      relations {
        edges {
          relationType
          node {
            id
            title { romaji english native }
            format
            status
            coverImage { medium }
          }
        }
      }
    }
  }
`;

// Local Anime Grid Card - Matches Sim/Style of HomeScreen
const CARD_GAP = 12;
const CARD_WIDTH = (width - 40 - CARD_GAP) / 2; // (Screen - Padding*2 - Gap) / 2
const CARD_HEIGHT = CARD_WIDTH * 1.45;

const AnimeGridCard = ({ item, index, onPress }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    const delay = Math.min(index * 50, 300);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, delay, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, delay, tension: 50, friction: 7, useNativeDriver: true })
    ]).start();
  }, []);

  const imageUrl = item.image || item.coverImage?.extraLarge || item.coverImage?.large;
  const title = typeof item.title === 'string' ? item.title : (item.title?.english || item.title?.romaji || "Untitled");

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={cardStyles.card}
        activeOpacity={0.8}
        onPress={() => onPress(item)}
      >
        <View style={cardStyles.inner}>
          <Image source={{ uri: imageUrl || 'https://via.placeholder.com/200x300' }} style={cardStyles.image} resizeMode="cover" />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.95)']}
            locations={[0, 0.4, 1]}
            style={cardStyles.gradient}
          />
          <View style={cardStyles.titleContainer}>
            <Text style={cardStyles.title} numberOfLines={2}>{title}</Text>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const cardStyles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 20,
    backgroundColor: '#1a1a2e',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5
  },
  inner: { flex: 1, position: 'relative' },
  image: { width: '100%', height: '100%' },
  gradient: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: '50%',
    borderBottomLeftRadius: 20, borderBottomRightRadius: 20
  },
  titleContainer: {
    position: 'absolute', bottom: 0, left: 0, right: 0, padding: 10,
    paddingBottom: 15
  },
  title: {
    color: '#ff6a00',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    textShadowColor: 'rgba(190, 79, 0, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8
  }
});

const PieChart = ({ data }) => {
  const radius = 90;
  const strokeWidth = 30;
  const center = radius + strokeWidth;
  const total = data.reduce((acc, item) => acc + item.value, 0);
  let currentAngle = 0;

  if (data.length === 0 || total === 0) {
    return (
      <View style={styles.emptyChart}>
        <Ionicons name="stats-chart" size={48} color="rgba(255,255,255,0.2)" />
        <Text style={styles.emptyChartText}>No Data</Text>
      </View>
    );
  }

  const polarToCartesian = (centerX, centerY, radius, angleInDegrees) => {
    var angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
    return {
      x: centerX + (radius * Math.cos(angleInRadians)),
      y: centerY + (radius * Math.sin(angleInRadians))
    };
  }

  const describeArc = (x, y, radius, startAngle, endAngle) => {
    var start = polarToCartesian(x, y, radius, endAngle);
    var end = polarToCartesian(x, y, radius, startAngle);
    var largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
    var d = [
      "M", start.x, start.y,
      "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y
    ].join(" ");
    return d;
  }

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={center * 2} height={center * 2}>
        <G rotation={0} origin={`${center}, ${center}`}>
          <Circle cx={center} cy={center} r={radius} stroke="rgba(255,255,255,0.05)" strokeWidth={strokeWidth} fill="none" />
          {data.map((item, index) => {
            if (item.value <= 0) return null;
            const angle = (item.value / 100) * 360;
            const startAngle = currentAngle;
            const endAngle = currentAngle + angle;
            currentAngle += angle;

            if (Math.abs(angle - 360) < 0.1) {
              return <Circle key={index} cx={center} cy={center} r={radius} stroke={item.color} strokeWidth={strokeWidth} fill="none" />
            }

            const path = describeArc(center, center, radius, startAngle, endAngle >= 359.9 ? 359.9 : endAngle);
            return (
              <Path key={index} d={path} stroke={item.color} strokeWidth={strokeWidth} fill="none" strokeLinecap="butt" />
            );
          })}
        </G>
        <SvgText x={center} y={center - 10} fill="#fff" fontSize="24" fontWeight="bold" textAnchor="middle" alignmentBaseline="middle">{ANIME_GENRES.length}</SvgText>
        <SvgText x={center} y={center + 15} fill="rgba(255,255,255,0.7)" fontSize="12" textAnchor="middle" alignmentBaseline="middle">Total Genres</SvgText>
      </Svg>
    </View>
  );
};



const ProfileScreen = ({ navigation }) => {
  const { user, updateProfile, API, logout, checkAuthStatus } = useAuth();

  // State
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState(null);
  const [recentlyWatched, setRecentlyWatched] = useState([]);
  const [favoriteAnime, setFavoriteAnime] = useState([]);
  const [badges, setBadges] = useState([]);
  const [genres, setGenres] = useState([]);
  const [chartData, setChartData] = useState([]);

  // Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', bio: '', username: '' });

  // Modal State
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [selectedAnimeForDetails, setSelectedAnimeForDetails] = useState(null);

  const fetchAnimeDetails = async (anime) => {
    // Basic show first
    const basicAnime = {
      ...anime,
      id: anime.id || anime.animeId || anime._id,
      title: typeof anime.title === 'string' ? { romaji: anime.title } : anime.title,
      coverImage: anime.image ? { large: anime.image } : anime.coverImage
    };
    setSelectedAnimeForDetails(basicAnime);
    setDetailsModalVisible(true);

    // Fetch Rich Data
    const aniListId = anime.id || anime.animeId;
    if (!aniListId) return;

    try {
      const response = await axios.post('https://graphql.anilist.co', {
        query: ANIME_DETAILS_QUERY,
        variables: { id: aniListId }
      });
      const media = response.data.data.Media;
      if (media) {
        setSelectedAnimeForDetails(prev => ({ ...prev, ...media }));
      }
    } catch (e) {
      console.log("Failed to fetch rich details", e);
    }
  };

  const prepareChartData = useCallback((userGenres) => {
    // ... logic implied by loadProfileData mapping below
  }, []);

  const loadProfileData = async () => {
    try {
      if (!user?._id) return;
      const response = await axios.get(`${API}/api/profile/${user._id}`);
      const data = response.data;

      if (data) {
        const fixImageUrl = (url) => {
          if (!url) return null;
          if (url.startsWith('http') || url.startsWith('data:')) return url;
          const cleanPath = url.replace('//', '/');
          return `${API.replace('/api', '')}${cleanPath}`;
        };

        setProfileData({
          name: data.name || 'Anime Lover',
          username: data.profile?.username || `@user_${user._id.toString().slice(-6)}`,
          bio: data.profile?.bio || 'Anime enthusiast exploring new worlds through animation',
          joinDate: new Date(data.profile?.joinDate || data.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
          avatar: fixImageUrl(data.photo),
          coverImage: fixImageUrl(data.profile?.coverImage),
          email: data.email
        });

        setStats(data.profile?.stats || {});
        setRecentlyWatched(data.recentlyWatched || []);
        setFavoriteAnime(data.favoriteAnime || []);
        setBadges(data.profile?.badges || []);

        const fullChartData = ANIME_GENRES.map((genreName, index) => {
          const gParams = (data.profile?.favoriteGenres || []).find(g => g.name === genreName);
          return {
            name: genreName,
            value: gParams ? gParams.percentage : 0,
            count: gParams ? gParams.count : 0,
            color: COLORS[index % COLORS.length]
          };
        });
        setChartData(fullChartData);

        setEditForm({
          name: data.name || '',
          bio: data.profile?.bio || '',
          username: data.profile?.username || `@user_${user._id.toString().slice(-6)}`
        });
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      Alert.alert("Error", "Failed to load profile data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadProfileData(); }, [user]);
  const onRefresh = useCallback(() => { setRefreshing(true); loadProfileData(); }, []);

  const handleCoverUpload = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [16, 9], quality: 0.8 });
      if (!result.canceled && result.assets[0].uri) {
        const formData = new FormData();
        formData.append('cover', { uri: result.assets[0].uri, name: 'cover.jpg', type: 'image/jpeg' });
        const response = await axios.post(`${API}/api/profile/${user._id}/upload-cover`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        if (response.data.coverImage) { loadProfileData(); Alert.alert("Success", "Cover image updated!"); }
      }
    } catch (e) { Alert.alert("Error", "Failed to upload cover"); }
  };

  const handleImageUpload = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.8 });
      if (!result.canceled && result.assets[0].uri) {
        const formData = new FormData();
        formData.append('photo', { uri: result.assets[0].uri, name: 'photo.jpg', type: 'image/jpeg' });
        const response = await axios.post(`${API}/api/profile/${user._id}/upload-photo`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });

        if (response.data.photo) {
          // Sync global auth state
          await checkAuthStatus();
          // Reload local profile data (though useEffect on user change might handle this)
          loadProfileData();
          Alert.alert("Success", "Profile photo updated!");
        }
      }
    } catch (e) { Alert.alert("Error", "Failed to upload photo"); }
  };

  const handleSaveProfile = async () => {
    try {
      await updateProfile({ name: editForm.name, profile: { bio: editForm.bio, username: editForm.username } });
      setProfileData(prev => ({ ...prev, name: editForm.name, bio: editForm.bio, username: editForm.username }));
      setIsEditing(false);
      Alert.alert("Success", "Profile updated!");
    } catch (e) { Alert.alert("Error", "Failed to update profile"); }
  };

  const handleShareProfile = async () => { try { await Share.share({ message: `Check out ${profileData?.name}'s anime profile!` }); } catch (e) { } };

  if (loading) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#ff6b6b" /><Text style={styles.loadingText}>Loading Profile...</Text></View>;
  if (!profileData) return null;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <ScrollView style={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ff6b6b" />}>
        {/* Cover */}
        <View style={styles.coverContainer}>
          <Image source={{ uri: profileData.coverImage || "https://images.unsplash.com/photo-1520975916090-3105956dac38?auto=format&fit=crop&w=1600&q=80" }} style={styles.coverImage} />
          <LinearGradient colors={['transparent', 'rgba(10,15,30,0.9)', '#0a0f1e']} style={styles.coverGradient} />
          <TouchableOpacity style={styles.changeCoverBtn} onPress={handleCoverUpload}><Ionicons name="camera-outline" size={16} color="#fff" /><Text style={styles.changeCoverText}> Change Cover</Text></TouchableOpacity>
        </View>

        {/* Header */}
        <View style={[styles.headerContent, isEditing && styles.headerContentEditing]}>
          <View style={styles.avatarSection}>
            <View style={styles.avatarWrapper}>
              {profileData.avatar ? <Image source={{ uri: profileData.avatar }} style={styles.avatar} /> : <View style={[styles.avatar, styles.placeholderAvatar]}><Text style={styles.placeholderAvatarText}>{profileData.name.charAt(0)}</Text></View>}
              <TouchableOpacity style={styles.changeAvatarBtn} onPress={handleImageUpload}><Ionicons name="camera" size={18} color="#fff" /></TouchableOpacity>
            </View>
          </View>

          {isEditing ? (
            <View style={styles.editForm}>
              <Text style={styles.label}>Name</Text><TextInput style={styles.input} value={editForm.name} onChangeText={(t) => setEditForm(prev => ({ ...prev, name: t }))} placeholderTextColor="#666" />
              <Text style={styles.label}>Username</Text><TextInput style={styles.input} value={editForm.username} onChangeText={(t) => setEditForm(prev => ({ ...prev, username: t }))} placeholderTextColor="#666" />
              <Text style={styles.label}>Bio</Text><TextInput style={[styles.input, styles.textArea]} value={editForm.bio} onChangeText={(t) => setEditForm(prev => ({ ...prev, bio: t }))} multiline numberOfLines={4} placeholderTextColor="#666" />
              <View style={styles.editActions}>
                <TouchableOpacity style={styles.saveBtn} onPress={handleSaveProfile}><Text style={styles.btnText}>Save</Text></TouchableOpacity>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsEditing(false)}><Text style={styles.btnText}>Cancel</Text></TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.profileInfo}>
              <Text style={styles.name}>{profileData.name}</Text>
              <Text style={styles.username}>{profileData.username}</Text>
              <Text style={styles.bio}>{profileData.bio}</Text>
              <View style={styles.joinedDate}><Ionicons name="calendar-outline" size={14} color="rgba(255,255,255,0.6)" /><Text style={styles.joinedText}> Joined {profileData.joinDate}</Text></View>
              <View style={styles.actionButtons}>
                <TouchableOpacity style={styles.editProfileBtn} onPress={() => setIsEditing(true)}><Ionicons name="pencil" size={16} color="#fff" /><Text style={styles.btnText}> Edit Profile</Text></TouchableOpacity>
                <TouchableOpacity style={styles.shareBtn} onPress={handleShareProfile}><Ionicons name="share-social" size={16} color="#fff" /></TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        <View style={styles.mainContainer}>
          {/* Stats */}
          <Text style={styles.sectionTitle}>Overview</Text>
          <View style={styles.statsGrid}>
            {[
              { label: 'Watching', value: stats?.currentlyWatching || 0 },
              { label: 'Completed', value: stats?.animeWatched || 0 },
              { label: 'Planned', value: stats?.animePlanned || 0 },
              { label: 'Dropped', value: stats?.animeDropped || 0 },
              { label: 'Hours', value: stats?.hoursWatched || 0 },
              { label: 'Episodes', value: stats?.totalEpisodes || 0 },
              { label: 'Mean Score', value: stats?.meanScore || 0 },
              { label: 'Favorites', value: stats?.favorites || 0 },
            ].map((stat, index) => (
              <View key={index} style={styles.statCard}><Text style={styles.statNumber}>{stat.value}</Text><Text style={styles.statLabel}>{stat.label}</Text></View>
            ))}
          </View>

          {/* Recent Activity Grid */}
          <Text style={styles.sectionTitle}>Recently Watched</Text>
          {recentlyWatched.length > 0 ? (
            <View style={styles.gridContainer}>
              {recentlyWatched.map((anime, i) => <AnimeGridCard key={i} item={anime} index={i} onPress={fetchAnimeDetails} />)}
            </View>
          ) : (
            <View style={styles.emptyState}><Text style={styles.emptyText}>No recently watched anime yet.</Text></View>
          )}

          {/* Favorites Grid */}
          <Text style={styles.sectionTitle}>Favorite Anime</Text>
          {favoriteAnime.length > 0 ? (
            <View style={styles.gridContainer}>
              {favoriteAnime.map((anime, i) => <AnimeGridCard key={i} item={anime} index={i} onPress={fetchAnimeDetails} />)}
            </View>
          ) : (
            <View style={styles.emptyState}><Text style={styles.emptyText}>No favorite anime yet.</Text></View>
          )}

          {/* Badges */}
          <Text style={styles.sectionTitle}>Badges</Text>
          <View style={styles.badgesGrid}>
            {badges.length > 0 ? badges.map((badge, i) => (
              <View key={i} style={styles.badgeCard}><Text style={{ fontSize: 30 }}>{badge.icon}</Text><Text style={styles.badgeTitle}>{badge.title}</Text></View>
            )) : (
              <View style={[styles.emptyState, { width: '100%' }]}><Text style={styles.emptyText}>No badges earned yet.</Text></View>
            )}
          </View>

          {/* Chart */}
          <Text style={styles.sectionTitle}>Genre Breakdown</Text>
          <View style={styles.chartContainer}>
            <PieChart data={chartData} />
            <View style={styles.chartStats}>
              <View style={styles.chartStatItem}><Text style={styles.chartStatLabel}>Total Genres</Text><Text style={styles.chartStatValue}>{ANIME_GENRES.length}</Text></View>
              <View style={styles.chartStatItem}><Text style={styles.chartStatLabel}>Studied</Text><Text style={styles.chartStatValue}>{chartData.filter(d => d.value > 0).length}</Text></View>
              <View style={styles.chartStatItem}><Text style={styles.chartStatLabel}>Top %</Text><Text style={styles.chartStatValue}>{chartData.length > 0 ? Math.max(...chartData.map(d => d.value)).toFixed(1) : 0}%</Text></View>
            </View>
            <View style={styles.legendContainer}>
              {chartData.map((item, index) => (
                <View key={index} style={[styles.legendItem, item.value === 0 && styles.legendItemInactive]}>
                  <View style={[styles.legendColor, { backgroundColor: item.color, opacity: item.value === 0 ? 0.3 : 1 }]} />
                  <View style={styles.legendInfo}><Text style={styles.legendText} numberOfLines={1}>{item.name}</Text><Text style={styles.legendPercent}>{item.value.toFixed(1)}%</Text></View>
                </View>
              ))}
            </View>
          </View>
          <View style={{ height: 100 }} />
        </View>
      </ScrollView>

      <AnimeModal visible={detailsModalVisible} anime={selectedAnimeForDetails} onClose={() => setDetailsModalVisible(false)} onOpenAnime={(a) => fetchAnimeDetails(a)} />

      <BottomNav navigation={navigation} activeRoute="Profile" />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0f1e' },
  loadingContainer: { flex: 1, backgroundColor: '#0a0f1e', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#ff6b6b', marginTop: 10, fontSize: 16 },
  content: { flex: 1 },
  coverContainer: { height: 300, width: '100%', position: 'relative' }, // Fixed 300
  coverImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  coverGradient: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 150 },
  changeCoverBtn: { position: 'absolute', top: 50, right: 20, backgroundColor: 'rgba(0,0,0,0.6)', flexDirection: 'row', alignItems: 'center', padding: 8, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  changeCoverText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  headerContent: { flexDirection: 'row', alignItems: 'flex-start', marginTop: -140, paddingHorizontal: 20, marginBottom: 20 }, // Fixed layout
  headerContentEditing: { flexDirection: 'column', alignItems: 'center', marginTop: -50 }, // Editing layout

  avatarSection: { marginRight: 20, position: 'relative', marginBottom: 0 },
  avatarWrapper: { width: 120, height: 120, borderRadius: 60, borderWidth: 4, borderColor: 'rgba(255,107,107,0.4)', justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0f1e', shadowColor: "#ff6b6b", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 20, elevation: 10 },
  avatar: { width: 112, height: 112, borderRadius: 56 },
  placeholderAvatar: { backgroundColor: '#ff6b6b', justifyContent: 'center', alignItems: 'center' },
  placeholderAvatarText: { fontSize: 40, color: '#fff', fontWeight: 'bold' },
  changeAvatarBtn: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#4ecdc4', width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#0a0f1e' },

  profileInfo: { flex: 1, flexShrink: 1, alignItems: 'flex-start', paddingTop: 10 },
  name: { fontSize: 24, fontWeight: '800', color: '#fff', marginBottom: 2, textAlign: 'left' },
  username: { fontSize: 14, color: 'rgba(255,255,255,0.7)', marginBottom: 8, textAlign: 'left' },
  bio: { fontSize: 14, color: 'rgba(255,255,255,0.8)', textAlign: 'left', lineHeight: 20, marginBottom: 12, paddingHorizontal: 0, paddingVertical: 0, backgroundColor: 'transparent', borderRadius: 0, borderLeftWidth: 0, marginRight: 10 },
  joinedDate: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginBottom: 15, alignSelf: 'flex-start' },
  joinedText: { color: 'rgba(255,255,255,0.6)', fontSize: 12 },

  actionButtons: { flexDirection: 'row', gap: 10, width: '100%', justifyContent: 'flex-start' },
  editProfileBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ff6b6b', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, justifyContent: 'center' },
  shareBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 15 },

  mainContainer: { paddingHorizontal: 20, marginTop: 20 },
  sectionTitle: { fontSize: 22, fontWeight: 'bold', color: '#fff', marginBottom: 20, marginTop: 10, borderLeftWidth: 4, borderLeftColor: '#4ecdc4', paddingLeft: 10 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, marginBottom: 30 },
  statCard: { width: (width - 52) / 2, backgroundColor: 'rgba(255,255,255,0.05)', padding: 15, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center' },
  statNumber: { fontSize: 24, fontWeight: 'bold', color: '#ff6b6b', marginBottom: 5 },
  statLabel: { fontSize: 12, color: 'rgba(255,255,255,0.6)', textAlign: 'center' },

  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }, // Added Grid Style

  badgesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 15, marginBottom: 30 },
  badgeCard: { width: (width - 55) / 2, backgroundColor: 'rgba(255,255,255,0.05)', padding: 20, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  badgeTitle: { color: '#fff', fontWeight: 'bold', marginTop: 10, textAlign: 'center' },

  chartContainer: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 24, padding: 20, marginBottom: 30, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  chartStats: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginTop: 20, padding: 15, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16 },
  chartStatItem: { alignItems: 'center' },
  chartStatLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginBottom: 4 },
  chartStatValue: { color: '#ff6b6b', fontSize: 18, fontWeight: 'bold' },
  legendContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 20, justifyContent: 'center' },
  legendItem: { width: (width - 100) / 2, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', padding: 8, borderRadius: 8, marginBottom: 4 },
  legendItemInactive: { opacity: 0.5 },
  legendColor: { width: 12, height: 12, borderRadius: 4, marginRight: 8 },
  legendInfo: { flex: 1, flexDirection: 'row', justifyContent: 'space-between' },
  legendText: { color: '#fff', fontSize: 12, maxWidth: 80 },
  legendPercent: { color: '#ff6b6b', fontSize: 12, fontWeight: 'bold' },
  emptyChart: { alignItems: 'center', justifyContent: 'center', height: 200 },
  emptyChartText: { color: 'rgba(255,255,255,0.4)', marginTop: 10 },

  editForm: { width: '90%', alignSelf: 'center', paddingHorizontal: 10, backgroundColor: 'rgba(10, 15, 30, 0.95)', paddingVertical: 20, borderRadius: 16, marginTop: 20 },
  label: { color: '#fff', fontWeight: '600', marginBottom: 8, marginTop: 15 },
  input: { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 15, color: '#fff', fontSize: 16 },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  editActions: { flexDirection: 'row', gap: 15, marginTop: 30 },
  saveBtn: { flex: 1, backgroundColor: '#4ecdc4', padding: 16, borderRadius: 12, alignItems: 'center' },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', padding: 16, borderRadius: 12, alignItems: 'center' },

  emptyState: { padding: 30, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12, alignItems: 'center', marginBottom: 30 },
  emptyText: { color: 'rgba(255,255,255,0.5)' }
});

export default ProfileScreen;