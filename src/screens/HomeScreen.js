import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, Image, TouchableOpacity, FlatList,
  ActivityIndicator, StyleSheet, Dimensions, Animated, StatusBar,
  RefreshControl, PanResponder,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import BottomNavBar from '../components/BottomNav';
import AnimeModal from '../components/AnimeModal';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL } from '../config/api';
import { fetchHeroTrailers } from '../api/anilist';
import ProfilePill from '../components/ProfilePill';

const { width, height } = Dimensions.get('window');
const HERO_HEIGHT = height * 0.72;
const CARD_WIDTH = width * 0.38;
const CARD_HEIGHT = CARD_WIDTH * 1.48;

const CACHE_KEY = 'animeSections_rn_v2';
const CACHE_TIME_KEY = `${CACHE_KEY}_time`;
const STALE_TIME = 1000 * 60 * 30;

// ─── Normalize ─────────────────────────────────────────────────────────────
const normalizeAnime = (anime) => {
  if (!anime) return null;
  return {
    id: anime.id || anime.malId || Math.random().toString(36).substr(2, 9),
    idMal: anime.idMal || anime.mal_id,
    title: anime.title?.english || anime.title?.romaji || anime.title?.native || anime.title || 'Unknown',
    coverImage: {
      large: anime.coverImage?.large || anime.images?.jpg?.large_image_url,
      extraLarge: anime.coverImage?.extraLarge || anime.images?.jpg?.large_image_url,
    },
    bannerImage: anime.bannerImage || anime.images?.jpg?.large_image_url,
    description: anime.description || anime.synopsis || null,
    episodes: anime.episodes || anime.totalEpisodes || null,
    averageScore: anime.averageScore || anime.score || null,
    status: anime.status || null,
    genres: anime.genres || [],
    studios: anime.studios?.edges?.map(e => e.node.name) || [],
    trailer: anime.trailer || null,
    format: anime.format || null,
    season: anime.season || null,
    year: anime.year || anime.startDate?.year || null,
    startDate: anime.startDate || null,
    endDate: anime.endDate || null,
    relations: anime.relations || null,
  };
};

// ─── AnimeCard ─────────────────────────────────────────────────────────────
const AnimeCard = React.memo(({ anime, onPress, index }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1, duration: 350,
      delay: Math.min(index * 40, 300),
      useNativeDriver: true,
    }).start();
  }, []);

  const imageUrl = anime?.coverImage?.extraLarge || anime?.coverImage?.large ||
    `https://picsum.photos/${Math.floor(CARD_WIDTH)}/${Math.floor(CARD_HEIGHT)}?random=${index}`;

  return (
    <Animated.View style={[styles.cardOuter, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPressIn={() => Animated.spring(scaleAnim, { toValue: 0.95, useNativeDriver: true }).start()}
        onPressOut={() => Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start()}
        onPress={() => anime && onPress(anime)}
        style={styles.cardTouch}
      >
        <Image source={{ uri: imageUrl }} style={styles.cardImage} resizeMode="cover" />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.92)']}
          locations={[0.3, 0.65, 1]}
          style={styles.cardGradient}
        />
        <View style={styles.cardTitleBox}>
          <Text style={styles.cardTitle} numberOfLines={2}>{anime?.title}</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

// ─── SkeletonCard ───────────────────────────────────────────────────────────
const SkeletonCard = ({ index }) => {
  const shimmer = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 900, delay: index * 80, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.7] });
  return <Animated.View style={[styles.skeletonCard, { opacity }]} />;
};

// ─── AnimeSection (Carousel) ────────────────────────────────────────────────
const AnimeSection = React.memo(({ title, data, onOpenModal }) => {
  if (!data || data.length === 0) return null;
  return (
    <View style={styles.sectionContainer}>
      {/* Header */}
      <View style={styles.sectionHeader}>
        <View style={styles.accentBar} />
        <Text style={styles.sectionTitle}>{title}</Text>
        <TouchableOpacity style={styles.exploreBtn} activeOpacity={0.7}>
          <Text style={styles.exploreBtnText}>Explore  ›</Text>
        </TouchableOpacity>
      </View>
      {/* Horizontal Carousel */}
      <FlatList
        data={data}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item, i) => `${title}-${item.id || i}`}
        renderItem={({ item, index }) => (
          <AnimeCard anime={item} onPress={onOpenModal} index={index} />
        )}
        contentContainerStyle={styles.carouselContent}
        decelerationRate="fast"
        snapToInterval={CARD_WIDTH + 14}
        snapToAlignment="start"
        initialNumToRender={5}
        maxToRenderPerBatch={6}
        windowSize={3}
      />
    </View>
  );
});

// ─── SkeletonSection ─────────────────────────────────────────────────────────
const SkeletonSection = ({ index: si }) => {
  const shimmer = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 800, delay: si * 100, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.65] });
  return (
    <View style={styles.sectionContainer}>
      <View style={styles.sectionHeader}>
        <Animated.View style={[styles.skeletonAccent, { opacity }]} />
        <Animated.View style={[styles.skeletonTitle, { opacity }]} />
      </View>
      <FlatList
        data={[1, 2, 3, 4, 5]}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(_, i) => `sk-${si}-${i}`}
        renderItem={({ index }) => <SkeletonCard index={index} />}
        contentContainerStyle={styles.carouselContent}
        scrollEnabled={false}
      />
    </View>
  );
};

// ─── TrailerHero ─────────────────────────────────────────────────────────────
const TrailerHero = React.memo(({ featuredAnime, onOpenModal }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef(null);

  const goTo = useCallback((nextIdx) => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: -20, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      setCurrentIndex(nextIdx);
      slideAnim.setValue(20);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    });
  }, [fadeAnim, slideAnim]);

  const resetTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    if (!featuredAnime || featuredAnime.length < 2) return;
    timerRef.current = setInterval(() => {
      setCurrentIndex(prev => {
        const next = (prev + 1) % featuredAnime.length;
        goTo(next);
        return next;
      });
    }, 9000);
  }, [featuredAnime, goTo]);

  useEffect(() => {
    resetTimer();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [featuredAnime, resetTimer]);

  const handleSwipePrev = useCallback(() => {
    if (!featuredAnime || featuredAnime.length === 0) return;
    const prevIdx = (currentIndex - 1 + featuredAnime.length) % featuredAnime.length;
    goTo(prevIdx);
    resetTimer();
  }, [currentIndex, featuredAnime, goTo, resetTimer]);

  const handleSwipeNext = useCallback(() => {
    if (!featuredAnime || featuredAnime.length === 0) return;
    const nextIdx = (currentIndex + 1) % featuredAnime.length;
    goTo(nextIdx);
    resetTimer();
  }, [currentIndex, featuredAnime, goTo, resetTimer]);

  const handleSwipePrevRef = useRef(handleSwipePrev);
  const handleSwipeNextRef = useRef(handleSwipeNext);
  handleSwipePrevRef.current = handleSwipePrev;
  handleSwipeNextRef.current = handleSwipeNext;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 15;
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx > 45) {
          handleSwipePrevRef.current();
        } else if (gestureState.dx < -45) {
          handleSwipeNextRef.current();
        }
      },
    })
  ).current;

  if (!featuredAnime || featuredAnime.length === 0) {
    return (
      <View style={[styles.heroContainer, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#ff6b6b" />
      </View>
    );
  }

  const current = featuredAnime[currentIndex] || featuredAnime[0];
  const imageUrl = current?.coverImage?.extraLarge || current?.coverImage?.large || current?.bannerImage;
  const title = current?.title || 'Unknown';
  const desc = (current?.description || '').replace(/<[^>]*>/g, '').substring(0, 160);
  const genres = (current?.genres || []).slice(0, 3).join(' • ');
  const score = current?.averageScore ? (current.averageScore / 10).toFixed(1) : null;

  return (
    <View style={styles.heroContainer} {...panResponder.panHandlers}>
      <Image source={{ uri: imageUrl }} style={styles.heroImage} resizeMode="cover" />
      {/* Gradients */}
      <LinearGradient
        colors={['rgba(3,7,18,0.15)', 'rgba(3,7,18,0.4)', 'rgba(3,7,18,0.75)', 'rgba(3,7,18,1)']}
        locations={[0, 0.5, 0.8, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Content */}
      <Animated.View style={[styles.heroContent, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        {genres ? <Text style={styles.heroGenres}>{genres}</Text> : null}
        <Text style={styles.heroTitle} numberOfLines={2}>{title}</Text>
        <View style={styles.heroMeta}>
          {score && <Text style={styles.heroScore}>⭐ {score}</Text>}
          {current?.episodes && <Text style={styles.heroMetaText}> • {current.episodes} eps</Text>}
          {current?.year && <Text style={styles.heroMetaText}> • {current.year}</Text>}
        </View>
        {desc ? <Text style={styles.heroDesc} numberOfLines={3}>{desc}</Text> : null}
        <TouchableOpacity style={styles.heroBtn} onPress={() => onOpenModal(current)} activeOpacity={0.85}>
          <MaterialIcons name="play-circle-outline" size={20} color="#000" />
          <Text style={styles.heroBtnText}>More Details</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Dots */}
      {featuredAnime.length > 1 && (
        <View style={styles.dotsRow}>
          {featuredAnime.slice(0, 10).map((_, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => { clearInterval(timerRef.current); goTo(i); setCurrentIndex(i); resetTimer(); }}
              style={[styles.dot, i === currentIndex && styles.dotActive]}
            />
          ))}
        </View>
      )}
    </View>
  );
});

// ─── HomeScreen ───────────────────────────────────────────────────────────────
const HomeScreen = ({ navigation }) => {
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sections, setSections] = useState({
    topAiring: [], mostWatched: [], topMovies: [], trending: [], topRated: [], upcoming: [],
  });
  const [heroAnime, setHeroAnime] = useState([]);
  const [selectedAnime, setSelectedAnime] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;

  const applyNormalized = (data) => ({
    topAiring: (data.topAiring || []).map(normalizeAnime).filter(Boolean),
    mostWatched: (data.mostWatched || []).map(normalizeAnime).filter(Boolean),
    topMovies: (data.topMovies || []).map(normalizeAnime).filter(Boolean),
    trending: (data.trending || []).map(normalizeAnime).filter(Boolean),
    topRated: (data.topRated || []).map(normalizeAnime).filter(Boolean),
    upcoming: (data.upcoming || []).map(normalizeAnime).filter(Boolean),
  });

  const loadData = useCallback(async (isRefresh = false) => {
    // 1. Try cache first
    if (!isRefresh) {
      try {
        const cached = await AsyncStorage.getItem(CACHE_KEY);
        const cachedTime = await AsyncStorage.getItem(CACHE_TIME_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed.topAiring) {
            setSections(applyNormalized(parsed));
            setLoading(false);
            const age = Date.now() - (parseInt(cachedTime) || 0);
            if (age < STALE_TIME) return; // Fresh enough, skip network
          }
        }
      } catch (_) {}
    }

    // 2. Fetch from network
    try {
      const res = await axios.get(`${API_BASE_URL}/api/anime/anime-sections`, { timeout: 15000 });
      const data = res.data?.data || res.data || {};
      setSections(applyNormalized(data));
      setLoading(false);

      // Cache raw data
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({
        topAiring: data.topAiring || [],
        mostWatched: data.mostWatched || [],
        topMovies: data.topMovies || [],
        trending: data.trending || [],
        topRated: data.topRated || [],
        upcoming: data.upcoming || [],
      }));
      await AsyncStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
    } catch (err) {
      console.warn('Fetch failed:', err.message);
      setLoading(false);
    } finally {
      setRefreshing(false);
    }
  }, []);

  const loadHero = useCallback(async () => {
    try {
      const heroData = await fetchHeroTrailers(false);
      if (Array.isArray(heroData) && heroData.length > 0) {
        setHeroAnime(heroData.map(normalizeAnime).filter(Boolean).slice(0, 10));
      }
    } catch (_) {}
  }, []);

  useEffect(() => { loadData(); loadHero(); }, []);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadData(true);
    loadHero();
  }, [loadData, loadHero]);

  const openModal = useCallback((anime) => {
    setSelectedAnime(anime);
    setModalVisible(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalVisible(false);
    setTimeout(() => setSelectedAnime(null), 300);
  }, []);

  const headerOpacity = scrollY.interpolate({ inputRange: [0, 80], outputRange: [0, 1], extrapolate: 'clamp' });

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Sticky translucent header (appears on scroll) */}
      <Animated.View style={[styles.stickyHeader, { opacity: headerOpacity }]}>
        <LinearGradient colors={['rgba(3,7,18,0.98)', 'rgba(3,7,18,0.85)']} style={StyleSheet.absoluteFill} />
      </Animated.View>

      {/* Persistent top header (logo + profile) */}
      <View style={styles.topBar}>
        <MaskedView style={{ height: 38, width: 200 }} maskElement={<Text style={styles.logo}>OtakuShelf</Text>}>
          <LinearGradient colors={['#ff6a00', '#ffcc00', '#ff0066', '#ff33cc']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }} />
        </MaskedView>
        {!user ? (
          <TouchableOpacity style={styles.getStartedBtn} onPress={() => navigation.navigate('Login')} activeOpacity={0.85}>
            <Text style={styles.getStartedText}>Get Started</Text>
          </TouchableOpacity>
        ) : (
          <ProfilePill user={user} logout={logout} navigation={navigation} />
        )}
      </View>

      {/* Main Scroll */}
      <Animated.ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#ff6b6b" colors={['#ff6b6b']} />
        }
      >
        {/* Hero */}
        <TrailerHero featuredAnime={heroAnime} onOpenModal={openModal} />

        {/* Sections */}
        <View style={styles.sectionsWrapper}>
          {loading ? (
            ['TOP AIRING', 'TRENDING THIS WEEK', 'MOST WATCHED', 'TOP RATED ALL TIME', 'TOP MOVIES', 'UPCOMING RELEASES']
              .map((_, i) => <SkeletonSection key={i} index={i} />)
          ) : (
            <>
              <AnimeSection title="TOP AIRING" data={sections.topAiring} onOpenModal={openModal} />
              <AnimeSection title="TRENDING THIS WEEK" data={sections.trending} onOpenModal={openModal} />
              <AnimeSection title="MOST WATCHED" data={sections.mostWatched} onOpenModal={openModal} />
              <AnimeSection title="TOP RATED ALL TIME" data={sections.topRated} onOpenModal={openModal} />
              <AnimeSection title="TOP MOVIES" data={sections.topMovies} onOpenModal={openModal} />
              <AnimeSection title="UPCOMING RELEASES" data={sections.upcoming} onOpenModal={openModal} />
            </>
          )}
        </View>
        <View style={{ height: 110 }} />
      </Animated.ScrollView>

      {/* Modal */}
      <AnimeModal
        visible={modalVisible}
        anime={selectedAnime}
        onClose={closeModal}
        onOpenAnime={(next) => { setSelectedAnime(next); setModalVisible(true); }}
      />

      <BottomNavBar />
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#030712' },

  // Sticky blur header
  stickyHeader: {
    position: 'absolute', top: 0, left: 0, right: 0,
    height: 88, zIndex: 20,
  },

  // Top bar (logo + auth)
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    zIndex: 30, paddingTop: 44, paddingBottom: 10,
    paddingHorizontal: 20,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  logo: { fontSize: 24, color: '#fff', fontFamily: 'Prompt', letterSpacing: 1 },
  getStartedBtn: {
    backgroundColor: '#ff6b6b', paddingHorizontal: 18, paddingVertical: 10,
    borderRadius: 22, shadowColor: '#ff6b6b', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.45, shadowRadius: 7, elevation: 6,
  },
  getStartedText: { color: '#fff', fontWeight: '700', fontSize: 14, letterSpacing: 0.4 },

  scroll: { flex: 1 },

  // ── Hero ──
  heroContainer: { height: HERO_HEIGHT, position: 'relative', backgroundColor: '#111' },
  heroImage: { ...StyleSheet.absoluteFillObject },
  heroContent: {
    position: 'absolute', bottom: 32, left: 18, right: 18,
  },
  heroGenres: { color: '#ddd', fontSize: 12, fontWeight: '600', letterSpacing: 1.2, marginBottom: 6, textTransform: 'uppercase' },
  heroTitle: {
    fontSize: 28, fontWeight: '800', color: '#ffae00', fontFamily: 'OutfitRegular',
    letterSpacing: 0.5, marginBottom: 4,
    textShadowColor: 'rgba(0,0,0,0.9)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8,
  },
  heroMeta: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  heroScore: { color: '#FFD700', fontSize: 13, fontWeight: '700' },
  heroMetaText: { color: 'rgba(255,255,255,0.6)', fontSize: 13 },
  heroDesc: {
    color: '#ffffff', fontSize: 13, lineHeight: 20, marginBottom: 12,
    fontFamily: 'JosefinSans',
    textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4,
  },
  heroBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#ffae00', paddingHorizontal: 22, paddingVertical: 12,
    borderRadius: 24, alignSelf: 'flex-start',
    shadowColor: '#ffae00', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 10, elevation: 8,
  },
  heroBtnText: { color: '#000', fontWeight: '800', fontSize: 14, textTransform: 'uppercase' },

  // Dots
  dotsRow: {
    position: 'absolute', bottom: 16, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
  },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.35)' },
  dotActive: { width: 22, height: 7, borderRadius: 4, backgroundColor: '#ff6b6b' },

  // ── Sections ──
  sectionsWrapper: { paddingTop: 12 },
  sectionContainer: { marginBottom: 28 },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 18, marginBottom: 14,
  },
  accentBar: {
    width: 6, height: 28, borderRadius: 4,
    backgroundColor: '#ff4757', marginRight: 14,
    shadowColor: '#ff6b6b', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 10,
  },
  sectionTitle: {
    flex: 1, color: '#ffffff', fontSize: 18, fontWeight: '700',
    fontFamily: 'OutfitRegular', letterSpacing: 0.5, textTransform: 'capitalize',
  },
  exploreBtn: { paddingHorizontal: 4, paddingVertical: 2 },
  exploreBtnText: { color: '#a4b0be', fontSize: 14, fontWeight: '600' },
  carouselContent: { paddingHorizontal: 18, gap: 14 },

  // ── Anime Card ──
  cardOuter: {
    width: CARD_WIDTH, height: CARD_HEIGHT, borderRadius: 16,
    overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
  },
  cardTouch: { flex: 1 },
  cardImage: { ...StyleSheet.absoluteFillObject, borderRadius: 16 },
  cardGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '55%', borderBottomLeftRadius: 16, borderBottomRightRadius: 16 },
  cardTitleBox: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 10 },
  cardTitle: {
    color: '#ff9a00', fontSize: 13.5, fontWeight: '700', textAlign: 'center',
    fontFamily: 'OutfitRegular', lineHeight: 18,
    textShadowColor: 'rgba(0,0,0,0.95)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 6,
    textShadowColor: 'rgba(0,0,0,0.8)',
  },

  // ── Skeleton ──
  skeletonCard: {
    width: CARD_WIDTH, height: CARD_HEIGHT, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  skeletonAccent: { width: 5, height: 22, borderRadius: 3, backgroundColor: 'rgba(255,107,107,0.5)', marginRight: 12 },
  skeletonTitle: { height: 18, width: 180, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.12)' },
});

export default HomeScreen;
