import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  Easing,
} from 'react-native';
import Svg, { Path, Rect, Line } from 'react-native-svg';

const { width, height } = Dimensions.get('screen');

// ─── ToriiGate SVG ───────────────────────────────────────────────────────────
const ToriiGate = ({ size = 80, color = 'rgba(255, 115, 0, 0.5)' }) => (
  <Svg width={size} height={size} viewBox="0 0 100 80" fill="none">
    {/* Top beam */}
    <Rect x="4" y="8" width="92" height="10" rx="2" fill={color} />
    {/* Second beam */}
    <Rect x="14" y="22" width="72" height="8" rx="2" fill={color} />
    {/* Left pillar */}
    <Rect x="16" y="22" width="10" height="52" rx="2" fill={color} />
    {/* Right pillar */}
    <Rect x="74" y="22" width="10" height="52" rx="2" fill={color} />
    {/* Top beam extensions (wings) */}
    <Path d="M4 8 L0 18 L14 18" fill={color} />
    <Path d="M96 8 L100 18 L86 18" fill={color} />
  </Svg>
);

// ─── PageLoader ───────────────────────────────────────────────────────────────
const PageLoader = ({ onFinish }) => {
  // Curtain panel animations
  const leftCurtain = useRef(new Animated.Value(-width / 2)).current;
  const rightCurtain = useRef(new Animated.Value(width / 2)).current;
  const overlayOpacity = useRef(new Animated.Value(1)).current;

  // Logo / center content
  const logoScale = useRef(new Animated.Value(0.7)).current;
  const logoTranslateY = useRef(new Animated.Value(20)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;

  // Torii float
  const toriiFloat = useRef(new Animated.Value(0)).current;

  // Typewriter state
  const [tagline, setTagline] = useState('');
  const [showCursor, setShowCursor] = useState(true);
  const FULL_TAGLINE = 'Your anime universe, curated.';

  useEffect(() => {
    // ── Phase 1: Curtains slide IN (0–400ms)
    Animated.parallel([
      Animated.timing(leftCurtain, {
        toValue: 0,
        duration: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(rightCurtain, {
        toValue: 0,
        duration: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      // ── Phase 1.5: Logo appears after curtains meet
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(logoTranslateY, {
          toValue: 0,
          duration: 250,
          easing: Easing.out(Easing.back(1.5)),
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      // ── Typewriter after 100ms delay
      let charIndex = 0;
      const typeInterval = setTimeout(() => {
        const interval = setInterval(() => {
          charIndex++;
          setTagline(FULL_TAGLINE.substring(0, charIndex));
          if (charIndex >= FULL_TAGLINE.length) clearInterval(interval);
        }, 18);
      }, 100);

      // ── Phase 2: Curtains SPLIT apart at 800ms
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(leftCurtain, {
            toValue: -width,
            duration: 500,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(rightCurtain, {
            toValue: width,
            duration: 500,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(logoScale, {
            toValue: 0.85,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(logoOpacity, {
            toValue: 0,
            duration: 350,
            useNativeDriver: true,
          }),
        ]).start();
      }, 800);

      // ── Phase 3: Overlay fades at 1300ms
      setTimeout(() => {
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start(() => {
          onFinish && onFinish();
        });
      }, 1300);

      return () => clearTimeout(typeInterval);
    });

    // ── Torii floating loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(toriiFloat, {
          toValue: -6,
          duration: 1500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(toriiFloat, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // ── Cursor blink
    const cursorInterval = setInterval(() => {
      setShowCursor(prev => !prev);
    }, 375);

    return () => clearInterval(cursorInterval);
  }, []);

  return (
    <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]} pointerEvents="auto">
      {/* Left curtain */}
      <Animated.View
        style={[styles.curtainLeft, { transform: [{ translateX: leftCurtain }] }]}
      >
        <View style={styles.curtainInner} />
      </Animated.View>

      {/* Right curtain */}
      <Animated.View
        style={[styles.curtainRight, { transform: [{ translateX: rightCurtain }] }]}
      >
        <View style={styles.curtainInner} />
      </Animated.View>

      {/* Center Logo */}
      <Animated.View
        style={[
          styles.centerContent,
          {
            opacity: logoOpacity,
            transform: [{ scale: logoScale }, { translateY: logoTranslateY }],
          },
        ]}
        pointerEvents="none"
      >
        {/* Torii Gate Icon */}
        <Animated.View style={{ transform: [{ translateY: toriiFloat }] }}>
          <ToriiGate size={80} color="rgba(255, 115, 0, 0.55)" />
        </Animated.View>

        {/* Brand Name */}
        <View style={styles.brandRow}>
          <Text style={styles.brandOtaku}>OTAKU</Text>
          <Text style={styles.brandShelf}>SHELF</Text>
        </View>

        {/* Tagline with typewriter cursor */}
        <View style={styles.taglineRow}>
          <Text style={styles.taglineText}>{tagline}</Text>
          <Text style={[styles.cursor, { opacity: showCursor ? 1 : 0 }]}>|</Text>
        </View>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    width: width + 2,
    height: height + 2,
    marginLeft: -1,
    marginTop: -1,
    zIndex: 99999,
    backgroundColor: '#030712',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Curtains ──
  curtainLeft: {
    position: 'absolute',
    top: -1,
    left: -1,
    width: width / 2 + 3,
    height: height + 2,
  },
  curtainRight: {
    position: 'absolute',
    top: -1,
    right: -1,
    width: width / 2 + 3,
    height: height + 2,
  },
  curtainInner: {
    flex: 1,
    backgroundColor: '#0d0018',
    // Subtle inner border handled by the overlay gap between panels
  },

  // ── Center Content ──
  centerContent: {
    position: 'absolute',
    zIndex: 3,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },

  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  brandOtaku: {
    fontFamily: 'OutfitRegular',
    fontSize: 32,
    fontWeight: '900',
    color: '#ff7300',
    letterSpacing: 4,
  },
  brandShelf: {
    fontFamily: 'OutfitRegular',
    fontSize: 32,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 4,
  },

  taglineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  taglineText: {
    fontFamily: 'OutfitRegular',
    fontSize: 14,
    fontWeight: '300',
    color: 'rgba(255, 220, 160, 0.7)',
    letterSpacing: 0.5,
  },
  cursor: {
    fontFamily: 'OutfitRegular',
    fontSize: 14,
    color: '#ff7300',
    marginLeft: 1,
  },
});

export default PageLoader;
