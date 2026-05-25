// API Configuration for OtakuShelf Mobile App
// This file centralizes all API-related configuration

// ============================================
// IMPORTANT: CONFIGURE YOUR API URL HERE
// ============================================
// 
// For local development:
// - Emulator/Simulator: 'http://localhost:5000'
// - Physical Device: 'http://YOUR_COMPUTER_IP:5000' (e.g., 'http://192.168.1.100:5000')
//
// For production:
// - Update PRODUCTION_API_URL below with your deployed backend URL
// ============================================

const DEVELOPMENT_API_URL = 'https://otakushelf-uuvw.onrender.com';
const PRODUCTION_API_URL = 'https://otakushelf-uuvw.onrender.com';

const getApiBaseUrl = () => {
    // Check if running in development mode
    const isDevelopment = __DEV__;

    if (isDevelopment) {
        // Development mode - use local backend
        console.log('[DEV] API URL:', DEVELOPMENT_API_URL);
        console.log('[TIP] Testing on a physical device? Update DEVELOPMENT_API_URL in src/config/api.js with your computer\'s IP address');
        return DEVELOPMENT_API_URL;
    }

    // Production mode - use production backend
    console.log('[PROD] API URL:', PRODUCTION_API_URL);
    return PRODUCTION_API_URL;
};

export const API_BASE_URL = getApiBaseUrl();

// API endpoints
export const API_ENDPOINTS = {
    ANIME_SECTIONS: '/api/anime/anime-sections',
    ANIME_SEARCH: '/api/anime/search',
    ANIME_DETAILS: '/api/anime/details',
    AUTH_ME: '/auth/me',
    AUTH_LOGOUT: '/auth/logout',
    PROFILE: '/api/profile',
};

// Axios configuration
export const AXIOS_CONFIG = {
    timeout: 15000, // 15 seconds
    headers: {
        'Content-Type': 'application/json',
    },
};

// Helper function to build full API URL
export const buildApiUrl = (endpoint) => {
    return `${API_BASE_URL}${endpoint}`;
};

// Helper function to check if API is configured
export const isApiConfigured = () => {
    return API_BASE_URL &&
        API_BASE_URL !== 'https://your-production-api.com' &&
        !API_BASE_URL.includes('undefined');
};

// Log configuration on import
if (!isApiConfigured() && !__DEV__) {
    console.warn('[WARNING] API URL not configured! Please update PRODUCTION_API_URL in src/config/api.js');
}

export default {
    API_BASE_URL,
    API_ENDPOINTS,
    AXIOS_CONFIG,
    buildApiUrl,
    isApiConfigured,
};
