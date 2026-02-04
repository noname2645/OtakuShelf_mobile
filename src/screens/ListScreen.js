import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Alert,
  Modal,
  Platform,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Animated
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import BottomNav from '../components/BottomNav';
import ProfilePill from '../components/ProfilePill';
import AnimeModal from '../components/AnimeModal';

const { width } = Dimensions.get('window');

const AnimeCard = React.memo(({ anime, cardWidth, activeTab, onIncrement, onRating, onRemove, onStatusPress, onCardPress, navigation, styles }) => {
  const [imgError, setImgError] = useState(false);
  const totalEpisodes = anime.totalEpisodes || anime.episodes || 24;
  const episodesWatched = anime.episodesWatched || 0;
  const progress = Math.min((episodesWatched / totalEpisodes) * 100, 100);
  const isCompleted = (anime.status || activeTab) === 'completed';
  const status = (anime.status || activeTab).toLowerCase();

  const getStatusColor = (s) => {
    switch (s) {
      case 'completed': return ['#22c55e', '#16a34a'];
      case 'planned': return ['#f97316', '#ea580c'];
      case 'dropped': return ['#6b7280', '#4b5563'];
      default: return ['#3b82f6', '#1e40af']; // watching/default
    }
  };

  const statusColors = getStatusColor(status);

  const imageUrl = useMemo(() => {
    if (imgError) return `https://picsum.photos/seed/${anime._id || anime.animeId}/200/300`;

    const sources = [
      anime.coverImage?.large,
      anime.coverImage?.extraLarge,
      (typeof anime.coverImage === 'string' ? anime.coverImage : null),
      anime.image,
      anime.image_url,
      anime.images?.jpg?.large_image_url,
      anime.images?.jpg?.image_url,
      anime.poster,
      anime.cover,
      anime.main_picture?.medium,
      anime.main_picture?.large
    ];
    const validSource = sources.find(s => typeof s === 'string' && s.length > 5 && s.startsWith('http'));
    return validSource || `https://placehold.co/300x400/222/fff?text=${encodeURIComponent(anime.title).substring(0, 20)}`;
  }, [anime, imgError]);

  return (
    <View style={[styles.cardContainer, { width: cardWidth }]}>
      <TouchableOpacity
        style={styles.cardPosterContainer}
        activeOpacity={0.9}
        onPress={() => onCardPress(anime)}
      >
        {/* Base Image with Brightness Effect */}
        <View style={styles.imageWrapper}>
          <Image
            source={{ uri: imageUrl }}
            style={styles.posterImage}
            resizeMode="cover"
            onError={() => setImgError(true)}
          />

          {/* Dark overlay for unwatched portion */}
          {!isCompleted && (
            <View style={styles.darkOverlay} />
          )}
        </View>

        {/* Color Overlay for Progress - Only show if not completed */}
        {!isCompleted && (
          <View style={[styles.colorOverlay, { width: `${progress}%` }]}>
            <Image
              source={{ uri: imageUrl }}
              style={[styles.posterImage, { width: cardWidth }]}
              resizeMode="cover"
            />
          </View>
        )}

        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.3)', 'rgba(10,15,30,0.9)']}
          locations={[0, 0.4, 1]}
          style={styles.cardOverlay}
        >
          <Text style={styles.cardTitle} numberOfLines={2}>{anime.title}</Text>

          <View style={styles.episodeInfo}>
            <View style={styles.dot} />
            <Text style={styles.episodeText}>{episodesWatched}/{totalEpisodes} eps</Text>
            {!isCompleted && (
              <TouchableOpacity
                style={styles.plusBtn}
                onPress={() => onIncrement(anime)}
              >
                <Text style={styles.plusBtnText}>+1</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Progress Bar */}
          <View style={styles.progressBarBg}>
            <LinearGradient
              colors={['#667eea', '#764ba2']}
              style={{ width: `${progress}%`, height: '100%' }}
            />
          </View>

          {/* Actions Row */}
          <View style={styles.cardActions}>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map(star => (
                <TouchableOpacity key={star} onPress={() => onRating(anime, star)}>
                  <Ionicons
                    name={star <= (anime.userRating || 0) ? "star" : "star-outline"}
                    size={16}
                    color="#ffd700"
                  />
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity onPress={() => onRemove(anime._id || anime.animeId)}>
              <Ionicons name="trash-outline" size={18} color="#ef4444" />
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* Status Badge */}
        <TouchableOpacity
          style={styles.badgeContainer}
          onPress={() => onStatusPress(anime)}
        >
          <LinearGradient colors={statusColors} style={styles.statusBadge}>
            <Text style={styles.statusText}>{(anime.status || activeTab).toUpperCase()}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </TouchableOpacity>
    </View>
  );
});

const ANIME_DETAILS_QUERY = `
  query ($id: Int) {
    Media (id: $id, type: ANIME) {
      id
      idMal
      title { romaji english native }
      coverImage { extraLarge large medium }
      bannerImage
      description
      episodes
      status
      format
      genres
      averageScore
      studios { nodes { name } }
      startDate { year month day }
      endDate { year month day }
      trailer { id site }
      relations {
        edges {
          relationType
          node {
            id
            title { romaji english native }
            format
            status
            coverImage { medium }
          }
        }
      }
    }
  }
`;

const ListScreen = ({ navigation }) => {
  const { user, API, logout } = useAuth();

  // State
  const [activeTab, setActiveTab] = useState('watching');
  const [animeList, setAnimeList] = useState({
    watching: [],
    completed: [],
    planned: [],
    dropped: [],
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Import State
  const [importing, setImporting] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [importOption, setImportOption] = useState('replace');
  const [importProgress, setImportProgress] = useState('');

  // Editing/Modals
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [selectedAnimeForStatus, setSelectedAnimeForStatus] = useState(null);

  // Details Modal
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [selectedAnimeForDetails, setSelectedAnimeForDetails] = useState(null);

  const wsRef = useRef(null);

  const fetchAnimeDetails = async (anime) => {
    const aniListId = anime.animeId || anime.id;
    // If we only have Mongo _id and no external ID, we can't fetch from AniList easily.
    // Assuming animeId is preserved.
    if (!aniListId) return;

    try {
      const response = await axios.post('https://graphql.anilist.co', {
        query: ANIME_DETAILS_QUERY,
        variables: { id: aniListId }
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      const media = response.data.data.Media;

      if (media) {
        const fullAnime = {
          ...anime,
          ...media,
          title: media.title, // Ensure title object is set if it was string
          coverImage: media.coverImage,
          // Conserve our local status/progress but prioritize media status for display
          userListStatus: anime.status,
          status: media.status,
          episodesWatched: anime.episodesWatched,
          userRating: anime.userRating,
          _id: anime._id,
        };
        setSelectedAnimeForDetails(fullAnime);
      }
    } catch (e) {
      console.log("Failed to fetch rich details from AniList", e);
    }
  };

  const getFallbackImage = (animeTitle) => {
    const encodedTitle = encodeURIComponent(animeTitle || 'Anime Poster');
    return `https://placehold.co/300x180/667eea/ffffff?text=${encodedTitle}&font=roboto`;
  };

  // WebSocket connection
  useEffect(() => {
    if (!user || !user._id) return;

    const connectWebSocket = () => {
      try {
        const backendUrl = API.replace('http://', 'ws://').replace('https://', 'wss://');
        const wsUrl = `${backendUrl}/ws?userId=${user._id}`;

        wsRef.current = new WebSocket(wsUrl);

        wsRef.current.onopen = () => {
          console.log('✅ WebSocket connected');
        };

        wsRef.current.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'progress') {
              if (data.current !== undefined && data.total !== undefined) {
                const progressStr = `${data.current}/${data.total}`;
                setImportProgress(progressStr);
              }

              if (data.completed) {
                setTimeout(() => setImportProgress(''), 2000);
                setImporting(false);
              }

              if (data.error) {
                console.error('Import error:', data.message);
              }
            }
          } catch (e) {
            console.error('Failed to parse WebSocket message:', e);
          }
        };

        wsRef.current.onerror = (error) => {
          console.log('WebSocket connection error (expected in some envs):', error.message);
        };

        wsRef.current.onclose = (event) => {
          if (event.code !== 1000) {
            // Reconnect logic possibly
          }
        };

      } catch (error) {
        console.error('WebSocket setup error:', error);
      }
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [user, API]);

  const fetchAnimeList = useCallback(async () => {
    try {
      if (!refreshing) setLoading(true);
      setError(null);

      if (!user || !user._id) {
        setLoading(false);
        return;
      }

      const userId = user._id;
      const response = await axios.get(`${API}/api/list/${userId}`);

      let listData = response.data;

      const normalizedList = {
        watching: [],
        completed: [],
        planned: [],
        dropped: [],
      };

      if (listData) {
        normalizedList.watching = Array.isArray(listData.watching) ? listData.watching : [];
        normalizedList.completed = Array.isArray(listData.completed) ? listData.completed : [];
        normalizedList.planned = Array.isArray(listData.planned) ? listData.planned : [];
        normalizedList.dropped = Array.isArray(listData.dropped) ? listData.dropped : [];
      }

      setAnimeList(normalizedList);
    } catch (error) {
      console.error("Error fetching list:", error);
      setError("Failed to load anime list");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, API, refreshing]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAnimeList();
  }, [fetchAnimeList]);

  useEffect(() => {
    if (user) {
      fetchAnimeList();
    } else {
      setLoading(false);
    }
  }, [user, fetchAnimeList]);

  // Update helpers
  const updateAnimeInList = useCallback((animeId, updates) => {
    setAnimeList(prev => {
      const newList = { ...prev };
      Object.keys(newList).forEach(category => {
        if (Array.isArray(newList[category])) {
          newList[category] = newList[category].map(anime => {
            if (anime._id === animeId || anime.animeId === animeId) {
              return { ...anime, ...updates };
            }
            return anime;
          });
        }
      });
      return newList;
    });
  }, []);

  const moveAnimeBetweenCategories = useCallback((animeId, fromCategory, toCategory) => {
    setAnimeList(prev => {
      const newList = { ...prev };
      if (!Array.isArray(newList[fromCategory])) newList[fromCategory] = [];
      if (!Array.isArray(newList[toCategory])) newList[toCategory] = [];

      const animeIndex = newList[fromCategory].findIndex(
        anime => anime._id === animeId || anime.animeId === animeId
      );

      if (animeIndex === -1) return prev;

      const [anime] = newList[fromCategory].splice(animeIndex, 1);
      const updatedAnime = { ...anime, status: toCategory };
      newList[toCategory].push(updatedAnime);

      return newList;
    });
  }, []);

  // Grouping Logic
  const groupAnimeByMonthYear = useCallback((inputList, category) => {
    if (!Array.isArray(inputList) || inputList.length === 0) return [];

    const groups = {};

    inputList.forEach(anime => {
      let date;
      let hasValidDate = true;

      if (category === 'completed') {
        if (anime.finishDate) date = new Date(anime.finishDate);
        else if (anime.addedDate) date = new Date(anime.addedDate);
        else if (anime.updatedAt) date = new Date(anime.updatedAt);
        else if (anime.createdAt) date = new Date(anime.createdAt);
        else {
          date = new Date(0);
          hasValidDate = false;
        }
      } else {
        if (anime.addedDate) date = new Date(anime.addedDate);
        else if (anime.createdAt) date = new Date(anime.createdAt);
        else if (anime.updatedAt) date = new Date(anime.updatedAt);
        else {
          date = new Date(0);
          hasValidDate = false;
        }
      }

      if (isNaN(date.getTime())) {
        date = new Date(0);
        hasValidDate = false;
      }

      let key;
      if (!hasValidDate || date.getTime() === 0) {
        key = "Unknown Date";
      } else {
        const month = date.toLocaleString('default', { month: 'long' });
        const year = date.getFullYear();
        key = `${month} ${year}`;
      }

      if (!groups[key]) {
        groups[key] = {
          title: key,
          sortDate: hasValidDate ? new Date(date.getFullYear(), date.getMonth(), 1) : new Date(0),
          hasValidDate: hasValidDate,
          anime: []
        };
      }
      groups[key].anime.push(anime);
    });

    return Object.values(groups).sort((a, b) => {
      if (!a.hasValidDate && b.hasValidDate) return 1;
      if (a.hasValidDate && !b.hasValidDate) return -1;
      return b.sortDate - a.sortDate;
    });
  }, []);

  const sortedAnimeList = useMemo(() => {
    const list = animeList[activeTab];
    if (!Array.isArray(list) || list.length === 0) return [];

    return list.slice().sort((a, b) => {
      const d1 = new Date(activeTab === 'completed' ? (a.finishDate || a.addedDate || 0) : (a.addedDate || a.createdAt || 0));
      const d2 = new Date(activeTab === 'completed' ? (b.finishDate || b.addedDate || 0) : (b.addedDate || b.createdAt || 0));
      return d2 - d1;
    });
  }, [animeList, activeTab]);

  // Actions
  const handleRemove = useCallback(async (animeId) => {
    Alert.alert(
      "Confirm Removal",
      "Are you sure you want to remove this anime from your list?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              if (!user?._id) return;
              await axios.delete(`${API}/api/list/${user._id}/${animeId}`);

              setAnimeList(prev => {
                const newList = { ...prev };
                Object.keys(newList).forEach(category => {
                  if (Array.isArray(newList[category])) {
                    newList[category] = newList[category].filter(
                      anime => anime._id !== animeId && anime.animeId !== animeId
                    );
                  }
                });
                return newList;
              });
            } catch (error) {
              Alert.alert("Error", "Failed to remove anime.");
            }
          }
        }
      ]
    );
  }, [user, API]);

  const handleStatusChange = async (anime, newStatus) => {
    if (!user?._id) return;
    const userId = user._id;
    const animeId = anime._id || anime.animeId;
    const totalEpisodes = anime.totalEpisodes || anime.episodes || 24;
    const currentStatus = anime.status || activeTab;
    const currentEpisodes = anime.episodesWatched || 0;

    try {
      const payload = { status: newStatus, fromCategory: currentStatus };
      let episodeUpdate = {};

      if (newStatus === "completed") {
        payload.episodesWatched = totalEpisodes;
        episodeUpdate = { episodesWatched: totalEpisodes };
      }

      updateAnimeInList(animeId, { status: newStatus, ...episodeUpdate });

      if (currentStatus !== newStatus) {
        moveAnimeBetweenCategories(animeId, currentStatus, newStatus);
      }

      await axios.put(`${API}/api/list/${userId}/${animeId}`, payload);
    } catch (err) {
      console.error("Status update error", err);
      fetchAnimeList(); // Revert
    }
  };

  const handleIncrementEpisode = async (anime) => {
    if (!user?._id) return;
    const userId = user._id;
    const animeId = anime._id || anime.animeId;
    const totalEpisodes = anime.totalEpisodes || anime.episodes || 24;
    const currentEpisodes = anime.episodesWatched || 0;

    if (currentEpisodes >= totalEpisodes) return;

    const updatedEpisodes = currentEpisodes + 1;
    updateAnimeInList(animeId, { episodesWatched: updatedEpisodes });

    try {
      await axios.put(`${API}/api/list/${userId}/${animeId}`, {
        episodesWatched: updatedEpisodes,
        category: activeTab
      });

      if (updatedEpisodes >= totalEpisodes) {
        handleStatusChange(anime, "completed");
      }
    } catch (err) {
      updateAnimeInList(animeId, { episodesWatched: currentEpisodes });
    }
  };

  const handleRatingChange = async (anime, newRating) => {
    if (!user?._id) return;
    const animeId = anime._id || anime.animeId;
    updateAnimeInList(animeId, { userRating: newRating });

    try {
      await axios.put(`${API}/api/list/${user._id}/${animeId}`, {
        userRating: newRating,
        status: anime.status || activeTab
      });
    } catch (err) {
      updateAnimeInList(animeId, { userRating: anime.userRating || 0 }); // Revert
    }
  };


  // Import Logic
  const handleFileSelect = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/xml', 'text/xml'],
        copyToCacheDirectory: true
      });

      if (result.canceled) return;

      const file = result.assets ? result.assets[0] : result;
      setSelectedFile(file);
      setShowImportModal(true);

    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Failed to pick file");
    }
  };

  const handleImportConfirm = async () => {
    if (!selectedFile || !user?._id) return;

    setShowImportModal(false);
    setImporting(true);
    setImportProgress('0/?');

    const formData = new FormData();
    formData.append('malFile', {
      uri: selectedFile.uri,
      name: selectedFile.name,
      type: selectedFile.mimeType || 'text/xml'
    });
    formData.append('userId', user._id);
    formData.append('clearExisting', (importOption === 'replace').toString());

    try {
      const response = await axios.post(`${API}/api/list/import/mal`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        }
      });

      if (response.data.success) {
        Alert.alert("Success", response.data.message);
        fetchAnimeList();
      } else {
        Alert.alert("Error", response.data.message);
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Import Failed", error.response?.data?.message || "Check your internet connection or file format.");
    } finally {
      setImporting(false);
      setImportProgress('');
      setSelectedFile(null);
    }
  };



  return (
    <View style={styles.container}>


      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <View style={styles.tabsScroll}>
          {["watching", "completed", "planned", "dropped"].map(tab => (
            <TouchableOpacity
              key={tab}
              style={[styles.tabButton, activeTab === tab && styles.activeTab]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}

          {/* Import Button */}
          <TouchableOpacity style={styles.importBtn} onPress={handleFileSelect}>
            {importing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="document-text-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.importBtnText}>Import</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Main List */}
      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {loading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#667eea" />
            <Text style={styles.loadingText}>Loading your list...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={fetchAnimeList}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.listContainer}>
            {sortedAnimeList.length > 0 ? (
              <View style={styles.cardsGrid}>
                {sortedAnimeList.map(anime => (
                  <AnimeCard
                    key={anime._id || anime.animeId}
                    anime={anime}
                    cardWidth={(width - 48) / 2}
                    activeTab={activeTab}
                    onIncrement={handleIncrementEpisode}
                    onRating={handleRatingChange}
                    onRemove={handleRemove}
                    onStatusPress={(a) => {
                      setSelectedAnimeForStatus(a);
                      setStatusModalVisible(true);
                    }}
                    onCardPress={(a) => {
                      // Normalize ID for shared AnimeModal
                      const animeForModal = {
                        ...a,
                        id: a.animeId || a.id || a._id
                      };
                      setSelectedAnimeForDetails(animeForModal);
                      setDetailsModalVisible(true);
                      fetchAnimeDetails(a);
                    }}
                    navigation={navigation}
                    styles={styles}
                  />
                ))}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="folder-open-outline" size={50} color="#666" />
                <Text style={styles.emptyTitle}>No anime found</Text>
                <Text style={styles.emptySub}>Start adding to your {activeTab} list!</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      <StatusModal
        visible={statusModalVisible}
        onClose={() => setStatusModalVisible(false)}
        onSelect={(status) => {
          if (selectedAnimeForStatus) {
            handleStatusChange(selectedAnimeForStatus, status);
          }
          setStatusModalVisible(false);
        }}
        currentStatus={selectedAnimeForStatus?.status || activeTab}
      />

      <ImportModal
        visible={showImportModal}
        onClose={() => setShowImportModal(false)}
        onConfirm={handleImportConfirm}
        fileName={selectedFile?.name}
        importOption={importOption}
        setImportOption={setImportOption}
      />

      <AnimeModal
        visible={detailsModalVisible}
        anime={selectedAnimeForDetails}
        onClose={() => setDetailsModalVisible(false)}
        onOpenAnime={(anime) => setSelectedAnimeForDetails(anime)}
      />

      <BottomNav navigation={navigation} activeRoute="List" />
    </View >
  );
};

// Helper Modals
const StatusModal = ({ visible, onClose, onSelect, currentStatus }) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
      <View style={styles.modalContent}>
        <Text style={styles.modalTitle}>Change Status</Text>
        {['watching', 'completed', 'planned', 'dropped'].map(status => (
          <TouchableOpacity
            key={status}
            style={[styles.modalOption, currentStatus === status && styles.modalOptionActive]}
            onPress={() => onSelect(status)}
          >
            <Text style={[styles.modalOptionText, currentStatus === status && { color: '#FF5533' }]}>
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Text>
            {currentStatus === status && <Ionicons name="checkmark" size={20} color="#FF5533" />}
          </TouchableOpacity>
        ))}
      </View>
    </TouchableOpacity>
  </Modal>
);

const ImportModal = ({ visible, onClose, onConfirm, fileName, importOption, setImportOption }) => (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <View style={styles.modalOverlay}>
      <View style={[styles.modalContent, { width: '90%', maxWidth: 400 }]}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Import MAL List</Text>
          <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color="#fff" /></TouchableOpacity>
        </View>

        <View style={styles.fileInfo}>
          <View style={styles.fileIcon}><Ionicons name="document-text" size={24} color="#fff" /></View>
          <Text style={styles.fileName}>{fileName || 'file.xml'}</Text>
        </View>

        <Text style={styles.optionLabel}>Import Options</Text>
        <TouchableOpacity
          style={[styles.radioOption, importOption === 'replace' && styles.radioActive]}
          onPress={() => setImportOption('replace')}
        >
          <View style={styles.radioCircle}>
            {importOption === 'replace' && <View style={styles.radioDot} />}
          </View>
          <View>
            <Text style={styles.radioTitle}>Replace existing list</Text>
            <Text style={styles.radioDesc}>Clears current list first</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.radioOption, importOption === 'merge' && styles.radioActive]}
          onPress={() => setImportOption('merge')}
        >
          <View style={styles.radioCircle}>
            {importOption === 'merge' && <View style={styles.radioDot} />}
          </View>
          <View>
            <Text style={styles.radioTitle}>Merge with existing</Text>
            <Text style={styles.radioDesc}>Adds new entries only</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.modalActions}>
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.confirmBtn} onPress={onConfirm}>
            <Text style={styles.confirmText}>Start Import</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);



const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0f1e',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },

  tabsContainer: {
    paddingVertical: 10,
    marginBottom: 10
  },
  tabsScroll: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 10
  },
  tabButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)'
  },
  activeTab: {
    backgroundColor: '#FF5533',
    borderColor: '#FF5533'
  },
  tabText: {
    color: '#888',
    fontWeight: '600',
    fontSize: 14
  },
  activeTabText: {
    color: '#fff'
  },
  importBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#4f46e5',
  },
  importBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13
  },
  content: {
    flex: 1,
  },
  groupContainer: {
    marginBottom: 30,
    paddingHorizontal: 20
  },
  groupHeader: {
    alignItems: 'center',
    marginBottom: 20,
    position: 'relative'
  },
  groupTitle: {
    color: '#FF775C',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    backgroundColor: '#0a0f1e',
    paddingHorizontal: 20,
    zIndex: 2
  },
  groupLine: {
    height: 2,
    width: '100%',
    position: 'absolute',
    top: 15, // center of text approx
    zIndex: 1
  },
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 15
  },
  cardContainer: {
    height: 280,
    // Width set dynamically
    borderRadius: 16,
    backgroundColor: '#161b2e',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    marginBottom: 15
  },
  cardPosterContainer: {
    flex: 1,
    position: 'relative'
  },
  posterImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imageWrapper: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  darkOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)', // Dark overlay for unwatched portion
    zIndex: 1,
  },
  colorOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    overflow: 'hidden',
    zIndex: 2
  },
  cardOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 15,
    zIndex: 5
  },
  cardTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 5,
    lineHeight: 18
  },
  episodeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4063fd',
    marginRight: 8
  },
  episodeText: {
    color: '#fff',
    fontSize: 14,
    marginRight: 10
  },
  plusBtn: {
    backgroundColor: '#667eea',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10
  },
  plusBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold'
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#444',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 10
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  starsRow: {
    flexDirection: 'row',
    gap: 2
  },
  badgeContainer: {
    position: 'absolute',
    top: 15,
    right: 15,
    zIndex: 10
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold'
  },
  loadingContainer: {
    padding: 50,
    alignItems: 'center'
  },
  loadingText: {
    color: '#888',
    marginTop: 10
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 50,
    opacity: 0.7
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 10
  },
  emptySub: {
    color: '#666',
    marginTop: 5
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalContent: {
    backgroundColor: '#1a1f38',
    padding: 20,
    borderRadius: 20,
    width: 300,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)'
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center'
  },
  modalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)'
  },
  modalOptionActive: {
    backgroundColor: 'rgba(255, 85, 51, 0.1)',
    marginHorizontal: -20,
    paddingHorizontal: 20
  },
  modalOptionText: {
    color: '#ccc',
    fontSize: 16
  },
  // Import Modal Specifics
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20
  },
  fileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20
  },
  fileIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#4f46e5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10
  },
  fileName: {
    color: '#fff',
    flex: 1
  },
  optionLabel: {
    color: '#fff',
    fontWeight: 'bold',
    marginBottom: 10
  },
  radioOption: {
    flexDirection: 'row',
    padding: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    marginBottom: 10,
    alignItems: 'center'
  },
  radioActive: {
    borderColor: '#FF5533',
    backgroundColor: 'rgba(255, 85, 51, 0.05)'
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#ccc',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF5533'
  },
  radioTitle: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14
  },
  radioDesc: {
    color: '#888',
    fontSize: 12
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10
  },
  cancelBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center'
  },
  cancelText: { color: '#ccc' },
  confirmBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#FF5533',
    alignItems: 'center'
  },
  confirmText: { color: '#fff', fontWeight: 'bold' }
});

export default ListScreen;
