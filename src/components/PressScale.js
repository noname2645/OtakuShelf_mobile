import React, { useRef } from 'react';
import { Animated, TouchableOpacity, Platform } from 'react-native';

const PressScale = ({ children, style, onPressIn, onPressOut, scaleTo = 0.95, ...props }) => {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = (e) => {
    Animated.spring(scale, {
      toValue: scaleTo,
      tension: 200,
      friction: 8,
      useNativeDriver: true,
    }).start();
    onPressIn?.(e);
  };

  const handlePressOut = (e) => {
    Animated.spring(scale, {
      toValue: 1,
      tension: 200,
      friction: 8,
      useNativeDriver: true,
    }).start();
    onPressOut?.(e);
  };

  return (
    <TouchableOpacity
      activeOpacity={1}
      style={style}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      {...props}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        {children}
      </Animated.View>
    </TouchableOpacity>
  );
};

export default PressScale;
