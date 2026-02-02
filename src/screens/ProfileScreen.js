import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contexts/AuthContext';
import BottomNav from '../components/BottomNav';

const ProfileScreen = ({ navigation }) => {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigation.replace('Login');
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0a0f1e', '#161b2e']} style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
      </LinearGradient>

      <ScrollView style={styles.content}>
        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            {user?.photo ? (
              <Image source={{ uri: user.photo }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>
                  {user?.name?.charAt(0) || user?.email?.charAt(0) || 'U'}
                </Text>
              </View>
            )}
          </View>
          
          <Text style={styles.userName}>{user?.name || 'Anime Lover'}</Text>
          <Text style={styles.userEmail}>{user?.email || ''}</Text>

          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutButtonText}>Logout</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.placeholderContainer}>
          <Text style={styles.placeholderIcon}>👤</Text>
          <Text style={styles.placeholderTitle}>Profile Features</Text>
          <Text style={styles.placeholderText}>
            View your stats, favorite anime, and customize your profile.
          </Text>
          <Text style={styles.implementationNote}>
            This screen needs to be implemented with full profile functionality from profile.jsx
          </Text>
          
          <View style={styles.featuresList}>
            <Text style={styles.featureItem}>📊 Anime Statistics</Text>
            <Text style={styles.featureItem}>⭐ Favorite Anime</Text>
            <Text style={styles.featureItem}>🏆 Badges & Achievements</Text>
            <Text style={styles.featureItem}>📈 Genre Breakdown</Text>
          </View>
        </View>
      </ScrollView>

      <BottomNav navigation={navigation} activeRoute="Profile" />
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
  profileSection: {
    alignItems: 'center',
    paddingVertical: 30,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  avatarContainer: {
    marginBottom: 15,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 89, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#fff',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  userEmail: {
    fontSize: 16,
    color: '#999',
    marginBottom: 20,
  },
  logoutButton: {
    backgroundColor: '#ff5900',
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderRadius: 25,
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 60,
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

export default ProfileScreen;