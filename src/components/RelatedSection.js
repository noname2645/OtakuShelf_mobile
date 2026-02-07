import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';

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

  const grouped = useMemo(() => groupByRelation(related), [related]);

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

  return (
    <View style={styles.container}>
      {Object.entries(grouped).map(([relationType, animeList]) => (
        <View key={relationType} style={styles.group}>
          <Text style={styles.groupTitle}>{formatRelationType(relationType)}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {animeList.map((animeItem, index) => {
              const image =
                animeItem.coverImage?.extraLarge ||
                animeItem.coverImage?.large ||
                animeItem.coverImage?.medium ||
                'https://via.placeholder.com/300x450';
              return (
                <TouchableOpacity
                  key={`${animeItem.id || index}-${relationType}`}
                  style={styles.card}
                  activeOpacity={0.8}
                  onPress={() => onSelect && onSelect({
                    ...animeItem,
                    startDate: animeItem.startDate,
                    endDate: animeItem.endDate,
                  })}
                >
                  <View style={styles.cardInner}>
                    <Image source={{ uri: image }} style={styles.cardImage} resizeMode="cover" />
                    <LinearGradient
                      colors={['transparent', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.8)', 'rgba(0,0,0,0.95)']}
                      locations={[0, 0.3, 0.7, 1]}
                      style={styles.gradientOverlay}
                    />
                    <View style={styles.titleOverlay}>
                      <Text style={styles.cardTitle} numberOfLines={2}>
                        {animeItem.title || 'Untitled'}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 10,
  },
  group: {
    marginBottom: 16,
  },
  groupTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  card: {
    width: 140,
    marginRight: 12,
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
  cardInner: {
    height: 190,
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
  gradientOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '40%',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  titleOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 8,
    paddingBottom: 12,
    paddingHorizontal: 10,
    zIndex: 1,
  },
  cardTitle: {
    color: '#ff6a00',
    fontFamily: 'Outfit',
    fontWeight: '600',
    letterSpacing: 1,
    fontSize: isMobile ? 14 : 16,
    textAlign: 'center',
    lineHeight: isMobile ? 20 : 22,
    textShadowColor: 'rgba(190, 79, 0, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
    includeFontPadding: true,
    textAlignVertical: 'center',
    margin: 0,
    padding: 0,
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
