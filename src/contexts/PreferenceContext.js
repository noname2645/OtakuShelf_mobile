import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PreferenceContext = createContext();

const FAV_PREFIX = 'fav_';
const WL_PREFIX = 'watchlist_';

const loadAll = async () => {
  const keys = await AsyncStorage.getAllKeys();
  const favKeys = keys.filter(k => k.startsWith(FAV_PREFIX));
  const wlKeys = keys.filter(k => k.startsWith(WL_PREFIX));
  const allKeys = [...favKeys, ...wlKeys];
  if (!allKeys.length) return { favorites: {}, watchlist: {} };
  const pairs = await AsyncStorage.multiGet(allKeys);
  const favorites = {};
  const watchlist = {};
  pairs.forEach(([key, val]) => {
    const id = key.replace(FAV_PREFIX, '').replace(WL_PREFIX, '');
    if (val === 'true') {
      if (key.startsWith(FAV_PREFIX)) favorites[id] = true;
      else watchlist[id] = true;
    }
  });
  return { favorites, watchlist };
};

export const PreferenceProvider = ({ children }) => {
  const [favorites, setFavorites] = useState({});
  const [watchlist, setWatchlist] = useState({});
  const [loaded, setLoaded] = useState(false);
  const pendingWrites = useRef({});

  useEffect(() => {
    loadAll().then(({ favorites: f, watchlist: w }) => {
      setFavorites(f);
      setWatchlist(w);
      setLoaded(true);
    });
  }, []);

  // Flush pending writes every 2s
  useEffect(() => {
    const interval = setInterval(async () => {
      const batch = pendingWrites.current;
      if (Object.keys(batch).length === 0) return;
      pendingWrites.current = {};
      const entries = Object.entries(batch);
      await AsyncStorage.multiSet(entries);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const isFavorite = useCallback((id) => !!favorites[id], [favorites]);
  const isWatchlisted = useCallback((id) => !!watchlist[id], [watchlist]);

  const toggleFavorite = useCallback((id) => {
    setFavorites(prev => {
      const next = { ...prev };
      const becomingFav = !next[id];
      if (next[id]) delete next[id];
      else next[id] = true;
      pendingWrites.current[`${FAV_PREFIX}${id}`] = JSON.stringify(becomingFav);
      return next;
    });
  }, []);

  const toggleWatchlist = useCallback((id) => {
    setWatchlist(prev => {
      const next = { ...prev };
      const becomingWl = !next[id];
      if (next[id]) delete next[id];
      else next[id] = true;
      pendingWrites.current[`${WL_PREFIX}${id}`] = JSON.stringify(becomingWl);
      return next;
    });
  }, []);

  const value = useMemo(() => ({
    isFavorite, isWatchlisted, toggleFavorite, toggleWatchlist, loaded,
  }), [isFavorite, isWatchlisted, toggleFavorite, toggleWatchlist, loaded]);

  return (
    <PreferenceContext.Provider value={value}>
      {children}
    </PreferenceContext.Provider>
  );
};

export const usePreferences = () => useContext(PreferenceContext);

export default PreferenceContext;
