import React, { useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Share,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import Svg, { Path, Polyline, Line, Rect, Polygon } from 'react-native-svg';
import { usePreferences } from '../contexts/PreferenceContext';

const { width } = Dimensions.get('window');

export const CARD_WIDTH = Math.min(width * 0.44, 210);
export const CARD_HEIGHT = CARD_WIDTH * 1.52;

const blurhash = 'L5H2EC=PM+yV0gofqwt7jrRjwfRj';

const StarIcon = React.memo(() => (
  <Svg width={10} height={10} viewBox="0 0 24 24" fill="#ff5900">
    <Path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </Svg>
));

const HeartIcon = React.memo(({ filled }) => (
  <Svg width={15} height={15} viewBox="0 0 24 24"
    fill={filled ? '#ff2a5f' : 'none'}
    stroke={filled ? '#ff2a5f' : 'rgba(255,255,255,0.7)'}
    strokeWidth={2}
  >
    <Path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </Svg>
));

const WatchlistIcon = React.memo(({ active }) => (
  <Svg width={12} height={12} viewBox="0 0 24 24"
    fill={active ? '#ff5900' : 'none'}
    stroke={active ? '#ff5900' : 'rgba(255,255,255,0.7)'}
    strokeWidth={2}
  >
    <Path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
  </Svg>
));

const ShareIcon = React.memo(() => (
  <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth={2}>
    <Path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
    <Polyline points="16 6 12 2 8 6" />
    <Line x1="12" y1="2" x2="12" y2="15" />
  </Svg>
));

const CalIcon = React.memo(() => (
  <Svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="#ff5900" strokeWidth={2}>
    <Rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <Line x1="16" y1="2" x2="16" y2="6" />
    <Line x1="8" y1="2" x2="8" y2="6" />
    <Line x1="3" y1="10" x2="21" y2="10" />
  </Svg>
));

const EpisodesIcon = React.memo(() => (
  <Svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="#ff5900" strokeWidth={2}>
    <Polygon points="23 7 16 12 23 17 23 7" />
    <Rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
  </Svg>
));

const GenreIcon = React.memo(() => (
  <Svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="#ff5900" strokeWidth={2}>
    <Line x1="8" y1="6" x2="21" y2="6" />
    <Line x1="8" y1="12" x2="21" y2="12" />
    <Line x1="8" y1="18" x2="21" y2="18" />
    <Line x1="3" y1="6" x2="3.01" y2="6" />
    <Line x1="3" y1="12" x2="3.01" y2="12" />
    <Line x1="3" y1="18" x2="3.01" y2="18" />
  </Svg>
));

const AnimeCardPremium = React.memo(({ anime, onPress, index, isGrid = false, isBanner = false }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const { isFavorite, isWatchlisted, toggleFavorite, toggleWatchlist, loaded } = usePreferences();

  const handlePressIn = useCallback(() => {
    Animated.timing(scaleAnim, { toValue: 0.95, duration: 50, useNativeDriver: true }).start();
  }, []);

  const handlePressOut = useCallback(() => {
    Animated.timing(scaleAnim, { toValue: 1, duration: 100, useNativeDriver: true }).start();
  }, []);

  const handleToggleWatchlist = useCallback((e) => {
    e.stopPropagation?.();
    if (anime?.id) toggleWatchlist(String(anime.id));
  }, [anime?.id, toggleWatchlist]);

  const handleToggleFavorite = useCallback((e) => {
    e.stopPropagation?.();
    if (anime?.id) toggleFavorite(String(anime.id));
  }, [anime?.id, toggleFavorite]);

  const handlePress = useCallback(() => {
    if (anime) onPress(anime);
  }, [anime, onPress]);

  const handleShare = useCallback(async (e) => {
    e.stopPropagation?.();
    try {
      await Share.share({
        message: `Check out ${anime?.title} on OtakuShelf!`,
        title: anime?.title,
      });
    } catch (_) {}
  }, [anime?.title]);

  if (!anime) return null;

  const imageUrl = isBanner ? (anime.bannerImage || anime.coverImage?.extraLarge || anime.coverImage?.large) : (anime.coverImage?.extraLarge || anime.coverImage?.large);
  const score = anime.averageScore ? (anime.averageScore / 10).toFixed(1) : null;
  const genre = (anime.genres || [])[0] || '—';
  const episodes = anime.episodes || '—';
  const year = anime.year || anime.startDate?.year || '—';
  const format = anime.format || 'TV';

  const cardW = isGrid ? undefined : isBanner ? undefined : CARD_WIDTH;
  const cardH = isGrid ? CARD_WIDTH * 1.52 : isBanner ? 260 : CARD_HEIGHT;
  const fav = loaded && anime?.id ? isFavorite(String(anime.id)) : false;
  const wl = loaded && anime?.id ? isWatchlisted(String(anime.id)) : false;

  return (
    <Animated.View
      style={[
        styles.cardOuter,
        isGrid ? styles.cardGrid : isBanner ? styles.cardBanner : { width: cardW, height: cardH },
        { transform: [{ scale: scaleAnim }] },
      ]}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        style={styles.cardTouch}
      >
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.cardImage}
            contentFit="cover"
            placeholder={{ blurhash }}
            cachePolicy="memory-disk"
            transition={50}
          />
        ) : (
          <View style={[styles.cardImage, styles.noImage]} />
        )}

        <LinearGradient
          colors={['transparent', 'rgba(12,16,28,0.35)', 'rgba(12,16,28,0.8)', '#0c101c']}
          locations={[0, 0.25, 0.55, 1]}
          style={styles.posterFade}
        />

        <View style={styles.cardHeader}>
          {score ? (
            <View style={styles.ratingBadge}>
              <StarIcon />
              <Text style={styles.ratingText}>{score}</Text>
            </View>
          ) : null}
          <TouchableOpacity
            style={styles.bookmarkBtn}
            onPress={handleToggleFavorite}
            activeOpacity={0.8}
          >
            <HeartIcon filled={fav} />
          </TouchableOpacity>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.formatTag}>
            <Text style={styles.formatTagText}>{format.toUpperCase()}</Text>
          </View>

          <Text style={styles.mainTitle} numberOfLines={2}>{typeof anime.title === 'string' ? anime.title.toUpperCase() : 'Unknown'}</Text>

          <View style={styles.metaRow}>
            <View style={styles.metaCol}>
              <CalIcon />
              <Text style={styles.metaLabel}>RELEASED</Text>
              <Text style={styles.metaValue}>{year}</Text>
            </View>
            <View style={styles.metaDivider} />
            <View style={styles.metaCol}>
              <EpisodesIcon />
              <Text style={styles.metaLabel}>EPISODES</Text>
              <Text style={styles.metaValue}>{episodes}</Text>
            </View>
            <View style={styles.metaDivider} />
            <View style={styles.metaCol}>
              <GenreIcon />
              <Text style={styles.metaLabel}>GENRE</Text>
              <Text style={styles.metaValue} numberOfLines={1}>{genre}</Text>
            </View>
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.actionBtn} onPress={handleToggleWatchlist} activeOpacity={0.75}>
              <WatchlistIcon active={wl} />
              <Text style={[styles.actionLabel, wl && styles.actionActive]}>WATCHLIST</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={handleShare} activeOpacity={0.75}>
              <ShareIcon />
              <Text style={styles.actionLabel}>SHARE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  cardOuter: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(12, 16, 28, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
      },
      android: { elevation: 8 },
    }),
  },
  cardGrid: {
    flex: 1,
    marginBottom: 14,
  },
  cardBanner: {
    width: '100%',
    height: 200,
    marginBottom: 16,
  },
  cardTouch: { flex: 1 },
  cardImage: {
    flex: 1,
  },
  noImage: {
    backgroundColor: '#0f1428',
  },
  posterFade: {
    ...StyleSheet.absoluteFillObject,
  },
  cardHeader: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.85)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  ratingText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    fontFamily: 'OutfitRegular',
  },
  bookmarkBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardBody: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 8,
    paddingBottom: 8,
    alignItems: 'center',
    zIndex: 5,
  },
  formatTag: {
    borderWidth: 1,
    borderColor: '#ff5900',
    borderRadius: 100,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginBottom: 5,
  },
  formatTagText: {
    color: '#ff5900',
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 1,
  },
  mainTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
    fontFamily: 'OutfitRegular',
    letterSpacing: 0.3,
    lineHeight: 17,
    height: 34,
    marginBottom: 6,
    textShadowColor: 'rgba(0,0,0,0.95)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  metaCol: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  metaLabel: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 6,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  metaValue: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '600',
    textAlign: 'center',
  },
  metaDivider: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    gap: 4,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 5,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  actionLabel: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  actionActive: {
    color: '#ff5900',
  },
});

export default AnimeCardPremium;
