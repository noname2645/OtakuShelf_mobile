import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  Platform,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  SectionList,
  TextInput,
  ScrollView,
  Animated,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import axios from 'axios';
import Svg, { Path, Line, Circle, Rect, Polyline } from 'react-native-svg';
import { useAuth } from '../contexts/AuthContext';
import BottomNav from '../components/BottomNav';
import AnimeModal from '../components/AnimeModal';
import StarRating from '../components/StarRating';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');
const CARD_W = (width - 40 - 14) / 2;
const CARD_H = CARD_W * 1.5;

const STATUS_CONFIG = {
  watching: { color: '#22c55e', bg: 'rgba(34,197,94,0.15)', label: 'Watching' },
  completed: { color: '#3b82f6', bg: 'rgba(59,130,246,0.15)', label: 'Completed' },
  planned: { color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)', label: 'Plan to Watch' },
  dropped: { color: '#ef4444', bg: 'rgba(239,68,68,0.15)', label: 'Dropped' },
  on_hold: { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', label: 'On Hold' },
};

const TAB_ORDER = ['watching', 'completed', 'planned', 'dropped'];

// ─── SVG Icons ────────────────────────────────────────────────────────

const HeartSvg = ({ filled }) => (
  <Svg width={14} height={14} viewBox="0 0 24 24"
    fill={filled ? '#ff2a5f' : 'none'}
    stroke={filled ? '#ff2a5f' : 'rgba(255,255,255,0.6)'}
    strokeWidth={2}
  >
    <Path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </Svg>
);

const PlusSvg = () => (
  <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#ff5900" strokeWidth={2.5}>
    <Line x1="12" y1="5" x2="12" y2="19" />
    <Line x1="5" y1="12" x2="19" y2="12" />
  </Svg>
);

const MinusSvg = () => (
  <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#ff5900" strokeWidth={2.5}>
    <Line x1="5" y1="12" x2="19" y2="12" />
  </Svg>
);

const ClapboardSvg = () => (
  <Svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="#ff5900" strokeWidth={2}>
    <Rect x="2" y="4" width="20" height="16" rx="2" />
    <Line x1="8" y1="2" x2="8" y2="6" />
    <Line x1="16" y1="2" x2="16" y2="6" />
    <Line x1="2" y1="10" x2="22" y2="10" />
  </Svg>
);

const TrashSvg = () => (
  <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#ff4d4d" strokeWidth={2}>
    <Polyline points="3 6 5 6 21 6" />
    <Path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </Svg>
);

const CheckSvg = () => (
  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth={3}>
    <Polyline points="20 6 9 17 4 12" />
  </Svg>
);

const SearchSvg = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth={2}>
    <Circle cx="11" cy="11" r="8" />
    <Line x1="21" y1="21" x2="16.65" y2="16.65" />
  </Svg>
);

const ANIME_DETAILS_QUERY = `
  query ($id: Int) {
    Media (id: $id, type: ANIME) {
      id idMal
      title { romaji english native }
      coverImage { extraLarge large medium }
      bannerImage description episodes status format genres averageScore
      studios { nodes { name } }
      startDate { year month day }
      endDate { year month day }
      trailer { id site }
      relations {
        edges { relationType node { id title { romaji english native } format status coverImage { medium } } }
      }
    }
  }
`;

const TabBtn = React.memo(({ tab, label, isActive, onPress }) => (
  <TouchableOpacity style={[s.tabBtn, isActive && s.tabActive]} onPress={() => onPress(tab)}>
    <Text style={[s.tabLabel, isActive && s.tabLabelActive]}>{label}</Text>
  </TouchableOpacity>
));

// ─── Premium Anime Card ───────────────────────────────────────────────

const PremiumAnimeCard = React.memo(({
  anime, cardWidth, status,
  onIncrement, onDecrement, onRating, onRemove, onStatusChange, onCardPress, onFavoriteToggle
}) => {
  const [imgErr, setImgErr] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const totalEp = anime.totalEpisodes || anime.episodes || 24;
  const currEp = anime.episodesWatched || 0;
  const progress = totalEp > 0 ? Math.min((currEp / totalEp) * 100, 100) : 0;
  const resolvedStatus = (status || anime.status || 'watching').toLowerCase();
  const cfg = STATUS_CONFIG[resolvedStatus] || STATUS_CONFIG.watching;
  const isFav = anime.favorite || false;

  const imageUrl = useMemo(() => {
    if (imgErr) return `https://placehold.co/300/400/222/fff?text=No+Image`;
    return anime.coverImage?.large || anime.coverImage?.extraLarge ||
      anime.image || anime.image_url || anime.images?.jpg?.large_image_url ||
      anime.main_picture?.medium || `https://placehold.co/300/400/222/fff?text=Anime`;
  }, [anime, imgErr]);

  const title = anime.title?.english || anime.title?.romaji || anime.title || 'Unknown';

  return (
    <View style={[s.cardOuter, { width: cardWidth, height: CARD_H }]}>
      <TouchableOpacity
        activeOpacity={0.95}
        onPress={() => onCardPress?.(anime)}
        onLongPress={() => setMenuOpen(true)}
        delayLongPress={400}
        style={s.cardTouch}
      >
        {/* ── Full card image ── */}
        <Image source={{ uri: imageUrl }} style={s.cardImage} contentFit="cover" cachePolicy="memory-disk" onError={() => setImgErr(true)} />

        {/* ── Full fade overlay ── */}
        <LinearGradient
          colors={['transparent', 'rgba(12,16,28,0.3)', 'rgba(12,16,28,0.75)', '#0c101c']}
          locations={[0, 0.35, 0.65, 1]}
          style={s.fullFade}
        />

        {/* ── Badges ── */}
        <View style={s.badgesRow}>
          <TouchableOpacity
            style={s.favBtn}
            onPress={() => onFavoriteToggle?.(anime)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <HeartSvg filled={isFav} />
          </TouchableOpacity>
          <View style={[s.statusPill, { backgroundColor: cfg.bg, borderColor: cfg.color }]}>
            <Text style={[s.statusPillText, { color: cfg.color }]}>{cfg.label.toUpperCase()}</Text>
          </View>
        </View>

        {/* ── Body ── */}
        <View style={s.cardBody}>
          <Text style={s.cardTitle} numberOfLines={2}>{title}</Text>

          {/* Progress Box */}
          <View style={s.progressBox}>
            <View style={s.progressRow}>
              <TouchableOpacity
                style={s.epBtn}
                onPress={() => onDecrement?.(anime)}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <MinusSvg />
              </TouchableOpacity>
              <View style={s.epInfo}>
                <Text style={s.epLabel}>EPISODES</Text>
                <Text style={s.epValue}>{currEp} / {totalEp}</Text>
              </View>
              <TouchableOpacity
                style={s.epBtn}
                onPress={() => onIncrement?.(anime)}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <PlusSvg />
              </TouchableOpacity>
            </View>
            <View style={s.progressTrack}>
              <View style={[s.progressFill, { width: `${progress}%`, backgroundColor: cfg.color }]} />
            </View>
          </View>

          {/* Footer */}
          <View style={s.cardFooter}>
            <View style={s.ratingSection}>
              <Text style={s.ratingLabel}>YOUR RATING</Text>
              <View style={s.starRow}>
                <StarRating rating={anime.userRating || 0} onRate={(r) => onRating?.(anime, r)} size={20} maxStars={5} />
              </View>
            </View>
            <TouchableOpacity
              style={s.removeBtn}
              onPress={() => onRemove?.(anime._id || anime.animeId)}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <TrashSvg />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>

      {/* ── Status Menu Dropdown ── */}
      {menuOpen && (
        <TouchableOpacity style={s.menuOverlay} activeOpacity={1} onPress={() => setMenuOpen(false)}>
          <View style={s.menuDropdown}>
            {TAB_ORDER.map(tab => {
              const c = STATUS_CONFIG[tab];
              const isCurrent = tab === status;
              return (
                <TouchableOpacity
                  key={tab}
                  style={[s.menuItem, isCurrent && { backgroundColor: c.bg }]}
                  onPress={() => {
                    setMenuOpen(false);
                    onStatusChange?.(anime, tab);
                  }}
                >
                  <Text style={[s.menuItemText, { color: isCurrent ? c.color : 'rgba(255,255,255,0.7)' }]}>
                    {c.label}
                  </Text>
                  {isCurrent && <CheckSvg />}
                </TouchableOpacity>
              );
            })}
            <View style={s.menuDivider} />
            <TouchableOpacity
              style={s.menuRemoveItem}
              onPress={() => {
                setMenuOpen(false);
                onRemove?.(anime._id || anime.animeId);
              }}
            >
              <Text style={s.menuRemoveText}>Remove</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
});

// ─── List Screen ──────────────────────────────────────────────────────

const ListScreen = () => {
  const { user, API } = useAuth();

  const [activeTab, setActiveTab] = useState('watching');
  const [animeList, setAnimeList] = useState({
    watching: [], completed: [], planned: [], dropped: [], on_hold: [],
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Import
  const [importing, setImporting] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [importOption, setImportOption] = useState('replace');
  const [importProgress, setImportProgress] = useState('');

  // Add Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addQuery, setAddQuery] = useState('');
  const [addResults, setAddResults] = useState([]);
  const [addLoading, setAddLoading] = useState(false);
  const addDebounce = useRef(null);

  // Detail
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedAnime, setSelectedAnime] = useState(null);

  const wsRef = useRef(null);
  const scrollYList = useRef(new Animated.Value(0)).current;
  const headerBgOpacityList = scrollYList.interpolate({
    inputRange: [0, 100],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  // ── WebSocket ──
  useEffect(() => {
    if (!user?._id) return;
    const connect = () => {
      try {
        const wsUrl = `${API.replace('http://', 'ws://').replace('https://', 'wss://')}/ws?userId=${user._id}`;
        wsRef.current = new WebSocket(wsUrl);
        wsRef.current.onmessage = (e) => {
          try {
            const d = JSON.parse(e.data);
            if (d.type === 'progress') {
              setImportProgress(d.current !== undefined ? `${d.current}/${d.total}` : '');
              if (d.completed) { setTimeout(() => setImportProgress(''), 2000); setImporting(false); }
            }
          } catch (_) {}
        };
      } catch (_) {}
    };
    connect();
    return () => wsRef.current?.close();
  }, [user, API]);

  // ── Fetch List ──
  const fetchAnimeList = useCallback(async () => {
    try {
      if (!refreshing) setLoading(true);
      setError(null);
      const uid = user?._id || user?.id;
      if (!uid) { setLoading(false); return; }
      const token = await AsyncStorage.getItem('token');
      const res = await axios.get(`${API}/api/list/${uid}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = res.data?.data || res.data;
      setAnimeList({
        watching: Array.isArray(data.watching) ? data.watching : [],
        completed: Array.isArray(data.completed) ? data.completed : [],
        planned: Array.isArray(data.planned) ? data.planned : [],
        dropped: Array.isArray(data.dropped) ? data.dropped : [],
        on_hold: Array.isArray(data.on_hold) ? data.on_hold : [],
      });
    } catch (e) {
      setError('Failed to load anime list');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, API, refreshing]);

  const onRefresh = useCallback(() => { setRefreshing(true); fetchAnimeList(); }, [fetchAnimeList]);

  useEffect(() => { if (user) fetchAnimeList(); else setLoading(false); }, [user, fetchAnimeList]);

  // ── Update helpers ──
  const updateAnimeInList = useCallback((id, updates) => {
    setAnimeList(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(cat => {
        if (Array.isArray(next[cat])) {
          next[cat] = next[cat].map(a => (a._id === id || a.animeId === id) ? { ...a, ...updates } : a);
        }
      });
      return next;
    });
  }, []);

  const moveAnime = useCallback((id, fromCat, toCat) => {
    setAnimeList(prev => {
      const next = { ...prev };
      const from = next[fromCat] || [];
      const idx = from.findIndex(a => a._id === id || a.animeId === id);
      if (idx === -1) return prev;
      const [item] = from.splice(idx, 1);
      next[fromCat] = [...from];
      next[toCat] = [...(next[toCat] || []), { ...item, status: toCat }];
      return next;
    });
  }, []);

  // ── Actions ──
  const handleStatusChange = useCallback(async (anime, newStatus) => {
    const uid = user?._id || user?.id;
    if (!uid) return;
    const id = anime._id || anime.animeId;
    const total = anime.totalEpisodes || anime.episodes || 24;
    const oldStatus = anime.status || activeTab;

    const payload = { status: newStatus, fromCategory: oldStatus };
    if (newStatus === 'completed') {
      payload.episodesWatched = total;
      updateAnimeInList(id, { status: newStatus, episodesWatched: total });
    } else {
      updateAnimeInList(id, { status: newStatus });
    }
    if (oldStatus !== newStatus) moveAnime(id, oldStatus, newStatus);

    try {
      const token = await AsyncStorage.getItem('token');
      await axios.put(`${API}/api/list/${uid}/${id}`, payload, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    } catch { fetchAnimeList(); }
  }, [user, API, activeTab]);

  const handleFavoriteToggle = useCallback(async (anime) => {
    const uid = user?._id || user?.id;
    if (!uid) return;
    const id = anime._id || anime.animeId;
    const next = !anime.favorite;
    updateAnimeInList(id, { favorite: next });
    try {
      const token = await AsyncStorage.getItem('token');
      await axios.put(`${API}/api/list/${uid}/${id}`, { favorite: next, status: anime.status || activeTab }, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    } catch { updateAnimeInList(id, { favorite: !next }); }
  }, [user, API, activeTab]);

  const handleIncrement = useCallback(async (anime) => {
    const uid = user?._id || user?.id;
    if (!uid) return;
    const id = anime._id || anime.animeId;
    const total = anime.totalEpisodes || anime.episodes || 24;
    const curr = anime.episodesWatched || 0;
    if (curr >= total) return;
    const next = curr + 1;
    updateAnimeInList(id, { episodesWatched: next });
    try {
      const token = await AsyncStorage.getItem('token');
      await axios.put(`${API}/api/list/${uid}/${id}`, { episodesWatched: next, category: activeTab }, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (next >= total) handleStatusChange(anime, 'completed');
    } catch {
      updateAnimeInList(id, { episodesWatched: curr });
    }
  }, [user, API, activeTab, handleStatusChange]);

  const handleDecrement = useCallback(async (anime) => {
    const uid = user?._id || user?.id;
    if (!uid) return;
    const id = anime._id || anime.animeId;
    const curr = anime.episodesWatched || 0;
    if (curr <= 0) return;
    const next = curr - 1;
    updateAnimeInList(id, { episodesWatched: next });
    try {
      const token = await AsyncStorage.getItem('token');
      await axios.put(`${API}/api/list/${uid}/${id}`, { episodesWatched: next, category: activeTab }, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    } catch {
      updateAnimeInList(id, { episodesWatched: curr });
    }
  }, [user, API, activeTab]);

  const handleRating = useCallback(async (anime, rating) => {
    const uid = user?._id || user?.id;
    if (!uid) return;
    const id = anime._id || anime.animeId;
    updateAnimeInList(id, { userRating: rating });
    try {
      const token = await AsyncStorage.getItem('token');
      await axios.put(`${API}/api/list/${uid}/${id}`, { userRating: rating, status: anime.status || activeTab }, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    } catch {
      updateAnimeInList(id, { userRating: anime.userRating || 0 });
    }
  }, [user, API, activeTab]);

  const handleRemove = useCallback((id) => {
    Alert.alert('Remove Anime', 'Remove this from your list?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          const uid = user?._id || user?.id;
          if (!uid) return;
          try {
            const token = await AsyncStorage.getItem('token');
            await axios.delete(`${API}/api/list/${uid}/${id}`, {
              headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            setAnimeList(prev => {
              const next = { ...prev };
              Object.keys(next).forEach(cat => {
                next[cat] = (next[cat] || []).filter(a => a._id !== id && a.animeId !== id);
              });
              return next;
            });
          } catch { Alert.alert('Error', 'Failed to remove.'); }
        }
      }
    ]);
  }, [user, API]);

  // ── Card Press → Detail ──
  const handleCardPress = useCallback(async (anime) => {
    const aniListId = anime.animeId || anime.id;
    if (!aniListId) {
      setSelectedAnime(anime);
      setDetailModalVisible(true);
      return;
    }
    try {
      const res = await axios.post('https://graphql.anilist.co', {
        query: ANIME_DETAILS_QUERY, variables: { id: aniListId }
      }, { headers: { 'Content-Type': 'application/json' } });
      const media = res.data.data.Media;
      if (media) {
        setSelectedAnime({ ...anime, ...media, title: media.title, coverImage: media.coverImage, userListStatus: anime.status, _id: anime._id });
      } else setSelectedAnime(anime);
    } catch { setSelectedAnime(anime); }
    setDetailModalVisible(true);
  }, []);

  // ── Import ──
  const handleFileSelect = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/xml', 'text/xml'],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      setSelectedFile(result.assets ? result.assets[0] : result);
      setShowImportModal(true);
    } catch { Alert.alert('Error', 'Failed to pick file'); }
  };

  const handleImportConfirm = async () => {
    const uid = user?._id || user?.id;
    if (!selectedFile || !uid) return;
    setShowImportModal(false);
    setImporting(true);
    setImportProgress('0/?');
    const fd = new FormData();
    fd.append('malFile', { uri: selectedFile.uri, name: selectedFile.name, type: selectedFile.mimeType || 'text/xml' });
    fd.append('userId', uid);
    fd.append('clearExisting', (importOption === 'replace').toString());
    try {
      const token = await AsyncStorage.getItem('token');
      const res = await axios.post(`${API}/api/list/import/mal`, fd, {
        headers: { 'Content-Type': 'multipart/form-data', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (res.data.success) { Alert.alert('Success', res.data.message); fetchAnimeList(); }
      else Alert.alert('Error', res.data.message);
    } catch {
      Alert.alert('Import Failed', 'Check your file or connection.');
    } finally { setImporting(false); setImportProgress(''); setSelectedFile(null); }
  };

  // ── Add Anime (Jikan search) ──
  const handleAddSearch = useCallback((text) => {
    setAddQuery(text);
    if (addDebounce.current) clearTimeout(addDebounce.current);
    if (!text.trim()) { setAddResults([]); return; }
    addDebounce.current = setTimeout(async () => {
      setAddLoading(true);
      try {
        const res = await axios.get(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(text)}&limit=15`);
        setAddResults(res.data.data || []);
      } catch { setAddResults([]); }
      setAddLoading(false);
    }, 500);
  }, []);

  const handleAddToList = async (anime) => {
    const uid = user?._id || user?.id;
    if (!uid) return;
    const payload = {
      animeId: anime.mal_id,
      title: anime.title_english || anime.title || anime.title_japanese,
      coverImage: { large: anime.images?.jpg?.large_image_url },
      totalEpisodes: anime.episodes || 0,
      status: 'planned',
      format: anime.type || 'TV',
    };
    try {
      const token = await AsyncStorage.getItem('token');
      await axios.post(`${API}/api/list/${uid}`, payload, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      Alert.alert('Added', `${payload.title} added to your list.`);
      setAddQuery('');
      setAddResults([]);
      setShowAddModal(false);
      fetchAnimeList();
    } catch { Alert.alert('Error', 'Failed to add anime.'); }
  };

  // ── Grouping ──
  const sortedGroups = useMemo(() => {
    const list = animeList[activeTab] || [];
    if (!list.length) return [];
    const groups = {};
    list.forEach(a => {
      const d = new Date(a.addedDate || a.createdAt || a.updatedAt || Date.now());
      const key = isNaN(d.getTime()) ? 'Unknown' : `${d.toLocaleString('default', { month: 'long' })} ${d.getFullYear()}`;
      if (!groups[key]) groups[key] = { title: key, sort: isNaN(d.getTime()) ? new Date(0) : new Date(d.getFullYear(), d.getMonth(), 1), anime: [] };
      groups[key].anime.push(a);
    });
    return Object.values(groups).sort((a, b) => b.sort - a.sort);
  }, [animeList, activeTab]);

  const sections = useMemo(() => {
    return sortedGroups.map(g => {
      const rows = [];
      for (let i = 0; i < g.anime.length; i += 2) rows.push(g.anime.slice(i, i + 2));
      return { title: g.title, data: rows };
    });
  }, [sortedGroups]);

  // ── Render ──
  const renderSectionHeader = useCallback(({ section: { title } }) => (
    <View style={s.monthHeader}>
      <View style={s.monthLine} />
      <Text style={s.monthTitle}>{title}</Text>
      <View style={s.monthLine} />
    </View>
  ), []);

  const renderItem = useCallback(({ item: row }) => (
    <View style={s.cardsRow}>
      {row.map(a => (
        <PremiumAnimeCard
          key={a._id || a.animeId}
          anime={a}
          cardWidth={CARD_W}
          status={a.status}
          onIncrement={handleIncrement}
          onDecrement={handleDecrement}
          onRating={handleRating}
          onRemove={handleRemove}
          onStatusChange={handleStatusChange}
          onCardPress={handleCardPress}
          onFavoriteToggle={handleFavoriteToggle}
        />
      ))}
      {row.length === 1 && <View style={s.cardSpacer} />}
    </View>
  ), [handleIncrement, handleDecrement, handleRating, handleRemove, handleStatusChange, handleCardPress, handleFavoriteToggle]);

  const keyExtractor = useCallback((item, idx) => {
    const id = item[0]?._id || item[0]?.animeId;
    return id ? `row-${id}` : `idx-${idx}`;
  }, []);

  const currentList = animeList[activeTab] || [];
  const showImporting = importing || !!importProgress;

  return (
    <View style={s.root}>
      {/* ── Header ── */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>My Anime List</Text>
          <Text style={s.headerSub}>Track, rate, and organize your collection</Text>
        </View>
        <View style={s.headerActions}>
          <TouchableOpacity style={s.addBtn} onPress={() => setShowAddModal(true)} activeOpacity={0.8}>
            <Ionicons name="add" size={18} color="#ff5900" />
          </TouchableOpacity>
          <TouchableOpacity style={s.importBtn} onPress={handleFileSelect} activeOpacity={0.8}>
            {showImporting ? (
              <ActivityIndicator size="small" color="#60a5fa" />
            ) : (
              <>
                <Ionicons name="cloud-download-outline" size={15} color="#60a5fa" />
                <Text style={s.importBtnText}>Import</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Tabs ── */}
      <View style={s.tabsWrap}>
        <View style={s.tabsRow}>
          {TAB_ORDER.map(tab => (
            <TabBtn key={tab} tab={tab} label={STATUS_CONFIG[tab].label} isActive={activeTab === tab} onPress={setActiveTab} />
          ))}
        </View>
      </View>

      {/* ── List ── */}
      {loading && !refreshing ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color="#ff5900" />
          <Text style={s.loadingText}>Loading your list...</Text>
        </View>
      ) : error ? (
        <View style={s.center}>
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={fetchAnimeList}>
            <Text style={s.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Animated.SectionList
          style={s.list}
          sections={sections}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          contentContainerStyle={s.listContent}
          stickySectionHeadersEnabled={false}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollYList } } }],
            { useNativeDriver: true }
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ff5900" colors={['#ff5900']} />}
          ListEmptyComponent={
            <View style={s.emptyState}>
              <Ionicons name="library-outline" size={48} color="rgba(255,255,255,0.15)" />
              <Text style={s.emptyTitle}>Nothing here yet</Text>
              <Text style={s.emptySub}>Add anime to your {STATUS_CONFIG[activeTab]?.label || activeTab} list</Text>
              <TouchableOpacity style={s.emptyAddBtn} onPress={() => setShowAddModal(true)}>
                <Ionicons name="add-circle-outline" size={16} color="#fff" />
                <Text style={s.emptyAddText}>Add Anime</Text>
              </TouchableOpacity>
            </View>
          }
          initialNumToRender={12}
          maxToRenderPerBatch={20}
          windowSize={11}
          removeClippedSubviews={true}
        />
      )}

      {/* ── Top scroll fade (ChatGPT style) ── */}
      <Animated.View style={[s.scrollFade, { opacity: headerBgOpacityList }]} pointerEvents="none">
        <LinearGradient colors={['#030712', 'transparent']} style={StyleSheet.absoluteFill} />
      </Animated.View>

      {/* ── Modals ── */}
      <AnimeModal visible={detailModalVisible} anime={selectedAnime} onClose={() => setDetailModalVisible(false)} onOpenAnime={(a) => setSelectedAnime(a)} />

      <ImportModal
        visible={showImportModal}
        onClose={() => setShowImportModal(false)}
        onConfirm={handleImportConfirm}
        fileName={selectedFile?.name}
        importOption={importOption}
        setImportOption={setImportOption}
      />

      <AddAnimeModal
        visible={showAddModal}
        onClose={() => { setShowAddModal(false); setAddQuery(''); setAddResults([]); }}
        query={addQuery}
        onSearch={handleAddSearch}
        results={addResults}
        loading={addLoading}
        onAdd={handleAddToList}
      />

      <BottomNav />
    </View>
  );
};

// ─── Import Modal ─────────────────────────────────────────────────────

const ImportModal = ({ visible, onClose, onConfirm, fileName, importOption, setImportOption }) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
      <TouchableOpacity style={s.modalWrap} activeOpacity={1} onPress={() => {}}>
        <View style={s.modalIconRow}>
          <View style={s.importIconBox}>
            <Ionicons name="cloud-download" size={24} color="#60a5fa" />
          </View>
        </View>
        <Text style={s.modalTitle}>Import from MyAnimeList</Text>
        <Text style={s.modalDesc}>Paste your MAL XML export file</Text>

        {fileName && (
          <View style={s.fileInfo}>
            <Ionicons name="document-text" size={18} color="#fff" />
            <Text style={s.fileName} numberOfLines={1}>{fileName}</Text>
          </View>
        )}

        <Text style={s.optionLabel}>Import Options</Text>
        <TouchableOpacity style={[s.radioRow, importOption === 'replace' && s.radioActive]} onPress={() => setImportOption('replace')}>
          <View style={s.radioOuter}>{importOption === 'replace' && <View style={s.radioInner} />}</View>
          <View><Text style={s.radioTitle}>Replace existing list</Text><Text style={s.radioDesc}>Clears current list first</Text></View>
        </TouchableOpacity>
        <TouchableOpacity style={[s.radioRow, importOption === 'merge' && s.radioActive]} onPress={() => setImportOption('merge')}>
          <View style={s.radioOuter}>{importOption === 'merge' && <View style={s.radioInner} />}</View>
          <View><Text style={s.radioTitle}>Merge with existing</Text><Text style={s.radioDesc}>Adds new entries only</Text></View>
        </TouchableOpacity>

        <View style={s.modalActions}>
          <TouchableOpacity style={s.cancelBtn} onPress={onClose}><Text style={s.cancelText}>Cancel</Text></TouchableOpacity>
          <TouchableOpacity style={s.confirmBtn} onPress={onConfirm}><Text style={s.confirmText}>Start Import</Text></TouchableOpacity>
        </View>
      </TouchableOpacity>
    </TouchableOpacity>
  </Modal>
);

// ─── Add Anime Modal ──────────────────────────────────────────────────

const AddAnimeModal = ({ visible, onClose, query, onSearch, results, loading, onAdd }) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
      <TouchableOpacity style={[s.modalWrap, s.addModalWide]} activeOpacity={1} onPress={() => {}}>
        <View style={s.addModalHeader}>
          <Text style={s.modalTitle}>Add Anime</Text>
          <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color="rgba(255,255,255,0.5)" /></TouchableOpacity>
        </View>
        <Text style={s.modalDesc}>Search for any anime to add to your collection</Text>

        <View style={s.searchBox}>
          <SearchSvg />
          <TextInput
            style={s.searchInput}
            placeholder="Search for anime..."
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={query}
            onChangeText={onSearch}
            autoFocus
          />
          {query ? (
            <TouchableOpacity onPress={() => onSearch('')}>
              <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.3)" />
            </TouchableOpacity>
          ) : null}
        </View>

        {loading ? (
          <View style={s.searchLoading}><ActivityIndicator color="#ff5900" /><Text style={s.searchLoadingText}>Searching...</Text></View>
        ) : (
          <ScrollView style={s.resultsList} showsVerticalScrollIndicator={false}>
            {results.map(item => (
              <View key={item.mal_id} style={s.resultCard}>
                <Image source={{ uri: item.images?.jpg?.image_url }} style={s.resultImg} contentFit="cover" cachePolicy="memory-disk" />
                <View style={s.resultInfo}>
                  <Text style={s.resultTitle} numberOfLines={2}>{item.title_english || item.title}</Text>
                  <Text style={s.resultMeta}>
                    {item.type || 'TV'} &middot; {item.episodes || '?'} eps &middot; ⭐ {(item.score || '?')}/10
                  </Text>
                  <TouchableOpacity style={s.resultAddBtn} onPress={() => onAdd(item)}>
                    <Text style={s.resultAddText}>Add to List</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            {query && !loading && results.length === 0 && (
              <Text style={s.noResults}>No results found</Text>
            )}
          </ScrollView>
        )}
      </TouchableOpacity>
    </TouchableOpacity>
  </Modal>
);

// ─── Styles ───────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#030712', paddingTop: Platform.OS === 'ios' ? 56 : 36 },
  scrollFade: {
    position: 'absolute', top: 0, left: 0, right: 0,
    height: 170, zIndex: 200,
  },

  // Header
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: 16, paddingBottom: 12,
  },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: '800', fontFamily: 'OutfitRegular', letterSpacing: 0.3 },
  headerSub: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontFamily: 'OutfitRegular', marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  addBtn: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: 'rgba(255,89,0,0.1)', borderWidth: 1, borderColor: 'rgba(255,89,0,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  importBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingVertical: 7, paddingHorizontal: 12, borderRadius: 10,
    backgroundColor: 'rgba(59,130,246,0.1)', borderWidth: 1, borderColor: 'rgba(59,130,246,0.25)',
  },
  importBtnText: { color: '#60a5fa', fontSize: 11, fontWeight: '700', fontFamily: 'OutfitRegular' },

  // Tabs
  tabsWrap: {
    marginHorizontal: 16, marginBottom: 12,
    backgroundColor: 'rgba(12,14,28,0.85)', borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    padding: 4,
  },
  tabsRow: { flexDirection: 'row', gap: 4 },
  tabBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 10, paddingHorizontal: 2, borderRadius: 12,
  },
  tabActive: { backgroundColor: 'rgba(255,89,0,0.12)', borderWidth: 1, borderColor: 'rgba(255,89,0,0.2)' },
  tabLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600', fontFamily: 'OutfitRegular', textAlign: 'center' },
  tabLabelActive: { color: '#ff5900', fontWeight: '700' },

  // List
  list: { flex: 1 },
  listContent: { paddingBottom: 100, paddingHorizontal: 20 },

  // Month Header
  monthHeader: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: 30, marginTop: 16, paddingHorizontal: 4,
  },
  monthLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.1)' },
  monthTitle: {
    color: '#fff', fontSize: 18, fontWeight: '800',
    fontFamily: 'OutfitRegular', marginHorizontal: 14, letterSpacing: 0.5,
    textShadowColor: 'rgba(255,89,0,0.3)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 10,
  },


  cardsRow: { flexDirection: 'row', gap: 14, marginBottom: 14 },
  cardSpacer: { width: CARD_W },

  // Card
  cardOuter: {
    borderRadius: 16, overflow: 'hidden', backgroundColor: '#070a13',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  cardTouch: { flex: 1 },

  cardImage: { ...StyleSheet.absoluteFillObject },
  fullFade: { ...StyleSheet.absoluteFillObject },

  badgesRow: {
    position: 'absolute', top: 8, left: 8, right: 8,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', zIndex: 10,
  },
  favBtn: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.4)', borderWidth: 1, borderColor: 'rgba(255,42,95,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  statusPill: {
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, maxWidth: '60%',
  },
  statusPillText: { fontSize: 8, fontWeight: '700', letterSpacing: 0.5 },

  cardBody: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 8, paddingBottom: 8, paddingTop: 20,
  },
  cardTitle: {
    color: '#fff', fontSize: 13, fontWeight: '700', fontFamily: 'OutfitRegular',
    textAlign: 'center', lineHeight: 16, marginBottom: 6,
  },

  // Progress
  progressBox: {
    backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10, padding: 6, marginBottom: 4,
  },
  progressRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  epBtn: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(255,89,0,0.1)', borderWidth: 1, borderColor: 'rgba(255,89,0,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  epInfo: { alignItems: 'center' },
  epLabel: { color: 'rgba(255,255,255,0.35)', fontSize: 6, fontWeight: '600', letterSpacing: 0.5, fontFamily: 'OutfitRegular' },
  epValue: { color: '#fff', fontSize: 10, fontWeight: '700', fontFamily: 'OutfitRegular' },
  progressTrack: { height: 3, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden', marginTop: 4 },
  progressFill: { height: '100%', borderRadius: 2 },

  // Footer
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  ratingSection: { flex: 1 },
  ratingLabel: { color: 'rgba(255,255,255,0.3)', fontSize: 7, fontWeight: '600', letterSpacing: 0.5, fontFamily: 'OutfitRegular', marginBottom: 2 },
  starRow: {},
  removeBtn: { padding: 6 },

  // Menu
  menuOverlay: {
    ...StyleSheet.absoluteFillObject, zIndex: 50,
    justifyContent: 'flex-end', alignItems: 'center',
  },
  menuDropdown: {
    backgroundColor: '#0d1222', borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 4, marginBottom: 40, width: CARD_W - 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.6, shadowRadius: 16, elevation: 12,
  },
  menuItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 14,
  },
  menuItemText: { fontSize: 12, fontWeight: '600', fontFamily: 'OutfitRegular' },
  menuDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginHorizontal: 14 },
  menuRemoveItem: { paddingVertical: 10, paddingHorizontal: 14 },
  menuRemoveText: { fontSize: 12, fontWeight: '600', color: '#ef4444', fontFamily: 'OutfitRegular' },

  // States
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: 'rgba(255,255,255,0.4)', marginTop: 12, fontFamily: 'OutfitRegular' },
  errorText: { color: '#ef4444', fontFamily: 'OutfitRegular' },
  retryBtn: { marginTop: 12, paddingVertical: 8, paddingHorizontal: 20, backgroundColor: 'rgba(255,89,0,0.15)', borderRadius: 10 },
  retryText: { color: '#ff5900', fontWeight: '700', fontFamily: 'OutfitRegular' },
  emptyState: { alignItems: 'center', marginTop: 48 },
  emptyTitle: { color: 'rgba(255,255,255,0.4)', fontSize: 16, fontWeight: '700', marginTop: 12, fontFamily: 'OutfitRegular' },
  emptySub: { color: 'rgba(255,255,255,0.25)', fontSize: 11, marginTop: 4, fontFamily: 'OutfitRegular' },
  emptyAddBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 16, paddingVertical: 8, paddingHorizontal: 16,
    backgroundColor: 'rgba(255,89,0,0.12)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,89,0,0.25)',
  },
  emptyAddText: { color: '#fff', fontSize: 12, fontWeight: '700', fontFamily: 'OutfitRegular' },

  // Modal shared
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
  modalWrap: {
    width: '88%', maxWidth: 400, maxHeight: '80%',
    backgroundColor: '#0d1222', borderRadius: 24, padding: 24,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  addModalWide: { maxWidth: 500, maxHeight: '85%' },
  modalIconRow: { alignItems: 'center', marginBottom: 12 },
  importIconBox: {
    width: 56, height: 56, borderRadius: 16,
    backgroundColor: 'rgba(59,130,246,0.1)', borderWidth: 1, borderColor: 'rgba(59,130,246,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: '700', textAlign: 'center', fontFamily: 'OutfitRegular' },
  modalDesc: { color: 'rgba(255,255,255,0.4)', fontSize: 12, textAlign: 'center', marginTop: 6, marginBottom: 16, fontFamily: 'OutfitRegular' },

  // Import Modal
  fileInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.03)', padding: 10, borderRadius: 10, marginBottom: 16 },
  fileName: { color: '#fff', fontSize: 12, flex: 1, fontFamily: 'OutfitRegular' },
  optionLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '700', marginBottom: 8, fontFamily: 'OutfitRegular' },
  radioRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 12, marginBottom: 8,
  },
  radioActive: { borderColor: '#ff5900', backgroundColor: 'rgba(255,89,0,0.05)' },
  radioOuter: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' },
  radioInner: { width: 9, height: 9, borderRadius: 4.5, backgroundColor: '#ff5900' },
  radioTitle: { color: '#fff', fontSize: 13, fontWeight: '600', fontFamily: 'OutfitRegular' },
  radioDesc: { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontFamily: 'OutfitRegular' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center' },
  cancelText: { color: 'rgba(255,255,255,0.6)', fontWeight: '600', fontFamily: 'OutfitRegular' },
  confirmBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#3b82f6', alignItems: 'center' },
  confirmText: { color: '#fff', fontWeight: '700', fontFamily: 'OutfitRegular' },

  // Add Modal
  addModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 16,
  },
  searchInput: { flex: 1, color: '#fff', fontSize: 13, fontFamily: 'OutfitRegular', padding: 0 },
  searchLoading: { alignItems: 'center', paddingVertical: 24 },
  searchLoadingText: { color: 'rgba(255,255,255,0.4)', marginTop: 8, fontFamily: 'OutfitRegular' },
  resultsList: { maxHeight: 360 },
  resultCard: {
    flexDirection: 'row', gap: 12,
    backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14, padding: 10, marginBottom: 8,
  },
  resultImg: { width: 56, height: 78, borderRadius: 8, backgroundColor: '#111' },
  resultInfo: { flex: 1, justifyContent: 'space-between' },
  resultTitle: { color: '#fff', fontSize: 12, fontWeight: '700', fontFamily: 'OutfitRegular' },
  resultMeta: { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontFamily: 'OutfitRegular' },
  resultAddBtn: {
    alignSelf: 'flex-start', paddingVertical: 5, paddingHorizontal: 12, borderRadius: 8,
    backgroundColor: 'rgba(255,89,0,0.12)', borderWidth: 1, borderColor: 'rgba(255,89,0,0.25)',
  },
  resultAddText: { color: '#ff5900', fontSize: 10, fontWeight: '700', fontFamily: 'OutfitRegular' },
  noResults: { color: 'rgba(255,255,255,0.3)', textAlign: 'center', paddingVertical: 24, fontFamily: 'OutfitRegular' },
});

export default ListScreen;
