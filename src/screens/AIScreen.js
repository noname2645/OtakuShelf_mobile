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
    Alert,
    Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contexts/AuthContext';
import BottomNav from '../components/BottomNav';
import AnimatedAnimeCard from '../components/AnimatedAnimeCard';
import AnimeModal from '../components/AnimeModal';

const { width } = Dimensions.get('window');
const otakuAI = require('../../assets/icon.png');

const ANIME_DETAILS_QUERY = `
  query ($id: Int) {
    Media (id: $id, type: ANIME) {
      id
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
    }
  }
`;

const FormattedMessage = ({ content, style }) => {
    if (!content) return null;
    const lines = content.split('\n');
    return (
        <View>
            {lines.map((line, index) => {
                if (!line.trim()) return <View key={index} style={{ height: 8 }} />;

                // Detect list item "1. Title: Description" pattern
                const listMatch = !line.includes('**') && line.match(/^(\d+\.|-)\s+([^:]+)(:\s+.*)$/);
                if (listMatch) {
                    return (
                        <Text key={index} style={[style, { marginBottom: 6 }]}>
                            <Text style={{ fontWeight: '700', color: '#fff', fontFamily: 'OutfitRegular' }}>{listMatch[1]} {listMatch[2]}</Text>
                            <Text style={{ fontFamily: 'OutfitRegular' }}>{listMatch[3]}</Text>
                        </Text>
                    );
                }

                // Parse bold (**text**) and code (`text`) inline styles
                const parts = line.split(/(\*\*.*?\*\*|`.*?`)/g);
                return (
                    <Text key={index} style={[style, { marginBottom: 4, fontFamily: 'OutfitRegular' }]}>
                        {parts.map((part, i) => {
                            if (part.startsWith('**') && part.endsWith('**')) {
                                return (
                                    <Text key={i} style={{ fontWeight: '700', color: '#fff', fontFamily: 'OutfitRegular' }}>
                                        {part.slice(2, -2)}
                                    </Text>
                                );
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

const AIScreen = ({ navigation }) => {
    const [input, setInput] = useState("");
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(false);
    const [streaming, setStreaming] = useState(false);
    const [streamingText, setStreamingText] = useState("");
    const [conversationContext, setConversationContext] = useState({
        mood: 'friendly',
        suggestions: ["Recommend something new!", "Based on my history", "Top anime of the season"]
    });
    const [selectedAnime, setSelectedAnime] = useState(null);
    const [modalVisible, setModalVisible] = useState(false);

    const scrollViewRef = useRef(null);
    const typingIntervalRef = useRef(null);
    const scrollY = useRef(0);

    const { user, API } = useAuth();

    // Auto-scroll to bottom
    const scrollToBottom = (instant = false) => {
        if (scrollViewRef.current) {
            scrollViewRef.current.scrollToEnd({ animated: !instant });
        }
    };

    // Handle scroll position
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
                } else {
                    const welcomeMessage = {
                        role: "ai",
                        text: `Yo! 👋 I'm OtakuAI, your personal anime companion. Think of me as your ultimate nakama in the anime world! \n\nI've analyzed your profile and I'm ready to dive deep into discussions or find your next binge-worthy masterpiece. What's on your mind today?`,
                        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        mood: 'friendly',
                        id: Date.now() + Math.random()
                    };
                    setMessages([welcomeMessage]);
                    setTimeout(() => scrollToBottom(true), 300);
                }
            } catch (error) {
                console.error("Failed to parse saved conversation:", error);
            }
        };
        loadConversation();
    }, []);

    // Cleanup interval on unmount
    useEffect(() => {
        return () => {
            if (typingIntervalRef.current) {
                clearInterval(typingIntervalRef.current);
            }
        };
    }, []);

    // Save conversation to storage
    useEffect(() => {
        const saveConversation = async () => {
            if (messages.length > 0 && !streaming) {
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
    }, [messages, streaming]);

    // Auto-scroll when messages change
    useEffect(() => {
        if (messages.length > 0) {
            const lastMessage = messages[messages.length - 1];
            if (lastMessage.role === "user" || (!loading && lastMessage.role === "ai")) {
                setTimeout(() => scrollToBottom(), 100);
            }
        }
    }, [messages, loading]);

    // Typewriter effect for streaming
    const typewriterEffect = (fullText, messageData) => {
        if (!fullText) {
            setMessages(prev => [...prev, messageData]);
            return;
        }
        
        setStreaming(true);
        setStreamingText("");

        let currentIndex = 0;
        const typingSpeed = 2;

        if (typingIntervalRef.current) {
            clearInterval(typingIntervalRef.current);
        }

        typingIntervalRef.current = setInterval(() => {
            if (currentIndex < fullText.length) {
                setStreamingText(fullText.substring(0, currentIndex + 1));
                currentIndex++;
                if (currentIndex % 10 === 0) scrollToBottom();
            } else {
                clearInterval(typingIntervalRef.current);
                typingIntervalRef.current = null;
                setStreaming(false);
                setStreamingText("");
                setMessages((prev) => [...prev, messageData]);
            }
        }, typingSpeed);
    };

    // Send Message function
    const sendMessage = async () => {
        if (!input.trim() || loading) return;

        const userText = input;
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        const userMsg = {
            role: "user",
            text: userText,
            timestamp,
            id: Date.now()
        };

        setMessages((prev) => [...prev, userMsg]);
        setInput("");
        setLoading(true);

        setTimeout(() => scrollToBottom(), 50);

        try {
            const token = await AsyncStorage.getItem("token");
            const history = messages.slice(-8)
                .filter(msg => msg.text && msg.text.trim())
                .map(msg => ({
                    role: msg.role === 'ai' ? 'assistant' : 'user',
                    content: msg.text || ""
                }));

            const res = await fetch(`${API}/api/ai/chat`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    message: userText,
                    history: history,
                    userId: user?._id || user?.id,
                    context: conversationContext
                }),
            });

            if (!res.ok) {
                const errorText = await res.text();
                console.error('Server error:', errorText);
                throw new Error(`Server error: ${res.status}`);
            }

            const response = await res.json();
            
            if (response.status === 'error') {
                throw new Error(response.message || "Failed to generate AI response");
            }

            const data = (response.status && response.data) ? response.data : response;

            setConversationContext(prev => ({
                ...prev,
                mood: data.context?.mood || 'neutral',
                suggestions: data.context?.suggestions || []
            }));

            setLoading(false);

            const aiMessageData = {
                role: "ai",
                text: data.reply || "Something went wrong, but I'm still here!",
                anime: data.anime || [],
                context: data.context || {},
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                mood: data.context?.mood || 'neutral',
                id: Date.now() + 1
            };

            typewriterEffect(data.reply, aiMessageData);

        } catch (err) {
            console.error("AI Chat Error:", err);
            setLoading(false);
            setMessages((prev) => [
                ...prev,
                {
                    role: "ai",
                    text: "Hmm, having a little trouble connecting. Check your internet or try again! 🌸",
                    isError: true,
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    id: Date.now() + 1
                },
            ]);
        }
    };

    // Handle quick prompt chip click
    const handlePromptClick = (prompt) => {
        setInput(prompt);
    };

    // Handle anime card press
    const handleAnimePress = async (anime) => {
        setSelectedAnime(anime);
        setModalVisible(true);

        // Fetch detailed info if dates are missing
        if (!anime.startDate || !anime.endDate) {
            try {
                const response = await fetch('https://graphql.anilist.co', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                    },
                    body: JSON.stringify({
                        query: ANIME_DETAILS_QUERY,
                        variables: { id: parseInt(anime.id) }
                    })
                });

                const data = await response.json();
                const media = data.data?.Media;

                if (media) {
                    setSelectedAnime(prev => ({
                        ...prev,
                        ...media,
                        title: media.title || prev.title,
                        coverImage: media.coverImage || prev.coverImage,
                    }));
                }
            } catch (error) {
                console.log("Error fetching anime details:", error);
            }
        }
    };

    // Clear chat handler
    const handleClearChat = () => {
        Alert.alert(
            "Clear Conversation",
            "Are you sure you want to clear the conversation?",
            [
                {
                    text: "Cancel",
                    style: "cancel"
                },
                {
                    text: "Clear",
                    style: "destructive",
                    onPress: async () => {
                        if (typingIntervalRef.current) {
                            clearInterval(typingIntervalRef.current);
                            typingIntervalRef.current = null;
                        }
                        setMessages([]);
                        await AsyncStorage.removeItem('ai_conversation');
                        setConversationContext({ 
                            mood: 'friendly', 
                            suggestions: ["Recommend something new!", "Based on my history", "Top anime of the season"] 
                        });

                        const welcomeMsg = {
                            role: "ai",
                            text: "Chat cleared! Ready to start fresh. What's on your mind?",
                            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                            mood: 'friendly',
                            id: Date.now()
                        };
                        setMessages([welcomeMsg]);
                    }
                }
            ]
        );
    };

    // Render message bubble
    const renderMessage = (msg) => {
        const isUser = msg.role === "user";

        return (
            <View key={msg.id || Math.random()} style={[styles.messageBubble, isUser ? styles.userBubble : styles.aiBubble]}>
                <View style={[styles.messageHeader, isUser && styles.userMessageHeader]}>
                    <View style={styles.messageAvatar}>
                        {isUser ? (
                            user?.photo ? (
                                <Image source={{ uri: user.photo }} style={styles.avatarImage} resizeMode="cover" />
                            ) : (
                                <View style={styles.userInitialsContainer}>
                                    <Text style={styles.userInitials}>
                                        {(user?.name || user?.email || 'U').charAt(0).toUpperCase()}
                                    </Text>
                                </View>
                            )
                        ) : (
                            <Image source={otakuAI} style={styles.avatarImage} resizeMode="contain" />
                        )}
                    </View>
                    <View style={styles.messageMeta}>
                        <Text style={styles.messageSender}>
                            {isUser ? (user?.name || "You") : "Otaku AI"}
                        </Text>
                        <Text style={styles.messageTime}>{msg.timestamp}</Text>
                    </View>
                </View>

                {isUser ? (
                    <LinearGradient
                        colors={['#818cf8', '#6366f1']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={[styles.messageContent, styles.userContent]}
                    >
                        <Text style={[styles.messageText, styles.userText]}>{msg.text}</Text>
                    </LinearGradient>
                ) : (
                    <View style={[styles.messageContent, styles.aiContent]}>
                        <FormattedMessage content={msg.text} style={[styles.messageText, styles.aiText]} />
                        {msg.isError && <Text style={styles.errorIndicator}> ⚠️</Text>}
                    </View>
                )}

                {/* Anime Recommendations */}
                {msg.anime && msg.anime.length > 0 && (
                    <View style={styles.animeRecommendationsBox}>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.animeCardsScroll}
                        >
                            {msg.anime.map((anime, idx) => anime && (
                                <View key={anime.id || idx} style={styles.animeCardWrapperHorizontal}>
                                    <AnimatedAnimeCard
                                        item={anime}
                                        index={idx}
                                        onPress={handleAnimePress}
                                        cardStyle={{
                                            width: '100%',
                                            height: '100%',
                                            marginBottom: 0
                                        }}
                                    />
                                </View>
                            ))}
                        </ScrollView>
                    </View>
                )}
            </View>
        );
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.companionInfoWrapper}>
                    <View style={styles.companionAvatar}>
                        <Image source={otakuAI} style={styles.avatarImage} resizeMode="contain" />
                    </View>
                    <View style={styles.companionInfo}>
                        <Text style={styles.headerTitle}>OtakuAI</Text>
                        <View style={styles.companionStatus}>
                            <View style={styles.statusDot} />
                            <Text style={styles.statusText}>Ready to Binge</Text>
                        </View>
                    </View>
                </View>
                <TouchableOpacity
                    style={styles.clearButton}
                    onPress={handleClearChat}
                >
                    <Text style={styles.clearButtonText}>Clear History</Text>
                </TouchableOpacity>
            </View>

            <KeyboardAvoidingView
                style={styles.keyboardAvoid}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
            >
                {/* Messages Container */}
                <ScrollView
                    ref={scrollViewRef}
                    style={styles.messagesContainer}
                    contentContainerStyle={styles.messagesContent}
                    onScroll={handleScroll}
                    scrollEventThrottle={16}
                    showsVerticalScrollIndicator={false}
                >
                    {messages.map(renderMessage)}

                    {streaming && (
                        <View style={[styles.messageBubble, styles.aiBubble]}>
                            <View style={styles.messageHeader}>
                                <View style={styles.messageAvatar}>
                                    <Image source={otakuAI} style={styles.avatarImage} resizeMode="contain" />
                                </View>
                                <View style={styles.messageMeta}>
                                    <Text style={styles.messageSender}>Otaku AI</Text>
                                </View>
                            </View>
                            <View style={[styles.messageContent, styles.aiContent]}>
                                <FormattedMessage content={streamingText} style={[styles.messageText, styles.aiText]} />
                            </View>
                        </View>
                    )}

                    {loading && !streaming && (
                        <View style={[styles.messageBubble, styles.aiBubble]}>
                            <View style={styles.messageHeader}>
                                <View style={styles.messageAvatar}>
                                    <Image source={otakuAI} style={styles.avatarImage} resizeMode="contain" />
                                </View>
                                <View style={styles.messageMeta}>
                                    <Text style={styles.messageSender}>Otaku AI</Text>
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

                    <View style={{ height: 20 }} />
                </ScrollView>

                {/* Footer Suggestions & Input */}
                <View style={styles.chatFooter}>
                    {conversationContext.suggestions && conversationContext.suggestions.length > 0 && !loading && (
                        <View style={styles.quickSuggestionsBox}>
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.quickSuggestionsScroll}
                            >
                                {conversationContext.suggestions.map((suggestion, i) => (
                                    <TouchableOpacity
                                        key={i}
                                        style={styles.suggestionChip}
                                        onPress={() => handlePromptClick(suggestion)}
                                    >
                                        <Text style={styles.suggestionChipText}>{suggestion}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    )}

                    <View style={styles.inputWrapper}>
                        <TextInput
                            style={styles.messageInput}
                            value={input}
                            onChangeText={setInput}
                            placeholder="Message OtakuAI..."
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
                                <ActivityIndicator color="#000" size="small" />
                            ) : (
                                <Text style={[styles.sendIcon, (!input.trim() || loading) && styles.sendIconDisabled]}>➤</Text>
                            )}
                        </TouchableOpacity>
                    </View>
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
        backgroundColor: '#050814',
    },
    header: {
        paddingTop: Platform.OS === 'ios' ? 50 : 35,
        paddingBottom: 15,
        paddingHorizontal: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.08)',
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
    },
    companionInfoWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    companionAvatar: {
        width: 40,
        height: 40,
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: 12,
        padding: 4,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarImage: {
        width: '100%',
        height: '100%',
    },
    companionInfo: {
        justifyContent: 'center',
    },
    headerTitle: {
        fontFamily: 'OutfitRegular',
        fontSize: 18,
        fontWeight: '700',
        color: '#fff',
    },
    companionStatus: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 2,
    },
    statusDot: {
        width: 6,
        height: 6,
        backgroundColor: '#10b981',
        borderRadius: 3,
        shadowColor: '#10b981',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 4,
    },
    statusText: {
        fontSize: 11,
        color: '#94a3b8',
        fontWeight: '500',
        fontFamily: 'OutfitRegular',
    },
    clearButton: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 10,
    },
    clearButtonText: {
        color: '#94a3b8',
        fontSize: 12,
        fontWeight: '600',
        fontFamily: 'OutfitRegular',
    },
    keyboardAvoid: {
        flex: 1,
    },
    messagesContainer: {
        flex: 1,
    },
    messagesContent: {
        padding: 15,
        paddingBottom: 5,
    },
    messageBubble: {
        marginBottom: 20,
        maxWidth: '82%',
    },
    userBubble: {
        alignSelf: 'flex-end',
        alignItems: 'flex-end',
    },
    aiBubble: {
        alignSelf: 'flex-start',
        alignItems: 'flex-start',
    },
    messageHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 6,
    },
    userMessageHeader: {
        flexDirection: 'row-reverse',
    },
    messageAvatar: {
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 4,
    },
    userInitialsContainer: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    userInitials: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 14,
        fontFamily: 'OutfitRegular',
    },
    messageMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    messageSender: {
        fontSize: 12,
        fontWeight: '600',
        color: '#94a3b8',
        fontFamily: 'OutfitRegular',
    },
    messageTime: {
        fontSize: 10,
        color: 'rgba(148, 163, 184, 0.5)',
        fontFamily: 'OutfitRegular',
    },
    messageContent: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 20,
    },
    userContent: {
        borderTopRightRadius: 4,
    },
    aiContent: {
        backgroundColor: 'rgba(30, 41, 59, 0.4)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        borderTopLeftRadius: 4,
    },
    messageText: {
        fontSize: 15,
        lineHeight: 22,
        color: '#fff',
        fontFamily: 'OutfitRegular',
    },
    userText: {
        color: '#fff',
    },
    aiText: {
        color: '#fff',
    },
    codeInline: {
        fontFamily: 'JetbrainsMono',
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        color: '#f59e0b',
        paddingHorizontal: 4,
        paddingVertical: 2,
        borderRadius: 4,
        fontSize: 13,
    },
    errorIndicator: {
        color: '#ef4444',
        marginTop: 4,
    },
    animeRecommendationsBox: {
        marginTop: 12,
        width: width * 0.82,
    },
    animeCardsScroll: {
        paddingRight: 20,
    },
    animeCardWrapperHorizontal: {
        width: 135,
        height: 195,
        marginRight: 12,
    },
    chatFooter: {
        paddingBottom: Platform.OS === 'ios' ? 10 : 15,
    },
    quickSuggestionsBox: {
        marginBottom: 10,
        marginHorizontal: 16,
    },
    quickSuggestionsScroll: {
        gap: 8,
        paddingRight: 10,
    },
    suggestionChip: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    },
    suggestionChipText: {
        color: '#94a3b8',
        fontSize: 13,
        fontWeight: '500',
        fontFamily: 'OutfitRegular',
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: 24,
        paddingHorizontal: 8,
        paddingVertical: 6,
        marginHorizontal: 16,
        marginBottom: 70,
    },
    messageInput: {
        flex: 1,
        color: '#fff',
        paddingHorizontal: 12,
        paddingVertical: Platform.OS === 'ios' ? 10 : 6,
        fontSize: 15,
        fontFamily: 'OutfitRegular',
        maxHeight: 120,
    },
    sendButton: {
        width: 38,
        height: 38,
        borderRadius: 12,
        backgroundColor: '#f59e0b',
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendButtonDisabled: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    sendIcon: {
        color: '#000',
        fontSize: 16,
        fontWeight: 'bold',
    },
    sendIconDisabled: {
        color: '#94a3b8',
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
});

export const useAnimePreferences = () => {
  const { user } = useAuth();
  
  const preferences = user?.settings?.preferences || {
    titleLanguage: 'romaji',
    defaultLayout: 'grid',
    nsfwContent: false,
    autoplayTrailers: true,
    accentColor: '#ff6b6b'
  };

  /**
   * Returns the preferred title string for a given anime object.
   * Expects title objects in Anilist schema: { romaji, english, native }
   */
  const getPreferredTitle = (titleObj) => {
    if (!titleObj) return "Unknown Title";
    if (typeof titleObj === 'string') return titleObj;

    const { titleLanguage } = preferences;

    if (titleLanguage === 'english' && titleObj.english) return titleObj.english;
    if (titleLanguage === 'native' && titleObj.native) return titleObj.native;
    
    // Default to Romaji, or whichever is available as fallback
    return titleObj.romaji || titleObj.english || titleObj.native || "Unknown Title";
  };

  /**
   * Checks if a cover image should be blurred based on age restriction and user settings.
   */
  const shouldBlurNSFW = (isAdult) => {
    if (!isAdult) return false;
    return !preferences.nsfwContent;
  };

  /**
   * Returns true if trailers should play automatically.
   */
  const shouldAutoplay = () => {
    return preferences.autoplayTrailers;
  };

  return {
    preferences,
    getPreferredTitle,
    shouldBlurNSFW,
    shouldAutoplay
  };
};

export default AIScreen;