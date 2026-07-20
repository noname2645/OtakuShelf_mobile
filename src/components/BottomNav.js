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
import Svg, { Path, Polyline, Circle, Line, Polygon, Rect } from 'react-native-svg';

const { width: screenWidth } = Dimensions.get('window');

// ── Tab definitions (matches design.md §7) ──────────────────────────────────
const TABS = [
  {
    name: 'Home',
    label: 'Home',
    color: [167, 139, 250], // Violet
    icon: ({ active, size, color }) => (
      <Svg width={size} height={size} viewBox="0 0 512 512" fill={active ? `rgb(${color})` : '#94a3b8'}>
        <Path d="M261.56 101.28a8 8 0 0 0-11.06 0L66.4 277.15a8 8 0 0 0-2.47 5.79L63.9 448a32 32 0 0 0 32 32H192a16 16 0 0 0 16-16V328a8 8 0 0 1 8-8h80a8 8 0 0 1 8 8v136a16 16 0 0 0 16 16h96.06a32 32 0 0 0 32-32V282.94a8 8 0 0 0-2.47-5.79Z" />
        <Path d="m490.91 244.15l-74.8-71.56V64a16 16 0 0 0-16-16h-48a16 16 0 0 0-16 16v32l-57.92-55.38C272.77 35.14 264.71 32 256 32c-8.68 0-16.72 3.14-22.14 8.63l-212.7 203.5c-6.22 6-7 15.87-1.34 22.37A16 16 0 0 0 43 267.56L250.5 69.28a8 8 0 0 1 11.06 0l207.52 198.28a16 16 0 0 0 22.59-.44c6.14-6.36 5.63-16.86-.76-22.97Z" />
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
      <Svg width={size} height={size} viewBox="0 0 512 512" fill={active ? `rgb(${color})` : '#94a3b8'}>
        <Path
          fillRule="evenodd"
          d="M384 128v256H128V128zm-148.25 64h-24.932l-47.334 128h22.493l8.936-25.023h56.662L260.32 320h23.847zm88.344 64h-22.402v128h22.402zm-101 21.475l22.315 63.858h-44.274zM405.335 320H448v42.667h-42.667zm-256 85.333H192V448h-42.667zm85.333 0h42.666V448h-42.666zM149.333 64H192v42.667h-42.667zM320 405.333h42.667V448H320zM234.667 64h42.666v42.667h-42.666zM320 64h42.667v42.667H320zm85.333 170.667H448v42.666h-42.667zM64 320h42.667v42.667H64zm341.333-170.667H448V192h-42.667zM64 234.667h42.667v42.666H64zm0-85.334h42.667V192H64z"
        />
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
                <IconComp
                  active={isActive}
                  size={screenWidth < 375 ? 18 : 22}
                  color={colorStr}
                />
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
});

export default BottomNavBar;
