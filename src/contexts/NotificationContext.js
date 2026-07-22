import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import PremiumToast from '../components/PremiumToast';

const NotificationContext = createContext();

export const useNotification = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotification must be used within NotificationProvider');
  return ctx;
};

export const NotificationProvider = ({ children }) => {
  const [notification, setNotification] = useState(null);
  const idRef = useRef(0);

  const showNotification = useCallback((type, message, options) => {
    idRef.current += 1;
    setNotification({ type, message, id: idRef.current, ...options });
  }, []);

  const hideNotification = useCallback(() => {
    setNotification(null);
  }, []);

  return (
    <NotificationContext.Provider value={{ showNotification, hideNotification }}>
      {children}
      <PremiumToast notification={notification} onDismiss={hideNotification} />
    </NotificationContext.Provider>
  );
};
