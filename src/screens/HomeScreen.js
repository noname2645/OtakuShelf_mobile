import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, FlatList,
  ActivityIndicator, StyleSheet, Dimensions, Animated, StatusBar,
  RefreshControl, PanResponder, TextInput,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import Svg, { Path, Circle, Line, Polyline } from 'react-native-svg';

import BottomNavBar from '../components/BottomNav';
import AnimeModal from '../components/AnimeModal';
import AnimeCardPremium, { CARD_WIDTH, CARD_HEIGHT } from '../components/AnimeCardPremium';
import PageLoader from '../components/PageLoader';
import ProfilePill from '../components/ProfilePill';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL } from '../config/api';
import { fetchHeroTrailers } from '../api/anilist';

const { width, height } = Dimensions.get('window');
const HERO_HEIGHT = height * 0.78;

const CACHE_KEY = 'animeSections_rn_v3';
const CACHE_TIME_KEY = `${CACHE_KEY}_time`;
const STALE_TIME = 1000 * 60 * 30;

// ─── Normalize ──────────────────────────────────────────────────────────────
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

// ─── Chevron Arrow SVGs ──────────────────────────────────────────────────────
const ChevronLeft = () => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#ff5900" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <Polyline points="15 18 9 12 15 6" />
  </Svg>
);

const ChevronRight = () => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#ff5900" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <Polyline points="9 18 15 12 9 6" />
  </Svg>
);

// ─── Status Badge ────────────────────────────────────────────────────────────
const getStatusColor = (status) => {
  switch ((status || '').toUpperCase()) {
    case 'RELEASING': return '#4CAF50';
    case 'NOT_YET_RELEASED': return '#FF9800';
    case 'FINISHED': return '#2196F3';
    default: return '#9E9E9E';
  }
};

const getStatusLabel = (status) => {
  switch ((status || '').toUpperCase()) {
    case 'RELEASING': return 'Airing';
    case 'NOT_YET_RELEASED': return 'Coming Soon';
    case 'FINISHED': return 'Finished';
    default: return status || 'Unknown';
  }
};

// ─── SkeletonCard ────────────────────────────────────────────────────────────
const SkeletonCard = ({ index }) => {
  const shimmer = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 900, delay: index * 80, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.65] });
  return (
    <Animated.View style={[styles.skeletonCard, { opacity }]}>
      <View style={styles.skeletonCardInner}>
        <View style={styles.skeletonRating} />
        <View style={{ flex: 1 }} />
        <View style={styles.skeletonTitle} />
        <View style={styles.skeletonMeta} />
        <View style={styles.skeletonFooter} />
      </View>
    </Animated.View>
  );
};

// ─── AnimeSection (Carousel) ─────────────────────────────────────────────────
const AnimeSection = React.memo(({ title, data, onOpenModal, onExplore }) => {
  if (!data || data.length === 0) return null;
  return (
    <View style={styles.sectionContainer}>
      {/* Header */}
      <View style={styles.sectionHeader}>
        <LinearGradient
          colors={['#ff6b6b', '#ff4757']}
          style={styles.accentBar}
        />
        <Text style={styles.sectionTitle}>{title}</Text>
        <TouchableOpacity style={styles.exploreBtn} onPress={onExplore} activeOpacity={0.7}>
          <Text style={styles.exploreBtnText}>Explore  ›</Text>
        </TouchableOpacity>
      </View>

      {/* Carousel */}
      <FlatList
        data={data}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item, i) => `${title}-${item.id || i}`}
        renderItem={({ item, index }) => (
          <AnimeCardPremium anime={item} onPress={onOpenModal} index={index} />
        )}
        contentContainerStyle={styles.carouselContent}
        decelerationRate="fast"
        snapToInterval={CARD_WIDTH + 16}
        snapToAlignment="start"
        initialNumToRender={5}
        maxToRenderPerBatch={6}
        windowSize={3}
      />
    </View>
  );
});

// ─── SkeletonSection ──────────────────────────────────────────────────────────
const SkeletonSection = ({ index: si }) => {
  const shimmer = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 800, delay: si * 100, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.65] });
  return (
    <View style={styles.sectionContainer}>
      <View style={styles.sectionHeader}>
        <Animated.View style={[styles.skeletonAccent, { opacity }]} />
        <Animated.View style={[styles.skeletonTitleBar, { opacity }]} />
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

// ─── TrailerHero ──────────────────────────────────────────────────────────────
const TrailerHero = React.memo(({ featuredAnime, onOpenModal }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef(null);

  const goTo = useCallback((nextIdx) => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: -20, duration: 220, useNativeDriver: true }),
    ]).start(() => {
      setCurrentIndex(nextIdx);
      slideAnim.setValue(20);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 320, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 320, useNativeDriver: true }),
      ]).start();
    });
  }, [fadeAnim, slideAnim]);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
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
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [featuredAnime, resetTimer]);

  const handlePrev = useCallback(() => {
    if (!featuredAnime?.length) return;
    const prev = (currentIndex - 1 + featuredAnime.length) % featuredAnime.length;
    goTo(prev); resetTimer();
  }, [currentIndex, featuredAnime, goTo, resetTimer]);

  const handleNext = useCallback(() => {
    if (!featuredAnime?.length) return;
    const next = (currentIndex + 1) % featuredAnime.length;
    goTo(next); resetTimer();
  }, [currentIndex, featuredAnime, goTo, resetTimer]);

  const handlePrevRef = useRef(handlePrev);
  const handleNextRef = useRef(handleNext);
  handlePrevRef.current = handlePrev;
  handleNextRef.current = handleNext;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > Math.abs(gs.dy) && Math.abs(gs.dx) > 15,
      onPanResponderRelease: (_, gs) => {
        if (gs.dx > 45) handlePrevRef.current();
        else if (gs.dx < -45) handleNextRef.current();
      },
    })
  ).current;

  if (!featuredAnime || featuredAnime.length === 0) {
    return (
      <View style={[styles.heroContainer, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#ff5900" />
      </View>
    );
  }

  const current = featuredAnime[currentIndex] || featuredAnime[0];
  // Prefer bannerImage for hero (wider, cinematic)
  const imageUrl = current?.bannerImage || current?.coverImage?.extraLarge || current?.coverImage?.large;
  const title = current?.title || 'Unknown';
  const rawDesc = (current?.description || '').replace(/<[^>]*>/g, '');
  const desc = rawDesc.substring(0, 180);
  const genres = (current?.genres || []).slice(0, 3).join(' • ');
  const score = current?.averageScore ? (current.averageScore / 10).toFixed(1) : null;
  const statusColor = getStatusColor(current?.status);
  const statusLabel = getStatusLabel(current?.status);

  return (
    <View style={styles.heroContainer} {...panResponder.panHandlers}>
      {/* Banner Image */}
      <Image source={{ uri: imageUrl }} style={styles.heroImage} contentFit="cover" cachePolicy="memory-disk" />

      {/* Dual gradient overlay matching spec */}
      {/* Left-to-right dark gradient */}
      <LinearGradient
        colors={[
          'rgba(0,0,0,0.92)', 'rgba(0,0,0,0.78)',
          'rgba(0,0,0,0.45)', 'rgba(0,0,0,0.1)',
          'transparent',
        ]}
        locations={[0, 0.2, 0.45, 0.65, 0.85]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Bottom-to-top dark gradient */}
      <LinearGradient
        colors={['rgba(0,0,0,0.88)', 'rgba(0,0,0,0.45)', 'rgba(0,0,0,0.15)', 'transparent']}
        locations={[0, 0.3, 0.55, 0.8]}
        start={{ x: 0.5, y: 1 }}
        end={{ x: 0.5, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Top fade for status bar */}
      <LinearGradient
        colors={['rgba(3,7,18,0.6)', 'transparent']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 100 }}
      />

      {/* ── Content Overlay ── */}
      <Animated.View
        style={[
          styles.heroContent,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}
        pointerEvents="box-none"
      >
        {/* Title */}
        <Text style={styles.heroTitle} numberOfLines={2}>{title}</Text>

        {/* Meta: status badge + score + episodes + year */}
        <View style={styles.heroMeta}>
          <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
            <Text style={styles.statusBadgeText}>{statusLabel}</Text>
          </View>
          {current?.year ? <Text style={styles.heroMetaText}>{current.year}</Text> : null}
          {current?.episodes ? <Text style={styles.heroMetaText}> • {current.episodes} eps</Text> : null}
          {score ? <Text style={styles.heroScore}> ⭐ {score}</Text> : null}
        </View>

        {/* Description */}
        {desc ? (
          <Text style={styles.heroDesc} numberOfLines={3}>{desc}</Text>
        ) : null}

        {/* Genres */}
        {genres ? (
          <Text style={styles.heroGenres}>
            {'Genres: '}{genres}
          </Text>
        ) : null}

        {/* "More Details" button */}
        <TouchableOpacity
          style={styles.heroBtn}
          onPress={() => onOpenModal(current)}
          activeOpacity={0.85}
        >
          <MaterialIcons name="play-circle-outline" size={20} color="#000" />
          <Text style={styles.heroBtnText}>MORE DETAILS</Text>
        </TouchableOpacity>
      </Animated.View>



      {/* ── Progress Dots ── */}
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

// ─── Search Results ───────────────────────────────────────────────────────────
const SearchResults = ({ data, loading, query, onOpenModal, onClearSearch }) => {
  if (loading) {
    return (
      <View style={styles.searchState}>
        <ActivityIndicator size="large" color="#4facfe" />
        <Text style={styles.searchStateText}>Searching...</Text>
      </View>
    );
  }
  if (!loading && query && data.length === 0) {
    return (
      <View style={styles.searchState}>
        <Text style={styles.searchEmptyIcon}>🔍</Text>
        <Text style={styles.searchEmptyTitle}>No results found</Text>
        <Text style={styles.searchEmptySubtitle}>Try a different title or check the spelling.</Text>
        <TouchableOpacity style={styles.searchCta} onPress={onClearSearch}>
          <Text style={styles.searchCtaText}>Clear Search</Text>
        </TouchableOpacity>
      </View>
    );
  }
  // Grid of results
  return (
    <View style={styles.searchGrid}>
      {data.map((item, index) => (
        <View key={item.id || index} style={styles.searchGridItem}>
          <AnimeCardPremium
            anime={item}
            onPress={onOpenModal}
            index={index}
            isGrid
          />
        </View>
      ))}
    </View>
  );
};

// ─── HomeScreen ───────────────────────────────────────────────────────────────
const HomeScreen = ({ navigation }) => {
  const { user, logout } = useAuth();
  const [loaderDone, setLoaderDone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sections, setSections] = useState({
    topAiring: [], mostWatched: [], topMovies: [], trending: [], topRated: [], upcoming: [],
  });
  const [heroAnime, setHeroAnime] = useState([]);
  const [selectedAnime, setSelectedAnime] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchDebounceRef = useRef(null);
  const searchInputRef = useRef(null);

  const scrollY = useRef(new Animated.Value(0)).current;
  const searchBarAnim = useRef(new Animated.Value(0)).current;

  const applyNormalized = (data) => ({
    topAiring: (data.topAiring || []).map(normalizeAnime).filter(Boolean),
    mostWatched: (data.mostWatched || []).map(normalizeAnime).filter(Boolean),
    topMovies: (data.topMovies || []).map(normalizeAnime).filter(Boolean),
    trending: (data.trending || []).map(normalizeAnime).filter(Boolean),
    topRated: (data.topRated || []).map(normalizeAnime).filter(Boolean),
    upcoming: (data.upcoming || []).map(normalizeAnime).filter(Boolean),
  });

  const loadData = useCallback(async (isRefresh = false) => {
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
            if (age < STALE_TIME) return;
          }
        }
      } catch (_) {}
    }
    try {
      const res = await axios.get(`${API_BASE_URL}/api/anime/anime-sections`, { timeout: 60000 });
      const data = res.data?.data || res.data || {};
      setSections(applyNormalized(data));
      setLoading(false);
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

  // Search logic
  const doSearch = useCallback(async (q) => {
    if (!q.trim()) {
      setIsSearching(false);
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/anime/search`, {
        params: { q, limit: 20 }, timeout: 15000,
      });
      const raw = res.data?.data || res.data?.results || res.data || [];
      setSearchResults((Array.isArray(raw) ? raw : []).map(normalizeAnime).filter(Boolean));
    } catch (_) {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  const handleSearchChange = useCallback((text) => {
    setSearchQuery(text);
    setIsSearching(!!text.trim());
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => doSearch(text), 500);
  }, [doSearch]);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setIsSearching(false);
    setSearchResults([]);
    searchInputRef.current?.blur();
  }, []);

  // Animated header opacity on scroll
  const headerBgOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* ── Top scroll fade (ChatGPT style) ── */}
      <Animated.View style={[styles.scrollFade, { opacity: headerBgOpacity }]} pointerEvents="none">
        <LinearGradient
          colors={['#030712', 'transparent']}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* ── Top Bar: Logo + Search + Profile ── */}
      <View style={styles.topBar}>
        {/* Logo */}
        <MaskedView
          style={{ height: 36, justifyContent: 'center' }}
          maskElement={
            <Text style={styles.logoMask}>OtakuShelf</Text>
          }
        >
          <LinearGradient
            colors={['#ff6a00', '#ffcc00', '#ff0066']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ flex: 1, width: 160 }}
          />
        </MaskedView>

        {/* Auth */}
        {!user ? (
          <TouchableOpacity
            style={styles.getStartedBtn}
            onPress={() => navigation.navigate('Login')}
            activeOpacity={0.85}
          >
            <Text style={styles.getStartedText}>Get Started</Text>
          </TouchableOpacity>
        ) : (
          <ProfilePill user={user} logout={logout} navigation={navigation} />
        )}
      </View>

      {/* ── Main Scroll ── */}
      <Animated.ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#ff5900"
            colors={['#ff5900']}
          />
        }
      >
        {/* Hero */}
        <TrailerHero featuredAnime={heroAnime} onOpenModal={openModal} />

        {/* Sections or Search */}
        <View style={styles.sectionsWrapper}>
          {isSearching ? (
            <SearchResults
              data={searchResults}
              loading={searchLoading}
              query={searchQuery}
              onOpenModal={openModal}
              onClearSearch={clearSearch}
            />
          ) : loading ? (
            ['TRENDING THIS WEEK', 'TOP AIRING', 'UPCOMING RELEASES', 'TOP MOVIES', 'MOST WATCHED', 'TOP RATED ALL TIME']
              .map((_, i) => <SkeletonSection key={i} index={i} />)
          ) : (
            <>
              {/* ── Section order per design.md §14 ── */}
              <AnimeSection
                title="TRENDING THIS WEEK"
                data={sections.trending}
                onOpenModal={openModal}
                onExplore={() => navigation.navigate('Search', { sort: 'TRENDING' })}
              />
              <AnimeSection
                title="TOP AIRING"
                data={sections.topAiring}
                onOpenModal={openModal}
                onExplore={() => navigation.navigate('Search', { status: 'RELEASING' })}
              />
              <AnimeSection
                title="UPCOMING RELEASES"
                data={sections.upcoming}
                onOpenModal={openModal}
                onExplore={() => navigation.navigate('Search', { status: 'TBA' })}
              />
              <AnimeSection
                title="TOP MOVIES"
                data={sections.topMovies}
                onOpenModal={openModal}
                onExplore={() => navigation.navigate('Search', { type: 'MOVIE' })}
              />
              <AnimeSection
                title="MOST WATCHED"
                data={sections.mostWatched}
                onOpenModal={openModal}
                onExplore={() => navigation.navigate('Search', { sort: 'POPULARITY' })}
              />
              <AnimeSection
                title="TOP RATED ALL TIME"
                data={sections.topRated}
                onOpenModal={openModal}
                onExplore={() => navigation.navigate('Search', { sort: 'SCORE' })}
              />
            </>
          )}
        </View>

        {/* ── Footer ── */}
        <View style={styles.footer}>
          <View style={styles.footerDivider} />
          <MaskedView
            style={{ height: 28, alignSelf: 'center', marginBottom: 6 }}
            maskElement={<Text style={styles.footerLogoMask}>OtakuShelf</Text>}
          >
            <LinearGradient
              colors={['#ff6a00', '#ffcc00', '#ff0066']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ flex: 1, width: 130 }}
            />
          </MaskedView>
          <Text style={styles.footerTagline}>
            Your ultimate anime companion. Track, discover, obsess.
          </Text>
          <Text style={styles.footerCopy}>© 2026 OtakuShelf. All rights reserved.</Text>
          <Text style={styles.footerHeart}>Made with ♥ for anime fans</Text>
        </View>

        <View style={{ height: 120 }} />
      </Animated.ScrollView>

      {/* ── Modal ── */}
      <AnimeModal
        visible={modalVisible}
        anime={selectedAnime}
        onClose={closeModal}
        onOpenAnime={(next) => { setSelectedAnime(next); setModalVisible(true); }}
      />

      {/* ── Bottom Nav ── */}
      <BottomNavBar />

      {/* ── PageLoader (cinematic intro) ── */}
      {!loaderDone && (
        <PageLoader onFinish={() => setLoaderDone(true)} />
      )}
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#030712' },

  // ── Header ──
  stickyHeaderBg: {
    position: 'absolute', top: 0, left: 0, right: 0,
    height: 90, zIndex: 20,
  },
  scrollFade: {
    position: 'absolute', top: 0, left: 0, right: 0,
    height: 170, zIndex: 25,
  },
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    zIndex: 30, paddingTop: 46, paddingBottom: 10,
    paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  logoMask: {
    fontSize: 22, color: '#fff', fontFamily: 'OutfitRegular',
    fontWeight: '800', letterSpacing: 0.5,
  },

  // ── Search Bar ──
  searchBarWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 38,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 10,
  },
  searchIcon: { marginRight: 6 },
  searchInput: {
    flex: 1,
    color: '#ff9f00',
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'OutfitRegular',
    letterSpacing: 0.5,
    height: 38,
    padding: 0,
  },
  searchClear: { marginLeft: 4 },

  // ── Auth Button ──
  getStartedBtn: {
    backgroundColor: '#e2aa01',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.75)',
  },
  getStartedText: {
    color: '#000000', fontWeight: '700', fontSize: 13,
    fontFamily: 'OutfitRegular',
  },

  scroll: { flex: 1 },

  // ── Hero ──
  heroContainer: {
    height: HERO_HEIGHT,
    backgroundColor: '#0a0a14',
    position: 'relative',
  },
  heroImage: { ...StyleSheet.absoluteFillObject },
  heroContent: {
    position: 'absolute',
    bottom: '20%',
    left: 18,
    right: width * 0.35,
  },
  heroGenres: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 11, fontWeight: '600',
    letterSpacing: 1.2, textTransform: 'uppercase',
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 26, fontWeight: '800',
    fontFamily: 'OutfitRegular',
    color: '#ffae00',
    letterSpacing: 0.4,
    marginBottom: 10,
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  heroMeta: {
    flexDirection: 'row', alignItems: 'center',
    flexWrap: 'wrap', gap: 6, marginBottom: 10,
  },
  statusBadge: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 10,
  },
  statusBadgeText: {
    color: '#fff', fontSize: 11, fontWeight: '700',
  },
  heroMetaText: { color: 'rgba(255,255,255,0.65)', fontSize: 12 },
  heroScore: { color: '#FFD700', fontSize: 12, fontWeight: '700' },
  heroDesc: {
    color: 'rgba(255,255,255,0.85)', fontSize: 12.5,
    lineHeight: 18.5, marginBottom: 14,
    fontFamily: 'JosefinSans',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  heroBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgb(255, 115, 0)',
    paddingHorizontal: 20, paddingVertical: 12,
    borderRadius: 25, alignSelf: 'flex-start',
    shadowColor: '#ff5900',
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 10, elevation: 8,
  },
  heroBtnText: { color: '#000', fontWeight: '800', fontSize: 13, textTransform: 'uppercase' },

  // ── Hero Arrows ──
  arrowsContainer: {
    position: 'absolute',
    top: 0, bottom: 0, left: 0, right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    zIndex: 5,
  },
  arrowBtn: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center', alignItems: 'center',
  },

  // ── Dots ──
  dotsRow: {
    position: 'absolute', bottom: '14%', left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center',
    alignItems: 'center', gap: 7,
  },
  dot: {
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  dotActive: {
    width: 22, height: 7, borderRadius: 4,
    backgroundColor: '#ff6b6b',
  },

  // ── Sections ──
  sectionsWrapper: {
    marginTop: -85,
    paddingTop: 24,
    backgroundColor: '#030712',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  sectionContainer: { marginBottom: 30 },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 18, marginBottom: 14, gap: 14,
  },
  accentBar: {
    width: 6, height: 28, borderRadius: 4,
    shadowColor: '#ff6b6b',
    shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 10,
  },
  sectionTitle: {
    flex: 1, color: '#ffffff', fontSize: 18, fontWeight: '700',
    fontFamily: 'OutfitRegular', letterSpacing: 0.5,
  },
  exploreBtn: { paddingHorizontal: 4, paddingVertical: 2 },
  exploreBtnText: { color: '#a4b0be', fontSize: 14, fontWeight: '600' },
  carouselContent: { paddingHorizontal: 18, gap: 16 },

  // ── Skeleton ──
  skeletonCard: {
    width: CARD_WIDTH, height: CARD_HEIGHT, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
  },
  skeletonCardInner: { flex: 1, padding: 10 },
  skeletonRating: { width: 40, height: 18, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.1)' },
  skeletonTitle: { height: 28, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.1)', marginBottom: 6 },
  skeletonMeta: { height: 18, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.08)', marginBottom: 6 },
  skeletonFooter: { height: 28, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.07)' },
  skeletonAccent: { width: 6, height: 28, borderRadius: 4, backgroundColor: 'rgba(255,107,107,0.5)' },
  skeletonTitleBar: { height: 18, width: 180, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.12)' },

  // ── Search ──
  searchState: {
    alignItems: 'center', justifyContent: 'center',
    padding: 60, gap: 14,
  },
  searchStateText: { color: 'rgba(255,255,255,0.6)', fontSize: 15 },
  searchEmptyIcon: { fontSize: 48, marginBottom: 8 },
  searchEmptyTitle: {
    color: '#fff', fontSize: 22, fontWeight: '700',
    fontFamily: 'OutfitRegular',
  },
  searchEmptySubtitle: {
    color: 'rgba(255,255,255,0.5)', fontSize: 14, textAlign: 'center',
  },
  searchCta: {
    backgroundColor: '#ff5900', paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 20, marginTop: 8,
  },
  searchCtaText: { color: '#000', fontWeight: '700', fontSize: 14 },
  searchGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 16, gap: 16,
  },
  searchGridItem: {
    width: (width - 48) / 2,
  },

  // ── Footer ──
  footer: {
    paddingHorizontal: 24, paddingTop: 32, paddingBottom: 20,
    alignItems: 'center', gap: 6,
    borderTopWidth: 1, borderColor: 'rgba(255, 154, 0, 0.12)',
  },
  footerDivider: { height: 1, width: '80%', backgroundColor: 'rgba(255,154,0,0.12)', marginBottom: 16 },
  footerLogoMask: {
    fontSize: 18, fontFamily: 'OutfitRegular', fontWeight: '800',
    color: '#fff', letterSpacing: 0.5,
  },
  footerTagline: {
    color: 'rgba(255,255,255,0.35)', fontSize: 12,
    textAlign: 'center', lineHeight: 18,
  },
  footerCopy: {
    color: 'rgba(255,255,255,0.25)', fontSize: 11,
    marginTop: 8, textAlign: 'center',
  },
  footerHeart: {
    color: 'rgba(255,154,0,0.5)', fontSize: 11,
    textAlign: 'center',
  },
});

export default HomeScreen;
