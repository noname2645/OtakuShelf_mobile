import React, { useRef, useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ActivityIndicator,
    TouchableOpacity,
    Alert,
    Linking,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

const GoogleAuthScreen = ({ navigation }) => {
    const [loading, setLoading] = useState(true);
    const [initialLoad, setInitialLoad] = useState(true);
    const [processingAuth, setProcessingAuth] = useState(false);
    const [error, setError] = useState(null);
    const [visitedGoogle, setVisitedGoogle] = useState(false);
    const [isRedirecting, setIsRedirecting] = useState(false);
    const webViewRef = useRef(null);
    const { login, API } = useAuth();
    const [currentUrl, setCurrentUrl] = useState('');

    useEffect(() => {
        console.log('GoogleAuthScreen mounted');
        console.log('API URL:', API);
    }, []);

    const handleNavigationStateChange = async (navState) => {
        const { url } = navState;
        console.log('📍 Navigation URL:', url);
        setCurrentUrl(url);

        // Logic to detect when we are done with Google and returning to app/backend
        const isGoogle = url.includes('google.com') || url.includes('accounts.google');

        if (isGoogle && !visitedGoogle) {
            console.log('🔍 Visited Google domain');
            setVisitedGoogle(true);
        }

        // If we visited Google and are now navigating to a non-Google URL, we are likely completing the flow
        if (visitedGoogle && !isGoogle && !isRedirecting) {
            console.log('🔙 Redirecting back to app/backend - showing overlay');
            setIsRedirecting(true);
        }

        // Check if we got redirected back with a token
        if (url.includes('token=')) {
            console.log('✅ Token detected in URL');
            setIsRedirecting(true); // Ensure overlay is on

            try {
                // Extract token from URL
                const tokenMatch = url.match(/[?&]token=([^&]+)/);

                if (tokenMatch && tokenMatch[1]) {
                    const token = decodeURIComponent(tokenMatch[1]);
                    console.log('🔑 Token extracted');

                    setProcessingAuth(true);

                    // Verify token and get user data
                    console.log('🔍 Verifying token with backend...');
                    const response = await axios.get(`${API}/auth/me`, {
                        headers: { Authorization: `Bearer ${token}` },
                        timeout: 10000
                    });

                    if (response.data.user) {
                        console.log('💾 Storing user data and token...');
                        await login(response.data.user, token);
                        console.log('✅ Login successful, navigating to Home');
                        navigation.replace('Home');
                    } else {
                        throw new Error('Invalid user data received');
                    }
                }
            } catch (err) {
                console.error('❌ Google auth error:', err);
                setError('Authentication failed. Please try again.');
                setLoading(false);
                setProcessingAuth(false);
                setIsRedirecting(false);

                Alert.alert(
                    'Authentication Failed',
                    err.response?.data?.message || err.message || 'Could not complete Google sign-in',
                    [
                        {
                            text: 'Try Again',
                            onPress: () => {
                                setError(null);
                                setLoading(true);
                                setInitialLoad(true);
                                setVisitedGoogle(false);
                                setIsRedirecting(false);
                                webViewRef.current?.reload();
                            }
                        },
                        {
                            text: 'Cancel',
                            onPress: () => navigation.goBack(),
                            style: 'cancel'
                        }
                    ]
                );
            }
        }

        // Check for error in URL
        if (url.includes('error=')) {
            const errorMatch = url.match(/[?&]error=([^&]+)/);
            const errorMessage = errorMatch ? decodeURIComponent(errorMatch[1]) : 'Authentication failed';

            console.error('❌ Error in URL:', errorMessage);
            setError(errorMessage);
            setLoading(false);
            setIsRedirecting(false);

            Alert.alert(
                'Authentication Error',
                errorMessage.replace(/_/g, ' '),
                [
                    {
                        text: 'Try Again',
                        onPress: () => {
                            setError(null);
                            setLoading(true);
                            setVisitedGoogle(false);
                            setIsRedirecting(false);
                            webViewRef.current?.reload();
                        }
                    },
                    {
                        text: 'Cancel',
                        onPress: () => navigation.goBack(),
                        style: 'cancel'
                    }
                ]
            );
        }
    };

    const handleError = (syntheticEvent) => {
        const { nativeEvent } = syntheticEvent;
        console.error('❌ WebView error:', nativeEvent);
        // Only show error screen if we are not already redirecting/processing
        // Sometimes "errors" occur during redirects (like nsf_urls) which are actually fine
        if (!isRedirecting && !processingAuth) {
            // setError('Failed to load authentication page');
            // setLoading(false);
            console.log('WebView reported error but continuing: ', nativeEvent.description);
        }
    };

    const handleLoadStart = () => {
        // Only show loading overlay on initial load or if we are redirecting
        if (initialLoad) {
            setLoading(true);
        }
    };

    const handleLoadEnd = () => {
        setLoading(false);
        setInitialLoad(false);
    };

    // Determine which loading text to show
    const getLoadingText = () => {
        if (processingAuth) return "Finalizing Sign-In...";
        if (isRedirecting) return "Completing Sign-In...";
        return "Loading Google Sign-In...";
    };

    // Determine if we should show the overlay
    // We want to HIDE the overlay ONLY when:
    // 1. We are NOT loading
    // 2. We are on a Google page (login flow)
    // 3. We are NOT processing the final auth token
    const isGoogleDomain = currentUrl.includes('google.com') || currentUrl.includes('accounts.google') || currentUrl.includes('gstatic.com');
    // Special case for initial load (API URL) to avoid flash before redirect to Google
    const isInitialApiCall = currentUrl.includes('/auth/google') && !isGoogleDomain;

    const shouldShowOverlay =
        loading ||
        processingAuth ||
        isRedirecting ||
        (!isGoogleDomain && !isInitialApiCall && currentUrl !== ''); // Show overlay if we are on some other redirect page (like the react app)

    return (
        <View style={styles.container}>
            {/* Header */}
            <LinearGradient
                colors={['#0a0f1e', '#161b2e']}
                style={styles.header}
            >
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <Text style={styles.backButtonText}>← Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Sign in with Google</Text>
                {__DEV__ && (
                    <Text style={styles.debugText} numberOfLines={1}>
                        {currentUrl.split('?')[0] || 'Waiting for URL...'}
                    </Text>
                )}
            </LinearGradient>

            {/* WebView */}
            {!error && (
                <WebView
                    ref={webViewRef}
                    source={{ uri: `${API}/auth/google` }}
                    onNavigationStateChange={handleNavigationStateChange}
                    onLoadStart={handleLoadStart}
                    onLoadEnd={handleLoadEnd}
                    onError={handleError}
                    style={styles.webview}
                    startInLoadingState={false} // We handle our own loading overlay
                    javaScriptEnabled={true}
                    domStorageEnabled={true}
                    sharedCookiesEnabled={true}
                    thirdPartyCookiesEnabled={true}
                    mixedContentMode="always"
                    userAgent="Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.45 Mobile Safari/537.36"
                />
            )}

            {/* Unified Full Screen Loading/Processing Overlay */}
            {shouldShowOverlay && !error && (
                <View style={[styles.loadingContainer, { zIndex: 999 }]}>
                    <LinearGradient
                        colors={['#0a0f1e', '#161b2e']}
                        style={styles.loadingGradient}
                    >
                        <ActivityIndicator size="large" color="#ff5900" />
                        <Text style={styles.loadingText}>{getLoadingText()}</Text>
                        <Text style={styles.loadingSubtext}>Please wait a moment</Text>
                    </LinearGradient>
                </View>
            )}

            {/* Error State */}
            {error && (
                <View style={styles.errorContainer}>
                    <LinearGradient
                        colors={['#0a0f1e', '#161b2e']}
                        style={styles.errorGradient}
                    >
                        <Text style={styles.errorIcon}>⚠️</Text>
                        <Text style={styles.errorText}>{error}</Text>

                        <TouchableOpacity
                            style={styles.retryButton}
                            onPress={() => {
                                setError(null);
                                setLoading(true);
                                setInitialLoad(true);
                                setVisitedGoogle(false);
                                setIsRedirecting(false);
                                webViewRef.current?.reload();
                            }}
                        >
                            <LinearGradient
                                colors={['#ff5900', '#ff7a33']}
                                style={styles.retryButtonGradient}
                            >
                                <Text style={styles.retryButtonText}>Try Again</Text>
                            </LinearGradient>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.cancelButton}
                            onPress={() => navigation.goBack()}
                        >
                            <Text style={styles.cancelButtonText}>Cancel</Text>
                        </TouchableOpacity>
                    </LinearGradient>
                </View>
            )}
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
        paddingBottom: 15,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    },
    backButton: {
        marginBottom: 10,
    },
    backButtonText: {
        color: '#ff5900',
        fontSize: 16,
        fontWeight: '600',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
    },
    debugText: {
        fontSize: 10,
        color: '#666',
        marginTop: 5,
    },
    webview: {
        flex: 1,
        backgroundColor: '#fff',
    },
    loadingContainer: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingGradient: {
        flex: 1,
        width: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 15,
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
    },
    loadingSubtext: {
        marginTop: 5,
        color: '#999',
        fontSize: 14,
    },
    errorContainer: {
        flex: 1,
    },
    errorGradient: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 30,
    },
    errorIcon: {
        fontSize: 60,
        marginBottom: 20,
    },
    errorText: {
        color: '#fff',
        fontSize: 18,
        textAlign: 'center',
        marginBottom: 30,
        lineHeight: 24,
    },
    retryButton: {
        width: '100%',
        borderRadius: 12,
        overflow: 'hidden',
        marginBottom: 15,
    },
    retryButtonGradient: {
        paddingVertical: 15,
        alignItems: 'center',
    },
    retryButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    cancelButton: {
        paddingVertical: 15,
    },
    cancelButtonText: {
        color: '#999',
        fontSize: 16,
    },
    debugContainer: {
        marginTop: 30,
        padding: 15,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 8,
        width: '100%',
    },
    debugTitle: {
        color: '#ff5900',
        fontSize: 14,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    debugInfo: {
        color: '#999',
        fontSize: 12,
        marginBottom: 5,
        fontFamily: 'monospace',
    },
    processingContainer: {
        position: 'absolute',
        bottom: 20,
        left: 20,
        right: 20,
        borderRadius: 12,
        overflow: 'hidden',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    processingGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 15,
        paddingHorizontal: 20,
    },
    processingText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 10,
    },
});

export default GoogleAuthScreen;
