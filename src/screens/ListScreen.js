import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import BottomNav from '../components/BottomNav';

const ListScreen = ({ navigation }) => {
  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0a0f1e', '#161b2e']} style={styles.header}>
        <Text style={styles.headerTitle}>My Anime List</Text>
      </LinearGradient>

      <ScrollView style={styles.content}>
        <View style={styles.placeholderContainer}>
          <Text style={styles.placeholderIcon}>📋</Text>
          <Text style={styles.placeholderTitle}>Anime List</Text>
          <Text style={styles.placeholderText}>
            Track your watching, completed, planned, and dropped anime.
          </Text>
          <Text style={styles.implementationNote}>
            This screen needs to be implemented with the full list functionality from list.jsx
          </Text>
        </View>
      </ScrollView>

      <BottomNav navigation={navigation} activeRoute="List" />
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
  content: {
    flex: 1,
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 100,
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
  },
});

export default ListScreen;