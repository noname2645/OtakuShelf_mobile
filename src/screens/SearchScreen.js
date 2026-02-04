import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Image,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import AnimeModal from '../components/AnimeModal';
import BottomNav from '../components/BottomNav';
import BeautifulLoader from '../components/BeautifulLoader';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 60) / 2;
const CARD_HEIGHT = CARD_WIDTH * 1.45;

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

const FILTER_OPTIONS = {
  type: ["TV", "MOVIE", "OVA", "ONA", "SPECIAL"],
  status: ["FINISHED", "RELEASING", "TBA"]
};

const SearchScreen = ({ navigation }) => {
  const { API } = useAuth();
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedAnime, setSelectedAnime] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

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

  const performSearch = async (page = 1, isNewSearch = false) => {
    try {
      if (isNewSearch) {
        setIsSearching(true);
        setSearchResults([]);
      }

      const variables = {
        page,
        perPage: 20
      };

      if (searchText.trim()) {
        variables.search = searchText.trim();
      }

      if (filters.type.length > 0) {
        variables.format_in = filters.type;
      }

      if (filters.status.length > 0) {
        variables.status_in = filters.status.map(status =>
          status === 'TBA' ? 'NOT_YET_RELEASED' : status
        );
      }

      if (filters.minimumScore > 0) {
        variables.averageScore_greater = Math.floor(filters.minimumScore * 10);
      }

      if (filters.genres.length > 0) {
        variables.genre_in = filters.genres;
      }

      if (filters.season) {
        variables.season = filters.season;
      }

      if (filters.seasonYear && filters.seasonYear.trim() !== "") {
        const year = parseInt(filters.seasonYear, 10);
        if (!Number.isNaN(year) && year > 1900) {
          variables.seasonYear = year;
        }
      }

      const response = await axios.post(
        'https://graphql.anilist.co',
        {
          query: ANIME_SEARCH_QUERY,
          variables
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        }
      );

      const responseData = response.data.data.Page;
      const results = responseData.media.map(anime => ({
        id: anime.id,
        idMal: anime.idMal,
        title: anime.title?.english || anime.title?.romaji || anime.title?.native || "Unknown",
        coverImage: {
          large: anime.coverImage?.large,
          extraLarge: anime.coverImage?.extraLarge,
          medium: anime.coverImage?.medium
        },
        bannerImage: anime.bannerImage,
        startDate: anime.startDate,
        endDate: anime.endDate,
        description: anime.description,
        episodes: anime.episodes,
        format: anime.format,
        status: anime.status,
        genres: anime.genres,
        averageScore: anime.averageScore,
        trailer: anime.trailer,
        studios: anime.studios,
        relations: anime.relations,
      }));

      setHasMore(responseData.pageInfo.hasNextPage);

      if (isNewSearch) {
        setSearchResults(results);
        setCurrentPage(1);
      } else {
        setSearchResults(prev => [...prev, ...results]);
        setCurrentPage(page);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    Animated.timing(filterAnim, {
      toValue: showFilters ? 1 : 0,
      duration: showFilters ? 220 : 180,
      useNativeDriver: true,
    }).start();
  }, [showFilters, filterAnim]);

  useEffect(() => {
    const trimmed = searchText.trim();
    if (!trimmed) {
      if (!hasActiveFilters) {
        setSearchResults([]);
      }
      return;
    }

    const timeout = setTimeout(() => {
      performSearch(1, true);
    }, 200);

    return () => clearTimeout(timeout);
  }, [searchText, hasActiveFilters]);

  useEffect(() => {
    const currentSearch = searchTextRef.current.trim();
    if (!hasActiveFilters && !currentSearch) {
      setSearchResults([]);
      return;
    }
    performSearch(1, true);
  }, [filters, hasActiveFilters]);

  const loadMore = () => {
    if (!isSearching && hasMore) {
      performSearch(currentPage + 1, false);
    }
  };

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

  const renderAnimeCard = ({ item, index }) => {
    return (
      <View>
        <TouchableOpacity
          style={styles.animeCard}
          onPress={() => {
            setSelectedAnime(item);
            setModalVisible(true);
          }}
          activeOpacity={0.8}
        >
          <View style={styles.cardInner}>
            <Image
              source={{ uri: item.coverImage?.extraLarge || item.coverImage?.large || 'https://via.placeholder.com/300x450' }}
              style={styles.cardImage}
              resizeMode="cover"
            />
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.8)', 'rgba(0,0,0,0.95)']}
              locations={[0, 0.3, 0.7, 1]}
              style={styles.gradientOverlay}
            />
            <View style={styles.titleOverlay}>
              <Text style={styles.cardTitle} numberOfLines={2}>
                {item.title}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header - Same background as container */}
      <View style={styles.header}>
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by title..."
            placeholderTextColor="#666"
            value={searchText}
            onChangeText={setSearchText}
          />
        </View>

        {/* Filter Toggle */}
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={styles.filterToggleButton}
            onPress={() => setShowFilters(!showFilters)}
            activeOpacity={0.8}
          >
            <View style={styles.filterToggleContent}>
              <Text style={styles.filterToggleIcon}>{showFilters ? '▾' : '▸'}</Text>
              <Text style={styles.filterToggleText}>
                {showFilters ? 'Hide Filters' : 'Show Filters'}
              </Text>
            </View>
            {activeFilterCount > 0 && (
              <View style={styles.filterToggleBadge}>
                <Text style={styles.filterToggleBadgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.clearInlineButton}
            onPress={clearFilters}
            activeOpacity={0.8}
          >
            <Text style={styles.clearInlineText}>Clear</Text>
          </TouchableOpacity>
        </View>

        {/* Gradient fade at bottom of header */}

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
          <Text style={styles.filterSectionTitle}>Type</Text>
          <ScrollView
            horizontal={true}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScrollContent}
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
        </View>
      </Animated.View>

      {/* Results */}
      {isSearching && searchResults.length === 0 ? (
        <View style={styles.loadingContainer}>
          <BeautifulLoader />
          <Text style={styles.loadingText}>Searching...</Text>
        </View>
      ) : (
        <FlatList
          data={searchResults}
          renderItem={renderAnimeCard}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          numColumns={2}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {searchText || filters.genres.length > 0
                  ? 'No results found'
                  : 'Start searching for anime'}
              </Text>
            </View>
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            isSearching && searchResults.length > 0 ? (
              <View style={{ alignItems: 'center', marginVertical: 20 }}>
                <View style={{ transform: [{ scale: 0.5 }] }}>
                  <BeautifulLoader />
                </View>
              </View>
            ) : null
          }
        />
      )}

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
    backgroundColor: '#0a0f1e',
  },
  header: {
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: 'transparent',
    zIndex: 100,
  },
  headerGradient: {
    position: 'absolute',
    bottom: -20,
    left: 0,
    right: 0,
    height: 30,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 15,
    marginBottom: 15,
  },
  searchIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    paddingVertical: 12,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  filterToggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  filterToggleContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterToggleIcon: {
    color: '#ffb36b',
    fontSize: 16,
    marginRight: 8,
  },
  filterToggleText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  filterToggleBadge: {
    minWidth: 26,
    paddingHorizontal: 8,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#ff5900',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterToggleBadgeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  clearInlineButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 89, 0, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 89, 0, 0.4)',
  },
  clearInlineText: {
    color: '#ffb36b',
    fontSize: 14,
    fontWeight: '700',
  },
  filtersOverlay: {
    position: 'absolute',
    top: 150,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 20,
  },
  filtersCard: {
    backgroundColor: 'rgba(10, 15, 30, 0.98)', // Darker to match container
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
    backgroundColor: '#ff5900',
  },
  filterChipText: {
    color: '#999',
    fontSize: 14,
  },
  filterChipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 100,
  },
  animeCard: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    marginRight: 20,
    marginBottom: 20,
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
    backgroundColor: 'transparent',
    zIndex: 1,
  },
  cardTitle: {
    fontFamily: 'Outfit',
    fontWeight: '600',
    letterSpacing: 1,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    color: '#ff6a00',
    textShadowColor: 'rgba(190, 79, 0, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
    includeFontPadding: true,
    textAlignVertical: 'center',
    padding: 0,
    margin: 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
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
    paddingTop: 100,
  },
  emptyText: {
    color: '#999',
    fontSize: 16,
  },
});

export default SearchScreen;


