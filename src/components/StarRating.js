import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';

const StarIcon = ({ filled, size }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path
      d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
      fill={filled ? '#FFD700' : 'none'}
      stroke={filled ? '#FFD700' : 'rgba(255,255,255,0.3)'}
      strokeWidth={1.5}
    />
  </Svg>
);

const StarRating = ({ rating = 0, onRate, size = 10, maxStars = 10 }) => {
  const [preview, setPreview] = useState(0);
  const displayRating = preview || rating;

  return (
    <View style={styles.container}>
      {Array.from({ length: maxStars }, (_, i) => i + 1).map((star) => (
        <TouchableOpacity
          key={star}
          onPress={() => onRate?.(star === rating ? 0 : star)}
          onPressIn={() => setPreview(star)}
          onPressOut={() => setPreview(0)}
          activeOpacity={0.7}
          style={styles.starBtn}
          hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
        >
          <StarIcon filled={star <= displayRating} size={size} />
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
  },
  starBtn: {
    padding: 0,
  },
});

export default StarRating;
