import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Animated,
  ScrollView,
  Platform
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import YoutubePlayer from 'react-native-youtube-iframe';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import axios from 'axios';
import RelatedSection from './RelatedSection';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');
  const MODAL_HEADER_HEIGHT = Math.min(width * 0.5, 220);

const AnimeModal = ({ visible, anime, onClose, onOpenAnime }) => {
  const [activeTab, setActiveTab] = useState('info');
  const [isAddingToList, setIsAddingToList] = useState(false);
  const { user, API } = useAuth();
  const { showNotification } = useNotification();
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
      rating: anime.isAdult ? "R - 17+" : (anime.rating || "PG-13"),
      studio,
      synopsis: anime.description?.replace(/<[^>]*>/g, '') || "No description available.",
      bannerImage: anime.bannerImage || image,
      startDate: anime.startDate,
      endDate: anime.endDate,
      trailer: anime.trailer,
      relations: anime.relations?.edges || [],
    };
  }, [anime]);

  const truncateSynopsis = (text, maxLength = 320) => {
    if (!text) return "No description available.";
    return text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
  };

  const getStatusColor = (status) => {
    if (!status) return "#94a3b8";
    const normalizedStatus = status.toString().toUpperCase().replace(/\s+/g, '_');
    const statusColors = {
      "FINISHED": "#10b981",
      "RELEASING": "#3b82f6",
      "NOT_YET_RELEASED": "#fbbf24",
      "CANCELLED": "#ef4444",
      "HIATUS": "#f59e0b"
    };
    return statusColors[normalizedStatus] || "#94a3b8";
  };

  const formatAniListDate = (dateObj, showYear = true) => {
    if (!dateObj) return "TBA";
    if (typeof dateObj === 'string') {
      const parsed = new Date(dateObj);
      if (Number.isNaN(parsed.getTime())) return "TBA";
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const day = String(parsed.getDate()).padStart(2, "0");
      const month = months[parsed.getMonth()];
      return showYear ? `${day} ${month} ${parsed.getFullYear()}` : `${day} ${month}`;
    }
    if (!dateObj.year) return "TBA";
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const day = dateObj.day ? String(dateObj.day).padStart(2, "0") : "??";
    const month = dateObj.month ? months[dateObj.month - 1] : "??";
    return showYear ? `${day} ${month} ${dateObj.year}` : `${day} ${month}`;
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
      const startYear = animeData.startDate.year || (typeof animeData.startDate === 'string' && new Date(animeData.startDate).getFullYear());
      const endYear = animeData.endDate.year || (typeof animeData.endDate === 'string' && new Date(animeData.endDate).getFullYear());
      if (startYear && endYear && startYear === endYear) {
        return `${formatAniListDate(animeData.startDate, false)} - ${formatAniListDate(animeData.endDate, true)}`;
      }
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
      showNotification('error', "Please log in to add anime to your list");
      return;
    }

    setIsAddingToList(true);
    try {
      const userId = user._id || user.id;
      const token = await AsyncStorage.getItem("token");
      await axios.post(`${API}/api/list/${userId}`, {
        category: status,
        animeTitle: animeData.title,
        animeData: anime
      }, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      showNotification('success', `Added to ${status} list!`);
    } catch (error) {
      console.error("Error adding to list:", error);
      showNotification('error', "Failed to add to list");
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
      duration: 200,
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
          {/* Header Banner Section */}
          <Animated.View
            pointerEvents="box-none"
            style={[
              styles.header,
              {
                opacity: scrollY.interpolate({
                  inputRange: [0, 300],
                  outputRange: [1, 0],
                  extrapolate: 'clamp',
                }),
              },
            ]}
          >
            <Image
              source={{ uri: animeData.bannerImage }}
              style={styles.bannerImage}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
            <LinearGradient
              colors={['transparent', 'rgba(3, 7, 18, 0.7)', 'rgba(3, 7, 18, 0.98)']}
              locations={[0, 0.6, 1]}
              style={styles.headerGradient}
            />
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={22} color="#fff" />
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

            {/* Title & Stats */}
            <View style={styles.metaSection}>
              <Text style={styles.title}>
                {animeData.title}
              </Text>
              
              <View style={styles.statsRow}>
                {animeData.score && (
                  <View style={styles.statBadge}>
                    <Ionicons name="star" size={13} color="#ffae00" style={{ marginRight: 4 }} />
                    <Text style={[styles.statText, { color: '#ffae00' }]}>{animeData.score}</Text>
                  </View>
                )}
                <View style={styles.statBadge}>
                  <Ionicons name="tv-outline" size={13} color="rgba(255,255,255,0.7)" style={{ marginRight: 4 }} />
                  <Text style={styles.statText}>{animeData.episodes} Episodes</Text>
                </View>
                <View style={styles.statBadge}>
                  <Text style={[styles.statText, { fontSize: 11, fontWeight: '700' }]}>{animeData.rating}</Text>
                </View>
              </View>
            </View>

            {/* Glanceable Info Grid */}
            <View style={styles.infoGrid}>
              <View style={styles.gridRow}>
                <View style={styles.gridItem}>
                  <Ionicons name="play-circle-outline" size={16} color="#ffae00" style={{ marginRight: 8 }} />
                  <View style={styles.gridTextContainer}>
                    <Text style={styles.gridLabel}>Format</Text>
                    <Text style={styles.gridValue}>{animeData.format || 'N/A'}</Text>
                  </View>
                </View>
                <View style={[styles.gridItem, styles.noRightBorder]}>
                  <Ionicons name="hourglass-outline" size={16} color="#ffae00" style={{ marginRight: 8 }} />
                  <View style={styles.gridTextContainer}>
                    <Text style={styles.gridLabel}>Status</Text>
                    <Text style={[styles.gridValue, { color: getStatusColor(animeData.status) }]}>
                      {animeData.status || 'N/A'}
                    </Text>
                  </View>
                </View>
              </View>
              <View style={[styles.gridRow, styles.noBottomBorder]}>
                <View style={styles.gridItem}>
                  <Ionicons name="videocam-outline" size={16} color="#ffae00" style={{ marginRight: 8 }} />
                  <View style={styles.gridTextContainer}>
                    <Text style={styles.gridLabel}>Studio</Text>
                    <Text style={styles.gridValue}>{animeData.studio || 'N/A'}</Text>
                  </View>
                </View>
                <View style={[styles.gridItem, styles.noRightBorder]}>
                  <Ionicons name="calendar-outline" size={16} color="#ffae00" style={{ marginRight: 8 }} />
                  <View style={styles.gridTextContainer}>
                    <Text style={styles.gridLabel}>Aired</Text>
                    <Text style={styles.gridValue}>{getAiredRange() || 'N/A'}</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Compact Action Bar */}
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[styles.actionButton, styles.watchingBtn]}
                onPress={() => addToList('watching')}
                disabled={isAddingToList}
              >
                  {isAddingToList ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="play" size={13} color="#34d399" style={{ marginRight: 5 }} />
                      <Text style={styles.actionBtnText}>Watching</Text>
                    </>
                  )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.completedBtn]}
                onPress={() => addToList('completed')}
                disabled={isAddingToList}
              >
                <Ionicons name="checkmark-done" size={13} color="#60a5fa" style={{ marginRight: 5 }} />
                <Text style={styles.actionBtnText}>Completed</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.plannedBtn]}
                onPress={() => addToList('planned')}
                disabled={isAddingToList}
              >
                <Ionicons name="bookmark" size={13} color="#fb923c" style={{ marginRight: 5 }} />
                <Text style={styles.actionBtnText}>Plan</Text>
              </TouchableOpacity>
            </View>

            {/* Tabs */}
            <View style={styles.tabContainer}>
              {['info', 'related', 'trailer'].map((tab) => (
                <TouchableOpacity
                  key={tab}
                  style={[styles.tab, activeTab === tab && styles.activeTab]}
                  onPress={() => setActiveTab(tab)}
                >
                  <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
                    {tab === 'info' ? 'Synopsis' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
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
                        outputRange: [6, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              {activeTab === 'info' && (
                <View>
                  <Text style={styles.synopsis}>
                    {truncateSynopsis(animeData.synopsis, 360)}
                  </Text>

                  {animeData.genres.length > 0 && (
                    <View style={styles.genresContainer}>
                      {animeData.genres.map((genre, idx) => (
                        <View key={idx} style={styles.genreTag}>
                          <Text style={styles.genreTagText}>{genre}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
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
                <View style={styles.trailerContainer}>
                  {getTrailerId() ? (
                    <View style={styles.trailerWrapper}>
                      <YoutubePlayer
                        height={200}
                        play={false}
                        videoId={getTrailerId()}
                      />
                    </View>
                  ) : (
                    <Text style={styles.emptyText}>No trailer video available.</Text>
                  )}
                </View>
              )}
            </Animated.View>
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
    backgroundColor: 'rgba(5, 7, 12, 0.85)',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#030712',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: 0,
    overflow: 'hidden',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: MODAL_HEADER_HEIGHT,
    zIndex: 2,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
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
    top: Platform.OS === 'ios' ? 24 : 16,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(3, 7, 18, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  headerSpacer: {
    height: MODAL_HEADER_HEIGHT,
  },
  metaSection: {
    marginBottom: 16,
    zIndex: 5,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    fontFamily: 'OutfitRegular',
    lineHeight: 28,
    marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statText: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'OutfitRegular',
  },
  infoGrid: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
  },
  gridRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  noBottomBorder: {
    borderBottomWidth: 0,
  },
  gridItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.05)',
  },
  noRightBorder: {
    borderRightWidth: 0,
  },
  gridTextContainer: {
    flex: 1,
  },
  gridLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 1,
    fontFamily: 'OutfitRegular',
  },
  gridValue: {
    color: '#fff',
    fontSize: 11.5,
    fontWeight: '700',
    fontFamily: 'OutfitRegular',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  watchingBtn: {
    backgroundColor: 'rgba(16,185,129,0.15)',
    borderColor: 'rgba(16,185,129,0.3)',
  },
  completedBtn: {
    backgroundColor: 'rgba(59,130,246,0.15)',
    borderColor: 'rgba(59,130,246,0.3)',
  },
  plannedBtn: {
    backgroundColor: 'rgba(249,115,22,0.15)',
    borderColor: 'rgba(249,115,22,0.3)',
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 16,
  },
  tab: {
    paddingVertical: 10,
    marginRight: 20,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#ffae00',
  },
  tabText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'OutfitRegular',
  },
  activeTabText: {
    color: '#fff',
    fontWeight: '700',
  },
  tabContent: {
    paddingBottom: 60,
  },
  synopsis: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    lineHeight: 22,
    fontFamily: 'JosefinSans',
    marginBottom: 16,
  },
  genresContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  genreTag: {
    backgroundColor: 'rgba(255, 174, 0, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 174, 0, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  genreTagText: {
    color: '#ffae00',
    fontSize: 11,
    fontWeight: '600',
    fontFamily: 'OutfitRegular',
  },
  trailerContainer: {
    marginTop: 4,
  },
  trailerWrapper: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  emptyText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 12,
    fontFamily: 'JosefinSans',
  },
});

export default AnimeModal;
