import React, { useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

const { width, height } = Dimensions.get('window');
const MODAL_HEADER_HEIGHT = height * 0.42;

const AnimeModal = ({ visible, anime, onClose }) => {
  const [activeTab, setActiveTab] = useState('info');
  const [isAddingToList, setIsAddingToList] = useState(false);
  const { user, API } = useAuth();
  const scrollY = useRef(new Animated.Value(0)).current;

  const animeData = useMemo(() => {
    if (!anime) return null;

    let title = "Untitled";
    if (typeof anime.title === 'string') {
      title = anime.title;
    } else if (anime.title) {
      title = anime.title.english || anime.title.romaji || anime.title.native || "Untitled";
    }

    let image = anime.coverImage?.extraLarge || 
                anime.coverImage?.large || 
                anime.coverImage?.medium ||
                anime.bannerImage || 
                'https://via.placeholder.com/300x450';

    let genres = [];
    if (Array.isArray(anime.genres)) {
      genres = anime.genres.slice(0, 5);
    }

    let score = null;
    if (anime.averageScore) {
      score = (anime.averageScore / 10).toFixed(1);
    } else if (anime.score && anime.score !== "N/A") {
      score = (anime.score / 10).toFixed(1);
    }

    return {
      title,
      image,
      genres,
      score,
      episodes: anime.episodes || anime.episodeCount || "?",
      status: anime.status || "Unknown",
      format: anime.format || anime.type || "Unknown",
      synopsis: anime.description?.replace(/<[^>]*>/g, '') || "No description available.",
      bannerImage: anime.bannerImage || image,
    };
  }, [anime]);

  const truncateSynopsis = (text, maxLength = 300) => {
    if (!text) return "No description available.";
    return text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
  };

  const getStatusColor = (status) => {
    if (!status) return "#6b7280";
    const normalizedStatus = status.toString().toUpperCase().replace(/\s+/g, '_');
    const statusColors = {
      "FINISHED": "#22c55e",
      "RELEASING": "#3b82f6",
      "NOT_YET_RELEASED": "#f59e0b",
      "CANCELLED": "#ef4444",
      "HIATUS": "#f59e0b"
    };
    return statusColors[normalizedStatus] || "#6b7280";
  };

  const addToList = async (status) => {
    if (!user) {
      alert("Please log in to add anime to your list");
      return;
    }

    setIsAddingToList(true);
    try {
      await axios.post(`${API}/api/list/${user._id || user.id}`, {
        category: status,
        animeTitle: animeData.title,
        animeData: anime
      });
      alert(`Added to ${status} list!`);
    } catch (error) {
      console.error("Error adding to list:", error);
      alert("Failed to add to list");
    } finally {
      setIsAddingToList(false);
    }
  };

  if (!visible || !animeData) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.backdrop} />
        <View style={styles.modalContainer}>
          {/* Header with Banner */}
          <Animated.View
            pointerEvents="box-none"
            style={[
              styles.header,
              {
                opacity: scrollY.interpolate({
                  inputRange: [0, 180],
                  outputRange: [1, 0],
                  extrapolate: 'clamp',
                }),
              },
            ]}
          >
            <Image
              source={{ uri: animeData.bannerImage }}
              style={styles.bannerImage}
              resizeMode="cover"
            />
            <LinearGradient
              colors={['transparent', 'rgba(10, 15, 30, 0.65)', 'rgba(10, 15, 30, 0.92)']}
              locations={[0.06, 0.58, 1]}
              style={styles.headerGradient}
            />
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </Animated.View>

          <Animated.ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { y: scrollY } } }],
              { useNativeDriver: true }
            )}
            scrollEventThrottle={16}
          >
            <View style={styles.headerSpacer} />
            {/* Title */}
            <Text style={styles.title} numberOfLines={3}>
              {animeData.title}
            </Text>

            {/* Stats */}
            <View style={styles.statsRow}>
              <View style={styles.statBadge}>
                <Text style={styles.statText}>⭐ {animeData.score || 'N/A'}</Text>
              </View>
              <View style={styles.statBadge}>
                <Text style={styles.statText}>{animeData.episodes} Episodes</Text>
              </View>
              <View style={[styles.statBadge, { backgroundColor: getStatusColor(animeData.status) }]}>
                <Text style={styles.statText}>{animeData.status}</Text>
              </View>
            </View>

            {/* Tabs */}
            <View style={styles.tabContainer}>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'info' && styles.activeTab]}
                onPress={() => setActiveTab('info')}
              >
                <Text style={[styles.tabText, activeTab === 'info' && styles.activeTabText]}>
                  Synopsis
                </Text>
              </TouchableOpacity>
            </View>

            {/* Synopsis */}
            {activeTab === 'info' && (
              <View style={styles.tabContent}>
                <Text style={styles.synopsis}>
                  {truncateSynopsis(animeData.synopsis, 500)}
                </Text>

                {/* Genres */}
                {animeData.genres.length > 0 && (
                  <View style={styles.genresContainer}>
                    <Text style={styles.genresLabel}>Genres:</Text>
                    <View style={styles.genresRow}>
                      {animeData.genres.map((genre, index) => (
                        <View key={index} style={styles.genrePill}>
                          <Text style={styles.genreText}>{genre}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Info Row */}
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Format:</Text>
                  <Text style={styles.infoValue}>{animeData.format}</Text>
                </View>
              </View>
            )}

            {/* Add to List Buttons */}
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.actionButton, styles.watchingButton]}
                onPress={() => addToList('watching')}
                disabled={isAddingToList}
              >
                {isAddingToList ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.actionButtonText}>Add to Watching</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.completedButton]}
                onPress={() => addToList('completed')}
                disabled={isAddingToList}
              >
                <Text style={styles.actionButtonText}>Mark Completed</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.plannedButton]}
                onPress={() => addToList('planned')}
                disabled={isAddingToList}
              >
                <Text style={styles.actionButtonText}>Plan to Watch</Text>
              </TouchableOpacity>
            </View>

            <View style={{ height: 50 }} />
          </Animated.ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#0a0f1e',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: MODAL_HEADER_HEIGHT,
    zIndex: 2,
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  headerGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '100%',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    marginTop: 12,
  },
  headerSpacer: {
    height: MODAL_HEADER_HEIGHT,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  statBadge: {
    backgroundColor: 'rgba(255, 89, 0, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    marginRight: 10,
    marginBottom: 10,
  },
  statText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  tab: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginRight: 15,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#ff5900',
  },
  tabText: {
    color: '#999',
    fontSize: 16,
  },
  activeTabText: {
    color: '#fff',
    fontWeight: '600',
  },
  tabContent: {
    marginBottom: 20,
  },
  synopsis: {
    color: '#ccc',
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 20,
  },
  genresContainer: {
    marginBottom: 20,
  },
  genresLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  genresRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  genrePill: {
    backgroundColor: 'rgba(138, 43, 226, 0.3)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    marginRight: 8,
    marginBottom: 8,
  },
  genreText: {
    color: '#fff',
    fontSize: 14,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  infoLabel: {
    color: '#999',
    fontSize: 16,
  },
  infoValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  actionButtons: {
    marginTop: 20,
  },
  actionButton: {
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  watchingButton: {
    backgroundColor: '#4CAF50',
  },
  completedButton: {
    backgroundColor: '#2196F3',
  },
  plannedButton: {
    backgroundColor: '#FF9800',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default AnimeModal;
