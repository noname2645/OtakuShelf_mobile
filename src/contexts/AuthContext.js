import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { API_BASE_URL } from "../config/api";

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(null);

  // API base URL from centralized config
  const API = API_BASE_URL;

  const normalizeUser = useCallback(
    (userData) => {
      if (!userData) return null;
      const normUser = { ...userData };

      // Ensure both id and _id are set
      const id = normUser._id || normUser.id;
      if (id) {
        normUser._id = id;
        normUser.id = id;
      }

      // Fix photo URL if relative
      if (
        normUser.photo &&
        !normUser.photo.startsWith("http") &&
        !normUser.photo.startsWith("data:")
      ) {
        const separator = API.endsWith("/") ? "" : "/";
        const path = normUser.photo.startsWith("/")
          ? normUser.photo.substring(1)
          : normUser.photo;
        normUser.photo = `${API}${separator}${path}`;
      }
      return normUser;
    },
    [API],
  );

  const storeMinimalUser = useCallback(async (userData) => {
    try {
      let safePhoto = userData.photo;
      if (safePhoto && safePhoto.startsWith("data:image")) {
        safePhoto = null;
      }

      const minimalData = {
        id: userData._id || userData.id,
        _id: userData._id || userData.id,
        email: userData.email,
        name: userData.name || userData.email?.split("@")[0] || "User",
        photo: safePhoto,
      };

      await AsyncStorage.setItem("user", JSON.stringify(minimalData));
    } catch (error) {
      console.error("Storage error:", error);
      await AsyncStorage.setItem("user_id", userData._id || userData.id);
    }
  }, []);

  const loadFromStorage = useCallback(async () => {
    try {
      const [[, userString], [, userId], [, userEmail], [, userName]] =
        await AsyncStorage.multiGet(["user", "user_id", "user_email", "user_name"]);
      if (userString) {
        return JSON.parse(userString);
      }
      if (userId) {
        return { id: userId, _id: userId, email: userEmail || "", name: userName || "User" };
      }
    } catch (error) {
      console.error("Error loading from storage:", error);
      await AsyncStorage.multiRemove(["user", "user_profile"]);
    }
    return null;
  }, []);

  const clearStorage = useCallback(async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const userKeys = keys.filter(
        (key) =>
          key.startsWith("user") && key !== "settings" && key !== "theme",
      );
      await AsyncStorage.multiRemove([...userKeys, "token"]);
      setUser(null);
      setProfile(null);
      setToken(null);
    } catch (error) {
      console.error("Error clearing storage:", error);
    }
  }, []);

  const fetchFreshProfile = useCallback(
    async (userId) => {
      try {
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const response = await axios.get(`${API}/api/profile/${userId}`, {
          headers,
          timeout: 15000,
        });

        return response.data?.data || response.data;
      } catch (error) {
        console.error("Profile fetch error:", error);
        return null;
      }
    },
    [API, token],
  );

  const checkAuthStatus = useCallback(async () => {
    try {
      const [storedToken, storedUser] = await Promise.all([
        AsyncStorage.getItem("token"),
        loadFromStorage(),
      ]);

      if (storedToken) setToken(storedToken);

      // Show cached user immediately if available
      if (storedUser) {
        setUser(normalizeUser(storedUser));
      }

      if (!storedToken) {
        if (storedUser) {
          fetchFreshProfile(storedUser._id || storedUser.id)
            .then((profileData) => {
              setProfile(profileData);
              if (profileData?.photo) {
                const updatedUser = normalizeUser({
                  ...storedUser,
                  photo: profileData.photo,
                });
                setUser(updatedUser);
                storeMinimalUser(updatedUser);
              }
            })
            .catch(() => console.log("Offline mode: using stored user only"));
        }
        setLoading(false);
        return;
      }

      // Verify token with backend in background (don't block UI)
      try {
        const response = await axios.get(`${API}/auth/me`, {
          headers: { Authorization: `Bearer ${storedToken}` },
          timeout: 15000,
        });

        const rawUser = response.data?.data?.user || response.data?.user;

        if (rawUser) {
          const userData = normalizeUser(rawUser);
          setUser(userData);
          await storeMinimalUser(userData);

          fetchFreshProfile(userData._id || userData.id)
            .then((profileData) => {
              setProfile(profileData);
              if (profileData?.photo) {
                const updatedUser = normalizeUser({
                  ...userData,
                  photo: profileData.photo,
                });
                setUser(updatedUser);
                storeMinimalUser(updatedUser);
              }
            })
            .catch(() => console.log("Profile fetch failed, continuing anyway"));
        } else {
          await clearStorage();
        }
      } catch (error) {
        console.log("Auth check error:", error.message);

        if (error.response?.status === 401) {
          await clearStorage();
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

  const login = useCallback(
    async (userData, authToken) => {
      try {
        // Store token if provided
        if (authToken) {
          await AsyncStorage.setItem("token", authToken);
          setToken(authToken);
        }

        // Fetch fresh profile data
        const profileData = await fetchFreshProfile(
          userData._id || userData.id,
        );

        if (profileData?.photo) {
          userData = { ...userData, photo: profileData.photo };
        }

        const normalizedUser = normalizeUser(userData);
        setUser(normalizedUser);
        setProfile(profileData);

        // Store minimal user data for offline access
        await storeMinimalUser(normalizedUser);

        return { success: true };
      } catch (error) {
        console.error("Login error in AuthContext:", error);
        throw error;
      }
    },
    [fetchFreshProfile, storeMinimalUser],
  );

  const logout = useCallback(async () => {
    try {
      await axios.get(`${API}/auth/logout`, { timeout: 10000 });
    } catch (error) {
      console.log("Server logout failed, clearing local data");
    } finally {
      await clearStorage();
    }
  }, [API, clearStorage]);

  const updateProfile = useCallback(
    async (profileData) => {
      try {
        const currentUser = user || {};
        const userId = currentUser.id || currentUser._id;

        if (!userId) throw new Error("User not authenticated");
        if (!token) throw new Error("Authentication token missing");

        const response = await axios.put(
          `${API}/api/profile/${userId}`,
          profileData,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            timeout: 15000,
          },
        );

        if (response.data.user) {
          const updatedUser = {
            ...currentUser,
            ...response.data.user,
          };
          const normalizedUser = normalizeUser(updatedUser);

          setUser(normalizedUser);
          await storeMinimalUser(normalizedUser);

          fetchFreshProfile(userId).then(setProfile).catch(() => {});
        }

        return response.data;
      } catch (error) {
        console.error("Profile update error:", error);
        throw error;
      }
    },
    [API, user, token, fetchFreshProfile, storeMinimalUser],
  );

  const combinedUser = useMemo(() => user
    ? {
        ...user,
        profile: profile?.profile || {},
        recentlyWatched: profile?.recentlyWatched || [],
        favoriteAnime: profile?.favoriteAnime || [],
      }
    : null, [user, profile]);

  const value = {
    user: combinedUser,
    profile,
    loading,
    token,
    login,
    logout,
    checkAuthStatus,
    updateProfile,
    refreshProfile: () => user && fetchFreshProfile(user.id).then(setProfile),
    API,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
