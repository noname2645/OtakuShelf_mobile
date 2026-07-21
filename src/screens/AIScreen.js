import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  Animated, StyleSheet, KeyboardAvoidingView, Platform,
  ActivityIndicator, Dimensions, Alert,
} from 'react-native';
import { Image } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contexts/AuthContext';
import BottomNav from '../components/BottomNav';
import AnimeCardPremium, { CARD_WIDTH, CARD_HEIGHT } from '../components/AnimeCardPremium';
import AnimeModal from '../components/AnimeModal';
import Svg, { Path, Line, Polygon } from 'react-native-svg';

const { width, height } = Dimensions.get('window');
const otakuAI = require('../../assets/icon.png');
const isMobile = width <= 768;
const isSmall = width <= 480;

const normalizeAnime = (anime) => {
  if (!anime) return null;
  return {
    id: anime.id || anime.malId || Math.random().toString(36).substr(2, 9),
    idMal: anime.idMal || anime.mal_id,
    title: anime.title?.english || anime.title?.romaji || anime.title?.native || anime.title || 'Unknown',
    coverImage: {
      large: anime.coverImage?.large || anime.images?.jpg?.large_image_url,
      extraLarge: anime.coverImage?.extraLarge || anime.images?.jpg?.large_image_url,
    },
    bannerImage: anime.bannerImage || anime.images?.jpg?.large_image_url,
    description: anime.description || anime.synopsis || null,
    episodes: anime.episodes || anime.totalEpisodes || null,
    averageScore: anime.averageScore || anime.score || null,
    status: anime.status || null,
    genres: anime.genres || [],
    studios: anime.studios?.edges?.map(e => e.node.name) || [],
    trailer: anime.trailer || null,
    format: anime.format || null,
    season: anime.season || null,
    year: anime.year || anime.startDate?.year || null,
    startDate: anime.startDate || null,
    endDate: anime.endDate || null,
    relations: anime.relations || null,
  };
};

// ─── Colors ───────────────────────────────────────────────────────────────────
const C = {
  bg: '#030712',
  surface: 'rgba(13,15,26,0.85)',
  surface2: 'rgba(15,20,35,0.75)',
  border: 'rgba(255,255,255,0.08)',
  borderHover: 'rgba(255,159,0,0.35)',
  amber: '#e2aa01',
  amberGlow: 'rgba(226,170,1,0.18)',
  amberDark: '#b88800',
  orange: '#ff6b00',
  red: '#ff6b6b',
  purple: '#8b5cf6',
  textPrimary: '#f1f5f9',
  textSecondary: '#94a3b8',
  textMuted: '#475569',
  green: '#10b981',
};

// ─── Anim ──────────────────────────────────────────────────────────────────────
const usePulseAnim = (duration = 2500) => {
  const val = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(val, { toValue: 1, duration: duration / 2, useNativeDriver: false }),
        Animated.timing(val, { toValue: 0, duration: duration / 2, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return val;
};

const useBounceDots = () => {
  const anims = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
  useEffect(() => {
    const loops = anims.map((a, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(a, { toValue: 1, duration: 700, delay: i * 200, useNativeDriver: false }),
          Animated.timing(a, { toValue: 0, duration: 700, delay: i * 200, useNativeDriver: false }),
        ])
      )
    );
    loops.forEach(l => l.start());
    return () => loops.forEach(l => l.stop());
  }, []);
  return anims;
};

// ─── Send Icon SVG ────────────────────────────────────────────────────────────
const SendIcon = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <Line x1="22" y1="2" x2="11" y2="13" />
    <Polygon points="22 2 15 22 11 13 2 9 22 2" />
  </Svg>
);

// ─── TypingIndicator ─────────────────────────────────────────────────────────
const TypingIndicator = () => {
  const dots = useBounceDots();
  return (
    <View style={styles.typingBox}>
      {dots.map((anim, i) => (
        <Animated.View
          key={i}
          style={[
            styles.typingDot,
            {
              transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }],
              opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
            },
          ]}
        />
      ))}
    </View>
  );
};

// ─── FormattedMessage (Markdown) ──────────────────────────────────────────────
const FormattedMessage = ({ content, style }) => {
  if (!content) return null;
  const lines = content.split('\n');
  return (
    <View>
      {lines.map((line, index) => {
        if (!line.trim()) return <View key={index} style={{ height: 8 }} />;
        const listMatch = !line.includes('**') && line.match(/^(\d+\.|-)\s+([^:]+)(:\s+.*)$/);
        if (listMatch) {
          return (
            <Text key={index} style={[style, { marginBottom: 6 }]}>
              <Text style={{ fontWeight: '700', color: C.amber }}>{listMatch[1]} {listMatch[2]}</Text>
              <Text>{listMatch[3]}</Text>
            </Text>
          );
        }
        const parts = line.split(/(\*\*.*?\*\*|`.*?`)/g);
        return (
          <Text key={index} style={[style, { marginBottom: 4 }]}>
            {parts.map((part, i) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return <Text key={i} style={{ fontWeight: '700', color: C.amber }}>{part.slice(2, -2)}</Text>;
              }
              if (part.startsWith('`') && part.endsWith('`')) {
                return (
                  <Text key={i} style={styles.codeInline}>
                    {part.slice(1, -1)}
                  </Text>
                );
              }
              return <Text key={i}>{part}</Text>;
            })}
          </Text>
        );
      })}
    </View>
  );
};

// ─── AIScreen ─────────────────────────────────────────────────────────────────
const AIScreen = ({ navigation }) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [conversationContext, setConversationContext] = useState({
    mood: 'friendly',
    suggestions: ['Recommend something new!', 'Based on my history', 'Top anime of the season'],
  });
  const [selectedAnime, setSelectedAnime] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  const scrollViewRef = useRef(null);
  const typingIntervalRef = useRef(null);

  const { user, API } = useAuth();

  // Pulse animation for streaming border + status dot
  const statusPulse = usePulseAnim(2500);
  const streamPulse = usePulseAnim(1800);

  // Status dot glow
  const statusGlow = statusPulse.interpolate({ inputRange: [0, 1], outputRange: [6, 14] });

  // ── Scroll ──
  const scrollToBottom = useCallback((instant = false) => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollToEnd({ animated: !instant });
    }
  }, []);

  const handleScroll = useCallback((e) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const distFromBottom = contentSize.height - contentOffset.y - layoutMeasurement.height;
    setShowScrollBtn(distFromBottom > 100);
  }, []);

  // ── Persist conversation ──
  useEffect(() => {
    const load = async () => {
      try {
        const saved = await AsyncStorage.getItem('ai_conversation');
        if (saved) {
          const parsed = JSON.parse(saved);
          parsed.forEach(msg => {
            if (msg.anime && Array.isArray(msg.anime)) {
              msg.anime = msg.anime.map(normalizeAnime).filter(Boolean);
            }
          });
          setMessages(parsed);
          setTimeout(() => scrollToBottom(true), 300);
          return;
        }
      } catch (_) {}
      const welcome = {
        role: 'ai',
        text: `Yo! 👋 I'm OtakuAI, your personal anime companion. Think of me as your ultimate nakama in the anime world!\n\nI've analyzed your profile and I'm ready to dive deep into discussions or find your next binge-worthy masterpiece. What's on your mind today?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        mood: 'friendly',
        id: Date.now() + Math.random(),
      };
      setMessages([welcome]);
      setTimeout(() => scrollToBottom(true), 300);
    };
    load();
  }, []);

  useEffect(() => {
    return () => {
      if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    const save = async () => {
      if (messages.length > 0 && !streaming) {
        try {
          await AsyncStorage.setItem('ai_conversation', JSON.stringify(messages.slice(-50)));
        } catch (_) {}
      }
    };
    save();
  }, [messages, streaming]);

  useEffect(() => {
    if (messages.length > 0) {
      const last = messages[messages.length - 1];
      if (last.role === 'user' || (!loading && last.role === 'ai')) {
        setTimeout(() => scrollToBottom(), 100);
      }
    }
  }, [messages, loading]);

  // ── Typewriter ──
  const typewriterEffect = (fullText, messageData) => {
    if (!fullText) {
      setMessages(prev => [...prev, messageData]);
      return;
    }
    setStreaming(true);
    setStreamingText('');
    let currentIndex = 0;
    if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
    typingIntervalRef.current = setInterval(() => {
      if (currentIndex < fullText.length) {
        setStreamingText(fullText.substring(0, currentIndex + 1));
        currentIndex++;
        if (currentIndex % 10 === 0) scrollToBottom();
      } else {
        clearInterval(typingIntervalRef.current);
        typingIntervalRef.current = null;
        setStreaming(false);
        setStreamingText('');
        setMessages(prev => [...prev, messageData]);
      }
    }, 2);
  };

  // ── Send ──
  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const text = input;
    const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg = { role: 'user', text, timestamp: ts, id: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setTimeout(() => scrollToBottom(), 50);

    try {
      const token = await AsyncStorage.getItem('token');
      const history = messages.slice(-8).filter(m => m.text?.trim()).map(m => ({
        role: m.role === 'ai' ? 'assistant' : 'user',
        content: m.text || '',
      }));

      const res = await fetch(`${API}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: text, history, userId: user?._id || user?.id, context: conversationContext }),
      });

      if (!res.ok) throw new Error(`Server error: ${res.status}`);

      const response = await res.json();
      if (response.status === 'error') throw new Error(response.message || 'Failed to generate AI response');

      const data = (response.status && response.data) ? response.data : response;
      setConversationContext(prev => ({ ...prev, mood: data.context?.mood || 'neutral', suggestions: data.context?.suggestions || [] }));
      setLoading(false);

      const aiData = {
        role: 'ai',
        text: data.reply || "Something went wrong, but I'm still here!",
        anime: (data.anime || []).map(normalizeAnime).filter(Boolean),
        context: data.context || {},
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        mood: data.context?.mood || 'neutral',
        id: Date.now() + 1,
      };
      typewriterEffect(data.reply, aiData);
    } catch (err) {
      console.error('AI Chat Error:', err);
      setLoading(false);
      setMessages(prev => [...prev, {
        role: 'ai', text: "Hmm, having a little trouble connecting. Check your internet or try again! 🌸",
        isError: true, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), id: Date.now() + 1,
      }]);
    }
  };

  // ── Handlers ──
  const handlePromptClick = (prompt) => setInput(prompt);

  const handleAnimePress = async (anime) => {
    const needsEnrich = !anime.startDate || !anime.endDate || !anime.studios || !anime.description;
    if (needsEnrich && anime.id) {
      try {
        const res = await fetch('https://graphql.anilist.co', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            query: `query ($id: Int) { Media (id: $id, type: ANIME) { id title { romaji english native } coverImage { extraLarge large medium } bannerImage description episodes status format genres averageScore studios { nodes { name } } startDate { year month day } endDate { year month day } trailer { id site } } }`,
            variables: { id: parseInt(anime.id) },
          }),
        });
        const media = (await res.json())?.data?.Media;
        if (media) {
          setSelectedAnime({ ...anime, ...media, title: media.title || anime.title, coverImage: media.coverImage || anime.coverImage });
          setModalVisible(true);
          return;
        }
      } catch (_) {}
    }
    setSelectedAnime(anime);
    setModalVisible(true);
  };

  const handleClearChat = () => {
    Alert.alert('Clear Conversation', 'Are you sure you want to clear the conversation?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear', style: 'destructive',
        onPress: async () => {
          if (typingIntervalRef.current) { clearInterval(typingIntervalRef.current); typingIntervalRef.current = null; }
          setMessages([]);
          await AsyncStorage.removeItem('ai_conversation');
          setConversationContext({ mood: 'friendly', suggestions: ['Recommend something new!', 'Based on my history', 'Top anime of the season'] });
          setMessages([{
            role: 'ai', text: 'Chat cleared! Ready to start fresh. What\'s on your mind?',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), mood: 'friendly', id: Date.now(),
          }]);
        },
      },
    ]);
  };

  // ── Render bubble ──
  const renderMessage = (msg) => {
    const isUser = msg.role === 'user';
    const isError = msg.isError;

    return (
      <Animated.View key={msg.id || Math.random()} style={[styles.bubble, isUser ? styles.userBubble : styles.aiBubble]}>
        {/* Header */}
        <View style={[styles.bubbleHeader, isUser && styles.bubbleHeaderReverse]}>
          <View style={[styles.bubbleAvatar, isUser ? styles.userAvatar : styles.aiAvatar]}>
            {isUser ? (
              user?.photo ? (
                <Image source={{ uri: user.photo }} style={styles.avatarImg} contentFit="cover" cachePolicy="memory-disk" />
              ) : (
                <Text style={styles.userInitials}>{(user?.name || user?.email || 'U').charAt(0).toUpperCase()}</Text>
              )
            ) : (
              <Image source={otakuAI} style={styles.avatarImg} contentFit="contain" />
            )}
          </View>
          <View style={[styles.bubbleMeta, isUser && styles.bubbleMetaEnd]}>
            <Text style={styles.senderName}>{isUser ? (user?.name || 'You') : 'OtakuAI'}</Text>
            <Text style={styles.senderTime}>{msg.timestamp}</Text>
          </View>
        </View>

        {/* Content */}
        {isUser ? (
          <LinearGradient
            colors={['#ff9f00', '#e2aa01', '#ff6b00']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={[styles.bubbleContent, styles.userContent]}
          >
            <Text style={styles.userText}>{msg.text}</Text>
          </LinearGradient>
        ) : (
          <Animated.View style={[
            styles.bubbleContent, styles.aiContent,
            isError && styles.errorContent,
            streaming && { borderColor: streamPulse.interpolate({ inputRange: [0, 1], outputRange: ['rgba(226,170,1,0.15)', 'rgba(226,170,1,0.35)'] }) },
          ]}>
            <FormattedMessage content={msg.text} style={styles.aiText} />
            {isError && <Text style={styles.errorIndicator}> ⚠️</Text>}
          </Animated.View>
        )}

        {/* Anime recommendations */}
        {msg.anime && msg.anime.length > 0 && (
          <View style={styles.recsBox}>
            <Text style={styles.recsLabel}>✨ Recommendations</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recsScroll}>
              {msg.anime.map((anime, idx) => anime && (
                <View key={anime.id || idx} style={styles.recCard}>
                  <AnimeCardPremium
                    anime={anime}
                    index={idx}
                    onPress={handleAnimePress}
                    isGrid
                  />
                </View>
              ))}
            </ScrollView>
          </View>
        )}
      </Animated.View>
    );
  };

  // ── Render ──
  return (
    <View style={styles.container}>
      {/* Ambient background orbs */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={[styles.orb, { top: '8%', left: '15%', width: 360, height: 360, backgroundColor: 'rgba(255,107,107,0.1)' }]} />
        <View style={[styles.orb, { top: '80%', right: '8%', width: 300, height: 300, backgroundColor: 'rgba(139,92,246,0.1)' }]} />
        <View style={[styles.orb, { top: '50%', left: '50%', width: 200, height: 200, backgroundColor: 'rgba(226,170,1,0.04)', marginLeft: -100, marginTop: -100 }]} />
      </View>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerAvatar}>
            <Image source={otakuAI} style={styles.avatarImg} contentFit="contain" />
          </View>
          <View>
            <Text style={styles.headerTitle}>OtakuAI</Text>
            <View style={styles.statusRow}>
              <Animated.View style={[styles.dot, { shadowOpacity: statusPulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }), shadowRadius: statusGlow }]} />
              <Text style={styles.statusText}>Ready to Binge</Text>
            </View>
          </View>
        </View>
        <TouchableOpacity style={styles.clearPill} onPress={handleClearChat} activeOpacity={0.7}>
          <Text style={styles.clearPillText}>Clear History</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
        {/* Chat panel */}
        <View style={styles.panel}>
          {/* Messages */}
          <ScrollView
            ref={scrollViewRef}
            style={styles.messagesBox}
            contentContainerStyle={styles.messagesContent}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={false}
          >
            {messages.map(renderMessage)}

            {/* Streaming bubble */}
            {streaming && (
              <View style={[styles.bubble, styles.aiBubble]}>
                <View style={[styles.bubbleHeader]}>
                  <View style={[styles.bubbleAvatar, styles.aiAvatar]}>
                    <Image source={otakuAI} style={styles.avatarImg} contentFit="contain" />
                  </View>
                  <View style={styles.bubbleMeta}>
                    <Text style={styles.senderName}>OtakuAI</Text>
                  </View>
                </View>
                <Animated.View style={[
                  styles.bubbleContent, styles.aiContent,
                  { borderColor: streamPulse.interpolate({ inputRange: [0, 1], outputRange: ['rgba(226,170,1,0.15)', 'rgba(226,170,1,0.35)'] }) },
                ]}>
                  <FormattedMessage content={streamingText} style={styles.aiText} />
                </Animated.View>
              </View>
            )}

            {/* Loading indicator */}
            {loading && !streaming && (
              <View style={[styles.bubble, styles.aiBubble]}>
                <View style={styles.bubbleHeader}>
                  <View style={[styles.bubbleAvatar, styles.aiAvatar]}>
                    <Image source={otakuAI} style={styles.avatarImg} contentFit="contain" />
                  </View>
                  <View style={styles.bubbleMeta}>
                    <Text style={styles.senderName}>OtakuAI</Text>
                  </View>
                </View>
                <TypingIndicator />
              </View>
            )}

            <View style={{ height: 20 }} />
          </ScrollView>

          {/* Footer */}
          <View style={styles.chatFooter}>
            {/* Divider */}
            <View style={styles.footerDivider} />

            {/* Suggestions */}
            {conversationContext.suggestions?.length > 0 && !loading && (
              <View style={styles.suggestionsBox}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionsScroll}>
                  {conversationContext.suggestions.map((s, i) => (
                    <TouchableOpacity key={i} style={styles.suggestionChip} onPress={() => handlePromptClick(s)} activeOpacity={0.7}>
                      <Text style={styles.suggestionText}>{s}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Input */}
            <View style={styles.inputRow}>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  value={input}
                  onChangeText={setInput}
                  placeholder="Message OtakuAI..."
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  editable={!loading}
                  onKeyPress={({ nativeEvent }) => {
                    if (nativeEvent.key === 'Enter' && !nativeEvent.shiftKey) {
                      sendMessage();
                    }
                  }}
                  multiline
                  maxLength={500}
                />
                <TouchableOpacity
                  onPress={sendMessage}
                  style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
                  disabled={loading || !input.trim()}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator color="#000" size="small" />
                  ) : (
                    <SendIcon />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Scroll-to-bottom FAB */}
      {showScrollBtn && (
        <TouchableOpacity style={styles.scrollBtn} onPress={() => scrollToBottom()} activeOpacity={0.85}>
          <Text style={styles.scrollBtnIcon}>↓</Text>
        </TouchableOpacity>
      )}

      <BottomNav navigation={navigation} activeRoute="AI" />

      {/* Anime Modal */}
      <AnimeModal
        visible={modalVisible}
        anime={selectedAnime}
        onClose={() => setModalVisible(false)}
        onOpenAnime={(anime) => setSelectedAnime(anime)}
      />
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  // Ambient orbs
  orb: { position: 'absolute', borderRadius: 9999 },

  // Header (companion header)
  header: {
    paddingTop: Platform.OS === 'ios' ? 50 : 35,
    paddingBottom: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerAvatar: {
    width: isMobile ? 40 : 46,
    height: isMobile ? 40 : 46,
    borderRadius: isMobile ? 12 : 14,
    backgroundColor: 'rgba(226,170,1,0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(226,170,1,0.3)',
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: isMobile ? (isSmall ? 15 : 18) : 20,
    fontWeight: '700',
    color: '#fff',
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: C.green,
    shadowColor: C.green,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
  },
  statusText: { fontSize: isSmall ? 10 : 11, fontWeight: '600', color: C.textSecondary, letterSpacing: 0.4, textTransform: 'uppercase' },

  // Clear pill
  clearPill: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: isMobile ? 12 : 16,
    paddingVertical: isMobile ? 6 : 7,
    borderRadius: 50,
  },
  clearPillText: { color: C.textSecondary, fontSize: isSmall ? 11 : 12, fontWeight: '600' },

  // Chat panel
  panel: {
    flex: 1,
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: Platform.OS === 'ios' ? 0 : 70,
    backgroundColor: C.surface,
    borderRadius: isMobile ? 22 : 28,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },

  // Messages box
  messagesBox: { flex: 1 },
  messagesContent: {
    padding: isMobile ? (isSmall ? 14 : 18) : 24,
    paddingBottom: 5,
  },

  // Bubbles
  bubble: { marginBottom: isMobile ? (isSmall ? 14 : 16) : 20, maxWidth: isMobile ? (isSmall ? '92%' : '88%') : '80%' },
  userBubble: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  aiBubble: { alignSelf: 'flex-start', alignItems: 'flex-start' },

  // Bubble header
  bubbleHeader: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 7 },
  bubbleHeaderReverse: { flexDirection: 'row-reverse' },
  bubbleAvatar: {
    width: 34, height: 34, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  aiAvatar: { backgroundColor: 'rgba(226,170,1,0.06)', borderColor: 'rgba(226,170,1,0.2)' },
  userAvatar: { backgroundColor: 'rgba(255,107,0,0.15)', borderColor: 'rgba(255,107,0,0.35)' },
  avatarImg: { width: '100%', height: '100%' },
  userInitials: { color: C.amber, fontSize: 14, fontWeight: '800' },
  bubbleMeta: { flexDirection: 'column', gap: 1 },
  bubbleMetaEnd: { alignItems: 'flex-end' },
  senderName: { fontSize: isSmall ? 11 : 12, fontWeight: '700', color: C.textSecondary, letterSpacing: 0.3, textTransform: 'uppercase' },
  senderTime: { fontSize: 10, color: C.textMuted },

  // Bubble content
  bubbleContent: { paddingHorizontal: 18, paddingVertical: 14, lineHeight: 1.65 },
  userContent: {
    borderTopRightRadius: 4,
    borderTopLeftRadius: 20,
    borderBottomRightRadius: 20,
    borderBottomLeftRadius: 20,
  },
  aiContent: {
    backgroundColor: C.surface2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
    borderBottomLeftRadius: 20,
  },
  errorContent: { borderColor: 'rgba(239,68,68,0.25)', backgroundColor: 'rgba(239,68,68,0.06)' },
  userText: { color: '#000', fontWeight: '600', fontSize: isSmall ? 14 : 15 },
  aiText: { color: C.textPrimary, fontSize: isSmall ? 14 : 15, lineHeight: 22 },
  codeInline: {
    backgroundColor: 'rgba(226,170,1,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(226,170,1,0.2)',
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 1,
    color: C.amber,
    fontSize: 13,
  },
  errorIndicator: { color: '#ef4444', marginTop: 4 },

  // Typing indicator
  typingBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: C.surface2,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    borderBottomRightRadius: 20, borderBottomLeftRadius: 4,
    width: 'fit-content', alignSelf: 'flex-start',
  },
  typingDot: {
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: C.amber,
  },

  // Anime recommendations
  recsBox: { marginTop: 14 },
  recsLabel: { fontSize: isSmall ? 10 : 11, fontWeight: '700', color: C.amber, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 10 },
  recsScroll: { paddingRight: 10 },
  recCard: { width: isMobile ? CARD_WIDTH : 200, height: isMobile ? CARD_HEIGHT : 304, borderRadius: 20, overflow: 'hidden', marginRight: 14 },

  // Footer
  chatFooter: { flexShrink: 0 },
  footerDivider: {
    height: 1,
    marginHorizontal: 20,
    marginBottom: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },

  // Suggestions
  suggestionsBox: { paddingHorizontal: 20, marginBottom: 10 },
  suggestionsScroll: { gap: 8, paddingRight: 10 },
  suggestionChip: {
    backgroundColor: 'rgba(226,170,1,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(226,170,1,0.18)',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 50,
  },
  suggestionText: { color: 'rgba(226,170,1,0.8)', fontSize: isSmall ? 11 : 12, fontWeight: '600' },

  // Input
  inputRow: { paddingHorizontal: 16, paddingBottom: 16 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 50,
    paddingLeft: 18, paddingRight: 8, paddingVertical: 6,
  },
  input: {
    flex: 1, color: C.textPrimary, paddingVertical: 10,
    fontSize: isSmall ? 14 : 15, maxHeight: 120,
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 50,
    backgroundColor: C.amber,
    justifyContent: 'center', alignItems: 'center',
  },
  sendBtnDisabled: { backgroundColor: 'rgba(255,255,255,0.06)' },

  // Scroll to bottom FAB
  scrollBtn: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 100 : 120,
    right: isMobile ? 16 : 24,
    width: isMobile ? 36 : 40,
    height: isMobile ? 36 : 40,
    borderRadius: 50,
    backgroundColor: C.amber,
    justifyContent: 'center', alignItems: 'center',
    zIndex: 500,
    elevation: 8,
    shadowColor: C.amber,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
  },
  scrollBtnIcon: { color: '#000', fontSize: 18, fontWeight: '800' },
});

export const useAnimePreferences = () => {
  const { user } = useAuth();
  const preferences = user?.settings?.preferences || {
    titleLanguage: 'romaji', defaultLayout: 'grid', nsfwContent: false, autoplayTrailers: true, accentColor: '#ff6b6b',
  };
  const getPreferredTitle = (titleObj) => {
    if (!titleObj) return 'Unknown Title';
    if (typeof titleObj === 'string') return titleObj;
    const { titleLanguage } = preferences;
    if (titleLanguage === 'english' && titleObj.english) return titleObj.english;
    if (titleLanguage === 'native' && titleObj.native) return titleObj.native;
    return titleObj.romaji || titleObj.english || titleObj.native || 'Unknown Title';
  };
  const shouldBlurNSFW = (isAdult) => !isAdult ? false : !preferences.nsfwContent;
  const shouldAutoplay = () => preferences.autoplayTrailers;
  return { preferences, getPreferredTitle, shouldBlurNSFW, shouldAutoplay };
};

export default AIScreen;
