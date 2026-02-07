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
import { useAuth } from '../contexts/AuthContext';
import BottomNav from '../components/BottomNav';
import AnimatedAnimeCard from '../components/AnimatedAnimeCard';
import AnimeModal from '../components/AnimeModal';

const { width } = Dimensions.get('window');

const FormattedMessage = ({ content, style }) => {
    if (!content) return null;
    const lines = content.split('\n');
    return (
        <View>
            {lines.map((line, index) => {
                if (!line.trim()) return <View key={index} style={{ height: 10 }} />;

                // Detect list item "1. Title: Description" pattern
                const listMatch = !line.includes('**') && line.match(/^(\d+\.|-)\s+([^:]+)(:\s+.*)$/);
                if (listMatch) {
                    return (
                        <Text key={index} style={[style, { marginBottom: 8 }]}>
                            <Text style={{ fontWeight: 'bold', color: '#fff' }}>{listMatch[1]} {listMatch[2]}</Text>
                            <Text>{listMatch[3]}</Text>
                        </Text>
                    );
                }

                const parts = line.split(/(\*\*.*?\*\*)/g);
                return (
                    <Text key={index} style={[style, { marginBottom: 4 }]}>
                        {parts.map((part, i) => {
                            if (part.startsWith('**') && part.endsWith('**')) {
                                return <Text key={i} style={{ fontWeight: 'bold', color: '#fff' }}>{part.slice(2, -2)}</Text>;
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
                    // Add welcome message for first-time users
                    const welcomeMessage = {
                        role: "ai",
                        text: "Hey there! 👋 I'm OtakuAI, your anime companion. I can recommend shows based on your taste, chat about anime, or just hang out. What brings you here today?",
                        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        mood: 'neutral',
                        id: Date.now()
                    };
                    setMessages([welcomeMessage]);
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

            // Prepare history (last 10 messages) to send to backend
            // Filter out messages without text to prevent backend crashes
            const history = messages.slice(-10)
                .filter(msg => msg.text && msg.text.trim()) // Only include messages with actual text
                .map(msg => ({
                    role: msg.role === 'ai' ? 'assistant' : 'user',
                    content: msg.text
                }));

            console.log('Sending to:', `${API}/api/ai/chat`);
            console.log('Message:', userText);

            const res = await fetch(`${API}/api/ai/chat`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    message: userText,
                    history: history, // Send conversation history
                    userId: user?._id || user?.id,
                    context: conversationContext
                }),
            });

            console.log('Response status:', res.status);

            if (!res.ok) {
                const errorText = await res.text();
                console.error('Server error:', errorText);
                throw new Error(`Server error: ${res.status}`);
            }

            const data = await res.json();
            console.log('Response data:', data);

            if (!data || !data.reply) {
                console.error('Invalid response format:', data);
                throw new Error('Invalid response from server');
            }

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

            console.log('AI message added successfully');

        } catch (err) {
            console.error('AI Chat Error:', err);
            console.error('Error details:', err.message);

            setMessages((prev) => [
                ...prev,
                {
                    role: "ai",
                    text: `Error: ${err.message}. Please check your connection and try again.`,
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

            // Prepare history (last 10 messages)
            // Filter out messages without text to prevent backend crashes
            const history = messages.slice(-10)
                .filter(msg => msg.text && msg.text.trim()) // Only include messages with actual text
                .map(msg => ({
                    role: msg.role === 'ai' ? 'assistant' : 'user',
                    content: msg.text
                }));

            console.log('Sending prompt to:', `${API}/api/ai/chat`);
            console.log('Prompt:', prompt);

            const res = await fetch(`${API}/api/ai/chat`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    message: prompt,
                    history: history,
                    userId: user?._id || user?.id,
                    context: conversationContext
                }),
            });

            console.log('Response status:', res.status);

            if (!res.ok) {
                const errorText = await res.text();
                console.error('Server error:', errorText);
                throw new Error(`Server error: ${res.status}`);
            }

            const data = await res.json();
            console.log('Response data:', data);

            if (!data || !data.reply) {
                console.error('Invalid response format:', data);
                throw new Error('Invalid response from server');
            }

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

            console.log('AI message added successfully');

        } catch (err) {
            console.error('AI Chat Error:', err);
            console.error('Error details:', err.message);

            setMessages((prev) => [
                ...prev,
                {
                    role: "ai",
                    text: `Error: ${err.message}. Please check your connection and try again.`,
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
                        setMessages([]);
                        await AsyncStorage.removeItem('ai_conversation');
                        setConversationContext({ mood: 'neutral', suggestions: [] });

                        // Re-add welcome message
                        const welcomeMessage = {
                            role: "ai",
                            text: "Chat cleared! What's next on your watchlist?",
                            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                            mood: 'neutral',
                            id: Date.now()
                        };
                        setMessages([welcomeMessage]);
                    }
                }
            ]
        );
    };

    // Render message bubble
    const renderMessage = (msg) => {
        const isUser = msg.role === "user";

        return (
            <View key={msg.id} style={[styles.messageBubble, isUser ? styles.userBubble : styles.aiBubble]}>
                <View style={styles.messageHeader}>
                    <View style={[styles.messageAvatar, isUser ? styles.userAvatar : styles.aiAvatar]}>
                        {isUser && user?.photo ? (
                            <Image source={{ uri: user.photo }} style={styles.avatarImage} resizeMode="cover" />
                        ) : (
                            <Text style={styles.avatarText}>{isUser ? "👤" : "🤖"}</Text>
                        )}
                    </View>
                    <View style={styles.messageMeta}>
                        <Text style={[styles.messageSender, isUser ? styles.userSender : styles.aiSender]}>
                            {isUser ? (user?.name || "You") : "Otaku AI"}
                        </Text>
                        <Text style={styles.messageTime}>{msg.timestamp}</Text>
                    </View>
                </View>

                <View style={[styles.messageContent, isUser ? styles.userContent : styles.aiContent]}>
                    {isUser ? (
                        <Text style={[styles.messageText, styles.userText]}>{msg.text}</Text>
                    ) : (
                        <FormattedMessage content={msg.text} style={[styles.messageText, styles.aiText]} />
                    )}
                    {msg.isError && <Text style={styles.errorIndicator}> ⚠️</Text>}
                </View>

                {/* Anime Recommendations */}
                {msg.anime && msg.anime.length > 0 && (
                    <View style={styles.animeRecommendationsBox}>
                        <View style={styles.animeCardsGrid}>
                            {msg.anime.map((anime, idx) => (
                                <View key={anime.id || idx} style={styles.animeCardWrapper}>
                                    <AnimatedAnimeCard
                                        item={anime}
                                        index={idx}
                                        onPress={handleAnimePress}
                                        cardStyle={{
                                            width: '100%',
                                            height: undefined,
                                            aspectRatio: 0.7,
                                            marginBottom: 0
                                        }}
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
                <View style={styles.headerLeft}>
                    <Text style={styles.headerTitle}>🤖 OtakuAI</Text>
                    <Text style={styles.headerSubtitle}>Powered by Mistral AI</Text>
                </View>
                <TouchableOpacity
                    style={styles.clearButton}
                    onPress={handleClearChat}
                >
                    <Text style={styles.clearButtonText}>Clear Chat</Text>
                </TouchableOpacity>
            </View>

            <KeyboardAvoidingView
                style={styles.keyboardAvoid}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
            >
                {/* Quick Prompts - Show only when no messages or just welcome */}
                {messages.length <= 1 && (
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
                                    disabled={loading}
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
                                Now powered by Mistral AI! I'll recommend perfect anime shows just for you!
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
                                    <Text style={styles.featureText}>Powered by Mistral AI</Text>
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
                        onSubmitEditing={sendMessage}
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
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    headerLeft: {
        flex: 1,
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
    clearButton: {
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.3)',
    },
    clearButtonText: {
        color: '#ef4444',
        fontSize: 13,
        fontWeight: '600',
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
    avatarImage: {
        width: 36,
        height: 36,
        borderRadius: 18,
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
        color: '#fff', // Default white color for all text
    },
    userText: {
        color: '#fff',
    },
    aiText: {
        color: '#fff', // Changed from #e2e8f0 to ensure visibility
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
        padding: 10, // Reduced padding to align with card spacing
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    recommendationsHeader: {
        marginBottom: 12,
        paddingHorizontal: 5, // Align header text with card content
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
        marginTop: 0, // Removed extra margin
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