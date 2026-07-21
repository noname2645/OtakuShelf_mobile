// components/BottomNavBar.js
import React, { useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
  Animated,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Image } from 'expo-image';
import { useAuth } from '../contexts/AuthContext';
import Svg, { Path, Polyline, Circle, Line, Polygon, Rect } from 'react-native-svg';

const { width: screenWidth } = Dimensions.get('window');

// ── Tab definitions ─────────────────────────────────────────────────────────
const BASE_SIZES = { Home: 18, List: 20, Search: 20, AI: 22, Profile: 20 };
const TABS = [
  {
    name: 'Home',
    label: 'Home',
    color: [167, 139, 250], // Violet
    icon: ({ active, size, color }) => (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"
        stroke={active ? `rgb(${color})` : '#94a3b8'} strokeWidth={2}
        strokeLinecap="round" strokeLinejoin="round"
      >
        <Path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </Svg>
    ),
  },
  {
    name: 'List',
    label: 'Watchlist',
    color: [244, 114, 182], // Pink
    icon: ({ active, size, color }) => (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"
        stroke={active ? `rgb(${color})` : '#94a3b8'} strokeWidth={2}
        strokeLinecap="round" strokeLinejoin="round"
      >
        <Line x1="8" y1="6" x2="21" y2="6" />
        <Line x1="8" y1="12" x2="21" y2="12" />
        <Line x1="8" y1="18" x2="21" y2="18" />
        <Line x1="3" y1="6" x2="3.01" y2="6" />
        <Line x1="3" y1="12" x2="3.01" y2="12" />
        <Line x1="3" y1="18" x2="3.01" y2="18" />
      </Svg>
    ),
  },
  {
    name: 'Search',
    label: 'Discover',
    color: [45, 212, 191], // Teal
    icon: ({ active, size, color }) => (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"
        stroke={active ? `rgb(${color})` : '#94a3b8'} strokeWidth={2}
        strokeLinecap="round" strokeLinejoin="round"
      >
        <Circle cx="11" cy="11" r="8" />
        <Line x1="21" y1="21" x2="16.65" y2="16.65" />
      </Svg>
    ),
  },
  {
    name: 'AI',
    label: 'OtakuAI',
    color: [255, 215, 0], // Gold
    icon: ({ active, size, color }) => (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"
        stroke={active ? `rgb(${color})` : '#94a3b8'} strokeWidth={2}
        strokeLinecap="round" strokeLinejoin="round"
      >
        <Rect x="3" y="6" width="18" height="14" rx="3" fill={active ? `rgba(${color},0.12)` : 'none'} />
        <Circle cx="8.5" cy="11.5" r="1.5" fill={active ? `rgb(${color})` : '#94a3b8'} />
        <Circle cx="15.5" cy="11.5" r="1.5" fill={active ? `rgb(${color})` : '#94a3b8'} />
        <Path d="M12 6V3" />
        <Path d="M9 3h6" />
        <Path d="M6 20v2" />
        <Path d="M18 20v2" />
        <Path d="M8.5 15.5c.8.8 2 1.3 3.5 1.3s2.7-.5 3.5-1.3" />
        <Path d="M2 10.5h1" />
        <Path d="M21 10.5h1" />
      </Svg>
    ),
  },
  {
    name: 'Profile',
    label: 'Profile',
    color: [56, 189, 248], // Sky
    icon: ({ active, size, color }) => (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"
        stroke={active ? `rgb(${color})` : '#94a3b8'} strokeWidth={2}
        strokeLinecap="round" strokeLinejoin="round"
      >
        <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <Circle cx="12" cy="7" r="4" />
      </Svg>
    ),
  },
];

const ROUTE_ORDER = TABS.map(t => t.name);

const BottomNavBar = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const activePage = route.name;
  const { user } = useAuth();
  const userPhoto = user?.photo;

  // Scale animations per tab
  const scaleAnims = useRef(TABS.map(() => new Animated.Value(1))).current;

  const getNavBarWidth = () => {
    // 5 icon-only tabs × ~52px each + padding
    if (screenWidth < 375) return 270;
    return 300;
  };

  const getTransition = (target) => {
    const ci = ROUTE_ORDER.indexOf(activePage);
    const ti = ROUTE_ORDER.indexOf(target);
    if (ci === -1 || ti === -1) return 'right';
    return ti < ci ? 'left' : 'right';
  };

  const handlePress = (tab, index) => {
    // Bounce animation
    Animated.sequence([
      Animated.timing(scaleAnims[index], { toValue: 0.85, duration: 80, useNativeDriver: true }),
      Animated.spring(scaleAnims[index], { toValue: 1, tension: 120, friction: 5, useNativeDriver: true }),
    ]).start();

    navigation.navigate({
      name: tab.name,
      params: { transition: getTransition(tab.name) },
      merge: true,
    });
  };

  return (
    <View style={styles.safeArea} pointerEvents="box-none">
      <BlurView intensity={85} tint="dark" style={[styles.bottomBar, { width: getNavBarWidth() }]}>
        {TABS.map((tab, index) => {
          const isActive = activePage === tab.name;
          const colorStr = tab.color.join(', ');
          const IconComp = tab.icon;

          return (
            <Animated.View
              key={tab.name}
              style={[styles.navItemWrap, { transform: [{ scale: scaleAnims[index] }] }]}
            >
              <TouchableOpacity
                onPress={() => handlePress(tab, index)}
                style={[
                  styles.navItem,
                  isActive && {
                    backgroundColor: `rgba(${colorStr}, 0.12)`,
                    borderColor: `rgba(${colorStr}, 0.25)`,
                    borderWidth: 1,
                    shadowColor: `rgb(${colorStr})`,
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.4,
                    shadowRadius: 8,
                  },
                ]}
                activeOpacity={0.8}
              >
                {tab.name === 'Profile' && userPhoto ? (
                  <View style={[styles.profileIconWrap, isActive && styles.profileIconActive]}>
                    <Image source={{ uri: userPhoto }} style={styles.profileIconImg} contentFit="cover" />
                  </View>
                ) : (
                <IconComp
                  active={isActive}
                  size={BASE_SIZES[tab.name] || 20}
                  color={colorStr}
                />
                )}
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </BlurView>
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    pointerEvents: 'box-none',
    backgroundColor: 'transparent',
    paddingBottom: Platform.OS === 'ios' ? 20 : 16,
    zIndex: 9999,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(10, 8, 22, 0.75)',
    borderRadius: 40,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.65,
        shadowRadius: 25,
      },
      android: { elevation: 20 },
    }),
  },
  navItemWrap: {
    flex: 1,
    alignItems: 'center',
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
    height: 46,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  profileIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  profileIconActive: {
    shadowColor: 'rgb(56,189,248)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 6,
  },
  profileIconImg: {
    width: '100%',
    height: '100%',
    transform: [{ scale: 1.6 }],
  },
});

export default BottomNavBar;
