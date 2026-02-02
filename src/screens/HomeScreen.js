import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import AnimeModal from '../components/AnimeModal';
import BottomNav from '../components/BottomNav';

const { width, height } = Dimensions.get('window');
const CARD_WIDTH = width * 0.4;
const CARD_HEIGHT = CARD_WIDTH * 1.5;

const AnimeCard = React.memo(({ anime, onPress }) => {
  const imageUrl = anime.coverImage?.extraLarge || 
                   anime.coverImage?.large || 
                   anime.bannerImage || 
                   'https://via.placeholder.com/300x450';

  return (
    <TouchableOpacity 
      style={styles.animeCard} 
      onPress={() => onPress(anime)}
      activeOpacity={0.8}
    >
      <Image
        source={{ uri: imageUrl }}
        style={styles.cardImage}
        resizeMode="cover"
      />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.9)']}
        style={styles.cardGradient}
      >
        <Text style={styles.cardTitle} numberOfLines={2}>
          {anime.title}
        </Text>
      </LinearGradient>
    </TouchableOpacity>
  );
});

const HomeScreen = ({ navigation }) => {
  const { API } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mostWatched, setMostWatched] = useState([]);
  const [topMovies, setTopMovies] = useState([]);
  const [topAiring, setTopAiring] = useState([]);
  const [selectedAnime, setSelectedAnime] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  const normalizeGridAnime = useCallback((anime) => {
    if (!anime) return null;

    return {
      id: anime.id || anime.mal_id || Math.random().toString(36).substr(2, 9),
      idMal: anime.idMal || anime.mal_id,
      title: anime.title?.english || anime.title?.romaji || anime.title?.native || anime.title || "Unknown Title",
      coverImage: {
        large: anime.coverImage?.large || anime.image_url || anime.images?.jpg?.large_image_url,
        extraLarge: anime.coverImage?.extraLarge || anime.images?.jpg?.large_image_url,
        medium: anime.coverImage?.medium || anime.images?.jpg?.image_url
      },
      bannerImage: anime.bannerImage || anime.images?.jpg?.large_image_url,
      description: anime.description || anime.synopsis || null,
      episodes: anime.episodes || anime.episodes_count || anime.totalEpisodes || null,
      averageScore: anime.averageScore || anime.score || anime.rating || null,
      status: anime.status || anime.airing_status || null,
      genres: anime.genres || [],
      studios: anime.studios?.edges?.map(e => e.node.name) ||
              anime.studios?.map(s => s.name) ||
              anime.studios || [],
      startDate: anime.startDate || anime.aired?.from || null,
      endDate: anime.endDate || anime.aired?.to || null,
      isAdult: anime.isAdult || false,
      trailer: anime.trailer || null,
      format: anime.format || null,
      duration: anime.duration || null,
      popularity: anime.popularity || null,
      year: anime.year || anime.startDate?.year || null,
      season: anime.season || null,
      type: anime.type || anime.format || null,
      source: anime.source || null,
    };
  }, []);

  const fetchAnimeSections = async () => {
    try {
      const response = await axios.get(`${API}/api/anime/anime-sections`, {
        timeout: 10000
      });

      const data = response.data;
      const normalizedTopAiring = (data.topAiring || []).map(normalizeGridAnime).filter(Boolean);
      const normalizedMostWatched = (data.mostWatched || []).map(normalizeGridAnime).filter(Boolean);
      const normalizedTopMovies = (data.topMovies || []).map(normalizeGridAnime).filter(Boolean);

      setTopAiring(normalizedTopAiring);
      setMostWatched(normalizedMostWatched);
      setTopMovies(normalizedTopMovies);
    } catch (error) {
      console.error("Error fetching anime sections:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAnimeSections();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAnimeSections();
  }, []);

  const openModal = useCallback((anime) => {
    setSelectedAnime(anime);
    setModalVisible(true);
  }, []);

  const closeModal = useCallback(() => {
    setSelectedAnime(null);
    setModalVisible(false);
  }, []);

  const renderSection = (title, data) => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <FlatList
        data={data}
        renderItem={({ item }) => <AnimeCard anime={item} onPress={openModal} />}
        keyExtractor={(item, index) => `${title}-${item.id}-${index}`}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ff5900" />
        <Text style={styles.loadingText}>Loading anime...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#ff5900"
            colors={['#ff5900']}
          />
        }
      >
        {/* Header */}
        <LinearGradient
          colors={['#0a0f1e', '#161b2e']}
          style={styles.header}
        >
          <Text style={styles.headerTitle}>OtakuShelf</Text>
          <TouchableOpacity 
            style={styles.searchButton}
            onPress={() => navigation.navigate('Search')}
          >
            <Text style={styles.searchIcon}>🔍</Text>
          </TouchableOpacity>
        </LinearGradient>

        {/* Hero Section */}
        <View style={styles.heroSection}>
          <Image
            source={{ 
              uri: topAiring[0]?.bannerImage || topAiring[0]?.coverImage?.extraLarge || 
                   'https://via.placeholder.com/800x400' 
            }}
            style={styles.heroImage}
            resizeMode="cover"
          />
          <LinearGradient
            colors={['transparent', 'rgba(10,15,30,0.9)', '#0a0f1e']}
            style={styles.heroGradient}
          >
            <Text style={styles.heroTitle} numberOfLines={2}>
              {topAiring[0]?.title || 'Featured Anime'}
            </Text>
            <TouchableOpacity 
              style={styles.heroButton}
              onPress={() => topAiring[0] && openModal(topAiring[0])}
            >
              <Text style={styles.heroButtonText}>More Details</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>

        {/* Anime Sections */}
        {renderSection('TOP AIRING', topAiring)}
        {renderSection('MOST WATCHED', mostWatched)}
        {renderSection('TOP MOVIES', topMovies)}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom Navigation */}
      <BottomNav navigation={navigation} activeRoute="Home" />

      {/* Anime Modal */}
      <AnimeModal
        visible={modalVisible}
        anime={selectedAnime}
        onClose={closeModal}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0f1e',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0f1e',
  },
  loadingText: {
    color: '#fff',
    marginTop: 10,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  searchButton: {
    padding: 10,
  },
  searchIcon: {
    fontSize: 24,
  },
  heroSection: {
    height: height * 0.4,
    marginBottom: 20,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '80%',
    justifyContent: 'flex-end',
    padding: 20,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15,
  },
  heroButton: {
    backgroundColor: '#ff5900',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
    alignSelf: 'flex-start',
  },
  heroButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  section: {
    marginBottom: 25,
  },
  sectionHeader: {
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 1,
  },
  listContent: {
    paddingLeft: 20,
    paddingRight: 10,
  },
  animeCard: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    marginRight: 15,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1a1f2e',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
    justifyContent: 'flex-end',
    padding: 10,
  },
  cardTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default HomeScreen;