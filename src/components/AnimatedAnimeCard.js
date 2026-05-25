import React, { useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Image,
    StyleSheet,
    Animated,
    Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 60) / 2;
const CARD_HEIGHT = CARD_WIDTH * 1.45;

const AnimatedAnimeCard = ({ item, index, onPress, cardStyle }) => {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.9)).current;

    // Helper function to get title string
    const getTitle = (title) => {
        if (typeof title === 'string') return title;
        if (title?.english) return title.english;
        if (title?.romaji) return title.romaji;
        if (title?.native) return title.native;
        return 'Untitled';
    };

    useEffect(() => {
        const delay = Math.min(index * 50, 300); // Stagger animation
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 400,
                delay,
                useNativeDriver: true, // Use native driver for opacity
            }),
            Animated.spring(scaleAnim, {
                toValue: 1,
                delay,
                tension: 50,
                friction: 7,
                useNativeDriver: true, // Use native driver for scale
            }),
        ]).start();
    }, []);

    const handlePressIn = useCallback(() => {
        Animated.spring(scaleAnim, {
            toValue: 0.95,
            useNativeDriver: true,
        }).start();
    }, []);

    const handlePressOut = useCallback(() => {
        Animated.spring(scaleAnim, {
            toValue: 1,
            useNativeDriver: true,
        }).start();
    }, []);

    return (
        <Animated.View
            style={[{
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }],
                width: CARD_WIDTH,
                height: CARD_HEIGHT,
                marginBottom: 25,
            }, cardStyle]}
        >
            <TouchableOpacity
                style={styles.animeCard}
                onPress={() => onPress(item)}
                activeOpacity={1}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
            >
                <View style={styles.cardInner}>
                    <Image
                        source={{
                            uri:
                                item.coverImage?.extraLarge ||
                                item.coverImage?.large ||
                                'https://via.placeholder.com/300x450',
                        }}
                        style={styles.cardImage}
                        resizeMode="cover"
                    />
                    <LinearGradient
                        colors={[
                            'transparent',
                            'rgba(0,0,0,0.5)',
                            'rgba(0,0,0,0.8)',
                            'rgba(0,0,0,0.95)',
                        ]}
                        locations={[0, 0.3, 0.7, 1]}
                        style={styles.gradientOverlay}
                    />
                    <View style={styles.titleOverlay}>
                        <Text style={styles.cardTitle} numberOfLines={2}>
                            {getTitle(item.title)}
                        </Text>
                    </View>
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    animeCard: {
        width: '100%',
        height: '100%',
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: '#111',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
        elevation: 6,
    },
    cardInner: {
        flex: 1,
        position: 'relative',
    },
    cardImage: {
        ...require('react-native').StyleSheet.absoluteFillObject,
        borderRadius: 16,
    },
    gradientOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '55%',
        borderBottomLeftRadius: 16,
        borderBottomRightRadius: 16,
    },
    titleOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingTop: 8,
        paddingBottom: 12,
        paddingHorizontal: 10,
        backgroundColor: 'transparent',
        zIndex: 1,
    },
    cardTitle: {
        fontFamily: 'OutfitRegular',
        fontWeight: '700',
        letterSpacing: 0.5,
        fontSize: 13,
        textAlign: 'center',
        lineHeight: 18,
        color: '#ff9a00',
        textShadowColor: 'rgba(0,0,0,0.95)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 5,
        includeFontPadding: false,
        padding: 0,
        margin: 0,
    },
});

export default AnimatedAnimeCard;
