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
import { usePreferences } from '../contexts/PreferenceContext';

const { width } = Dimensions.get('window');

export const CARD_WIDTH = Math.min(width * 0.44, 210);
export const CARD_HEIGHT = CARD_WIDTH * 1.52;

const blurhash = 'L5H2EC=PM+yV0gofqwt7jrRjwfRj';

const AnimeCardPremium = React.memo(({ anime, onPress, index, isGrid = false }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const { isFavorite, isWatchlisted, toggleFavorite, toggleWatchlist, loaded } = usePreferences();

  const handlePressIn = useCallback(() => {
    Animated.spring(scaleAnim, { toValue: 0.96, useNativeDriver: true }).start();
  }, []);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();
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

  const imageUrl = anime.coverImage?.extraLarge || anime.coverImage?.large;
  const score = anime.averageScore ? (anime.averageScore / 10).toFixed(1) : null;
  const genre = (anime.genres || [])[0] || '—';
  const episodes = anime.episodes || '—';
  const year = anime.year || anime.startDate?.year || '—';
  const format = anime.format || 'TV';

  const cardW = isGrid ? undefined : CARD_WIDTH;
  const cardH = isGrid ? CARD_WIDTH * 1.52 : CARD_HEIGHT;
  const fav = loaded && anime?.id ? isFavorite(String(anime.id)) : false;
  const wl = loaded && anime?.id ? isWatchlisted(String(anime.id)) : false;

  return (
    <Animated.View
      style={[
        styles.cardOuter,
        isGrid ? styles.cardGrid : { width: cardW, height: cardH },
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
            transition={200}
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
              <Text style={{ color: '#ff5900', fontSize: 9 }}>★</Text>
              <Text style={styles.ratingText}>{score}</Text>
            </View>
          ) : null}
          <TouchableOpacity
            style={styles.bookmarkBtn}
            onPress={handleToggleFavorite}
            activeOpacity={0.8}
          >
            <Text style={{ fontSize: 13, color: fav ? '#ff2a5f' : 'rgba(255,255,255,0.7)' }}>{fav ? '♥' : '♡'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.formatTag}>
            <Text style={styles.formatTagText}>{format.toUpperCase()}</Text>
          </View>

          <Text style={styles.mainTitle} numberOfLines={2}>{anime.title?.toUpperCase?.() || anime.title}</Text>

          <View style={styles.metaRow}>
            <View style={styles.metaCol}>
              <Text style={{ color: '#ff5900', fontSize: 8 }}>📅</Text>
              <Text style={styles.metaLabel}>RELEASED</Text>
              <Text style={styles.metaValue}>{year}</Text>
            </View>
            <View style={styles.metaDivider} />
            <View style={styles.metaCol}>
              <Text style={{ color: '#ff5900', fontSize: 8 }}>▶</Text>
              <Text style={styles.metaLabel}>EPISODES</Text>
              <Text style={styles.metaValue}>{episodes}</Text>
            </View>
            <View style={styles.metaDivider} />
            <View style={styles.metaCol}>
              <Text style={{ color: '#ff5900', fontSize: 8 }}>🏷</Text>
              <Text style={styles.metaLabel}>GENRE</Text>
              <Text style={styles.metaValue} numberOfLines={1}>{genre}</Text>
            </View>
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.actionBtn} onPress={handleToggleWatchlist} activeOpacity={0.75}>
              <Text style={{ fontSize: 10, color: wl ? '#ff5900' : 'rgba(255,255,255,0.7)' }}>{wl ? '◈' : '◇'}</Text>
              <Text style={[styles.actionLabel, wl && styles.actionActive]}>WATCHLIST</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={handleShare} activeOpacity={0.75}>
              <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>↗</Text>
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
