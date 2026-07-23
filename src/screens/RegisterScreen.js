import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
  Animated, Dimensions, StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import Svg, { Path } from 'react-native-svg';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import axios from 'axios';

const appIcon = require('../../assets/otakushelf_app_icon.png');
const { width, height } = Dimensions.get('window');

// ─── Floating orb animation helper ──────────────────────────────────────────────
const useFloatingAnimation = (duration = 3000) => {
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, { toValue: 1, duration: duration, useNativeDriver: true }),
        Animated.timing(value, { toValue: 0, duration: duration, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return value;
};



// ─── InputField (same as LoginScreen) ────────────────────────────────────────
const InputField = ({ icon, placeholder, value, onChangeText, secureTextEntry, keyboardType, editable, entranceDelay = 0 }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState(false);
  const borderAnim = useRef(new Animated.Value(0)).current;
  const fieldOpacity = useRef(new Animated.Value(0)).current;
  const fieldY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fieldOpacity, { toValue: 1, duration: 450, delay: entranceDelay, useNativeDriver: false }),
      Animated.timing(fieldY, { toValue: 0, duration: 450, delay: entranceDelay, useNativeDriver: false }),
    ]).start();
  }, []);

  const onFocus = () => {
    setFocused(true);
    Animated.timing(borderAnim, { toValue: 1, duration: 200, useNativeDriver: false }).start();
  };
  const onBlur = () => {
    setFocused(false);
    Animated.timing(borderAnim, { toValue: 0, duration: 200, useNativeDriver: false }).start();
  };

  const borderColor = borderAnim.interpolate({ inputRange: [0, 1], outputRange: ['rgba(255,255,255,0.1)', '#a855f7'] });

  return (
    <Animated.View style={[styles.inputWrapper, { borderColor, opacity: fieldOpacity, transform: [{ translateY: fieldY }] }]}>
      <Ionicons name={icon} size={18} color={focused ? '#a855f7' : 'rgba(255,255,255,0.4)'} style={styles.inputIcon} />
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor="rgba(255,255,255,0.3)"
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry && !showPassword}
        keyboardType={keyboardType || 'default'}
        autoCapitalize="none"
        editable={editable !== false}
        onFocus={onFocus}
        onBlur={onBlur}
        autoCorrect={false}
      />
      {secureTextEntry && (
        <TouchableOpacity onPress={() => setShowPassword(s => !s)} style={styles.eyeBtn}>
          <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={18} color="rgba(255,255,255,0.35)" />
        </TouchableOpacity>
      )}
    </Animated.View>
  );
};

// ─── Password strength bar ────────────────────────────────────────────────────
const PasswordStrength = ({ password }) => {
  if (!password) return null;
  const score = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;

  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  const colors = ['', '#ef4444', '#f97316', '#eab308', '#22c55e'];
  const pct = (score / 4) * 100;

  return (
    <View style={{ marginTop: 8 }}>
      <View style={styles.strengthBar}>
        <Animated.View style={[styles.strengthFill, { width: `${pct}%`, backgroundColor: colors[score] }]} />
      </View>
      {score > 0 && <Text style={[styles.strengthLabel, { color: colors[score] }]}>{labels[score]}</Text>}
    </View>
  );
};

// ─── Google SVG Logo ─────────────────────────────────────────────────────────
const Svg_Google = () => (
  <Svg width={20} height={20} viewBox="0 0 48 48" style={{ marginRight: 10 }}>
    <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    <Path fill="none" d="M0 0h48v48H0z" />
  </Svg>
);

// ─── RegisterScreen ───────────────────────────────────────────────────────────
const RegisterScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login, API } = useAuth();
  const { showNotification } = useNotification();

  const handleGoogleLogin = async () => {
    try {
      setIsLoading(true);
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      GoogleSignin.configure({
        webClientId: '1028034713117-cob0tcmatejclstqkf35smno6425vbna.apps.googleusercontent.com',
        offlineAccess: true,
      });
      const result = await GoogleSignin.signIn();
      if (result.type !== 'success') {
        if (result.type === 'noSavedCredentialFound') {
          showNotification('error', 'No Google account found. Please add a Google account to your device first.');
        } else {
          showNotification('error', 'Google sign-in was cancelled');
        }
        return;
      }
      const idToken = result.data.idToken;
      if (!idToken) {
        showNotification('error', 'Google sign-in failed: no ID token returned');
        return;
      }
      console.log('[Google Auth] Sending idToken to backend:', `${API}/auth/google`);
      console.log('[Google Auth] idToken prefix:', idToken.substring(0, 20) + '...');
      
      let res;
      try {
        res = await axios.post(`${API}/auth/google`, { idToken }, {
          timeout: 30000,
          headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        });
        console.log('[Google Auth] Axios response status:', res.status);
      } catch (axiosErr) {
        console.error('[Google Auth] Axios failed, trying fetch...');
        console.error('[Google Auth] Axios error code:', axiosErr.code);
        console.error('[Google Auth] Axios error message:', axiosErr.message);
        
        const fetchRes = await fetch(`${API}/auth/google`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({ idToken }),
        });
        
        if (!fetchRes.ok) {
          const text = await fetchRes.text();
          throw new Error(`HTTP ${fetchRes.status}: ${text}`);
        }
        
        res = { data: await fetchRes.json(), status: fetchRes.status };
        console.log('[Google Auth] Fetch response status:', res.status);
      }
      
      console.log('[Google Auth] Response data:', res.data);
      const userData = res.data?.data?.user || res.data?.user;
      const token = res.data?.data?.token || res.data?.token;
      if (userData && token) {
        await login(userData, token);
        navigation.replace('Home');
      } else {
        console.error('[Google Auth] Invalid response format:', res.data);
        showNotification('error', 'Invalid response from server');
      }
    } catch (err) {
      console.error('[Google Sign-In Error]', err);
      let errorMessage = 'Google sign-in failed';
      if (err.code === statusCodes.SIGN_IN_CANCELLED) {
        return;
      } else if (err.code === statusCodes.NETWORK_ERROR) {
        errorMessage = 'Network error. Please check your internet connection and try again.';
      } else if (err.code === statusCodes.DEVELOPER_ERROR) {
        errorMessage = 'Developer error. SHA-1 or package name mismatch in Google Cloud Console.';
      } else if (err.code === statusCodes.ONE_TAP_START_FAILED) {
        errorMessage = 'Could not start Google sign-in. Try again later.';
      } else if (err.message) {
        errorMessage = `Google sign-in error: ${err.message}`;
      }
      showNotification('error', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Floating animations
  const orb1Y = useFloatingAnimation(2800);
  const orb2Y = useFloatingAnimation(3400);
  const orb3Y = useFloatingAnimation(2500);
  // Entrance animations
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardY = useRef(new Animated.Value(40)).current;
  const iconScale = useRef(new Animated.Value(0)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(cardOpacity, { toValue: 1, duration: 550, useNativeDriver: true }),
      Animated.spring(cardY, { toValue: 0, tension: 55, friction: 9, useNativeDriver: true }),
      Animated.spring(iconScale, { toValue: 1, delay: 300, tension: 60, friction: 8, useNativeDriver: true }),
      Animated.timing(glowOpacity, { toValue: 1, duration: 800, delay: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  const validate = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim() || !password || !confirmPassword) {
      showNotification('error', 'Please fill in all fields'); return false;
    }
    if (!emailRegex.test(email.trim())) {
      showNotification('error', 'Enter a valid email address'); return false;
    }
    if (password.length < 8) {
      showNotification('error', 'Password must be at least 8 characters'); return false;
    }
    if (!/[A-Z]/.test(password)) {
      showNotification('error', 'Password must include an uppercase letter'); return false;
    }
    if (!/[0-9]/.test(password)) {
      showNotification('error', 'Password must include a number'); return false;
    }
    if (!/[^A-Za-z0-9]/.test(password)) {
      showNotification('error', 'Password must include a special character'); return false;
    }
    if (password !== confirmPassword) {
      showNotification('error', 'Passwords do not match'); return false;
    }
    return true;
  };

  const handleRegister = async () => {
    if (!validate()) return;
    setIsLoading(true);
    try {
      await axios.post(`${API}/auth/register`, { email: email.trim(), password }, {
        withCredentials: true, timeout: 60000,
      });

      const loginRes = await axios.post(`${API}/auth/login`, { email: email.trim(), password }, {
        withCredentials: true, timeout: 60000,
      });

      const userData = loginRes.data?.data?.user || loginRes.data?.user;
      const token = loginRes.data?.data?.token || loginRes.data?.token;

      if (userData && token) {
        await login(userData, token);
        setEmail(''); setPassword(''); setConfirmPassword('');
        navigation.replace('Home');
      } else {
        showNotification('success', 'Registration OK — please log in manually');
        navigation.navigate('Login');
      }
    } catch (err) {
      console.error('Register error:', err);
      let msg = 'Error registering';
      if (err.code === 'ECONNABORTED') msg = 'Connection timeout. Check your internet.';
      else if (err.response) msg = err.response.data?.message || 'Registration failed';
      else if (err.request) msg = 'Cannot reach server. Try again later.';
      showNotification('error', msg);
    } finally {
      setIsLoading(false);
    }
  };

  const orb1TranslateY = orb1Y.interpolate({ inputRange: [0, 1], outputRange: [0, -30] });
  const orb2TranslateY = orb2Y.interpolate({ inputRange: [0, 1], outputRange: [0, 25] });
  const orb3TranslateY = orb3Y.interpolate({ inputRange: [0, 1], outputRange: [0, -20] });
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Background */}
      <View style={StyleSheet.absoluteFill}>
        <LinearGradient colors={['#0d0f1a', '#0d0f1a']} style={StyleSheet.absoluteFill} />
        <Animated.View style={[styles.orb, styles.orb1, { transform: [{ translateY: orb1TranslateY }] }]} />
        <Animated.View style={[styles.orb, styles.orb2, { transform: [{ translateY: orb2TranslateY }] }]} />
        <Animated.View style={[styles.orb, styles.orb3, { transform: [{ translateY: orb3TranslateY }] }]} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          <Animated.View style={[styles.card, { opacity: cardOpacity, transform: [{ translateY: cardY }] }]}>
            <BlurView intensity={100} tint="dark" style={StyleSheet.absoluteFill} />

            {/* Card glow */}
            <Animated.View style={[styles.cardGlow, { opacity: glowOpacity }]} />

            {/* Top accent — purple for register */}
            <LinearGradient
              colors={['transparent', '#a855f7', '#ff6b6b', 'transparent']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.cardAccentLine}
            />

            {/* Back */}
            <TouchableOpacity style={styles.backBtn} onPress={() => navigation.navigate('Home')} activeOpacity={0.75}>
              <Ionicons name="arrow-back" size={14} color="rgba(255,255,255,0.5)" />
              <Text style={styles.backBtnText}>Home</Text>
            </TouchableOpacity>

            {/* Floating icon */}
            <Animated.View style={[styles.iconBadgeWrapper, { transform: [{ scale: iconScale }] }]}>
              <LinearGradient colors={['#a855f7', '#ff6b6b']} style={styles.iconBadge}>
                <Image source={appIcon} style={styles.iconBadgeImage} contentFit="cover" />
              </LinearGradient>
              <View style={[styles.iconBadgeGlow, { backgroundColor: 'rgba(168,85,247,0.18)' }]} />
            </Animated.View>

            {/* Heading */}
            <View style={styles.heading}>
              <Text style={[styles.title, { textShadowColor: 'rgba(168,85,247,0.3)' }]}>Join OtakuShelf</Text>
              <Text style={styles.subtitle}>Start your anime journey today</Text>
            </View>

            {/* Fields */}
            <View style={styles.fieldGroup}>
              <InputField icon="mail-outline" placeholder="Enter your email" value={email} onChangeText={setEmail} keyboardType="email-address" editable={!isLoading} entranceDelay={100} />
            </View>

            <View style={styles.fieldGroup}>
              <InputField icon="key-outline" placeholder="Create a password (min 8 chars)" value={password} onChangeText={setPassword} secureTextEntry editable={!isLoading} entranceDelay={200} />
              <PasswordStrength password={password} />
            </View>

            <View style={styles.fieldGroup}>
              <InputField icon="shield-checkmark-outline" placeholder="Confirm your password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry editable={!isLoading} entranceDelay={300} />
              {confirmPassword.length > 0 && (
                <View style={styles.matchRow}>
                  <Ionicons
                    name={password === confirmPassword ? 'checkmark-circle' : 'close-circle'}
                    size={14}
                    color={password === confirmPassword ? '#4ade80' : '#f87171'}
                  />
                  <Text style={[styles.matchText, { color: password === confirmPassword ? '#4ade80' : '#f87171' }]}>
                    {password === confirmPassword ? 'Passwords match' : 'Passwords do not match'}
                  </Text>
                </View>
              )}
            </View>

            {/* Register button */}
            <TouchableOpacity onPress={handleRegister} disabled={isLoading} activeOpacity={0.85} style={[styles.primaryBtn, isLoading && styles.primaryBtnDisabled]}>
              <LinearGradient colors={['#e879f9', '#a855f7', '#7c3aed']} start={{x:0,y:0}} end={{x:1,y:1}} style={styles.primaryBg} />
              <LinearGradient colors={['rgba(255,255,255,0.3)', 'rgba(255,255,255,0)']} start={{x:0,y:0}} end={{x:0,y:0.5}} style={styles.primaryShine} />
              {isLoading ? (
                <View style={styles.primaryBtnInner}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={[styles.primaryBtnText, { color: '#fff' }]}>Signing Up...</Text>
                </View>
              ) : (
                  <View style={styles.primaryBtnInner}>
                    <Text style={[styles.primaryBtnText, { color: '#fff' }]}>Register</Text>
                  </View>
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or continue with</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Google button */}
            <TouchableOpacity
              onPress={handleGoogleLogin}
              disabled={isLoading}
              activeOpacity={0.85}
              style={styles.googleBtn}
            >
              <Svg_Google />
              <Text style={styles.googleText}>Sign up with Google</Text>
            </TouchableOpacity>

            {/* Footer */}
            <View style={styles.footer}>
              <View style={styles.footerDivider} />
              <Text style={styles.footerText}>
                Already part of the community?{'  '}
                <Text style={[styles.footerLink, { color: '#c084fc' }]} onPress={() => navigation.navigate('Login')}>
                  Login Here →
                </Text>
              </Text>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

// ─── Shared Styles ────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0f1a' },

  orb: { position: 'absolute', borderRadius: 9999 },
  orb1: { width: 420, height: 420, top: -120, left: -100, backgroundColor: 'rgba(168,85,247,0.2)' },
  orb2: { width: 350, height: 350, bottom: -80, right: -80, backgroundColor: 'rgba(255,107,107,0.2)' },
  orb3: { width: 250, height: 250, top: '40%', left: '55%', backgroundColor: 'rgba(255,166,0,0.1)' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 20, paddingTop: 60 },

  card: {
    width: '100%', maxWidth: 440, alignSelf: 'center',
    backgroundColor: 'transparent',
    borderRadius: 28, paddingTop: 56, paddingBottom: 36, paddingHorizontal: 28,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.55, shadowRadius: 60, elevation: 20,
    overflow: 'hidden',
    marginBottom: 20,
  },
  cardGlow: {
    position: 'absolute', top: -40, alignSelf: 'center',
    width: 200, height: 80, borderRadius: 100,
    backgroundColor: 'rgba(168,85,247,0.12)',
    shadowColor: '#a855f7', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4, shadowRadius: 60, elevation: 0,
  },
  cardAccentLine: {
    position: 'absolute', top: 0, left: '20%', right: '20%',
    height: 2, borderRadius: 999,
  },

  backBtn: {
    position: 'absolute', top: 16, left: 16,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  backBtnText: { color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '600' },

  iconBadgeWrapper: { alignSelf: 'center', marginTop: -30, marginBottom: 22, width: 64, height: 64 },
  iconBadge: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#a855f7', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 24, elevation: 12,
  },
  iconBadgeImage: { width: 64, height: 64, borderRadius: 32 },
  iconBadgeGlow: { position: 'absolute', inset: -8, borderRadius: 40 },

  heading: { alignItems: 'center', marginBottom: 28 },
  title: {
    fontSize: 28, fontWeight: '800', color: '#fff', marginBottom: 6, letterSpacing: -0.3,
    textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 10,
  },
  subtitle: { color: 'rgba(255,255,255,0.45)', fontSize: 14 },

  fieldGroup: { marginBottom: 14 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 50, borderWidth: 1.5,
    paddingHorizontal: 16, height: 52,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, color: '#fff', fontSize: 14.5, letterSpacing: 0.3 },
  eyeBtn: { padding: 4 },

  // Password strength
  strengthBar: {
    height: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 4, overflow: 'hidden',
  },
  strengthFill: { height: '100%', borderRadius: 4 },
  strengthLabel: { fontSize: 11, fontWeight: '700', marginTop: 4, textAlign: 'right' },

  // Password match
  matchRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  matchText: { fontSize: 12, fontWeight: '600' },

  // Primary button
  primaryBtn: {
    borderRadius: 50, overflow: 'hidden', marginTop: 8, marginBottom: 4,
    shadowColor: '#a855f7',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  primaryBg: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 50,
  },
  primaryShine: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 50,
  },
  primaryBtnDisabled: { backgroundColor: '#666' },
  primaryBtnInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 15, gap: 10,
  },
  primaryBtnText: { fontSize: 17, fontWeight: '800', letterSpacing: 1, color: '#fff', fontFamily: 'OutfitRegular' },
  primaryBtnArrow: { fontSize: 18, fontWeight: '700' },

  // Divider
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 22 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.1)' },
  dividerText: { color: 'rgba(255,255,255,0.3)', fontSize: 12, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase' },

  // Google button
  googleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 50, paddingVertical: 15,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
    overflow: 'hidden',
    marginBottom: 4,
  },
  googleText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  // Footer
  footer: { marginTop: 24 },
  footerDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.07)', marginBottom: 22 },
  footerText: { textAlign: 'center', color: 'rgba(255,255,255,0.45)', fontSize: 14 },
  footerLink: { fontWeight: '700' },


});

export default RegisterScreen;
