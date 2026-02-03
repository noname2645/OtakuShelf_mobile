// components/BottomNavBar.js
import React from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
  Animated,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Svg, { Path } from 'react-native-svg';

const BottomNavBar = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const screenWidth = Dimensions.get('window').width;
  const activePage = route.name;

  const getNavBarWidth = () => {
    if (screenWidth < 375) return '95%';
    if (screenWidth < 576) return '90%';
    return 'fit-content';
  };

  const getNavBarPadding = () => {
    if (screenWidth < 375) return { paddingHorizontal: 12, paddingVertical: 6 };
    if (screenWidth < 576) return { paddingHorizontal: 15, paddingVertical: 8 };
    return { paddingHorizontal: 20, paddingVertical: 10 };
  };

  const getIconSize = () => {
    if (screenWidth < 375) return 18;
    if (screenWidth < 576) return 20;
    return 24;
  };

  const getNavItemPadding = () => {
    if (screenWidth < 375) return { paddingHorizontal: 8, paddingVertical: 4 };
    if (screenWidth < 576) return { paddingHorizontal: 12, paddingVertical: 6 };
    return { paddingHorizontal: 18, paddingVertical: 8 };
  };

  const HomeIcon = ({ active, size }) => (
    <Svg width={size} height={size} viewBox="0 0 512 512" fill={active ? '#ff6608' : '#a5a5a5'}>
      <Path
        d="M261.56 101.28a8 8 0 0 0-11.06 0L66.4 277.15a8 8 0 0 0-2.47 5.79L63.9 448a32 32 0 0 0 32 32H192a16 16 0 0 0 16-16V328a8 8 0 0 1 8-8h80a8 8 0 0 1 8 8v136a16 16 0 0 0 16 16h96.06a32 32 0 0 0 32-32V282.94a8 8 0 0 0-2.47-5.79Z"
      />
      <Path
        d="m490.91 244.15l-74.8-71.56V64a16 16 0 0 0-16-16h-48a16 16 0 0 0-16 16v32l-57.92-55.38C272.77 35.14 264.71 32 256 32c-8.68 0-16.72 3.14-22.14 8.63l-212.7 203.5c-6.22 6-7 15.87-1.34 22.37A16 16 0 0 0 43 267.56L250.5 69.28a8 8 0 0 1 11.06 0l207.52 198.28a16 16 0 0 0 22.59-.44c6.14-6.36 5.63-16.86-.76-22.97Z"
      />
    </Svg>
  );

  const ListIcon = ({ active, size }) => (
    <Svg width={size} height={size} viewBox="0 0 18 20" fill={active ? '#ff6608' : '#a5a5a5'}>
      <Path
        d="M2 19.004h2.004V17H2v2.004ZM7 19h15v-2H7v2Zm-5-5.996h2.004V11H2v2.004ZM7 13h15v-2H7v2ZM2 7.004h2.004V5H2v2.004ZM7 7h15V5H7v2Z"
      />
    </Svg>
  );

  const SearchIcon = ({ active, size }) => (
    <Svg width={size} height={size} viewBox="0 0 26 26" fill={active ? '#ff6608' : '#a5a5a5'}>
      <Path
        d="M10 .188A9.812 9.812 0 0 0 .187 10A9.812 9.812 0 0 0 10 19.813c2.29 0 4.393-.811 6.063-2.125l.875.875a1.845 1.845 0 0 0 .343 2.156l4.594 4.625c.713.714 1.88.714 2.594 0l.875-.875a1.84 1.84 0 0 0 0-2.594l-4.625-4.594a1.824 1.824 0 0 0-2.157-.312l-.875-.875A9.812 9.812 0 0 0 10 .188zM10 2a8 8 0 1 1 0 16a8 8 0 0 1 0-16zM4.937 7.469a5.446 5.446 0 0 0-.812 2.875a5.46 5.46 0 0 0 5.469 5.469a5.516 5.516 0 0 0 3.156-1a7.166 7.166 0 0 1-.75.03a7.045 7.045 0 0 1-7.063-7.062c0-.104-.005-.208 0-.312z"
      />
    </Svg>
  );

  const AiIcon = ({ active, size }) => (
    <Svg width={size} height={size} viewBox="0 0 512 512" fill={active ? '#ff6608' : '#a5a5a5'}>
      <Path
        fillRule="evenodd"
        d="M384 128v256H128V128zm-148.25 64h-24.932l-47.334 128h22.493l8.936-25.023h56.662L260.32 320h23.847zm88.344 64h-22.402v128h22.402zm-101 21.475l22.315 63.858h-44.274zM405.335 320H448v42.667h-42.667zm-256 85.333H192V448h-42.667zm85.333 0h42.666V448h-42.666zM149.333 64H192v42.667h-42.667zM320 405.333h42.667V448H320zM234.667 64h42.666v42.667h-42.666zM320 64h42.667v42.667H320zm85.333 170.667H448v42.666h-42.667zM64 320h42.667v42.667H64zm341.333-170.667H448V192h-42.667zM64 234.667h42.667v42.666H64zm0-85.334h42.667V192H64z"
      />
    </Svg>
  );

  const NavItem = ({ routeName, title, isActive, IconComponent }) => (
    <TouchableOpacity
      onPress={() => navigation.navigate(routeName)}
      style={[
        styles.navLabel,
        getNavItemPadding(),
        isActive && styles.navLabelActive,
      ]}
      activeOpacity={0.7}
    >
      <View style={styles.iconContainer}>
        <IconComponent
          active={isActive}
          size={getIconSize()}
          style={[
            styles.icon,
            isActive && styles.activeIcon,
          ]}
        />
        {isActive && (
          <Animated.View style={styles.activeIndicator} />
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[
      styles.bottomButtonBar,
      { width: getNavBarWidth() },
      getNavBarPadding(),
    ]}>
      <NavItem
        routeName="Home"
        title="home"
        isActive={activePage === 'Home'}
        IconComponent={HomeIcon}
      />

      <NavItem
        routeName="List"
        title="list"
        isActive={activePage === 'List'}
        IconComponent={ListIcon}
      />

      <NavItem
        routeName="Advance"
        title="search"
        isActive={activePage === 'Advance'}
        IconComponent={SearchIcon}
      />

      <NavItem
        routeName="AI"
        title="AI"
        isActive={activePage === 'AI'}
        IconComponent={AiIcon}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  bottomButtonBar: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 30 : 20,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    backgroundColor: '#05213c',
    borderRadius: 30,
    zIndex: 2000,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 10,
      },
    }),
    // Safe area support for iOS
    ...Platform.select({
      ios: {
        bottom: 30,
      },
      android: {
        bottom: 20,
      },
    }),
  },
  navLabel: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  navLabelActive: {
    transform: [{ translateY: -5 }],
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    transition: 'all 0.2s',
  },
  activeIcon: {
    transform: [{ scale: 1.2 }],
  },
  activeIndicator: {
    position: 'absolute',
    bottom: -10,
    width: '100%',
    height: 2,
    backgroundColor: '#ff6608',
    borderRadius: 5,
    marginTop: 5,
  },
});

// Safe area wrapper for iOS
const BottomNavBarWithSafeArea = () => {
  return (
    <View style={styles.safeAreaContainer}>
      <BottomNavBar />
    </View>
  );
};

const safeAreaStyles = StyleSheet.create({
  safeAreaContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingBottom: Platform.OS === 'ios' ? 20 : 0,
  },
});

export default BottomNavBarWithSafeArea;