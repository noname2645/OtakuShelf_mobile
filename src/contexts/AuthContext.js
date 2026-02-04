import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_BASE_URL } from '../config/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // API base URL from centralized config
  const API = API_BASE_URL;


  const storeMinimalUser = useCallback(async (userData) => {
    try {
      let safePhoto = userData.photo;
      if (safePhoto && safePhoto.startsWith('data:image')) {
        safePhoto = null;
      }

      const minimalData = {
        id: userData._id,
        email: userData.email,
        name: userData.name || userData.email?.split('@')[0] || 'User',
        photo: safePhoto
      };

      await AsyncStorage.setItem("user", JSON.stringify(minimalData));
    } catch (error) {
      console.error('Storage error:', error);
      await AsyncStorage.setItem("user_id", userData._id);
    }
  }, []);

  const loadFromStorage = useCallback(async () => {
    try {
      const userString = await AsyncStorage.getItem("user");
      if (userString) {
        return JSON.parse(userString);
      }

      const userId = await AsyncStorage.getItem("user_id");
      if (userId) {
        return {
          id: userId,
          email: await AsyncStorage.getItem("user_email") || '',
          name: await AsyncStorage.getItem("user_name") || 'User'
        };
      }
    } catch (error) {
      console.error('Error loading from storage:', error);
      await AsyncStorage.multiRemove(["user", "user_profile"]);
    }
    return null;
  }, []);

  const clearStorage = useCallback(async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const userKeys = keys.filter(key => key.startsWith('user') && key !== 'settings' && key !== 'theme');
      await AsyncStorage.multiRemove([...userKeys, "token"]);
      setUser(null);
      setProfile(null);
    } catch (error) {
      console.error('Error clearing storage:', error);
    }
  }, []);

  const fetchFreshProfile = useCallback(async (userId) => {
    try {
      const token = await AsyncStorage.getItem("token");
      const response = await axios.get(`${API}/api/profile/${userId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        timeout: 8000
      });

      return response.data;
    } catch (error) {
      console.error('Profile fetch error:', error);
      return null;
    }
  }, [API]);

  const checkAuthStatus = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");

      if (!token) {
        const storedUser = await loadFromStorage();
        if (storedUser) {
          setUser(storedUser);
          fetchFreshProfile(storedUser.id)
            .then(setProfile)
            .catch(() => console.log('Offline mode: using stored user only'));
        }
        setLoading(false);
        return;
      }

      // Try to verify token with backend
      const response = await axios.get(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 8000 // Increased timeout for slow backends
      });

      if (response.data.user) {
        const userData = response.data.user;
        setUser(userData);
        await storeMinimalUser(userData);

        // Fetch profile in background - don't block on it
        fetchFreshProfile(userData._id)
          .then(setProfile)
          .catch(() => console.log('Profile fetch failed, continuing anyway'));
      } else {
        await clearStorage();
      }
    } catch (error) {
      console.log('Auth check error:', error.message);

      // Handle network errors gracefully
      if (error.code === 'ECONNABORTED' ||
        error.code === 'ERR_NETWORK' ||
        error.message?.includes('Network Error') ||
        error.message?.includes('timeout')) {
        // Network error - use cached data
        const storedUser = await loadFromStorage();
        if (storedUser) {
          setUser(storedUser);
          console.log('Network unavailable - using cached user data');
        } else {
          console.log('No cached user data available');
        }
      } else if (error.response?.status === 401) {
        // Unauthorized - clear everything
        await clearStorage();
      } else {
        // Other errors - try to use cached data
        const storedUser = await loadFromStorage();
        if (storedUser) {
          setUser(storedUser);
          console.log('Error during auth check - using cached data');
        }
      }
    } finally {
      setLoading(false);
    }
  }, [API, fetchFreshProfile, storeMinimalUser, clearStorage, loadFromStorage]);

  // Run auth check only once on mount
  useEffect(() => {
    checkAuthStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array - only run once

  const login = useCallback(async (userData, authToken) => {
    try {
      // Store token if provided
      if (authToken) {
        await AsyncStorage.setItem("token", authToken);
      }

      // Fetch fresh profile data
      const profileData = await fetchFreshProfile(userData._id || userData.id);

      // Update state
      setUser(userData);
      setProfile(profileData);

      // Store minimal user data for offline access
      await storeMinimalUser(userData);

      return { success: true };
    } catch (error) {
      console.error('Login error in AuthContext:', error);
      throw error;
    }
  }, [fetchFreshProfile, storeMinimalUser]);

  const logout = useCallback(async () => {
    try {
      await axios.get(`${API}/auth/logout`, { timeout: 3000 });
    } catch (error) {
      console.log('Server logout failed, clearing local data');
    } finally {
      await clearStorage();
    }
  }, [API, clearStorage]);

  const updateProfile = useCallback(async (profileData) => {
    try {
      const currentUser = user || JSON.parse(await AsyncStorage.getItem("user")) || {};
      const userId = currentUser.id || currentUser._id;

      if (!userId) {
        throw new Error('User not authenticated');
      }

      const token = await AsyncStorage.getItem("token");
      if (!token) {
        throw new Error('Authentication token missing');
      }

      const response = await axios.put(
        `${API}/api/profile/${userId}`,
        profileData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      if (response.data.user) {
        const updatedUser = {
          ...currentUser,
          ...response.data.user
        };

        setUser(updatedUser);
        await storeMinimalUser(updatedUser);

        const freshProfile = await fetchFreshProfile(userId);
        if (freshProfile) {
          setProfile(freshProfile);
        }
      }

      return response.data;
    } catch (error) {
      console.error('Profile update error:', error);
      throw error;
    }
  }, [API, user, fetchFreshProfile, storeMinimalUser]);

  const combinedUser = user ? {
    ...user,
    profile: profile?.profile || {},
    recentlyWatched: profile?.recentlyWatched || [],
    favoriteAnime: profile?.favoriteAnime || []
  } : null;

  const value = {
    user: combinedUser,
    profile,
    loading,
    login,
    logout,
    checkAuthStatus,
    updateProfile,
    refreshProfile: () => user && fetchFreshProfile(user.id).then(setProfile),
    API
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};