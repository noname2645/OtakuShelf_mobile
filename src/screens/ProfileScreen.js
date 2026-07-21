import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Animated,
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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../contexts/AuthContext';
import BottomNav from '../components/BottomNav';
import { Ionicons } from '@expo/vector-icons';
import { Svg, G, Path, Circle, Text as SvgText } from 'react-native-svg';
import axios from 'axios';
import AnimeModal from '../components/AnimeModal';
import AnimeCardPremium from '../components/AnimeCardPremium';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_VERSION, BUILD_DATE } from '../config/api';

const { width } = Dimensions.get('window');

const normalizeAnime = (item) => {
  if (!item) return null;
  return {
    id: item.id || item.animeId || item._id,
    title: typeof item.title === 'string' ? item.title : (item.title?.english || item.title?.romaji || item.title?.native || 'Unknown'),
    coverImage: {
      large: item.image || item.coverImage?.extraLarge || item.coverImage?.large,
      extraLarge: item.image || item.coverImage?.extraLarge || item.coverImage?.large,
    },
    averageScore: item.averageScore || item.score || null,
    episodes: item.episodes || null,
    format: item.format || null,
    genres: item.genres || [],
    year: item.year || item.startDate?.year || null,
    status: item.status || null,
    studios: item.studios || [],
    trailer: item.trailer || null,
  };
};

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
    borderRadius: 16,
    backgroundColor: '#111',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    marginBottom: 20,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  inner: { flex: 1, position: 'relative' },
  image: { ...StyleSheet.absoluteFillObject, borderRadius: 16 },
  gradient: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: '55%',
    borderBottomLeftRadius: 16, borderBottomRightRadius: 16
  },
  titleContainer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 10, paddingBottom: 12
  },
  title: {
    color: '#ff9a00',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 18,
    textShadowColor: 'rgba(0,0,0,0.95)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  }
});

const PieChart = ({ data }) => {
  const radius = 95;
  const strokeWidth = 55;
  const center = radius + strokeWidth;
  const totalValue = data.reduce((acc, item) => acc + item.value, 0);
  let currentAngle = 0;

  if (data.length === 0 || totalValue === 0) {
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
          {/* Background Track */}
          <Circle cx={center} cy={center} r={radius} stroke="rgba(255,255,255,0.05)" strokeWidth={strokeWidth} fill="none" />

          {data.map((item, index) => {
            if (item.value <= 0) return null;

            // Normalize the angle based on the TOTAL sum of values, not 100%
            // because genre percentages can sum to > 100% (multi-genre anime)
            const angle = (item.value / totalValue) * 360;
            const startAngle = currentAngle;
            const endAngle = currentAngle + angle;
            currentAngle += angle;

            // Handle full circle case
            if (angle >= 360) {
              return <Circle key={index} cx={center} cy={center} r={radius} stroke={item.color} strokeWidth={strokeWidth} fill="none" />
            }

            const path = describeArc(center, center, radius, startAngle, endAngle);
            return (
              <Path
                key={index}
                d={path}
                stroke={item.color}
                strokeWidth={strokeWidth}
                fill="none"
              />
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
      const userId = user?._id || user?.id;
      if (!userId) return;
      
      const token = await AsyncStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const [profileRes, listRes] = await Promise.all([
        axios.get(`${API}/api/profile/${userId}`, { headers }),
        axios.get(`${API}/api/list/${userId}`, { headers }).catch(() => null),
      ]);

      const data = profileRes.data?.data || profileRes.data;
      const watchlist = listRes?.data;

      if (data) {
        const fixImageUrl = (url) => {
          if (!url) return null;
          if (url.startsWith('http') || url.startsWith('data:')) return url;
          const cleanPath = url.replace('//', '/');
          return `${API.replace('/api', '')}${cleanPath}`;
        };

        setProfileData({
          name: data.name || 'Anime Lover',
          username: data.profile?.username || `@user_${userId.toString().slice(-6)}`,
          bio: data.profile?.bio || 'Anime enthusiast exploring new worlds through animation',
          joinDate: new Date(data.profile?.joinDate || data.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
          avatar: fixImageUrl(data.photo),
          coverImage: fixImageUrl(data.profile?.coverImage),
          email: data.email
        });

        // 1. Calculate Watchlist Stats
        let calculatedStats = {
          currentlyWatching: 0,
          animeWatched: 0,
          animePlanned: 0,
          animeDropped: 0,
          hoursWatched: 0,
          totalEpisodes: 0,
          meanScore: 0,
          favorites: data.favoriteAnime?.length || 0,
        };

        const genreCounts = {};
        let totalGenreOccurrences = 0;

        // Support both flat list or wrapped { success, data } object
        const listObj = watchlist?.data || watchlist;

        if (listObj) {
          const watchingCount = Array.isArray(listObj.watching) ? listObj.watching.length : 0;
          const completedCount = Array.isArray(listObj.completed) ? listObj.completed.length : 0;
          const plannedCount = Array.isArray(listObj.planned) ? listObj.planned.length : 0;
          const droppedCount = Array.isArray(listObj.dropped) ? listObj.dropped.length : 0;

          let totalEpWatched = 0;
          let totalRating = 0;
          let ratedCount = 0;

          const allLists = [
            ...(listObj.watching || []),
            ...(listObj.completed || []),
            ...(listObj.planned || []),
            ...(listObj.dropped || []),
          ];

          allLists.forEach(item => {
            totalEpWatched += item.episodesWatched || 0;
            if (item.userRating && item.userRating > 0) {
              totalRating += item.userRating;
              ratedCount++;
            }

            // Extract genres for chart breakdown
            const genresList = item.genres || item.animeData?.genres || [];
            if (Array.isArray(genresList)) {
              genresList.forEach(genre => {
                genreCounts[genre] = (genreCounts[genre] || 0) + 1;
                totalGenreOccurrences++;
              });
            }
          });

          calculatedStats.currentlyWatching = watchingCount;
          calculatedStats.animeWatched = completedCount;
          calculatedStats.animePlanned = plannedCount;
          calculatedStats.animeDropped = droppedCount;
          calculatedStats.totalEpisodes = totalEpWatched;
          calculatedStats.hoursWatched = Math.round((totalEpWatched * 24) / 60);
          calculatedStats.meanScore = ratedCount > 0 ? parseFloat(((totalRating / ratedCount) * 2).toFixed(1)) : 0;
        }

        // Set stats
        setStats(listObj ? calculatedStats : (data.profile?.stats || {}));
        
        setRecentlyWatched(data.recentlyWatched || []);
        setFavoriteAnime(data.favoriteAnime || []);
        setBadges(data.profile?.badges || []);

        // 2. Set Chart Data based on dynamic genres or server data
        const fullChartData = ANIME_GENRES.map((genreName, index) => {
          if (listObj && totalGenreOccurrences > 0) {
            const count = genreCounts[genreName] || 0;
            const percentage = (count / totalGenreOccurrences) * 100;
            return {
              name: genreName,
              value: percentage,
              count: count,
              color: COLORS[index % COLORS.length]
            };
          } else {
            const gParams = (data.profile?.favoriteGenres || []).find(g => g.name === genreName);
            return {
              name: genreName,
              value: gParams ? gParams.percentage : 0,
              count: gParams ? gParams.count : 0,
              color: COLORS[index % COLORS.length]
            };
          }
        });
        setChartData(fullChartData);

        setEditForm({
          name: data.name || '',
          bio: data.profile?.bio || '',
          username: data.profile?.username || `@user_${userId.toString().slice(-6)}`
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
      const userId = user?._id || user?.id;
      if (!userId) return;
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [16, 9], quality: 0.8 });
      if (!result.canceled && result.assets[0].uri) {
        const formData = new FormData();
        formData.append('cover', { uri: result.assets[0].uri, name: 'cover.jpg', type: 'image/jpeg' });
        const token = await AsyncStorage.getItem("token");
        const response = await axios.post(`${API}/api/profile/${userId}/upload-cover`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          }
        });
        const resData = response.data?.data || response.data;
        if (resData?.coverImage || resData?.profile?.coverImage) { 
          loadProfileData(); 
          Alert.alert("Success", "Cover image updated!"); 
        }
      }
    } catch (e) { Alert.alert("Error", "Failed to upload cover"); }
  };

  const handleImageUpload = async () => {
    try {
      const userId = user?._id || user?.id;
      if (!userId) return;
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.8 });
      if (!result.canceled && result.assets[0].uri) {
        const formData = new FormData();
        formData.append('photo', { uri: result.assets[0].uri, name: 'photo.jpg', type: 'image/jpeg' });
        const token = await AsyncStorage.getItem("token");
        const response = await axios.post(`${API}/api/profile/${userId}/upload-photo`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          }
        });

        const resData = response.data?.data || response.data;
        if (resData?.photo || resData?.avatar) {
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

  const scrollYProfile = useRef(new Animated.Value(0)).current;
  const headerBgOpacityProfile = scrollYProfile.interpolate({
    inputRange: [0, 100],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  if (loading) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#ffae00" style={{ transform: [{ scale: 1.5 }] }} /></View>;
  if (!profileData) return null;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <ScrollView
        style={styles.content}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollYProfile } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ff6b6b" />}
      >
        {/* Cover */}
        <View style={styles.coverContainer}>
          <Image source={{ uri: profileData.coverImage || "https://images.unsplash.com/photo-1520975916090-3105956dac38?auto=format&fit=crop&w=1600&q=80" }} style={styles.coverImage} />
          <LinearGradient colors={['transparent', 'rgba(3,7,18,0.9)', '#030712']} style={styles.coverGradient} />
          <TouchableOpacity style={styles.changeCoverBtn} onPress={handleCoverUpload}><Ionicons name="camera-outline" size={16} color="#fff" /><Text style={styles.changeCoverText}> Change Cover</Text></TouchableOpacity>
        </View>

        {/* Header */}
        <View style={[styles.headerContent, isEditing && styles.headerContentEditing]}>
          <View style={styles.avatarSection}>
            <View style={styles.avatarWrapper}>
              {profileData.avatar ? <Image source={{ uri: profileData.avatar }} style={styles.avatar} /> : <View style={[styles.avatar, styles.placeholderAvatar]}><Text style={styles.placeholderAvatarText}>{profileData.name.charAt(0)}</Text></View>}
              <TouchableOpacity style={styles.changeAvatarBtn} onPress={handleImageUpload}><Ionicons name="camera" size={16} color="#030712" /></TouchableOpacity>
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
              <Text style={styles.username}>@{profileData.username}</Text>
              {profileData.bio ? <View style={styles.bioRow}><View style={styles.bioAccent} /><Text style={styles.bio}>{profileData.bio}</Text></View> : null}
              <View style={styles.metaRow}>
                <View style={styles.joinedDate}><Ionicons name="calendar-outline" size={13} color="rgba(255,255,255,0.4)" /><Text style={styles.joinedText}> Joined {profileData.joinDate}</Text></View>
              </View>
              <View style={styles.actionButtons}>
                <TouchableOpacity style={styles.editProfileBtn} onPress={() => setIsEditing(true)}><Ionicons name="pencil" size={15} color="#030712" /><Text style={styles.editBtnText}> Edit Profile</Text></TouchableOpacity>
                <TouchableOpacity style={styles.shareBtn} onPress={handleShareProfile}><Ionicons name="share-social" size={16} color="#ffae00" /></TouchableOpacity>
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
            <View style={styles.recentGrid}>
              {recentlyWatched.slice(0, 5).map((anime, i) => {
                const norm = normalizeAnime(anime);
                if (!norm) return null;
                if (i === 0) {
                  return <AnimeCardPremium key={i} anime={norm} index={i} onPress={fetchAnimeDetails} isBanner />;
                }
                return (
                  <View key={i} style={styles.gridHalf}>
                    <AnimeCardPremium anime={norm} index={i} onPress={fetchAnimeDetails} isGrid />
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyState}><Text style={styles.emptyText}>No recently watched anime yet.</Text></View>
          )}

          {/* Favorites Grid */}
          <Text style={styles.sectionTitle}>Favorite Anime</Text>
          {favoriteAnime.length > 0 ? (
            <View style={styles.gridContainer}>
              {favoriteAnime.map((anime, i) => {
                const norm = normalizeAnime(anime);
                if (!norm) return null;
                return (
                  <View key={i} style={styles.gridHalf}>
                    <AnimeCardPremium anime={norm} index={i} onPress={fetchAnimeDetails} isGrid />
                  </View>
                );
              })}
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
          <View style={styles.versionFooter}>
            <Text style={styles.versionText}>OtakuShelf v{APP_VERSION}</Text>
            <Text style={styles.buildText}>Build {BUILD_DATE} • Stable</Text>
          </View>
          <View style={{ height: 130 }} />
        </View>
      </ScrollView>

      {/* ── Top scroll fade (ChatGPT style) ── */}
      <Animated.View style={[styles.scrollFade, { opacity: headerBgOpacityProfile }]} pointerEvents="none">
        <LinearGradient colors={['#030712', 'transparent']} style={StyleSheet.absoluteFill} />
      </Animated.View>

      <AnimeModal visible={detailsModalVisible} anime={selectedAnimeForDetails} onClose={() => setDetailsModalVisible(false)} onOpenAnime={(a) => fetchAnimeDetails(a)} />

      <BottomNav navigation={navigation} activeRoute="Profile" />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#030712' },
  scrollFade: {
    position: 'absolute', top: 0, left: 0, right: 0,
    height: 170, zIndex: 200,
  },
  loadingContainer: { flex: 1, backgroundColor: '#030712', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#ff6b6b', marginTop: 10, fontSize: 16 },
  content: { flex: 1 },
  coverContainer: { height: 300, width: '100%', position: 'relative' }, // Fixed 300
  coverImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  coverGradient: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 150 },
  changeCoverBtn: { position: 'absolute', top: 50, right: 20, backgroundColor: 'rgba(0,0,0,0.6)', flexDirection: 'row', alignItems: 'center', padding: 8, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  changeCoverText: { color: '#fff', fontSize: 12, fontWeight: '600' },


  headerContent: { flexDirection: 'row', alignItems: 'flex-start', marginTop: -140, paddingHorizontal: 16, marginBottom: 20 },
  headerContentEditing: { flexDirection: 'column', alignItems: 'center', marginTop: -50 },

  avatarSection: { marginRight: 16, position: 'relative', marginBottom: 0 },
  avatarWrapper: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: 'rgba(255,174,0,0.5)', justifyContent: 'center', alignItems: 'center', backgroundColor: '#030712', shadowColor: "#ffae00", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8 },
  avatar: { width: 94, height: 94, borderRadius: 47 },
  placeholderAvatar: { backgroundColor: '#ffae00', justifyContent: 'center', alignItems: 'center' },
  placeholderAvatarText: { fontSize: 36, color: '#030712', fontWeight: 'bold' },
  changeAvatarBtn: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#ffae00', width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#030712', shadowColor: "#ffae00", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 8, elevation: 6 },

  profileInfo: { flex: 1, flexShrink: 1, alignItems: 'flex-start', paddingTop: 6 },
  name: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 1, textAlign: 'left', letterSpacing: 0.3 },
  username: { fontSize: 13, color: '#ffae00', marginBottom: 8, textAlign: 'left', fontWeight: '600' },
  bioRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10, marginRight: 4 },
  bioAccent: { width: 3, height: '100%', backgroundColor: '#ffae00', borderRadius: 2, marginRight: 10, minHeight: 20 },
  bio: { fontSize: 13, color: 'rgba(255,255,255,0.75)', textAlign: 'left', lineHeight: 19, flex: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  joinedDate: { flexDirection: 'row', alignItems: 'center' },
  joinedText: { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginLeft: 4 },

  actionButtons: { flexDirection: 'row', gap: 8, width: '100%', justifyContent: 'flex-start' },
  editProfileBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffae00', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, justifyContent: 'center' },
  editBtnText: { color: '#030712', fontWeight: '700', fontSize: 13 },
  shareBtn: { width: 36, height: 36, borderRadius: 10, borderWidth: 1.5, borderColor: 'rgba(255,174,0,0.3)', justifyContent: 'center', alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 15 },

  mainContainer: { paddingHorizontal: 20, marginTop: 20 },
  sectionTitle: { fontSize: 22, fontWeight: 'bold', color: '#fff', marginBottom: 20, marginTop: 10, borderLeftWidth: 4, borderLeftColor: '#4ecdc4', paddingLeft: 10 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, marginBottom: 30 },
  statCard: { width: (width - 52) / 2, backgroundColor: 'rgba(255,255,255,0.05)', padding: 15, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center' },
  statNumber: { fontSize: 24, fontWeight: 'bold', color: '#ff6b6b', marginBottom: 5 },
  statLabel: { fontSize: 12, color: 'rgba(255,255,255,0.6)', textAlign: 'center' },

  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 14, columnGap: 14 },
  recentGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 14, columnGap: 14 },
  gridHalf: { width: (width - 40 - 14) / 2 },

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
  legendText: { color: '#fff', fontSize: 12, flex: 1, marginRight: 4 },
  legendPercent: { color: '#ff6b6b', fontSize: 12, fontWeight: 'bold' },
  emptyChart: { alignItems: 'center', justifyContent: 'center', height: 200 },
  emptyChartText: { color: 'rgba(255,255,255,0.4)', marginTop: 10 },

  editForm: { width: '90%', alignSelf: 'center', paddingHorizontal: 10, backgroundColor: '#030712', paddingVertical: 20, borderRadius: 16, marginTop: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  label: { color: '#fff', fontWeight: '600', marginBottom: 8, marginTop: 15 },
  input: { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 15, color: '#fff', fontSize: 16 },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  editActions: { flexDirection: 'row', gap: 15, marginTop: 30 },
  saveBtn: { flex: 1, backgroundColor: '#4ecdc4', padding: 16, borderRadius: 12, alignItems: 'center' },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', padding: 16, borderRadius: 12, alignItems: 'center' },

  emptyState: { padding: 30, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12, alignItems: 'center', marginBottom: 30 },
  emptyText: { color: 'rgba(255,255,255,0.5)' },
  versionFooter: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
    marginBottom: 20,
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  versionText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'OutfitRegular',
    letterSpacing: 0.8,
  },
  buildText: {
    color: 'rgba(255, 255, 255, 0.25)',
    fontSize: 10,
    marginTop: 4,
    fontFamily: 'JosefinSans',
    letterSpacing: 0.5,
  }
});

export default ProfileScreen;