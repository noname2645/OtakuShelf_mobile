import React, { useEffect, useRef } from 'react';
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

const AnimatedAnimeCard = ({ item, index, onPress }) => {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.9)).current;

    useEffect(() => {
        const delay = Math.min(index * 50, 300); // Stagger animation
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 400,
                delay,
                useNativeDriver: true,
            }),
            Animated.spring(scaleAnim, {
                toValue: 1,
                delay,
                tension: 50,
                friction: 7,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    return (
        <Animated.View
            style={{
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }],
            }}
        >
            <TouchableOpacity
                style={styles.animeCard}
                onPress={() => onPress(item)}
                activeOpacity={0.8}
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
                            {item.title}
                        </Text>
                    </View>
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    animeCard: {
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        marginRight: 20,
        marginBottom: 20,
        borderRadius: 20,
        overflow: 'hidden',
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: 'beige',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    cardInner: {
        flex: 1,
        position: 'relative',
    },
    cardImage: {
        width: '100%',
        height: '100%',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        borderRadius: 20,
    },
    gradientOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '40%',
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
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
        fontFamily: 'Outfit',
        fontWeight: '600',
        letterSpacing: 1,
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
        color: '#ff6a00',
        textShadowColor: 'rgba(190, 79, 0, 0.5)',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 8,
        includeFontPadding: true,
        textAlignVertical: 'center',
        padding: 0,
        margin: 0,
    },
});

export default AnimatedAnimeCard;
