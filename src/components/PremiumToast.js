import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const TOAST_WIDTH = width - 24;
const TOAST_HEIGHT = 68;
const SWIPE_THRESHOLD = 40;

const CONFIG = {
  success: { icon: 'checkmark-circle', color: '#10b981', bg: 'rgba(16,185,129,0.15)' },
  error: { icon: 'alert-circle', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
  info: { icon: 'information-circle', color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' },
  warning: { icon: 'warning', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
};

const PremiumToast = ({ notification, onDismiss }) => {
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const dismissTimer = useRef(null);
  const isDismissing = useRef(false);

  useEffect(() => {
    if (!notification) return;
    isDismissing.current = false;
    translateY.setValue(-100);
    opacity.setValue(0);

    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        tension: 80,
        friction: 12,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    dismissTimer.current = setTimeout(() => handleDismiss(), 3500);
    return () => { if (dismissTimer.current) clearTimeout(dismissTimer.current); };
  }, [notification?.id]);

  const handleDismiss = () => {
    if (isDismissing.current) return;
    isDismissing.current = true;
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -100,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => onDismiss?.());
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 5,
      onPanResponderMove: (_, g) => {
        if (g.dy < 0) translateY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy < -SWIPE_THRESHOLD) {
          handleDismiss();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            tension: 100,
            friction: 12,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  if (!notification) return null;

  const cfg = CONFIG[notification.type] || CONFIG.info;

  return (
    <Animated.View
      style={[
        styles.container,
        { transform: [{ translateY }], opacity },
      ]}
      {...panResponder.panHandlers}
    >
      <View style={styles.toast}>
        <BlurView
          intensity={Platform.OS === 'ios' ? 85 : 95}
          tint="dark"
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.bgFill} />
        <View style={[styles.iconCircle, { backgroundColor: cfg.bg }]}>
          <Ionicons name={cfg.icon} size={22} color={cfg.color} />
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.message} numberOfLines={2}>
            {notification.message}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : 36,
    left: 12,
    right: 12,
    zIndex: 99999,
    alignItems: 'center',
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
  },
  toast: {
    width: TOAST_WIDTH,
    minHeight: TOAST_HEIGHT,
    borderRadius: 16,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
  },
  bgFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(3, 7, 18, 0.7)',
    borderRadius: 16,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  textWrap: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  message: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'OutfitRegular',
    lineHeight: 19,
  },
});

export default PremiumToast;
