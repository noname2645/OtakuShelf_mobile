import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Dimensions,
  Animated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contexts/AuthContext';
import BottomNav from '../components/BottomNav';
import AnimatedAnimeCard from '../components/AnimatedAnimeCard';
import AnimeModal from '../components/AnimeModal';

const { width, height } = Dimensions.get('window');

const AIScreen = ({ navigation }) => {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [conversationContext, setConversationContext] = useState({
    mood: 'neutral',
    suggestions: []
  });
  const [selectedAnime, setSelectedAnime] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  const messagesEndRef = useRef(null);
  const scrollViewRef = useRef(null);
  const scrollY = useRef(0);

  const { user, API } = useAuth();

  // Auto-scroll to bottom
  const scrollToBottom = (instant = false) => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollToEnd({ animated: !instant });
    }
  };

  // Check scroll position (removed scroll button logic)
  const handleScroll = (event) => {
    const { contentOffset } = event.nativeEvent;
    scrollY.current = contentOffset.y;
  };

  // Load previous conversation on mount
  useEffect(() => {
    const loadConversation = async () => {
      try {
        const savedConvo = await AsyncStorage.getItem('ai_conversation');
        if (savedConvo) {
          const parsedConvo = JSON.parse(savedConvo);
          setMessages(parsedConvo);
          setTimeout(() => scrollToBottom(true), 300);
        }
      } catch (error) {
        console.log('Error loading conversation:', error);
      }
    };
    loadConversation();
  }, []);

  // Save conversation to storage
  useEffect(() => {
    const saveConversation = async () => {
      if (messages.length > 0) {
        try {
          await AsyncStorage.setItem(
            'ai_conversation',
            JSON.stringify(messages.slice(-50))
          );
        } catch (error) {
          console.log('Error saving conversation:', error);
        }
      }
    };
    saveConversation();
  }, [messages]);

  // Auto-scroll when messages change
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === "user" || (!loading && lastMessage.role === "ai")) {
        setTimeout(() => scrollToBottom(), 100);
      }
    }
  }, [messages, loading]);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userText = input;

    // Add user message
    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        text: userText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        id: Date.now()
      },
    ]);

    setInput("");
    setLoading(true);
    setTimeout(() => scrollToBottom(), 50);

    try {
      const token = await AsyncStorage.getItem("token");
      const res = await fetch(`${API}/api/ai/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          message: userText,
          userId: user?._id || user?.id,
          context: conversationContext
        }),
      });

      const data = await res.json();

      // Update conversation context
      setConversationContext(prev => ({
        ...prev,
        mood: data.context?.mood || 'neutral',
        suggestions: data.context?.suggestions || []
      }));

      // Add AI message
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: data.reply,
          anime: data.anime || [],
          context: data.context,
          suggestions: data.context?.suggestions || [],
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          mood: data.context?.mood || 'neutral',
          id: Date.now() + 1
        },
      ]);

    } catch (err) {
      console.error('AI Chat Error:', err);
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: "Hmm, having a little trouble connecting. Try again in a moment! 🌸",
          isError: true,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          id: Date.now() + 1
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Quick prompts for easy interaction
  const quickPrompts = [
    "Recommend me a comedy anime",
    "I'm in the mood for something adventurous",
    "What's similar to Jujutsu Kaisen?",
    "Find me hidden gem anime",
    "Recommend based on my watch list",
    "What should I watch next?",
    "Suggest a short anime series"
  ];

  // Handle quick prompt click - sends message directly
  const handlePromptClick = async (prompt) => {
    if (!prompt.trim() || loading) return;

    // Add user message immediately
    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        text: prompt,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        id: Date.now()
      },
    ]);

    setLoading(true);
    setTimeout(() => scrollToBottom(), 50);

    try {
      const token = await AsyncStorage.getItem("token");
      const res = await fetch(`${API}/api/ai/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          message: prompt,
          userId: user?._id || user?.id,
          context: conversationContext
        }),
      });

      const data = await res.json();

      // Update conversation context
      setConversationContext(prev => ({
        ...prev,
        mood: data.context?.mood || 'neutral',
        suggestions: data.context?.suggestions || []
      }));

      // Add AI message
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: data.reply,
          anime: data.anime || [],
          context: data.context,
          suggestions: data.context?.suggestions || [],
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          mood: data.context?.mood || 'neutral',
          id: Date.now() + 1
        },
      ]);

    } catch (err) {
      console.error('AI Chat Error:', err);
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: "Hmm, having a little trouble connecting. Try again in a moment! 🌸",
          isError: true,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          id: Date.now() + 1
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Handle anime card press
  const handleAnimePress = (anime) => {
    setSelectedAnime(anime);
    setModalVisible(true);
  };

  // Render message bubble
  const renderMessage = (msg) => {
    const isUser = msg.role === "user";

    return (
      <View key={msg.id} style={[styles.messageBubble, isUser ? styles.userBubble : styles.aiBubble]}>
        <View style={styles.messageHeader}>
          <View style={[styles.messageAvatar, isUser ? styles.userAvatar : styles.aiAvatar]}>
            <Text style={styles.avatarText}>{isUser ? "👤" : "🤖"}</Text>
          </View>
          <View style={styles.messageMeta}>
            <Text style={[styles.messageSender, isUser ? styles.userSender : styles.aiSender]}>
              {isUser ? "You" : "Otaku AI"}
            </Text>
            <Text style={styles.messageTime}>{msg.timestamp}</Text>
          </View>
        </View>

        <View style={[styles.messageContent, isUser ? styles.userContent : styles.aiContent]}>
          <Text style={[styles.messageText, isUser ? styles.userText : styles.aiText]}>
            {msg.text}
            {msg.isError && <Text style={styles.errorIndicator}> ⚠️</Text>}
          </Text>
        </View>

        {/* Follow-up suggestions */}
        {msg.suggestions && msg.suggestions.length > 0 && (
          <View style={styles.followupSuggestions}>
            <Text style={styles.suggestionsLabel}>Quick follow-ups:</Text>
            <View style={styles.suggestionsChips}>
              {msg.suggestions.map((suggestion, idx) => (
                <TouchableOpacity
                  key={idx}
                  onPress={() => setInput(suggestion)}
                  style={styles.suggestionChip}
                >
                  <Text style={styles.suggestionChipText}>{suggestion}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Anime Recommendations */}
        {msg.anime && msg.anime.length > 0 && (
          <View style={styles.animeRecommendationsBox}>
            <View style={styles.recommendationsHeader}>
              <Text style={styles.recommendationsTitle}>✨ Personalized Recommendations</Text>
              <Text style={styles.recommendationsSubtitle}>Based on our conversation</Text>
            </View>
            <View style={styles.animeCardsGrid}>
              {msg.anime.map((anime, idx) => (
                <View key={anime.id || idx} style={styles.animeCardWrapper}>
                  <AnimatedAnimeCard
                    item={anime}
                    index={idx}
                    onPress={handleAnimePress}
                  />
                </View>
              ))}
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🤖 OtakuAI Companion</Text>
        <Text style={styles.headerSubtitle}>Powered by Llama 3.1</Text>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Quick Prompts - Show only when no messages */}
        {messages.length === 0 && (
          <View style={styles.quickPromptsBox}>
            <Text style={styles.promptsTitle}>Try asking:</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.promptsScroll}
            >
              {quickPrompts.map((prompt, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => handlePromptClick(prompt)}
                  style={styles.promptChip}
                >
                  <Text style={styles.promptChipText}>{prompt}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Messages Container */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
        >
          {messages.length === 0 && (
            <View style={styles.welcomeMessage}>
              <Text style={styles.welcomeIcon}>🎬</Text>
              <Text style={styles.welcomeTitle}>Welcome to OtakuShell AI Companion!</Text>
              <Text style={styles.welcomeText}>
                Now powered by Llama 3.1! I'll recommend perfect anime shows just for you!
              </Text>
              <View style={styles.companionFeatures}>
                <View style={styles.feature}>
                  <Text style={styles.featureIcon}>✨</Text>
                  <Text style={styles.featureText}>Smart recommendations</Text>
                </View>
                <View style={styles.feature}>
                  <Text style={styles.featureIcon}>🎯</Text>
                  <Text style={styles.featureText}>Based on your watch history</Text>
                </View>
                <View style={styles.feature}>
                  <Text style={styles.featureIcon}>🤖</Text>
                  <Text style={styles.featureText}>Powered by Llama 3.1</Text>
                </View>
              </View>
            </View>
          )}

          {messages.map(renderMessage)}

          {loading && (
            <View style={[styles.messageBubble, styles.aiBubble]}>
              <View style={styles.messageHeader}>
                <View style={[styles.messageAvatar, styles.aiAvatar]}>
                  <Text style={styles.avatarText}>🤖</Text>
                </View>
                <View style={styles.messageMeta}>
                  <Text style={[styles.messageSender, styles.aiSender]}>Otaku AI</Text>
                  <Text style={styles.messageTime}>Typing...</Text>
                </View>
              </View>
              <View style={[styles.messageContent, styles.aiContent]}>
                <View style={styles.typingIndicator}>
                  <View style={styles.typingDot} />
                  <View style={[styles.typingDot, styles.typingDot2]} />
                  <View style={[styles.typingDot, styles.typingDot3]} />
                </View>
              </View>
            </View>
          )}

          <View ref={messagesEndRef} style={{ height: 20 }} />
        </ScrollView>


        {/* Input Area */}
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.messageInput}
            value={input}
            onChangeText={setInput}
            placeholder="Type your message here..."
            placeholderTextColor="#94a3b8"
            editable={!loading}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            onPress={sendMessage}
            style={[styles.sendButton, (!input.trim() || loading) && styles.sendButtonDisabled]}
            disabled={loading || !input.trim()}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.sendIcon}>➤</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <BottomNav navigation={navigation} activeRoute="AI" />

      {/* Anime Modal */}
      <AnimeModal
        visible={modalVisible}
        anime={selectedAnime}
        onClose={() => setModalVisible(false)}
        onOpenAnime={(anime) => {
          setSelectedAnime(anime);
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
    paddingBottom: 15,
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },
  keyboardAvoid: {
    flex: 1,
  },
  quickPromptsBox: {
    padding: 15,
  },
  promptsTitle: {
    marginBottom: 10,
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  promptsScroll: {
    flexGrow: 0,
  },
  promptChip: {
    backgroundColor: 'rgba(102, 126, 234, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'rgba(102, 126, 234, 0.3)',
  },
  promptChipText: {
    color: '#8cc8ff',
    fontSize: 13,
    fontWeight: '500',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 15,
    paddingBottom: 5,
  },
  welcomeMessage: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 15,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  welcomeIcon: {
    fontSize: 60,
    marginBottom: 15,
  },
  welcomeTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 10,
    textAlign: 'center',
  },
  welcomeText: {
    color: '#999',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  companionFeatures: {
    width: '100%',
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 10,
    marginBottom: 8,
  },
  featureIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  featureText: {
    color: '#fff',
    fontSize: 14,
  },
  messageBubble: {
    marginBottom: 20,
  },
  userBubble: {
    alignItems: 'flex-end',
  },
  aiBubble: {
    alignItems: 'flex-start',
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  messageAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  userAvatar: {
    backgroundColor: '#667eea',
  },
  aiAvatar: {
    backgroundColor: '#10b981',
  },
  avatarText: {
    fontSize: 16,
  },
  messageMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  messageSender: {
    fontWeight: '600',
    fontSize: 14,
  },
  userSender: {
    color: '#667eea',
  },
  aiSender: {
    color: '#10b981',
  },
  messageTime: {
    color: '#94a3b8',
    fontSize: 12,
  },
  messageContent: {
    maxWidth: '85%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
  },
  userContent: {
    backgroundColor: '#667eea',
    borderTopRightRadius: 4,
  },
  aiContent: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderTopLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  userText: {
    color: '#fff',
  },
  aiText: {
    color: '#e2e8f0',
  },
  errorIndicator: {
    color: '#ef4444',
  },
  followupSuggestions: {
    marginTop: 10,
    maxWidth: '85%',
  },
  suggestionsLabel: {
    color: '#94a3b8',
    fontSize: 12,
    marginBottom: 6,
  },
  suggestionsChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  suggestionChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  suggestionChipText: {
    color: '#cbd5e1',
    fontSize: 12,
  },
  animeRecommendationsBox: {
    marginTop: 15,
    padding: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  recommendationsHeader: {
    marginBottom: 12,
  },
  recommendationsTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  recommendationsSubtitle: {
    color: '#94a3b8',
    fontSize: 12,
  },
  animeCardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -5,
    marginTop: 5,
  },
  animeCardWrapper: {
    width: '50%',
    paddingHorizontal: 5,
    marginBottom: 10,
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#667eea',
  },
  typingDot2: {
    opacity: 0.7,
  },
  typingDot3: {
    opacity: 0.4,
  },

  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
    marginBottom: 70,
  },
  messageInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 15,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendIcon: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default AIScreen;