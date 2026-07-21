import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import AnimeCardPremium, { CARD_WIDTH, CARD_HEIGHT } from './AnimeCardPremium';

const anilistClient = axios.create({
  baseURL: 'https://graphql.anilist.co',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  withCredentials: false,
});

const RELATED_QUERY = `
  query ($id: Int) {
    Media(id: $id, type: ANIME) {
      id
      relations {
        edges {
          relationType
          node {
            id
            idMal
            title {
              romaji
              english
              native
              userPreferred
            }
            type
            coverImage {
              large
              medium
              extraLarge
            }
            bannerImage
            status
            description
            episodes
            averageScore
            format
            genres
            studios {
              edges {
                node {
                  name
                }
              }
            }
            startDate {
              year
              month
              day
            }
            endDate {
              year
              month
              day
            }
            season
            seasonYear
            popularity
            isAdult
            trailer {
              id
              site
            }
          }
        }
      }
    }
  }
`;

const isValidId = (value) => {
  if (!value) return false;
  const parsed = parseInt(value, 10);
  return !Number.isNaN(parsed) && parsed > 0;
};

const isSequelOrPrequel = (relationType) => {
  if (!relationType) return false;
  const normalized = relationType.toString().toUpperCase();
  return (
    normalized === 'SEQUEL' ||
    normalized === 'PREQUEL' ||
    normalized === 'SEQUEL/PREQUEL' ||
    normalized.includes('SEQUEL') ||
    normalized.includes('PREQUEL')
  );
};

const getBestImageUrl = (node) =>
  node?.coverImage?.extraLarge ||
  node?.coverImage?.large ||
  node?.coverImage?.medium ||
  null;

const normalizeAniListNode = (edge) => {
  const node = edge?.node;
  if (!node) return null;

  const title =
    node.title?.english ||
    node.title?.romaji ||
    node.title?.native ||
    node.title?.userPreferred ||
    'Untitled';

  const imageUrl = getBestImageUrl(node);

  return {
    id: node.id,
    idMal: node.idMal,
    title,
    coverImage: {
      extraLarge: node.coverImage?.extraLarge || imageUrl,
      large: node.coverImage?.large || imageUrl,
      medium: node.coverImage?.medium || imageUrl,
    },
    bannerImage: node.bannerImage || null,
    status: node.status,
    description: node.description,
    episodes: node.episodes,
    averageScore: node.averageScore,
    format: node.format,
    genres: node.genres || [],
    studios: node.studios,
    trailer: node.trailer,
    startDate: node.startDate,
    endDate: node.endDate,
    relationType: edge.relationType,
    source: 'anilist',
    _originalData: node,
  };
};


const groupByRelation = (list) =>
  list.reduce((acc, anime) => {
    if (!anime) return acc;
    const key = anime.relationType || 'RELATED';
    if (!acc[key]) acc[key] = [];
    acc[key].push(anime);
    return acc;
  }, {});

const formatRelationType = (value) =>
  value
    .toString()
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (l) => l.toUpperCase());

const { width } = Dimensions.get('window');
const isMobile = width <= 768;

const RelatedSection = ({ animeId, animeMalId, onSelect }) => {
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchFromAniList = useCallback(async (id) => {
    const parsed = parseInt(id, 10);
    if (Number.isNaN(parsed)) return [];
    const res = await anilistClient.post('/', {
      query: RELATED_QUERY,
      variables: { id: parsed },
    });
    const media = res.data?.data?.Media;
    if (!media) return [];
    return media.relations?.edges || [];
  }, []);

  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      if (!isValidId(animeId)) {
        setRelated([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        let normalized = [];

        const edges = await fetchFromAniList(animeId);
        const animeEdges = edges.filter((edge) => edge?.node?.type === 'ANIME');
        const sequelPrequel = animeEdges.filter((edge) =>
          isSequelOrPrequel(edge?.relationType)
        );
        normalized = sequelPrequel.map(normalizeAniListNode).filter(Boolean);

        if (isMounted) {
          setRelated(normalized);
        }
      } catch (err) {
        if (isMounted) {
          setError(err?.message || 'Failed to fetch related anime');
          setRelated([]);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchData();
    return () => {
      isMounted = false;
    };
  }, [animeId, fetchFromAniList]);

  const grouped = useMemo(() => {
    const g = groupByRelation(related);
    const ORDER = ['PREQUEL', 'SEQUEL'];
    return Object.entries(g).sort(([a], [b]) => ORDER.indexOf(a) - ORDER.indexOf(b));
  }, [related]);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#ff5900" />
        <Text style={styles.loadingText}>Loading related anime...</Text>
      </View>
    );
  }

  if (error) {
    return <Text style={styles.errorText}>Error: {error}</Text>;
  }

  if (!related.length) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Sequel or prequel is not available.</Text>
      </View>
    );
  }

  const allItems = useMemo(() => {
    const items = [];
    grouped.forEach(([relationType, animeList], gi) => {
      if (gi > 0) items.push({ isDivider: true, label: formatRelationType(relationType) });
      animeList.forEach(a => items.push({ isDivider: false, ...a }));
    });
    return items;
  }, [grouped]);

  return (
    <View style={styles.container}>
      <Text style={styles.groupTitle}>Sequels &amp; Prequels</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recsScroll}>
        {allItems.map((item, idx) => {
          if (item.isDivider) {
            return (
              <View key={`div-${idx}`} style={styles.divider}>
                <Text style={styles.dividerText}>{item.label}</Text>
              </View>
            );
          }
          return (
            <View key={item.id || idx} style={styles.recCard}>
              <AnimeCardPremium
                anime={item}
                index={idx}
                onPress={(sel) => onSelect && onSelect({
                  ...sel,
                  startDate: sel.startDate,
                  endDate: sel.endDate,
                })}
                isGrid
              />
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 10,
  },
  groupTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  recsScroll: {
    paddingRight: 10,
    paddingBottom: 4,
  },
  recCard: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 20,
    overflow: 'hidden',
    marginRight: 12,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    marginRight: 12,
    paddingHorizontal: 4,
  },
  dividerText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  loading: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  loadingText: {
    color: '#999',
    marginTop: 8,
  },
  errorText: {
    color: '#ff7b7b',
    fontSize: 12,
  },
  emptyContainer: {
    paddingVertical: 16,
  },
  emptyText: {
    color: '#999',
    fontSize: 12,
  },
});

export default RelatedSection;
