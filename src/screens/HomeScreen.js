import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  Animated,
  Platform,
  StatusBar,
  SafeAreaView,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import axios from 'axios';

const { width, height } = Dimensions.get('window');
const isMobile = width <= 768;

// API Configuration
const API_BASE_URL = process.env.API_BASE_URL || 'https://otakushelf-uuvw.onrender.com'; // For Android emulator

// Card dimensions
const CARD_WIDTH = isMobile ? (width - 60) / 2 : Math.floor((width - 100) / 4);
const CARD_HEIGHT = CARD_WIDTH * 1.5;

// ========== ANIME CARD COMPONENT ==========
const AnimeCard = React.memo(({ anime, onPress, index }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const imageUrl = useMemo(() => {
    if (anime?.coverImage?.extraLarge) return anime.coverImage.extraLarge;
    if (anime?.coverImage?.large) return anime.coverImage.large;
    if (anime?.bannerImage) return anime.bannerImage;
    return `https://picsum.photos/${CARD_WIDTH}/${CARD_HEIGHT}?random=${index}`;
  }, [anime, index]);

  useEffect(() => {
    const delay = Math.min(index * 30, 200);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      delay,
      useNativeDriver: true,
    }).start();
  }, []);

  const handlePressIn = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  }, []);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  }, []);

  const handlePress = useCallback(() => {
    if (anime) onPress(anime);
  }, [anime, onPress]);

  return (
    <Animated.View
      style={[
        styles.animeCardContainer,
        {
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
          width: CARD_WIDTH,
          height: CARD_HEIGHT,
          marginBottom: 20,
        }
      ]}
    >
      <TouchableOpacity 
        activeOpacity={1}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        style={styles.cardTouchable}
      >
        <View style={styles.cardInner}>
          {/* Image */}
          <Image
            source={{ uri: imageUrl }}
            style={styles.cardImage}
            resizeMode="cover"
            onLoadStart={() => setImageLoaded(false)}
            onLoadEnd={() => setImageLoaded(true)}
          />
          
          {/* Loading Placeholder */}
          {!imageLoaded && (
            <View style={styles.imagePlaceholder}>
              <ActivityIndicator size="small" color="#ff6b6b" />
            </View>
          )}

          {/* Title Overlay */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.8)', 'rgba(0,0,0,0.95)']}
            style={styles.titleGradient}
          >
            <Text style={styles.cardTitle} numberOfLines={2}>
              {anime?.title || 'Loading...'}
            </Text>
          </LinearGradient>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

// ========== TRAILER HERO ==========
const TrailerHero = React.memo(({ onOpenModal, featuredAnime }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const currentAnime = useMemo(() => 
    featuredAnime[currentIndex] || featuredAnime[0]
  , [featuredAnime, currentIndex]);

  useEffect(() => {
    if (featuredAnime.length > 1) {
      const interval = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % featuredAnime.length);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [featuredAnime]);

  if (!featuredAnime || featuredAnime.length === 0) {
    return (
      <View style={styles.heroContainer}>
        <View style={styles.heroPlaceholder}>
          <ActivityIndicator size="large" color="#ff5900" />
          <Text style={styles.heroPlaceholderText}>Loading featured anime...</Text>
        </View>
      </View>
    );
  }

  const imageUrl = currentAnime?.bannerImage || 
                   currentAnime?.coverImage?.extraLarge || 
                   `https://picsum.photos/${width}/400?random=hero`;

  return (
    <View style={styles.heroContainer}>
      <Image
        source={{ uri: imageUrl }}
        style={styles.heroImage}
        resizeMode="cover"
      />
      
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.7)', 'rgba(0,0,0,0.9)']}
        style={styles.heroOverlay}
      />

      <View style={styles.heroContent}>
        <Text style={styles.heroTitle} numberOfLines={2}>
          {currentAnime?.title || 'Featured Anime'}
        </Text>
        
        {currentAnime?.averageScore && (
          <View style={styles.heroMeta}>
            <MaterialIcons name="star" size={20} color="#FFD700" />
            <Text style={styles.heroScore}>{(currentAnime.averageScore / 10).toFixed(1)}/10</Text>
          </View>
        )}

        <TouchableOpacity 
          style={styles.heroButton}
          onPress={() => onOpenModal(currentAnime)}
        >
          <MaterialIcons name="info-outline" size={20} color="#000" />
          <Text style={styles.heroButtonText}>More Details</Text>
        </TouchableOpacity>
      </View>

      {/* Dots Indicator */}
      {featuredAnime.length > 1 && (
        <View style={styles.dotsContainer}>
          {featuredAnime.slice(0, 5).map((_, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.dot,
                index === currentIndex && styles.activeDot
              ]}
              onPress={() => setCurrentIndex(index)}
            />
          ))}
        </View>
      )}
    </View>
  );
});

// ========== DIVIDER ==========
const SectionDivider = React.memo(({ title }) => (
  <View style={styles.dividerContainer}>
    <View style={styles.dividerLine} />
    <View style={styles.dividerTextContainer}>
      <Text style={styles.dividerText}>{title}</Text>
    </View>
    <View style={styles.dividerLine} />
  </View>
));

// ========== MAIN HOMESCREEN COMPONENT ==========
const HomeScreen = ({ navigation }) => {
  // State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sections, setSections] = useState({
    topAiring: [],
    mostWatched: [],
    topMovies: [],
  });
  const [selectedAnime, setSelectedAnime] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // Refs
  const searchTimeoutRef = useRef(null);

  // Normalize anime data from API
  const normalizeAnime = useCallback((anime) => {
    if (!anime) return null;
    
    return {
      id: anime.id || anime.malId || Math.random().toString(36).substr(2, 9),
      title: anime.title?.english || anime.title?.romaji || anime.title?.native || anime.title || "Unknown Title",
      coverImage: {
        large: anime.coverImage?.large || anime.image_url || anime.images?.jpg?.large_image_url,
        extraLarge: anime.coverImage?.extraLarge || anime.images?.jpg?.large_image_url,
      },
      bannerImage: anime.bannerImage || anime.images?.jpg?.large_image_url,
      description: anime.description || anime.synopsis,
      episodes: anime.episodes || anime.episodes_count || anime.totalEpisodes,
      averageScore: anime.averageScore || anime.score,
      status: anime.status || anime.airing_status,
      genres: anime.genres || [],
      year: anime.year || anime.startDate?.year,
      season: anime.season,
      format: anime.format,
    };
  }, []);

  // Fetch anime sections from API
  const fetchAnimeSections = useCallback(async () => {
    try {
      console.log('Fetching anime sections from:', `${API_BASE_URL}/api/anime/anime-sections`);
      
      const response = await axios.get(`${API_BASE_URL}/api/anime/anime-sections`, {
        timeout: 15000,
      });

    //   console.log('API Response:', response.data);

      const data = response.data;
      
      setSections({
        topAiring: (data.topAiring || []).map(normalizeAnime).filter(Boolean).slice(0, 12),
        mostWatched: (data.mostWatched || []).map(normalizeAnime).filter(Boolean).slice(0, 12),
        topMovies: (data.topMovies || []).map(normalizeAnime).filter(Boolean).slice(0, 12),
      });

    } catch (error) {
      console.error('Error fetching anime sections:', error);
      
      // Fallback mock data if API fails
      const mockAnime = (count, prefix) => 
        Array.from({ length: count }, (_, i) => ({
          id: i + 1,
          title: `${prefix} Anime ${i + 1}`,
          coverImage: { 
            extraLarge: `https://picsum.photos/${CARD_WIDTH}/${CARD_HEIGHT}?random=${prefix}-${i}`,
            large: `https://picsum.photos/${CARD_WIDTH}/${CARD_HEIGHT}?random=${prefix}-${i}`,
          },
          bannerImage: `https://picsum.photos/${width}/400?random=${prefix}-banner-${i}`,
          description: `This is ${prefix.toLowerCase()} anime number ${i + 1} with an interesting plot.`,
          episodes: Math.floor(Math.random() * 24) + 1,
          averageScore: Math.floor(Math.random() * 30) + 70,
          status: ['releasing', 'finished', 'not_yet_released'][Math.floor(Math.random() * 3)],
          genres: ['Action', 'Fantasy', 'Adventure', 'Drama'].slice(0, Math.floor(Math.random() * 3) + 1),
          year: 2023,
        })).map(normalizeAnime);

      setSections({
        topAiring: mockAnime(12, 'Top Airing'),
        mostWatched: mockAnime(12, 'Most Watched'),
        topMovies: mockAnime(12, 'Top Movies'),
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [normalizeAnime]);

  // Initial load
  useEffect(() => {
    fetchAnimeSections();
  }, []);

  // Refresh function
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAnimeSections();
  }, [fetchAnimeSections]);

  // Search function
  const handleSearch = useCallback((text) => {
    setSearchQuery(text);
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!text.trim()) {
      setIsSearching(false);
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    setSearchLoading(true);

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/api/anime/search`, {
          params: { q: text, limit: 12 }
        });
        
        const results = (response.data || []).map(normalizeAnime).filter(Boolean);
        setSearchResults(results);
      } catch (error) {
        console.error('Search error:', error);
        // Mock search results
        const mockResults = Array.from({ length: 8 }, (_, i) => ({
          id: i + 100,
          title: `Search Result ${i + 1} - "${text}"`,
          coverImage: { 
            extraLarge: `https://picsum.photos/${CARD_WIDTH}/${CARD_HEIGHT}?random=search-${i}`,
          },
          description: `This anime matches your search for "${text}"`,
          episodes: Math.floor(Math.random() * 24) + 1,
          averageScore: Math.floor(Math.random() * 30) + 60,
          status: 'releasing',
          genres: ['Action', 'Adventure'],
          year: 2023,
        })).map(normalizeAnime);
        setSearchResults(mockResults);
      } finally {
        setSearchLoading(false);
      }
    }, 500);
  }, [normalizeAnime]);

  // Modal functions
  const openModal = useCallback((anime) => {
    setSelectedAnime(anime);
    setModalVisible(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalVisible(false);
    setTimeout(() => setSelectedAnime(null), 300);
  }, []);

  // Render anime grid
  const renderAnimeGrid = useCallback((data) => {
    if (!data || data.length === 0) {
      return (
        <View style={styles.noDataContainer}>
          <Text style={styles.noDataText}>No anime found</Text>
        </View>
      );
    }

    return (
      <FlatList
        key={`grid-${isMobile ? 2 : 4}`}
        data={data}
        renderItem={({ item, index }) => (
          <AnimeCard 
            anime={item} 
            onPress={openModal} 
            index={index} 
          />
        )}
        keyExtractor={(item, index) => `anime-${item.id}-${index}`}
        numColumns={isMobile ? 2 : 4}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.gridContainer}
        columnWrapperStyle={styles.gridRow}
        initialNumToRender={6}
        maxToRenderPerBatch={8}
        windowSize={3}
      />
    );
  }, [openModal, isMobile]);

  // Loading state
  if (loading) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#ff5900" />
        <Text style={styles.loadingText}>Loading anime...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a1124" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>OtakuShelf</Text>
      </View>

      {/* Main Content */}
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#ff5900"
            colors={['#ff5900']}
          />
        }
      >
        {/* Hero Section */}
        <TrailerHero 
          onOpenModal={openModal} 
          featuredAnime={sections.topAiring.slice(0, 5)} 
        />

        {/* Search Results or Regular Sections */}
        <View style={styles.content}>
          {isSearching ? (
            searchLoading ? (
              <View style={styles.searchLoading}>
                <ActivityIndicator size="large" color="#4facfe" />
                <Text style={styles.searchingText}>Searching...</Text>
              </View>
            ) : searchResults.length > 0 ? (
              <>
                <SectionDivider text="SEARCH RESULTS" />
                {renderAnimeGrid(searchResults)}
              </>
            ) : (
              <View style={styles.noResults}>
                <Ionicons name="search-off" size={48} color="#666" />
                <Text style={styles.noResultsText}>
                  No results found for "{searchQuery}"
                </Text>
              </View>
            )
          ) : (
            <>
              {/* Top Airing */}
              {sections.topAiring.length > 0 && (
                <>
                  <SectionDivider text="TOP AIRING" />
                  {renderAnimeGrid(sections.topAiring)}
                </>
              )}

              {/* Most Watched */}
              {sections.mostWatched.length > 0 && (
                <>
                  <SectionDivider text="MOST WATCHED" />
                  {renderAnimeGrid(sections.mostWatched)}
                </>
              )}

              {/* Top Movies */}
              {sections.topMovies.length > 0 && (
                <>
                  <SectionDivider text="TOP MOVIES" />
                  {renderAnimeGrid(sections.topMovies)}
                </>
              )}
            </>
          )}
        </View>

        {/* Bottom padding */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        {['Home', 'List', 'Search', 'AI'].map((item) => (
          <TouchableOpacity
            key={item}
            style={[
              styles.navItem,
              item === 'Home' && styles.activeNavItem
            ]}
            onPress={() => navigation.navigate(item)}
          >
            <Ionicons
              name={item === 'Home' ? 'home' : 
                    item === 'List' ? 'list' : 
                    item === 'Search' ? 'search' : 'sparkles'}
              size={22}
              color={item === 'Home' ? '#ff5900' : '#888'}
            />
            <Text style={[
              styles.navText,
              item === 'Home' && styles.activeNavText
            ]}>
              {item}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Anime Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity style={styles.closeButton} onPress={closeModal}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            
            {selectedAnime && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Image
                  source={{ uri: selectedAnime.bannerImage || selectedAnime.coverImage?.extraLarge }}
                  style={styles.modalImage}
                  resizeMode="cover"
                />
                
                <View style={styles.modalInfo}>
                  <Text style={styles.modalTitle}>{selectedAnime.title}</Text>
                  
                  <View style={styles.modalMeta}>
                    {selectedAnime.averageScore && (
                      <View style={styles.metaItem}>
                        <MaterialIcons name="star" size={18} color="#FFD700" />
                        <Text style={styles.metaText}>{(selectedAnime.averageScore / 10).toFixed(1)}/10</Text>
                      </View>
                    )}
                    
                    {selectedAnime.episodes && (
                      <View style={styles.metaItem}>
                        <MaterialIcons name="movie" size={18} color="#4ECDC4" />
                        <Text style={styles.metaText}>{selectedAnime.episodes} episodes</Text>
                      </View>
                    )}
                    
                    {selectedAnime.year && (
                      <View style={styles.metaItem}>
                        <MaterialIcons name="calendar-today" size={18} color="#FF6B6B" />
                        <Text style={styles.metaText}>{selectedAnime.year}</Text>
                      </View>
                    )}
                  </View>
                  
                  {selectedAnime.description && (
                    <Text style={styles.modalDescription}>
                      {selectedAnime.description}
                    </Text>
                  )}
                  
                  {selectedAnime.genres && selectedAnime.genres.length > 0 && (
                    <View style={styles.genresSection}>
                      <Text style={styles.sectionLabel}>Genres</Text>
                      <View style={styles.genresContainer}>
                        {selectedAnime.genres.slice(0, 6).map((genre, index) => (
                          <View key={index} style={styles.genreTag}>
                            <Text style={styles.genreText}>{genre}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

// ========== STYLES ==========
const styles = StyleSheet.create({
  // Container
  container: {
    flex: 1,
    backgroundColor: '#0a1124',
  },
  loadingScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a1124',
  },
  loadingText: {
    color: '#fff',
    marginTop: 12,
    fontSize: 16,
  },
  
  // Header
  header: {
    paddingTop: Platform.OS === 'ios' ? 10 : 20,
    paddingBottom: 16,
    paddingHorizontal: 16,
    backgroundColor: '#0a1124',
  },
  logo: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    marginLeft: 8,
    paddingVertical: 2,
  },
  
  // Scroll View
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  
  // Hero Section
  heroContainer: {
    height: 300,
    marginBottom: 24,
    position: 'relative',
  },
  heroPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
  },
  heroPlaceholderText: {
    color: '#fff',
    marginTop: 10,
    fontSize: 14,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  heroContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#fff',
    marginBottom: 10,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  heroMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  heroScore: {
    fontSize: 16,
    color: '#FFD700',
    fontWeight: '600',
    marginLeft: 6,
  },
  heroButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ff5900',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  heroButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000',
    marginLeft: 6,
  },
  dotsContainer: {
    position: 'absolute',
    bottom: 15,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    marginHorizontal: 4,
  },
  activeDot: {
    backgroundColor: '#ff5900',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  
  // Divider
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#ff5252',
  },
  dividerTextContainer: {
    paddingHorizontal: 15,
  },
  dividerText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ff6b6b',
    textAlign: 'center',
  },
  
  // Grid
  gridContainer: {
    paddingBottom: 10,
  },
  gridRow: {
    justifyContent: 'space-between',
  },
  
  // Anime Card
  animeCardContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1a1f2e',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  cardTouchable: {
    flex: 1,
  },
  cardInner: {
    flex: 1,
    position: 'relative',
  },
  cardImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  imagePlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  titleGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '40%',
    justifyContent: 'flex-end',
    paddingBottom: 8,
    borderRadius: 12,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ff6a00',
    textAlign: 'center',
    paddingHorizontal: 6,
    lineHeight: 16,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  
  // Search States
  searchLoading: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  searchingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 12,
  },
  noResults: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 50,
  },
  noResultsText: {
    color: '#aaa',
    fontSize: 16,
    marginTop: 15,
    textAlign: 'center',
  },
  
  // No Data
  noDataContainer: {
    padding: 40,
    alignItems: 'center',
  },
  noDataText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 16,
  },
  
  // Bottom Navigation
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: '#0a0f1e',
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 28 : 10,
    borderTopWidth: 1,
    borderTopColor: '#1a1f2e',
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
  },
  activeNavItem: {
    backgroundColor: 'rgba(255, 89, 0, 0.1)',
  },
  navText: {
    fontSize: 11,
    color: '#888',
    marginTop: 4,
  },
  activeNavText: {
    color: '#ff5900',
    fontWeight: '600',
  },
  
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxHeight: '85%',
    backgroundColor: '#1a1f2e',
    borderRadius: 16,
    overflow: 'hidden',
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImage: {
    width: '100%',
    height: 200,
  },
  modalInfo: {
    padding: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15,
  },
  modalMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 15,
    marginBottom: 20,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 15,
    color: '#ddd',
    fontWeight: '500',
  },
  modalDescription: {
    fontSize: 16,
    color: '#ddd',
    lineHeight: 1.5,
    marginBottom: 20,
  },
  genresSection: {
    marginTop: 10,
  },
  sectionLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 10,
  },
  genresContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  genreTag: {
    backgroundColor: '#ff5900',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  genreText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default HomeScreen;
