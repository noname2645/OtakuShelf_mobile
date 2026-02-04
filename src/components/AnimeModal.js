import React, { useState, useMemo, useRef, useEffect } from 'react';
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
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import YoutubePlayer from 'react-native-youtube-iframe';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import RelatedSection from './RelatedSection';

const { width, height } = Dimensions.get('window');
const MODAL_HEADER_HEIGHT = height * 0.42;

const AnimeModal = ({ visible, anime, onClose, onOpenAnime }) => {
  const [activeTab, setActiveTab] = useState('info');
  const [isAddingToList, setIsAddingToList] = useState(false);
  const { user, API } = useAuth();
  const scrollY = useRef(new Animated.Value(0)).current;
  const tabAnim = useRef(new Animated.Value(0)).current;

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

    let studio = "N/A";
    if (anime.studios) {
      if (anime.studios.edges) {
        const edges = anime.studios.edges.slice(0, 2);
        studio = edges.map(edge => edge?.node?.name).filter(Boolean).join(", ") || "N/A";
      } else if (anime.studios.nodes) {
        const nodes = anime.studios.nodes.slice(0, 2);
        studio = nodes.map(node => node?.name).filter(Boolean).join(", ") || "N/A";
      }
    }

    return {
      title,
      image,
      genres,
      score,
      episodes: anime.episodes || anime.episodeCount || "?",
      status: anime.status || "Unknown",
      format: anime.format || anime.type || "Unknown",
      rating: anime.isAdult ? "R - 17+ (violence & profanity)" : (anime.rating || "PG-13"),
      studio,
      synopsis: anime.description?.replace(/<[^>]*>/g, '') || "No description available.",
      bannerImage: anime.bannerImage || image,
      startDate: anime.startDate,
      endDate: anime.endDate,
      trailer: anime.trailer,
      relations: anime.relations?.edges || [],
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
      "NOT_YET_RELEASED": "#3b82f6",
      "CANCELLED": "#ef4444",
      "HIATUS": "#f59e0b"
    };
    return statusColors[normalizedStatus] || "#6b7280";
  };

  const formatAniListDate = (dateObj) => {
    if (!dateObj) return "TBA";
    if (typeof dateObj === 'string') {
      const parsed = new Date(dateObj);
      if (Number.isNaN(parsed.getTime())) return "TBA";
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const day = String(parsed.getDate()).padStart(2, "0");
      const month = months[parsed.getMonth()];
      return `${day} ${month} ${parsed.getFullYear()}`;
    }
    if (!dateObj.year) return "TBA";
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const day = dateObj.day ? String(dateObj.day).padStart(2, "0") : "??";
    const month = dateObj.month ? months[dateObj.month - 1] : "??";
    return `${day} ${month} ${dateObj.year}`;
  };

  const getAiredRange = () => {
    if (!anime) return "TBA";
    const startValid = !!animeData.startDate && formatAniListDate(animeData.startDate) !== "TBA";
    const endValid = !!animeData.endDate && formatAniListDate(animeData.endDate) !== "TBA";

    if (!startValid && !endValid) return "TBA";
    if (anime.format === "MOVIE" && startValid) {
      return formatAniListDate(animeData.startDate);
    }
    if (startValid && endValid) {
      return `${formatAniListDate(animeData.startDate)} - ${formatAniListDate(animeData.endDate)}`;
    }
    if (startValid) {
      const startDate = formatAniListDate(animeData.startDate);
      return `${startDate} - ${animeData.status === 'RELEASING' ? 'Ongoing' : 'TBA'}`;
    }
    return "TBA";
  };

  const getTrailerId = () => {
    if (animeData?.trailer?.site === 'youtube' && animeData?.trailer?.id) {
      return animeData.trailer.id;
    }
    return null;
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

  useEffect(() => {
    if (visible) {
      setActiveTab('info');
    }
  }, [visible, anime?.id]);

  useEffect(() => {
    tabAnim.setValue(0);
    Animated.timing(tabAnim, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [activeTab, tabAnim]);

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
            <View style={styles.typeBadge}>
              <Text style={styles.typeBadgeText}>{animeData.format}</Text>
              <View style={styles.typeBadgeDot} />
              <Text style={styles.typeBadgeDate}>{getAiredRange()}</Text>
            </View>
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
              <View style={styles.statBadge}>
                <Text style={styles.statText}>{animeData.rating}</Text>
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
              <TouchableOpacity
                style={[styles.tab, activeTab === 'related' && styles.activeTab]}
                onPress={() => setActiveTab('related')}
              >
                <Text style={[styles.tabText, activeTab === 'related' && styles.activeTabText]}>
                  Related
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'trailer' && styles.activeTab]}
                onPress={() => setActiveTab('trailer')}
              >
                <Text style={[styles.tabText, activeTab === 'trailer' && styles.activeTabText]}>
                  Trailer
                </Text>
              </TouchableOpacity>
            </View>

            {/* Tab Content */}
            <Animated.View
              key={activeTab}
              style={[
                styles.tabContent,
                {
                  opacity: tabAnim,
                  transform: [
                    {
                      translateY: tabAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [8, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              {activeTab === 'info' && (
                <>
                  <Text style={styles.synopsis}>
                    {truncateSynopsis(animeData.synopsis, 500)}
                  </Text>

                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Status:</Text>
                    <Text style={[styles.infoValue, { color: getStatusColor(animeData.status) }]}>
                      {animeData.status}
                    </Text>
                  </View>

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

                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Studio:</Text>
                    <Text style={styles.infoValue}>{animeData.studio}</Text>
                  </View>
                </>
              )}

              {activeTab === 'related' && (
                <RelatedSection
                  animeId={anime?.id}
                  animeMalId={anime?.idMal}
                  onSelect={(selected) => {
                    if (typeof onOpenAnime === 'function') {
                      onOpenAnime(selected);
                    }
                    setActiveTab('info');
                  }}
                />
              )}

              {activeTab === 'trailer' && (
                <>
                  {getTrailerId() ? (
                    <View style={styles.trailerWrapper}>
                      <YoutubePlayer
                        height={220}
                        play={false}
                        videoId={getTrailerId()}
                      />
                    </View>
                  ) : (
                    <Text style={styles.emptyText}>No trailer available.</Text>
                  )}
                </>
              )}
            </Animated.View>

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
  typeBadge: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: 16,
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 8,
    zIndex: 3,
  },
  typeBadgeText: {
    color: '#8cc8ff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  typeBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    marginHorizontal: 10,
  },
  typeBadgeDate: {
    color: '#e5e7eb',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.2,
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
  emptyText: {
    color: '#999',
    fontSize: 14,
  },
  trailerWrapper: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000',
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
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  infoLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginRight: 6,
  },
  infoValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
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
