import React, { useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Alert,
    Linking,
    ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

/**
 * Alternative Google Auth using device browser
 * This is more reliable than WebView for OAuth
 */
const GoogleAuthBrowser = ({ navigation }) => {
    const [loading, setLoading] = useState(false);
    const { login, API } = useAuth();

    const handleGoogleLogin = async () => {
        try {
            setLoading(true);

            // Open Google OAuth in device browser
            const authUrl = `${API}/auth/google`;
            console.log('Opening Google OAuth:', authUrl);

            const supported = await Linking.canOpenURL(authUrl);

            if (supported) {
                await Linking.openURL(authUrl);

                Alert.alert(
                    'Complete Sign-In',
                    'After signing in with Google, you will be redirected back to the app. If not redirected automatically, return to the app and tap "I\'ve Signed In".',
                    [
                        {
                            text: "I've Signed In",
                            onPress: checkAuthStatus
                        },
                        {
                            text: 'Cancel',
                            style: 'cancel',
                            onPress: () => {
                                setLoading(false);
                                navigation.goBack();
                            }
                        }
                    ]
                );
            } else {
                Alert.alert('Error', 'Cannot open browser');
                setLoading(false);
            }
        } catch (error) {
            console.error('Error opening browser:', error);
            Alert.alert('Error', 'Failed to open Google sign-in');
            setLoading(false);
        }
    };

    const checkAuthStatus = async () => {
        try {
            setLoading(true);

            // Check if user is now authenticated
            const response = await axios.get(`${API}/auth/me`, {
                withCredentials: true,
                timeout: 10000
            });

            if (response.data.user) {
                // User is authenticated
                await login(response.data.user, response.data.token);
                navigation.replace('Home');
            } else {
                Alert.alert(
                    'Not Signed In',
                    'Please complete the Google sign-in process in your browser.',
                    [
                        {
                            text: 'Try Again',
                            onPress: handleGoogleLogin
                        },
                        {
                            text: 'Cancel',
                            style: 'cancel',
                            onPress: () => navigation.goBack()
                        }
                    ]
                );
            }
        } catch (error) {
            console.error('Auth check error:', error);
            Alert.alert(
                'Sign-In Incomplete',
                'Could not verify authentication. Please try again.',
                [
                    {
                        text: 'Retry',
                        onPress: handleGoogleLogin
                    },
                    {
                        text: 'Cancel',
                        style: 'cancel',
                        onPress: () => navigation.goBack()
                    }
                ]
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <LinearGradient colors={['#0a0f1e', '#161b2e']} style={styles.container}>
            <View style={styles.content}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <Text style={styles.backButtonText}>← Back</Text>
                </TouchableOpacity>

                <View style={styles.iconContainer}>
                    <Text style={styles.icon}>🔐</Text>
                </View>

                <Text style={styles.title}>Sign in with Google</Text>
                <Text style={styles.subtitle}>
                    You'll be redirected to Google to sign in securely
                </Text>

                <TouchableOpacity
                    style={styles.googleButton}
                    onPress={handleGoogleLogin}
                    disabled={loading}
                >
                    <LinearGradient
                        colors={['#ff5900', '#ff7a33']}
                        style={styles.buttonGradient}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <>
                                <Text style={styles.googleIcon}>G</Text>
                                <Text style={styles.buttonText}>Continue with Google</Text>
                            </>
                        )}
                    </LinearGradient>
                </TouchableOpacity>

                <View style={styles.infoBox}>
                    <Text style={styles.infoTitle}>ℹ️ How it works:</Text>
                    <Text style={styles.infoText}>
                        1. Tap "Continue with Google"{'\n'}
                        2. Sign in with your Google account{'\n'}
                        3. Return to the app{'\n'}
                        4. Tap "I've Signed In"
                    </Text>
                </View>
            </View>
        </LinearGradient>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        flex: 1,
        padding: 20,
        justifyContent: 'center',
    },
    backButton: {
        position: 'absolute',
        top: 50,
        left: 20,
    },
    backButtonText: {
        color: '#ff5900',
        fontSize: 16,
        fontWeight: '600',
    },
    iconContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: 'rgba(255, 89, 0, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        alignSelf: 'center',
        marginBottom: 30,
    },
    icon: {
        fontSize: 50,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#fff',
        textAlign: 'center',
        marginBottom: 10,
    },
    subtitle: {
        fontSize: 16,
        color: '#999',
        textAlign: 'center',
        marginBottom: 40,
    },
    googleButton: {
        borderRadius: 12,
        overflow: 'hidden',
        marginBottom: 30,
    },
    buttonGradient: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 16,
    },
    googleIcon: {
        fontSize: 24,
        marginRight: 10,
        color: '#fff',
        fontWeight: 'bold',
    },
    buttonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
    },
    infoBox: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 12,
        padding: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    infoTitle: {
        color: '#ff5900',
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 10,
    },
    infoText: {
        color: '#999',
        fontSize: 14,
        lineHeight: 22,
    },
});

export default GoogleAuthBrowser;
