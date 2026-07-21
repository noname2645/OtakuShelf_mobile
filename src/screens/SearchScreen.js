import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Keyboard,
} from 'react-native';
import axios from 'axios';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contexts/AuthContext';
import AnimeModal from '../components/AnimeModal';
import BottomNav from '../components/BottomNav';
import AnimeCardPremium from '../components/AnimeCardPremium';




const ANIME_GENRES = [
  "Action",
  "Adventure",
  "Avant Garde",
  "Award Winning",
  "Boys Love",
  "Comedy",
  "Drama",
  "Fantasy",
  "Girls Love",
  "Gourmet",
  "Horror",
  "Mystery",
  "Romance",
  "Sci-Fi",
  "Slice of Life",
  "Sports",
  "Supernatural",
  "Suspense",
  "Thriller",
];

const ANIME_SEASONS = ["WINTER", "SPRING", "SUMMER", "FALL"];

const DEFAULT_STATUS = ["FINISHED", "RELEASING"];

const COLUMN_WRAPPER = { gap: 14 };
const KEY_EXTRACTOR = (item) => String(item.id);

const FILTER_OPTIONS = {
  type: ["TV", "MOVIE", "OVA", "ONA", "SPECIAL"],
  status: ["FINISHED", "RELEASING", "TBA"]
};

const SearchScreen = ({ navigation }) => {
  const { API } = useAuth();
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedAnime, setSelectedAnime] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [totalResults, setTotalResults] = useState(0);
  const allIdsRef = useRef(new Set());

  // Filters
  const [filters, setFilters] = useState({
    type: [],
    status: DEFAULT_STATUS,
    genres: [],
    minimumScore: 0,
    season: "",
    seasonYear: "",
  });
  const [scoreInput, setScoreInput] = useState('');
  const [scoreError, setScoreError] = useState('');

  const [showFilters, setShowFilters] = useState(false);
  const filterAnim = useRef(new Animated.Value(0)).current;
  const searchTextRef = useRef(searchText);
  const searchIdRef = useRef(0);

  useEffect(() => {
    searchTextRef.current = searchText;
  }, [searchText]);
  const isStatusDefault =
    filters.status.length === DEFAULT_STATUS.length &&
    DEFAULT_STATUS.every(status => filters.status.includes(status));

  const hasActiveFilters =
    filters.genres.length > 0 ||
    filters.type.length > 0 ||
    !isStatusDefault ||
    filters.minimumScore > 0 ||
    filters.season ||
    filters.seasonYear;

  const activeFilterCount =
    filters.genres.length +
    filters.type.length +
    (!isStatusDefault ? filters.status.length : 0) +
    (filters.minimumScore > 0 ? 1 : 0) +
    (filters.season ? 1 : 0) +
    (filters.seasonYear ? 1 : 0);

  const ANIME_SEARCH_QUERY = `
    query AdvancedSearch(
      $page: Int = 1,
      $perPage: Int = 20,
      $search: String,
      $format_in: [MediaFormat],
      $status_in: [MediaStatus],
      $averageScore_greater: Int,
      $genre_in: [String],
      $season: MediaSeason,
      $seasonYear: Int
    ) {
      Page(page: $page, perPage: $perPage) {
        pageInfo {
          total
          currentPage
          lastPage
          hasNextPage
        }
        media(
          type: ANIME,
          isAdult: false,
          search: $search,
          format_in: $format_in,
          status_in: $status_in,
          averageScore_greater: $averageScore_greater,
          genre_in: $genre_in,
          season: $season,
          seasonYear: $seasonYear,
          sort: POPULARITY_DESC
        ) {
          id
          idMal
          title {
            romaji
            english
            native
          }
          coverImage {
            large
            extraLarge
            medium
          }
          bannerImage
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
          description
          episodes
          format
          status
          genres
          averageScore
          trailer {
            id
            site
          }
          studios {
            nodes {
              name
            }
          }
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
                coverImage {
                  large
                  extraLarge
                  medium
                }
                bannerImage
                format
                status
                episodes
                averageScore
              }
            }
          }
        }
      }
    }
  `;

  const doFetch = async (page, requestId) => {
    const variables = { page, perPage: 50 };
    const query = searchTextRef.current.trim();
    if (query) variables.search = query;
    if (filters.type.length > 0) variables.format_in = filters.type;
    if (filters.status.length > 0) {
      variables.status_in = filters.status.map(s => s === 'TBA' ? 'NOT_YET_RELEASED' : s);
    }
    if (filters.minimumScore > 0) variables.averageScore_greater = Math.floor(filters.minimumScore * 10);
    if (filters.genres.length > 0) variables.genre_in = filters.genres;
    if (filters.season) variables.season = filters.season;
    if (filters.seasonYear && filters.seasonYear.trim() !== "") {
      const yr = parseInt(filters.seasonYear, 10);
      if (!Number.isNaN(yr) && yr > 1900) variables.seasonYear = yr;
    }

    let res;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        res = await axios.post('https://graphql.anilist.co', { query: ANIME_SEARCH_QUERY, variables }, {
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }
        });
        break;
      } catch (e) {
        if (e?.response?.status === 429 && attempt < 2) {
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }
        throw e;
      }
    }
    if (requestId !== searchIdRef.current) return null;

    const d = res.data.data.Page;
    const items = d.media.map(a => ({
      id: a.id, idMal: a.idMal,
      title: a.title?.english || a.title?.romaji || a.title?.native || "Unknown",
      coverImage: { large: a.coverImage?.large, extraLarge: a.coverImage?.extraLarge, medium: a.coverImage?.medium },
      bannerImage: a.bannerImage, startDate: a.startDate, endDate: a.endDate,
      year: a.startDate?.year, description: a.description, episodes: a.episodes,
      format: a.format, status: a.status, genres: a.genres,
      averageScore: a.averageScore, trailer: a.trailer, studios: a.studios, relations: a.relations,
    }));
    return { items, hasNext: d.pageInfo.hasNextPage, total: d.pageInfo.total, page };
  };

  useEffect(() => {
    Animated.timing(filterAnim, {
      toValue: showFilters ? 1 : 0,
      duration: showFilters ? 220 : 180,
      useNativeDriver: true,
    }).start();
  }, [showFilters, filterAnim]);

  useEffect(() => {
    const myRequestId = ++searchIdRef.current;
    setSearchResults([]);
    setSearchLoading(true);

    (async () => {
      const r1 = await doFetch(1, myRequestId);
      if (myRequestId !== searchIdRef.current) return;

      if (r1) {
        setSearchResults(r1.items);
        setSearchLoading(false);
      }

      const [r2, r3] = await Promise.all([
        doFetch(2, myRequestId),
        doFetch(3, myRequestId),
      ]);
      if (myRequestId !== searchIdRef.current) return;

      const seen = new Set();
      const merged = [];
      for (const r of [r1, r2, r3]) {
        if (!r) continue;
        for (const item of r.items) {
          if (!seen.has(item.id)) { seen.add(item.id); merged.push(item); }
        }
      }

      setSearchResults(merged);
    })();
  }, [searchText, filters]);

  const scrollYSearch = useRef(new Animated.Value(0)).current;
  const headerBgOpacitySearch = scrollYSearch.interpolate({
    inputRange: [0, 100],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const toggleFilter = (filterType, value) => {
    setFilters(prev => {
      const current = prev[filterType];
      const newValue = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value];
      return { ...prev, [filterType]: newValue };
    });
  };

  const clearFilters = () => {
    Keyboard.dismiss();
    setFilters({
      type: [],
      status: DEFAULT_STATUS,
      genres: [],
      minimumScore: 0,
      season: "",
      seasonYear: "",
    });
    setScoreInput('');
    setScoreError('');
    setSearchText('');
  };

  const toggleSingleFilter = (filterType, value) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: prev[filterType] === value ? "" : value,
    }));
  };

  const openModal = useCallback((anime) => {
    setSelectedAnime(anime);
    setModalVisible(true);
  }, []);

  const renderAnimeCard = useCallback(({ item, index }) => {
    return (
      <AnimeCardPremium
        anime={item}
        index={index}
        isGrid
        onPress={openModal}
      />
    );
  }, []);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        {/* Search Bar + Filters combined pill */}
        <View style={styles.searchPill}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by title..."
            placeholderTextColor="#666"
            value={searchText}
            onChangeText={setSearchText}
          />
          <TouchableOpacity
            style={[styles.pillFilterBtn, showFilters && styles.pillFilterBtnActive]}
            onPress={() => {
              Keyboard.dismiss();
              setShowFilters(!showFilters);
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.pillFilterText}>{showFilters ? '▾' : '▸'} Filters</Text>
            {activeFilterCount > 0 && (
              <View style={styles.pillBadge}>
                <Text style={styles.pillBadgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.pillClearBtn}
            onPress={clearFilters}
            activeOpacity={0.8}
          >
            <Text style={styles.pillClearText}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Filters */}
      <Animated.View
        pointerEvents={showFilters ? 'auto' : 'none'}
        style={[
          styles.filtersOverlay,
          {
            opacity: filterAnim,
            transform: [
              {
                translateY: filterAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-8, 0],
                }),
              },
              {
                scale: filterAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.98, 1],
                }),
              },
            ],
          },
        ]}
      >
        <View style={styles.filtersCard}>
          <ScrollView
            style={{ maxHeight: 450 }}
            showsVerticalScrollIndicator={true}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled={true}
          >
            <Text style={styles.filterSectionTitle}>Type</Text>
            <ScrollView
              horizontal={true}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterScrollContent}
              nestedScrollEnabled={true}
            >
              {FILTER_OPTIONS.type.map(type => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.filterChip,
                    filters.type.includes(type) && styles.filterChipActive
                  ]}
                  onPress={() => toggleFilter('type', type)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      filters.type.includes(type) && styles.filterChipTextActive
                    ]}
                  >
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.filterSectionTitle}>Status</Text>
            <ScrollView
              horizontal={true}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterScrollContent}
              nestedScrollEnabled={true}
            >
              {FILTER_OPTIONS.status.map(status => (
                <TouchableOpacity
                  key={status}
                  style={[
                    styles.filterChip,
                    filters.status.includes(status) && styles.filterChipActive
                  ]}
                  onPress={() => toggleFilter('status', status)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      filters.status.includes(status) && styles.filterChipTextActive
                    ]}
                  >
                    {status}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.inlineRow}>
              <View style={styles.inlineColumn}>
                <Text style={styles.inlineLabel}>Score</Text>
                <TextInput
                  style={styles.inputChip}
                  value={scoreInput}
                  onChangeText={(value) => {
                    setScoreInput(value);
                    if (value.trim() === '') {
                      setScoreError('');
                      setFilters(prev => ({
                        ...prev,
                        minimumScore: 0,
                      }));
                      return;
                    }
                    const numeric = parseFloat(value);
                    if (Number.isNaN(numeric) || numeric < 1 || numeric > 10) {
                      setScoreError('Invalid score (1-10)');
                      setFilters(prev => ({
                        ...prev,
                        minimumScore: 0,
                      }));
                      return;
                    }
                    setScoreError('');
                    setFilters(prev => ({
                      ...prev,
                      minimumScore: numeric,
                    }));
                  }}
                  keyboardType="numeric"
                  placeholder="1 - 10"
                  placeholderTextColor="#666"
                />
                {!!scoreError && (
                  <Text style={styles.inputErrorText}>{scoreError}</Text>
                )}
              </View>
              <View style={styles.inlineColumn}>
                <Text style={styles.inlineLabel}>Year</Text>
                <TextInput
                  style={styles.inputChip}
                  value={filters.seasonYear}
                  onChangeText={(value) => setFilters(prev => ({ ...prev, seasonYear: value }))}
                  keyboardType="numeric"
                  placeholder="e.g. 2024"
                  placeholderTextColor="#666"
                />
              </View>
            </View>

            <Text style={styles.filterSectionTitle}>Season</Text>
            <ScrollView
              horizontal={true}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterScrollContent}
              nestedScrollEnabled={true}
            >
              {ANIME_SEASONS.map(season => (
                <TouchableOpacity
                  key={season}
                  style={[
                    styles.filterChip,
                    filters.season === season && styles.filterChipActive
                  ]}
                  onPress={() => toggleSingleFilter('season', season)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      filters.season === season && styles.filterChipTextActive
                    ]}
                  >
                    {season}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.filterSectionTitle}>Genres</Text>
            <ScrollView
              horizontal={true}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterScrollContent}
              nestedScrollEnabled={true}
            >
              {ANIME_GENRES.map(genre => (
                <TouchableOpacity
                  key={genre}
                  style={[
                    styles.filterChip,
                    filters.genres.includes(genre) && styles.filterChipActive
                  ]}
                  onPress={() => toggleFilter('genres', genre)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      filters.genres.includes(genre) && styles.filterChipTextActive
                    ]}
                  >
                    {genre}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </ScrollView>
        </View>
      </Animated.View>

      {/* Results */}
      {searchLoading && searchResults.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#ffae00" style={{ transform: [{ scale: 1.5 }] }} />
        </View>
      ) : (
      <Animated.FlatList
          data={searchResults}
          renderItem={renderAnimeCard}
          keyExtractor={KEY_EXTRACTOR}
          numColumns={2}
          contentContainerStyle={styles.listContent}
          initialNumToRender={8}
          maxToRenderPerBatch={10}
          windowSize={7}
          removeClippedSubviews={true}
          overScrollMode="never"
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollYSearch } } }],
            { useNativeDriver: true }
          )}
          onScrollBeginDrag={() => {
            Keyboard.dismiss();
            setShowFilters(false);
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              {searchText || hasActiveFilters ? (
                <Text style={styles.emptyText}>No results found</Text>
              ) : (
                <>
                  <Text style={{ fontSize: 40, marginBottom: 10 }}>🔍</Text>
                  <Text style={styles.emptyText}>Search for your favorite anime</Text>
                </>
              )}
            </View>
          }
          columnWrapperStyle={COLUMN_WRAPPER}
        />
      )}

      {/* ── Top scroll fade (ChatGPT style) ── */}
      <Animated.View style={[styles.scrollFade, { opacity: headerBgOpacitySearch }]} pointerEvents="none">
        <LinearGradient colors={['#030712', 'transparent']} style={StyleSheet.absoluteFill} />
      </Animated.View>

      <BottomNav navigation={navigation} activeRoute="Search" />

      <AnimeModal
        visible={modalVisible}
        anime={selectedAnime}
        onClose={() => setModalVisible(false)}
        onOpenAnime={(nextAnime) => {
          setSelectedAnime(nextAnime);
          setModalVisible(true);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#030712',
  },
  header: {
    position: 'absolute', top: 0, left: 0, right: 0,
    paddingTop: 50,
    paddingBottom: 8,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(3, 7, 18, 0.85)',
    zIndex: 300,
  },
  searchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 4,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    paddingVertical: 6,
  },
  pillFilterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 100,
    backgroundColor: 'rgba(255,174,0,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,174,0,0.25)',
  },
  pillFilterBtnActive: {
    backgroundColor: 'rgba(255,174,0,0.2)',
    borderColor: '#ffae00',
  },
  pillFilterText: {
    color: '#ffae00',
    fontSize: 12,
    fontWeight: '700',
  },
  pillBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#ffae00',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  pillBadgeText: {
    color: '#000',
    fontSize: 10,
    fontWeight: '800',
  },
  pillClearBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  pillClearText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 14,
    fontWeight: '600',
  },
  filtersOverlay: {
    position: 'absolute',
    top: 100,
    left: 0,
    right: 0,
    zIndex: 250,
    paddingHorizontal: 20,
  },
  filtersCard: {
    backgroundColor: 'rgba(3, 7, 18, 0.98)', // Darker to match container
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  filterSectionTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 10,
  },
  filterScrollContent: {
    paddingRight: 6,
  },
  inlineRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
    marginBottom: 4,
  },
  inlineColumn: {
    flex: 1,
  },
  inlineLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  inputChip: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    color: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  inputErrorText: {
    color: '#ff7b7b',
    fontSize: 12,
    marginTop: 6,
  },
  filterChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#ffae00',
  },
  filterChipText: {
    color: '#999',
    fontSize: 14,
  },
  filterChipTextActive: {
    color: '#000000',
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 110,
    paddingBottom: 100,
    flexGrow: 1,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    marginTop: 10,
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#999',
    fontSize: 16,
    marginTop: 20,
  },
  scrollFade: {
    position: 'absolute', top: 0, left: 0, right: 0,
    height: 170, zIndex: 200,
  },
  resultsCountText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    marginBottom: 15,
    marginLeft: 5,
    fontWeight: '600',
  },
});

export default SearchScreen;