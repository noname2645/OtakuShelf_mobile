import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import BottomNav from '../components/BottomNav';

const AIScreen = ({ navigation }) => {
  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0a0f1e', '#161b2e']} style={styles.header}>
        <Text style={styles.headerTitle}>🤖 OtakuAI</Text>
        <Text style={styles.headerSubtitle}>Powered by Llama 3.1</Text>
      </LinearGradient>

      <ScrollView style={styles.content}>
        <View style={styles.placeholderContainer}>
          <Text style={styles.placeholderIcon}>🤖</Text>
          <Text style={styles.placeholderTitle}>AI Recommendations</Text>
          <Text style={styles.placeholderText}>
            Get personalized anime recommendations powered by AI.
          </Text>
          <Text style={styles.implementationNote}>
            This screen needs to be implemented with chat functionality from aipage.jsx
          </Text>
          
          <View style={styles.featuresList}>
            <Text style={styles.featureItem}>✨ Smart recommendations</Text>
            <Text style={styles.featureItem}>🎯 Based on your watch history</Text>
            <Text style={styles.featureItem}>💬 Conversational AI assistant</Text>
          </View>
        </View>
      </ScrollView>

      <BottomNav navigation={navigation} activeRoute="AI" />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0f1e',
  },
  header: {
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#999',
    marginTop: 5,
  },
  content: {
    flex: 1,
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 80,
  },
  placeholderIcon: {
    fontSize: 80,
    marginBottom: 20,
  },
  placeholderTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  placeholderText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    marginBottom: 20,
  },
  implementationNote: {
    fontSize: 14,
    color: '#ff5900',
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: 30,
  },
  featuresList: {
    alignItems: 'flex-start',
    width: '100%',
    paddingHorizontal: 20,
  },
  featureItem: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 10,
  },
});

export default AIScreen;