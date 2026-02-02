import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const BottomNav = ({ navigation, activeRoute }) => {
  const navItems = [
    { name: 'Home', icon: '🏠', route: 'Home' },
    { name: 'List', icon: '📋', route: 'List' },
    { name: 'Search', icon: '🔍', route: 'Search' },
    { name: 'AI', icon: '🤖', route: 'AI' },
  ];

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['rgba(10, 15, 30, 0.95)', 'rgba(22, 27, 46, 0.98)']}
        style={styles.gradient}
      >
        <View style={styles.navBar}>
          {navItems.map((item) => (
            <TouchableOpacity
              key={item.route}
              style={styles.navItem}
              onPress={() => navigation.navigate(item.route)}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.iconContainer,
                  activeRoute === item.route && styles.activeIconContainer,
                ]}
              >
                <Text style={styles.icon}>{item.icon}</Text>
              </View>
              <Text
                style={[
                  styles.label,
                  activeRoute === item.route && styles.activeLabel,
                ]}
              >
                {item.name}
              </Text>
              {activeRoute === item.route && <View style={styles.activeDot} />}
            </TouchableOpacity>
          ))}
        </View>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  gradient: {
    flex: 1,
  },
  navBar: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 10,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  activeIconContainer: {
    backgroundColor: 'rgba(255, 89, 0, 0.2)',
  },
  icon: {
    fontSize: 24,
  },
  label: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  activeLabel: {
    color: '#ff5900',
    fontWeight: '600',
  },
  activeDot: {
    position: 'absolute',
    bottom: -5,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ff5900',
  },
});

export default BottomNav;