// Shared App Footer (same style as HomeScreen footer)
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';

export default function AppFooter() {
  return (
    <View style={styles.footer}>
      <View style={styles.footerDivider} />
      <MaskedView
        style={{ height: 28, alignSelf: 'center', marginBottom: 6 }}
        maskElement={<Text style={styles.footerLogoMask}>OtakuShelf</Text>}
      >
        <LinearGradient
          colors={['#ff6a00', '#ffcc00', '#ff0066']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ flex: 1, width: 130 }}
        />
      </MaskedView>
      <Text style={styles.footerTagline}>
        Your ultimate anime companion. Track, discover, obsess.
      </Text>
      <Text style={styles.footerCopy}>© 2026 OtakuShelf. All rights reserved.</Text>
      <Text style={styles.footerHeart}>Made with ♥ for anime fans</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 20,
    alignItems: 'center',
    gap: 6,
  },
  footerDivider: {
    height: 1,
    width: '80%',
    backgroundColor: 'rgba(255,154,0,0.12)',
    marginBottom: 16,
  },
  footerLogoMask: {
    fontSize: 18,
    fontFamily: 'OutfitRegular',
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },
  footerTagline: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  footerCopy: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 11,
    marginTop: 8,
    textAlign: 'center',
  },
  footerHeart: {
    color: 'rgba(255,154,0,0.5)',
    fontSize: 11,
    textAlign: 'center',
  },
});
