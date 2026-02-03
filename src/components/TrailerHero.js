import React, { useState, useEffect, useRef, memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Dimensions,
  Animated,
  ScrollView,
  Platform,
  StatusBar,
  SafeAreaView,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import { Ionicons, MaterialIcons, FontAwesome } from '@expo/vector-icons';
import YoutubePlayer from 'react-native-youtube-iframe';
import { useAuth } from '../contexts/AuthContext';

const { width, height } = Dimensions.get('window');
const isMobile = width <= 768;
const isSmallMobile = width <= 480;

// YouTube Player Wrapper Component
const YouTubePlayerWrapper = memo(({ 
  videoId, 
  isMuted, 
  isPlaying, 
  onPlayerReady, 
  onPlayerError,
  onStateChange 
}) => {
  const playerRef = useRef(null);

  if (!videoId) return null;

  return (
    <View style={styles.youtubeContainer}>
      <YoutubePlayer
        ref={playerRef}
        height={height}
        width={width}
        videoId={videoId}
        play={isPlaying}
        mute={isMuted}
        volume={isMuted ? 0 : 50}
        playbackRate={1}
        playerParams={{
          modestbranding: 1,
          rel: 0,
          showinfo: 0,
          controls: 0,
          fs: 0,
          iv_load_policy: 3,
          disablekb: 1,
          autoplay: 0,
          playsinline: 1,
          origin: 'http://localhost',
        }}
        webViewStyle={styles.youtubeWebView}
        webViewProps={{
          allowsFullscreenVideo: false,
          mediaPlaybackRequiresUserAction: false,
        }}
        onReady={onPlayerReady}
        onChangeState={onStateChange}
        onError={onPlayerError}
      />
    </View>
  );
});

// Main TrailerHero Component
const TrailerHero = ({ onOpenModal }) => {
  const { API } = useAuth();
  const [currentAnime, setCurrentAnime] = useState(0);
  const [opacity] = useState(new Animated.Value(1));
  const [isMuted, setIsMuted] = useState(true);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [playerError, setPlayerError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [announcements, setAnnouncements] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [safeAreaTop, setSafeAreaTop] = useState(0);
  const [safeAreaBottom, setSafeAreaBottom] = useState(0);

  const autoScrollRef = useRef(null);
  const scrollViewRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateYAnim = useRef(new Animated.Value(100)).current;

  // Detect safe areas
  useEffect(() => {
    setSafeAreaTop(Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 0);
    setSafeAreaBottom(Platform.OS === 'ios' ? 34 : 0);
  }, []);

  // Auto-scroll function
  const startAutoScroll = () => {
    if (autoScrollRef.current) {
      clearInterval(autoScrollRef.current);
    }

    if (announcements.length <= 1) return;

    autoScrollRef.current = setInterval(() => {
      setCurrentAnime(prev => (prev + 1) % announcements.length);
    }, 30000);
  };

  const getAnimeTitle = (anime) => {
    if (anime.title?.english) return anime.title.english;
    if (anime.title?.romaji) return anime.title.romaji;
    if (anime.title?.native) return anime.title.native;
    if (typeof anime.title === 'string') return anime.title;
    if (anime.title_english) return anime.title_english;
    if (anime.title_romaji) return anime.title_romaji;
    return anime.title || 'Unknown Title';
  };

  // Fetch with retry logic
  const fetchWithRetry = async (url, retries = 3, delay = 1000) => {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await axios.get(url, { timeout: 10000 });
        return response.data;
      } catch (error) {
        if (i === retries - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  };

  const getAnimeDescription = (anime) => {
    return anime.description || anime.synopsis || 'No description available.';
  };

  // Check if current anime has a trailer
  const hasTrailer = (anime) => {
    const videoId = getVideoId(anime);
    return !!videoId;
  };

  // Get clean video ID from trailer
  const getVideoId = (anime) => {
    if (anime.trailer?.site === "youtube" && anime.trailer?.id) {
      return anime.trailer.id;
    }
    if (anime.trailer?.embed_url) {
      const match = anime.trailer.embed_url.match(/(?:youtube\.com\/embed\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
      return match ? match[1] : null;
    }
    return null;
  };

  // Normalize hero anime data
  const normalizeHeroAnime = (anime) => {
    return {
      id: anime.id,
      animeId: anime.id,
      animeMalId: anime.idMal || null,
      title: {
        romaji: anime.title?.romaji || null,
        english: anime.title?.english || null,
        native: anime.title?.native || null,
      },
      coverImage: {
        extraLarge: anime.coverImage?.extraLarge || null,
        large: anime.coverImage?.large || null,
        medium: anime.coverImage?.medium || null,
      },
      bannerImage: anime.bannerImage || null,
      trailer: anime.trailer || null,
      description: anime.description || null,
      episodes: anime.episodes || null,
      averageScore: anime.averageScore || null,
      status: anime.status || null,
      seasonYear: anime.seasonYear || null,
      genres: anime.genres || [],
      isAdult: anime.isAdult || false,
      format: anime.format || null,
      startDate: anime.startDate || null,
      endDate: anime.endDate || null,
      shortDescription: anime.description ? anime.description.substring(0, 200) + '...' : null,
      ...anime,
    };
  };

  // Fetch announcements
  useEffect(() => {
    const fetchAnnouncements = async () => {
      if (announcements.length > 0) return;

      try {
        const data = await fetchWithRetry(`${API}/api/anilist/hero-trailers`);
        const sorted = data.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

        const normalizedAnnouncements = sorted
          .map(normalizeHeroAnime)
          .filter(anime => {
            const notTBA = anime.status?.toLowerCase() !== "not_yet_released" &&
              anime.status?.toLowerCase() !== "not_yet_aired";
            return notTBA;
          });

        setAnnouncements(normalizedAnnouncements.slice(0, 10));
      } catch (err) {
        console.error("Error fetching announcements after retries:", err);
      }
    };

    fetchAnnouncements();
  }, []);

  // Animate content in when anime changes
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(translateYAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, [currentAnime]);

  // Main effect for auto-advance
  useEffect(() => {
    // Start auto-scroll
    startAutoScroll();

    return () => {
      if (autoScrollRef.current) {
        clearInterval(autoScrollRef.current);
      }
    };
  }, [announcements]);

  // YouTube player event handlers
  const handlePlayerReady = () => {
    setIsPlayerReady(true);
    setPlayerError(false);
    
    if (hasUserInteracted) {
      setIsPlaying(true);
    }
  };

  const handlePlayerError = (error) => {
    console.error('YouTube Player Error:', error);
    setIsPlayerReady(false);
    setPlayerError(true);
  };

  const handleStateChange = (state) => {
    if (state === 'ended') {
      setIsPlaying(true); // Loop the video
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  // Handle user interaction
  const handleUserInteraction = () => {
    setHasUserInteracted(true);
    setIsPlaying(true);
  };

  // Mobile-optimized helper functions
  const formatGenres = (genres) => {
    if (!genres || genres.length === 0) return "Unknown";
    const maxGenres = isMobile ? 2 : 3;
    return genres.slice(0, maxGenres).map(g => g.name || g).join(" • ");
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
    
    const mobileMaxLength = isMobile ? 250 : 180;
    return cleanText.length > mobileMaxLength 
      ? cleanText.substring(0, mobileMaxLength) + "..." 
      : cleanText;
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'releasing': return '#4CAF50';
      case 'not_yet_released': return '#FF9800';
      case 'finished': return '#2196F3';
      default: return '#757575';
    }
  };

  // If no announcements, don't render
  const currentAnimeData = announcements[currentAnime];
  if (!currentAnimeData) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ff6b6b" />
        <Text style={styles.loadingText}>Loading featured anime...</Text>
      </View>
    );
  }

  const currentAnimeHasTrailer = hasTrailer(currentAnimeData);
  const videoId = getVideoId(currentAnimeData);
  const showNavigationArrows = announcements.length > 1 && !(isMobile && width < 400);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      
      <View style={[styles.trailerHeroSection, { paddingTop: safeAreaTop }]}>
        {/* YouTube Player or Fallback Image */}
        {currentAnimeHasTrailer && videoId && !playerError ? (
          <YouTubePlayerWrapper
            videoId={videoId}
            isMuted={isMuted}
            isPlaying={isPlaying && hasUserInteracted}
            onPlayerReady={handlePlayerReady}
            onPlayerError={handlePlayerError}
            onStateChange={handleStateChange}
          />
        ) : (
          <Image
            source={{ 
              uri: currentAnimeData.bannerImage || 
                   currentAnimeData.coverImage?.extraLarge || 
                   'https://via.placeholder.com/800x400'
            }}
            style={styles.fallbackImage}
            resizeMode="cover"
          />
        )}

        {/* User Interaction Prompt */}
        {currentAnimeHasTrailer && !hasUserInteracted && !playerError && (
          <TouchableOpacity 
            style={styles.userInteractionPrompt}
            onPress={handleUserInteraction}
          >
            <Text style={styles.interactionPromptText}>
              {isMobile ? 'Tap to play video' : 'Click anywhere to enable video'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Mute/Unmute Button */}
        {currentAnimeHasTrailer && isPlayerReady && !playerError && (
          <TouchableOpacity 
            onPress={toggleMute} 
            style={styles.muteButton}
          >
            <Text style={styles.muteButtonText}>
              {isMuted ? '🔇' : '🔊'}
            </Text>
          </TouchableOpacity>
        )}

        {/* No Trailer Indicator */}
        {!currentAnimeHasTrailer && (
          <View style={styles.noTrailerIndicator}>
            <Text style={styles.noTrailerText}>
              🎬 {isMobile ? 'No trailer' : 'No trailer available - displaying banner image'}
            </Text>
          </View>
        )}

        {/* Gradient Overlay */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.85)']}
          style={styles.gradientOverlay}
        />

        {/* Content Overlay */}
        <Animated.View
          style={[
            styles.contentOverlay,
            {
              opacity: fadeAnim,
              transform: [{ translateY: translateYAnim }],
              bottom: isMobile ? '22%' : '20%',
            },
          ]}
        >
          <Text style={styles.animeTitle} numberOfLines={2}>
            {getAnimeTitle(currentAnimeData)}
          </Text>

          <View style={styles.animeMeta}>
            <View 
              style={[
                styles.statusBadge, 
                { backgroundColor: getStatusColor(currentAnimeData.status) }
              ]}
            >
              <Text style={styles.statusText}>
                {currentAnimeData.status?.replace(/_/g, ' ') || 'Unknown'}
              </Text>
            </View>
            
            <Text style={styles.metaText}>{currentAnimeData.seasonYear || 'TBA'}</Text>
            
            {currentAnimeData.episodes && (
              <>
                <Text style={styles.metaSeparator}>•</Text>
                <Text style={styles.metaText}>{currentAnimeData.episodes} Episodes</Text>
              </>
            )}
            
            {currentAnimeData.averageScore && (
              <>
                <Text style={styles.metaSeparator}>•</Text>
                <Text style={styles.scoreText}>
                  ⭐ {(currentAnimeData.averageScore) / 10}/10
                </Text>
              </>
            )}
          </View>

          <Text style={styles.animeDescription} numberOfLines={4}>
            {truncateDescription(getAnimeDescription(currentAnimeData))}
          </Text>

          <View style={styles.genresContainer}>
            <Text style={styles.genresLabel}>Genres:</Text>
            <Text style={styles.genresText}>
              {formatGenres(currentAnimeData.genres)}
            </Text>
          </View>

          <TouchableOpacity 
            onPress={() => onOpenModal(currentAnimeData)} 
            style={[
              styles.detailsButton,
              { width: isMobile ? '100%' : 'auto' }
            ]}
          >
            <Ionicons name="information-circle-outline" size={isMobile ? 18 : 20} color="#000" />
            <Text style={styles.detailsButtonText}>More Details</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Navigation Arrows */}
        {showNavigationArrows && (
          <View style={styles.sliderButtons}>
            <TouchableOpacity
              style={styles.sliderButton}
              onPress={() => setCurrentAnime(prev => prev === 0 ? announcements.length - 1 : prev - 1)}
            >
              <Ionicons name="chevron-back" size={24} color="#ff5900" />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.sliderButton, styles.rightSliderButton]}
              onPress={() => setCurrentAnime(prev => (prev + 1) % announcements.length)}
            >
              <Ionicons name="chevron-forward" size={24} color="#ff5900" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Trailer Spacer */}
      <View style={[styles.trailerSpacer, { height: height - safeAreaTop - safeAreaBottom }]} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a1124',
  },
  loadingContainer: {
    height: height * 0.6,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a1124',
  },
  loadingText: {
    color: '#fff',
    marginTop: 10,
    fontSize: 16,
  },
  trailerHeroSection: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: height,
    zIndex: 3,
  },
  youtubeContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    zIndex: -1,
  },
  youtubeWebView: {
    backgroundColor: '#000',
  },
  fallbackImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    zIndex: -1,
  },
  userInteractionPrompt: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -width * 0.4 }, { translateY: -25 }],
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    padding: 15,
    borderRadius: 12,
    zIndex: 3,
    width: width * 0.8,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 115, 0, 0.5)',
  },
  interactionPromptText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  muteButton: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  muteButtonText: {
    fontSize: 20,
    color: '#fff',
  },
  noTrailerIndicator: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 8,
    borderRadius: 8,
    zIndex: 2,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    maxWidth: width * 0.5,
  },
  noTrailerText: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'center',
  },
  gradientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    zIndex: 1,
  },
  contentOverlay: {
    position: 'absolute',
    left: isMobile ? '3%' : '10%',
    right: isMobile ? '3%' : '10%',
    zIndex: 2,
    maxWidth: 600,
    padding: 16,
  },
  animeTitle: {
    fontFamily: 'Outfit',
    fontSize: isMobile ? 28 : 40,
    fontWeight: '900',
    marginBottom: 12,
    lineHeight: 1.2,
    color: '#ff003c',
    letterSpacing: 1,
  },
  animeMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
    textTransform: 'uppercase',
  },
  metaText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
  metaSeparator: {
    fontSize: 14,
    color: '#fff',
    marginHorizontal: 4,
  },
  scoreText: {
    fontSize: 14,
    color: '#FFD700',
    fontWeight: '500',
  },
  animeDescription: {
    fontFamily: 'JosefinSans',
    fontSize: isMobile ? 16 : 18,
    lineHeight: 1.4,
    marginBottom: 12,
    color: '#fff',
    letterSpacing: 0.3,
  },
  genresContainer: {
    marginBottom: 20,
  },
  genresLabel: {
    fontSize: 16,
    color: '#ddd',
    fontWeight: '600',
  },
  genresText: {
    fontSize: 16,
    color: '#ddd',
    lineHeight: 1.4,
  },
  detailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: 'rgb(255, 115, 0)',
    borderRadius: 25,
    maxWidth: 250,
    alignSelf: isMobile ? 'center' : 'flex-start',
  },
  detailsButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
    textTransform: 'uppercase',
  },
  sliderButtons: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 4,
    paddingHorizontal: 20,
  },
  sliderButton: {
    width: 60,
    height: 60,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  rightSliderButton: {
    transform: [{ rotate: '180deg' }],
  },
  trailerSpacer: {
    position: 'relative',
    zIndex: 2,
  },
});

export default memo(TrailerHero);