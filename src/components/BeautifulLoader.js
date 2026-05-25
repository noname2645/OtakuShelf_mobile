import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';

const BeautifulLoader = () => {
    const rotation = useRef(new Animated.Value(0)).current;
    const pulse = useRef(new Animated.Value(1)).current;
    const opacity = useRef(new Animated.Value(0.5)).current;

    useEffect(() => {
        // Continuous rotation
        Animated.loop(
            Animated.timing(rotation, {
                toValue: 1,
                duration: 2000,
                easing: Easing.linear,
                useNativeDriver: true,
            })
        ).start();

        // Breathing effect
        Animated.loop(
            Animated.parallel([
                Animated.sequence([
                    Animated.timing(pulse, {
                        toValue: 1.2,
                        duration: 800,
                        easing: Easing.inOut(Easing.ease),
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulse, {
                        toValue: 1,
                        duration: 800,
                        easing: Easing.inOut(Easing.ease),
                        useNativeDriver: true,
                    }),
                ]),
                Animated.sequence([
                    Animated.timing(opacity, {
                        toValue: 0.8,
                        duration: 800,
                        easing: Easing.inOut(Easing.ease),
                        useNativeDriver: true,
                    }),
                    Animated.timing(opacity, {
                        toValue: 0.4,
                        duration: 800,
                        easing: Easing.inOut(Easing.ease),
                        useNativeDriver: true,
                    }),
                ]),
            ])
        ).start();
    }, []);

    const spin = rotation.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    const reverseSpin = rotation.interpolate({
        inputRange: [0, 1],
        outputRange: ['360deg', '0deg'],
    });

    return (
        <View style={styles.container}>
            {/* Background glow */}
            <Animated.View
                style={[
                    styles.glowEffect,
                    {
                        transform: [{ scale: pulse }],
                        opacity: opacity
                    }
                ]}
            />

            {/* Center Core */}
            <View style={styles.core} />

            {/* Outer rotating ring */}
            <Animated.View style={[styles.ringWrapper, { transform: [{ rotate: spin }] }]}>
                <View style={styles.outerRing} />
            </Animated.View>

            {/* Inner reverse rotating ring */}
            <Animated.View style={[styles.innerRingWrapper, { transform: [{ rotate: reverseSpin }] }]}>
                <View style={styles.innerRing} />
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: 100,
        height: 100,
        justifyContent: 'center',
        alignItems: 'center',
    },
    glowEffect: {
        position: 'absolute',
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#ff5900',
        shadowColor: '#ff5900',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 20,
    },
    core: {
        position: 'absolute',
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#fff',
        shadowColor: '#fff',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 10,
        zIndex: 10,
    },
    ringWrapper: {
        position: 'absolute',
        width: 80,
        height: 80,
        justifyContent: 'center',
        alignItems: 'center',
    },
    outerRing: {
        width: 80,
        height: 80,
        borderRadius: 40,
        borderWidth: 3,
        borderColor: 'transparent',
        borderTopColor: '#ff5900',
        borderRightColor: 'rgba(255, 89, 0, 0.3)',
    },
    innerRingWrapper: {
        position: 'absolute',
        width: 50,
        height: 50,
        justifyContent: 'center',
        alignItems: 'center',
    },
    innerRing: {
        width: 50,
        height: 50,
        borderRadius: 25,
        borderWidth: 3,
        borderColor: 'transparent',
        borderBottomColor: '#ffb36b',
        borderLeftColor: 'rgba(255, 179, 107, 0.3)',
    },
});

export default BeautifulLoader;
