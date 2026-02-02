import React, { useState, useCallback, useEffect } from 'react';
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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import AnimeModal from '../components/AnimeModal';
import BottomNav from '../components/BottomNav';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 60) / 2;
const CARD_HEIGHT = CARD_WIDTH * 1.5;

const ANIME_GENRES = [
  "Action", "Adventure", "Comedy", "Drama", "Fantasy",
  "Horror", "Mystery", "Romance", "Sci-Fi", "Slice of Life",
  "Sports", "Supernatural", "Suspense", "Thriller",
];

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
    status: ["FINISHED", "RELEASING"],
    genres: [],
    minimumScore: 0,
  });

  const [showFilters, setShowFilters] = useState(false);

  const ANIME_SEARCH_QUERY = `
    query AdvancedSearch(
      $page: Int = 1,
      $perPage: Int = 20,
      $search: String,
      $format_in: [MediaFormat],
      $status_in: [MediaStatus],
      $averageScore_greater: Int,
      $genre_in: [String]
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
        variables.status_in = filters.status;
      }

      if (filters.minimumScore > 0) {
        variables.averageScore_greater = Math.floor(filters.minimumScore * 10);
      }

      if (filters.genres.length > 0) {
        variables.genre_in = filters.genres;
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
        description: anime.description,
        episodes: anime.episodes,
        format: anime.format,
        status: anime.status,
        genres: anime.genres,
        averageScore: anime.averageScore,
        trailer: anime.trailer,
        studios: anime.studios,
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
    const timeout = setTimeout(() => {
      if (searchText.trim() || filters.genres.length > 0 || filters.type.length > 0) {
        performSearch(1, true);
      } else {
        setSearchResults([]);
      }
    }, 500);

    return () => clearTimeout(timeout);
  }, [searchText, filters]);

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
      status: ["FINISHED", "RELEASING"],
      genres: [],
      minimumScore: 0,
    });
    setSearchText('');
  };

  const renderAnimeCard = ({ item }) => (
    <TouchableOpacity
      style={styles.animeCard}
      onPress={() => {
        setSelectedAnime(item);
        setModalVisible(true);
      }}
      activeOpacity={0.8}
    >
      <Image
        source={{ uri: item.coverImage?.extraLarge || item.coverImage?.large || 'https://via.placeholder.com/300x450' }}
        style={styles.cardImage}
        resizeMode="cover"
      />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.9)']}
        style={styles.cardGradient}
      >
        <Text style={styles.cardTitle} numberOfLines={2}>
          {item.title}
        </Text>
      </LinearGradient>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0a0f1e', '#161b2e']} style={styles.header}>
        <Text style={styles.headerTitle}>Search Anime</Text>
        
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
        <TouchableOpacity
          style={styles.filterToggle}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Text style={styles.filterText}>
            {showFilters ? '▼ Hide Filters' : '▶ Show Filters'}
          </Text>
        </TouchableOpacity>
      </LinearGradient>

      {/* Filters */}
      {showFilters && (
        <ScrollView style={styles.filtersContainer} horizontal={false}>
          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>Genres</Text>
            <View style={styles.filterOptions}>
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
            </View>
          </View>

          <TouchableOpacity style={styles.clearButton} onPress={clearFilters}>
            <Text style={styles.clearButtonText}>Clear All Filters</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* Results */}
      {isSearching && searchResults.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#ff5900" />
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
              <ActivityIndicator color="#ff5900" style={{ marginVertical: 20 }} />
            ) : null
          }
        />
      )}

      <BottomNav navigation={navigation} activeRoute="Search" />

      <AnimeModal
        visible={modalVisible}
        anime={selectedAnime}
        onClose={() => setModalVisible(false)}
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
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15,
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
  filterToggle: {
    paddingVertical: 10,
  },
  filterText: {
    color: '#ff5900',
    fontSize: 16,
    fontWeight: '600',
  },
  filtersContainer: {
    maxHeight: 200,
    backgroundColor: '#161b2e',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  filterSection: {
    marginBottom: 15,
  },
  filterLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  filterChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    marginRight: 8,
    marginBottom: 8,
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
  clearButton: {
    backgroundColor: 'rgba(255, 89, 0, 0.2)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  clearButtonText: {
    color: '#ff5900',
    fontSize: 16,
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
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1a1f2e',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
    justifyContent: 'flex-end',
    padding: 10,
  },
  cardTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
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