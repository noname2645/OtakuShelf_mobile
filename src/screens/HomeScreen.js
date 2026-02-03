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
  PanResponder,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import axios from 'axios';
import BottomNavBar from '../components/BottomNav';
import AnimeModal from '../components/AnimeModal';

const { width, height } = Dimensions.get('window');
const isMobile = width <= 768;
const HERO_HEIGHT = height * 0.85;

// API Configuration
const API_BASE_URL = process.env.API_BASE_URL || 'https://otakushelf-uuvw.onrender.com';

// Card dimensions - match web exactly
const CARD_WIDTH = isMobile ? (width - 60) / 2 : Math.floor((width - 100) / 4);
const CARD_HEIGHT = CARD_WIDTH * 1.45; // Match web aspect ratio
const FONT_REGULAR = 'BricolageGrotesque_400Regular';

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
          marginBottom: 25,
          animationDelay: `${index * 0.03}s`,
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
          {/* Image - No top space */}
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

          {/* Gradient fade from below - matches web exactly */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.8)', 'rgba(0,0,0,0.95)']}
            locations={[0, 0.3, 0.7, 1]}
            style={styles.gradientOverlay}
          />

          {/* Title overlay - matches web card-title-bottom */}
          <View style={styles.titleOverlay}>
            <Text style={styles.cardTitle} numberOfLines={2}>
              {anime?.title || 'Loading...'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

// ========== TRAILER HERO WITH EXACT CONTENT OVERLAY ==========
const TrailerHero = React.memo(({ onOpenModal, featuredAnime, onSwipeUp }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(0)).current;
  const autoSlideRef = useRef(null);

  const currentAnime = useMemo(() =>
    featuredAnime[currentIndex] || featuredAnime[0]
    , [featuredAnime, currentIndex]);

  const animateToIndex = useCallback((nextIndex) => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) return;
      setCurrentIndex(nextIndex);
    });
  }, [fadeAnim]);

  // Animation effects
  useEffect(() => {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [currentIndex]);

  useEffect(() => {
    contentAnim.setValue(0);
    Animated.spring(contentAnim, {
      toValue: 1,
      tension: 50,
      friction: 7,
      useNativeDriver: true,
    }).start();
  }, [currentIndex]);

  // Auto-slide effect
  useEffect(() => {
    if (featuredAnime.length > 1) {
      autoSlideRef.current = setInterval(() => {
        const nextIndex = (currentIndex + 1) % featuredAnime.length;
        animateToIndex(nextIndex);
      }, 10000);
      return () => clearInterval(autoSlideRef.current);
    }
  }, [featuredAnime, currentIndex, animateToIndex]);

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gesture) =>
      Math.abs(gesture.dx) > 10 || Math.abs(gesture.dy) > 10,
    onPanResponderRelease: (_, gesture) => {
      const threshold = 50;
      const isVertical = Math.abs(gesture.dy) > Math.abs(gesture.dx);
      if (isVertical && gesture.dy <= -threshold) {
        if (onSwipeUp) onSwipeUp();
        return;
      }
      if (gesture.dx <= -threshold) {
        const nextIndex = (currentIndex + 1) % featuredAnime.length;
        animateToIndex(nextIndex);
      } else if (gesture.dx >= threshold) {
        const prevIndex = currentIndex === 0
          ? featuredAnime.length - 1
          : currentIndex - 1;
        animateToIndex(prevIndex);
      }
    },
  }), [currentIndex, featuredAnime.length, animateToIndex, onSwipeUp]);

  // Helper functions from TrailerHero.jsx
  const getAnimeTitle = (anime) => {
    if (anime?.title?.english) return anime.title.english;
    if (anime?.title?.romaji) return anime.title.romaji;
    if (anime?.title?.native) return anime.title.native;
    if (typeof anime?.title === 'string') return anime.title;
    if (anime?.title_english) return anime.title_english;
    if (anime?.title_romaji) return anime.title_romaji;
    return anime?.title || 'Unknown Title';
  };

  const getAnimeDescription = (anime) => {
    return anime?.description || anime?.synopsis || 'No description available.';
  };

  const truncateDescription = (description) => {
    if (!description) return "No description available.";
    const cleanText = description
      .replace(/<[^>]*>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .trim();

    const maxLength = isMobile ? 180 : 250;
    return cleanText.length > maxLength
      ? cleanText.substring(0, maxLength) + "..."
      : cleanText;
  };

  const formatGenres = (genres) => {
    if (!genres || genres.length === 0) return "Unknown";
    const maxGenres = isMobile ? 2 : 3;
    return genres.slice(0, maxGenres).join(" • ");
  };

  const getStatusColor = (status) => {
    if (!status) return '#757575';
    switch (status.toLowerCase()) {
      case 'releasing': return '#4CAF50';
      case 'not_yet_released':
      case 'not_yet_aired': return '#FF9800';
      case 'finished': return '#2196F3';
      default: return '#757575';
    }
  };

  const getStatusText = (status) => {
    if (!status) return 'Unknown';
    return status.replace(/_/g, ' ');
  };


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

  const imageUrl = currentAnime?.coverImage?.extraLarge ||
    currentAnime?.coverImage?.large ||
    currentAnime?.bannerImage ||
    `https://picsum.photos/${width}/400?random=hero`;

  const hasTrailer = currentAnime?.trailer?.id || currentAnime?.trailer?.embed_url;

  return (
    <Animated.View
      style={[styles.trailerHeroContainer, { opacity: fadeAnim }]}
      {...panResponder.panHandlers}
    >
      {/* Hero Image */}
      <Image
        source={{ uri: imageUrl }}
        style={styles.heroImage}
        resizeMode="cover"
      />

      {/* Gradient Overlay - matches web exactly */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.2)', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.85)']}
        locations={[0.3, 0.5, 0.7, 1]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 0, y: 1 }}
        style={styles.heroGradientOverlay}
      />

      {/* Bottom fade to blend into content */}
      <LinearGradient
        colors={['rgba(10,17,36,0)', 'rgba(10,17,36,0.7)', 'rgba(10,17,36,1)']}
        locations={[0, 0.6, 1]}
        style={styles.heroBottomFade}
        pointerEvents="none"
      />


      {/* Content Overlay - Exact match from web */}
      <Animated.View
        style={[
          styles.contentOverlay,
          {
            transform: [
              {
                translateY: contentAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [isMobile ? 50 : 100, 0]
                })
              }
            ],
            opacity: contentAnim
          }
        ]}
      >
        {/* Anime Title */}
        <Text style={styles.animeTitle} numberOfLines={2}>
          {getAnimeTitle(currentAnime)}
        </Text>

        {/* Anime Meta Information */}
        <View style={styles.animeMeta}>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(currentAnime.status) }]}>
            <Text style={styles.statusBadgeText}>{getStatusText(currentAnime.status)}</Text>
          </View>
          <Text style={styles.metaText}>{currentAnime.seasonYear || currentAnime.year || 'TBA'}</Text>
          {currentAnime.episodes && (
            <>
              <Text style={styles.metaSeparator}>•</Text>
              <Text style={styles.metaText}>{currentAnime.episodes} Episodes</Text>
            </>
          )}
          {currentAnime.averageScore && (
            <>
              <Text style={styles.metaSeparator}>•</Text>
              <Text style={styles.score}>⭐ {(currentAnime.averageScore / 10).toFixed(1)}/10</Text>
            </>
          )}
        </View>

        {/* Anime Description */}
        <Text style={styles.animeDescription} numberOfLines={4}>
          {truncateDescription(getAnimeDescription(currentAnime))}
        </Text>

        {/* Genres */}
        {currentAnime.genres && currentAnime.genres.length > 0 && (
          <Text style={styles.genres} numberOfLines={1}>
            <Text style={styles.genresLabel}>Genres: </Text>
            {formatGenres(currentAnime.genres)}
          </Text>
        )}

        {/* Details Button */}
        <TouchableOpacity
          style={styles.detailsButton}
          onPress={() => onOpenModal(currentAnime)}
          activeOpacity={0.8}
        >
          <MaterialIcons name="play-circle-outline" size={isMobile ? 20 : 24} color="#000" />
          <Text style={styles.detailsButtonText}>More Details</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Navigation Arrows
      {featuredAnime.length > 1 && (
        <View style={styles.sliderBtns}>
          <TouchableOpacity
            style={styles.sliderBtn}
            onPress={() => setCurrentIndex(prev => prev === 0 ? featuredAnime.length - 1 : prev - 1)}
          >
            <MaterialIcons name="arrow-back-ios" size={24} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.sliderBtn}
            onPress={() => setCurrentIndex(prev => (prev + 1) % featuredAnime.length)}
          >
            <MaterialIcons name="arrow-forward-ios" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      )} */}

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
              activeOpacity={0.7}
            />
          ))}
        </View>
      )}
    </Animated.View>
  );
});

// ========== DIVIDER ==========
const SectionDivider = React.memo(({ text }) => (
  <View style={styles.dividerContainer}>
    <View style={styles.dividerLine} />
    <View style={styles.dividerTextContainer}>
      <Text style={styles.dividerText}>{text}</Text>
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
  const [networkError, setNetworkError] = useState(null);
  const [heroTouchable, setHeroTouchable] = useState(true);

  // Refs
  const searchTimeoutRef = useRef(null);
  const scrollRef = useRef(null);
  const heroSwipeFade = useRef(new Animated.Value(0)).current;
  const scrollY = useRef(new Animated.Value(0)).current;

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
      seasonYear: anime.seasonYear || anime.year,
      season: anime.season,
      format: anime.format,
      trailer: anime.trailer,
    };
  }, []);

  // Fetch anime sections from API
  const fetchAnimeSections = useCallback(async () => {
    try {
      setNetworkError(null);

      const url = `${API_BASE_URL}/api/anime/anime-sections`;
      const maxRetries = 3;
      const retryDelayMs = 1500;

      let response = null;
      for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
        try {
          response = await axios.get(url, { timeout: 15000 });
          break;
        } catch (err) {
          if (attempt === maxRetries) throw err;
          await new Promise(resolve => setTimeout(resolve, retryDelayMs * attempt));
        }
      }

      const data = response.data;

      setSections({
        topAiring: (data.topAiring || []).map(normalizeAnime).filter(Boolean).slice(0, 12),
        mostWatched: (data.mostWatched || []).map(normalizeAnime).filter(Boolean).slice(0, 12),
        topMovies: (data.topMovies || []).map(normalizeAnime).filter(Boolean).slice(0, 12),
      });

    } catch (error) {
      console.error('Error fetching anime sections:', error);
      setNetworkError('Unable to reach the server. Showing offline data.');

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
          description: `This is ${prefix.toLowerCase()} anime number ${i + 1} with an interesting plot. This anime features amazing characters and an engaging storyline that will keep you hooked from start to finish.`,
          episodes: Math.floor(Math.random() * 24) + 1,
          averageScore: Math.floor(Math.random() * 30) + 70,
          status: ['releasing', 'finished', 'not_yet_released'][Math.floor(Math.random() * 3)],
          genres: ['Action', 'Fantasy', 'Adventure', 'Drama', 'Comedy', 'Sci-Fi'].slice(0, Math.floor(Math.random() * 4) + 1),
          year: 2023,
          seasonYear: 2023,
          trailer: Math.random() > 0.5 ? { id: 'dQw4w9WgXcQ' } : null,
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
          description: `This anime matches your search for "${text}" with an amazing storyline and characters that you will love.`,
          episodes: Math.floor(Math.random() * 24) + 1,
          averageScore: Math.floor(Math.random() * 30) + 60,
          status: 'releasing',
          genres: ['Action', 'Adventure', 'Fantasy'],
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
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent={true}
      />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>OtakuShelf</Text>
      </View>

      {/* Main Content */}
      <Animated.ScrollView
        ref={scrollRef}
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
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          {
            useNativeDriver: true,
            listener: (event) => {
              const y = event.nativeEvent.contentOffset.y;
              // Disable hero hit-testing once content scrolls under it
              setHeroTouchable(y < 40);
            },
          }
        )}
        scrollEventThrottle={16}
      >
        {/* Hero Spacer */}
        <View style={styles.heroSpacer} />

        {/* Network Error Banner */}
        {networkError && (
          <View style={styles.networkBanner}>
            <Ionicons name="cloud-offline" size={16} color="#fff" />
            <Text style={styles.networkBannerText}>{networkError}</Text>
          </View>
        )}

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
      </Animated.ScrollView>

      {/* Hero Overlay */}
      <Animated.View
        pointerEvents={heroTouchable ? 'box-none' : 'none'}
        style={[
          styles.heroOverlay,
          {
            opacity: Animated.multiply(
              scrollY.interpolate({
                inputRange: [0, 200],
                outputRange: [1, 0],
                extrapolate: 'clamp',
              }),
              Animated.subtract(1, heroSwipeFade)
            ),
          },
        ]}
      >
        <TrailerHero
          onOpenModal={openModal}
          onSwipeUp={() => {
            heroSwipeFade.setValue(0);
            Animated.timing(heroSwipeFade, {
              toValue: 1,
              duration: 240,
              useNativeDriver: true,
            }).start(() => {
              setTimeout(() => heroSwipeFade.setValue(0), 400);
            });
            if (scrollRef.current) {
              scrollRef.current.scrollTo({ y: HERO_HEIGHT - 40, animated: true });
            }
          }}
          featuredAnime={sections.topAiring.slice(0, 5)}
        />
      </Animated.View>

      <AnimeModal
        visible={modalVisible}
        anime={selectedAnime}
        onClose={closeModal}
      />

      <BottomNavBar />
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
    fontFamily: FONT_REGULAR,
  },

  // Header
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingTop: 0,
    paddingBottom: 0,
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
  },

  logo: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 45,
    fontFamily: FONT_REGULAR,
  },

  // Scroll View
  scrollView: {
    flex: 1,
  },

  content: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },

  networkBanner: {
    marginHorizontal: 20,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 89, 0, 0.2)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  networkBannerText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },

  // ========== TRAILER HERO STYLES ==========
  trailerHeroContainer: {
    height: HERO_HEIGHT,
    marginBottom: 24,
    position: 'relative',
    overflow: 'hidden',
  },
  heroOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: HERO_HEIGHT,
    zIndex: 5,
  },
  heroSpacer: {
    height: HERO_HEIGHT,
  },

  heroImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },

  heroGradientOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  heroBottomFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -20,
    height: 140,
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
    fontFamily: FONT_REGULAR,
  },

  // Content Overlay (Exact match from web)
  contentOverlay: {
    position: 'absolute',
    bottom: isMobile ? '10%' : '20%',
    left: isMobile ? '3%' : '10%',
    right: isMobile ? '3%' : '10%',
    maxWidth: 600,
  },

  animeTitle: {
    fontSize: isMobile ? 28 : 40,
    fontWeight: '900',
    color: '#fff',
    marginBottom: 8,
    lineHeight: isMobile ? 34 : 48,
    letterSpacing: 0.5,
    fontFamily: FONT_REGULAR,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },

  animeMeta: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },

  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginRight: 6,
  },

  statusBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    fontFamily: FONT_REGULAR,
  },

  metaText: {
    fontSize: isMobile ? 13 : 15,
    color: '#fff',
    fontWeight: '500',
    fontFamily: FONT_REGULAR,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },

  metaSeparator: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    marginHorizontal: 4,
  },

  score: {
    fontSize: isMobile ? 13 : 15,
    color: '#FFD700',
    fontWeight: '600',
    fontFamily: FONT_REGULAR,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },

  animeDescription: {
    fontSize: isMobile ? 14 : 16,
    color: '#fff',
    lineHeight: isMobile ? 20 : 24,
    marginBottom: 12,
    fontFamily: FONT_REGULAR,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },

  genres: {
    fontSize: isMobile ? 13 : 15,
    color: '#ddd',
    marginBottom: 20,
    fontFamily: FONT_REGULAR,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },

  genresLabel: {
    color: '#fff',
    fontWeight: '600',
    fontFamily: FONT_REGULAR,
  },

  detailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#ff7300',
    paddingHorizontal: isMobile ? 24 : 32,
    paddingVertical: isMobile ? 14 : 16,
    borderRadius: 25,
    alignSelf: 'flex-start',
    minWidth: isMobile ? 140 : 160,
    minHeight: 44,
  },

  detailsButtonText: {
    fontSize: isMobile ? 15 : 17,
    fontWeight: '700',
    color: '#000',
    textTransform: 'uppercase',
    fontFamily: FONT_REGULAR,
  },

  
  // Dots Indicator
  dotsContainer: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
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
    marginTop: 16,
    marginBottom: 16,
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
    fontFamily: 'SN Pro',
  },

  // Grid
  gridContainer: {
    paddingBottom: 10,
  },
  gridRow: {
    justifyContent: 'space-between',
  },

  // Anime Card - UPDATED to match web version exactly
  animeCardContainer: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'beige',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
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
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 20,
  },
  imagePlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
  // Gradient fade from below - matches web exactly
  gradientOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '40%',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  // Title overlay - matches web card-title-bottom
  titleOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 8,
    paddingBottom: 12,
    paddingHorizontal: 10,
    backgroundColor: 'transparent',
    zIndex: 1,
  },
  cardTitle: {
    fontFamily: 'Outfit',
    fontWeight: '600',
    letterSpacing: 1,
    fontSize: isMobile ? 14 : 16,
    textAlign: 'center',
    lineHeight: isMobile ? 20 : 22,
    color: '#ff6a00',
    textShadowColor: 'rgba(190, 79, 0, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
    includeFontPadding: true,
    textAlignVertical: 'center',
    padding: 0,
    margin: 0,
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
    fontFamily: FONT_REGULAR,
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
    fontFamily: FONT_REGULAR,
  },

  // No Data
  noDataContainer: {
    padding: 40,
    alignItems: 'center',
  },
  noDataText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 16,
    fontFamily: FONT_REGULAR,
  },

});

export default HomeScreen;
