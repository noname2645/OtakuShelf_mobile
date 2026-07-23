import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
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

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve();
  });
  failedQueue = [];
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accessToken, setAccessToken] = useState(null);
  const [refreshToken, setRefreshToken] = useState(null);

  const API = API_BASE_URL;

  const storeTokens = useCallback(async (access, refresh) => {
    await AsyncStorage.multiSet([
      ["accessToken", access],
      ["refreshToken", refresh],
    ]);
    setAccessToken(access);
    setRefreshToken(refresh);
  }, []);

  const normalizeUser = useCallback(
    (userData) => {
      if (!userData) return null;
      const normUser = { ...userData };
      const id = normUser._id || normUser.id;
      if (id) {
        normUser._id = id;
        normUser.id = id;
      }
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
      if (userString) return JSON.parse(userString);
      if (userId) return { id: userId, _id: userId, email: userEmail || "", name: userName || "User" };
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
        (key) => key.startsWith("user") && key !== "settings" && key !== "theme",
      );
      await AsyncStorage.multiRemove([...userKeys, "accessToken", "refreshToken"]);
      setUser(null);
      setProfile(null);
      setAccessToken(null);
      setRefreshToken(null);
    } catch (error) {
      console.error("Error clearing storage:", error);
    }
  }, []);

  const refreshTokens = useCallback(async () => {
    try {
      const storedRefresh = await AsyncStorage.getItem("refreshToken");
      if (!storedRefresh) throw new Error("No refresh token");
      const response = await axios.post(`${API}/auth/refresh`, {
        refreshToken: storedRefresh,
      }, { timeout: 15000 });
      const { accessToken: newAccess, refreshToken: newRefresh } =
        response.data?.data || response.data;
      if (newAccess && newRefresh) {
        await storeTokens(newAccess, newRefresh);
        return newAccess;
      }
      throw new Error("Invalid refresh response");
    } catch {
      await clearStorage();
      return null;
    }
  }, [API, storeTokens, clearStorage]);

  const authAxios = useMemo(() => {
    const instance = axios.create();
    instance.interceptors.request.use((config) => {
      if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`;
      }
      return config;
    });
    instance.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        if (error.response?.status === 401 && !originalRequest._retry) {
          if (isRefreshing) {
            return new Promise((resolve, reject) => {
              failedQueue.push({ resolve, reject });
            }).then(() => {
              originalRequest.headers.Authorization = `Bearer ${accessToken}`;
              return instance(originalRequest);
            });
          }
          originalRequest._retry = true;
          isRefreshing = true;
          const newAccess = await refreshTokens();
          isRefreshing = false;
          if (newAccess) {
            processQueue(null);
            originalRequest.headers.Authorization = `Bearer ${newAccess}`;
            return instance(originalRequest);
          }
          processQueue(error);
          return Promise.reject(error);
        }
        return Promise.reject(error);
      },
    );
    instance.defaults.timeout = 15000;
    return instance;
  }, [accessToken, refreshTokens]);

  const fetchFreshProfile = useCallback(
    async (userId) => {
      try {
        const response = await authAxios.get(`${API}/api/profile/${userId}`);
        return response.data?.data || response.data;
      } catch (error) {
        console.error("Profile fetch error:", error);
        return null;
      }
    },
    [API, authAxios],
  );

  const checkAuthStatus = useCallback(async () => {
    try {
      const [[, storedAccess], [, storedRefresh], storedUser] = await Promise.all([
        AsyncStorage.getItem("accessToken"),
        AsyncStorage.getItem("refreshToken"),
        loadFromStorage(),
      ]);

      if (storedAccess) setAccessToken(storedAccess);
      if (storedRefresh) setRefreshToken(storedRefresh);

      if (storedUser) {
        setUser(normalizeUser(storedUser));
      }

      if (!storedAccess && !storedRefresh) {
        if (storedUser) {
          fetchFreshProfile(storedUser._id || storedUser.id)
            .then((profileData) => {
              setProfile(profileData);
              if (profileData?.photo) {
                const updatedUser = normalizeUser({ ...storedUser, photo: profileData.photo });
                setUser(updatedUser);
                storeMinimalUser(updatedUser);
              }
            })
            .catch(() => {});
        }
        setLoading(false);
        return;
      }

      try {
        const response = await axios.get(`${API}/auth/me`, {
          headers: storedAccess ? { Authorization: `Bearer ${storedAccess}` } : {},
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
                const updatedUser = normalizeUser({ ...userData, photo: profileData.photo });
                setUser(updatedUser);
                storeMinimalUser(updatedUser);
              }
            })
            .catch(() => {});
        } else {
          const newAccess = await refreshTokens();
          if (!newAccess) await clearStorage();
        }
      } catch (error) {
        if (error.response?.status === 401) {
          const newAccess = await refreshTokens();
          if (!newAccess) await clearStorage();
        }
      }
    } finally {
      setLoading(false);
    }
  }, [API, fetchFreshProfile, storeMinimalUser, clearStorage, loadFromStorage, refreshTokens]);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const login = useCallback(
    async (userData, authAccessToken, authRefreshToken) => {
      try {
        if (authAccessToken && authRefreshToken) {
          await storeTokens(authAccessToken, authRefreshToken);
        }
        const profileData = await fetchFreshProfile(userData._id || userData.id);
        if (profileData?.photo) {
          userData = { ...userData, photo: profileData.photo };
        }
        const normalizedUser = normalizeUser(userData);
        setUser(normalizedUser);
        setProfile(profileData);
        await storeMinimalUser(normalizedUser);
        return { success: true };
      } catch (error) {
        console.error("Login error in AuthContext:", error);
        throw error;
      }
    },
    [fetchFreshProfile, storeMinimalUser, storeTokens],
  );

  const logout = useCallback(async () => {
    try {
      if (accessToken) {
        await axios.get(`${API}/auth/logout`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: 10000,
        });
      }
    } catch (error) {
      console.log("Server logout failed, clearing local data");
    } finally {
      await clearStorage();
    }
  }, [API, accessToken, clearStorage]);

  const updateProfile = useCallback(
    async (profileData) => {
      try {
        const currentUser = user || {};
        const userId = currentUser.id || currentUser._id;
        if (!userId) throw new Error("User not authenticated");
        if (!accessToken) throw new Error("Authentication token missing");

        const response = await axios.put(
          `${API}/api/profile/${userId}`,
          profileData,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            timeout: 15000,
          },
        );

        if (response.data.user) {
          const updatedUser = { ...currentUser, ...response.data.user };
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
    [API, user, accessToken, fetchFreshProfile, storeMinimalUser],
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
    accessToken,
    refreshToken,
    login,
    logout,
    checkAuthStatus,
    updateProfile,
    refreshProfile: () => user && fetchFreshProfile(user.id).then(setProfile),
    API,
    authAxios,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
