import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
  Animated, Dimensions, StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import axios from 'axios';

const appIcon = require('../../assets/otakushelf_app_icon.png');
const { width } = Dimensions.get('window');

// ─── Floating animation helper ──────────────────────────────────────────────
const useFloatingAnimation = (duration = 3000) => {
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, { toValue: 1, duration, useNativeDriver: true }),
        Animated.timing(value, { toValue: 0, duration, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return value;
};

// ─── InputField ─────────────────────────────────────────────────────────────
const InputField = ({ icon, placeholder, value, onChangeText, secureTextEntry, keyboardType, editable, entranceDelay = 0, accentColor = '#ff6b6b' }) => {
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

  const borderColor = borderAnim.interpolate({ inputRange: [0, 1], outputRange: ['rgba(255,255,255,0.1)', accentColor] });

  return (
    <Animated.View style={[styles.inputWrapper, { borderColor, opacity: fieldOpacity, transform: [{ translateY: fieldY }] }]}>
      <Ionicons name={icon} size={18} color={focused ? accentColor : 'rgba(255,255,255,0.4)'} style={styles.inputIcon} />
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

// ─── Password strength bar ──────────────────────────────────────────────────
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

// ─── ForgotPasswordScreen ─────────────────────────────────────────────────────
const ForgotPasswordScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [step, setStep] = useState('email'); // 'email' | 'reset'
  const [isLoading, setIsLoading] = useState(false);
  const { API } = useAuth();
  const { showNotification } = useNotification();

  const accentColor = '#14b8a6';

  // Floating animations
  const orb1Y = useFloatingAnimation(2800);
  const orb2Y = useFloatingAnimation(3400);
  const orb3Y = useFloatingAnimation(2500);
  // Entrance animations
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardY = useRef(new Animated.Value(40)).current;
  const iconScale = useRef(new Animated.Value(0)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;
  const stepOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(cardOpacity, { toValue: 1, duration: 550, useNativeDriver: true }),
      Animated.spring(cardY, { toValue: 0, tension: 55, friction: 9, useNativeDriver: true }),
      Animated.spring(iconScale, { toValue: 1, delay: 300, tension: 60, friction: 8, useNativeDriver: true }),
      Animated.timing(glowOpacity, { toValue: 1, duration: 800, delay: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  const transitionStep = (nextStep) => {
    Animated.timing(stepOpacity, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
      setStep(nextStep);
      Animated.timing(stepOpacity, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    });
  };

  const accentGradient = ['#2dd4bf', '#14b8a6', '#0d9488'];
  const accentShine = ['rgba(255,255,255,0.3)', 'rgba(255,255,255,0)'];

  const validateEmail = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      showNotification('error', 'Please enter your email'); return false;
    }
    if (!emailRegex.test(email.trim())) {
      showNotification('error', 'Enter a valid email address'); return false;
    }
    return true;
  };

  const validatePassword = () => {
    if (!newPassword || !confirmPassword) {
      showNotification('error', 'Please fill in all fields'); return false;
    }
    if (newPassword.length < 8) {
      showNotification('error', 'Password must be at least 8 characters'); return false;
    }
    if (!/[A-Z]/.test(newPassword)) {
      showNotification('error', 'Password must include an uppercase letter'); return false;
    }
    if (!/[0-9]/.test(newPassword)) {
      showNotification('error', 'Password must include a number'); return false;
    }
    if (!/[^A-Za-z0-9]/.test(newPassword)) {
      showNotification('error', 'Password must include a special character'); return false;
    }
    if (newPassword !== confirmPassword) {
      showNotification('error', 'Passwords do not match'); return false;
    }
    return true;
  };

  const handleSendCode = async () => {
    if (!validateEmail()) return;
    setIsLoading(true);
    try {
      await axios.post(`${API}/auth/forgot-password`, { email: email.trim() }, {
        withCredentials: true, timeout: 60000,
      });
      showNotification('success', 'Verification code sent to your email');
      setTimeout(() => transitionStep('reset'), 500);
    } catch (err) {
      let msg = 'Error sending reset code';
      if (err.code === 'ECONNABORTED') msg = 'Connection timeout. Check your internet.';
      else if (err.response) msg = err.response.data?.message || 'Email not found';
      else if (err.request) msg = 'Cannot reach server. Try again later.';
      showNotification('error', msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!validatePassword()) return;
    setIsLoading(true);
    try {
      await axios.post(`${API}/auth/reset-password`, {
        email: email.trim(),
        newPassword,
      }, {
        withCredentials: true, timeout: 60000,
      });
      showNotification('success', 'Password reset successfully!');
      setTimeout(() => navigation.navigate('Login'), 1200);
    } catch (err) {
      let msg = 'Error resetting password';
      if (err.code === 'ECONNABORTED') msg = 'Connection timeout. Check your internet.';
      else if (err.response) msg = err.response.data?.message || 'Reset failed';
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

            {/* Top accent — teal */}
            <LinearGradient
              colors={['transparent', accentColor, '#06b6d4', 'transparent']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.cardAccentLine}
            />

            {/* Back */}
            <TouchableOpacity style={styles.backBtn} onPress={() => navigation.navigate('Login')} activeOpacity={0.75}>
              <Ionicons name="arrow-back" size={14} color="rgba(255,255,255,0.5)" />
              <Text style={styles.backBtnText}>Login</Text>
            </TouchableOpacity>

            {/* Icon badge */}
            <Animated.View style={[styles.iconBadgeWrapper, { transform: [{ scale: iconScale }] }]}>
              <LinearGradient colors={[accentColor, '#06b6d4']} style={styles.iconBadge}>
                <Image source={appIcon} style={styles.iconBadgeImage} contentFit="cover" />
              </LinearGradient>
              <View style={[styles.iconBadgeGlow, { backgroundColor: `${accentColor}2E` }]} />
            </Animated.View>

            {/* Heading */}
            <View style={styles.heading}>
              <Text style={[styles.title, { textShadowColor: `${accentColor}4D` }]}>
                {step === 'email' ? 'Reset Password' : 'Create New Password'}
              </Text>
              <Text style={styles.subtitle}>
                {step === 'email'
                  ? 'Enter your email to receive a reset code'
                  : 'Choose a strong password for your account'}
              </Text>
            </View>

            {/* Form */}
            <Animated.View style={{ opacity: stepOpacity }}>
              {step === 'email' ? (
                <View style={styles.fieldGroup}>
                  <InputField
                    icon="mail-outline"
                    placeholder="Enter your email"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    editable={!isLoading}
                    entranceDelay={100}
                    accentColor={accentColor}
                  />
                </View>
              ) : (
                <>
                  <View style={styles.fieldGroup}>
                    <InputField
                      icon="key-outline"
                      placeholder="New password (min 8 chars)"
                      value={newPassword}
                      onChangeText={setNewPassword}
                      secureTextEntry
                      editable={!isLoading}
                      entranceDelay={100}
                      accentColor={accentColor}
                    />
                    <PasswordStrength password={newPassword} />
                  </View>

                  <View style={styles.fieldGroup}>
                    <InputField
                      icon="shield-checkmark-outline"
                      placeholder="Confirm new password"
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      secureTextEntry
                      editable={!isLoading}
                      entranceDelay={200}
                      accentColor={accentColor}
                    />
                    {confirmPassword.length > 0 && (
                      <View style={styles.matchRow}>
                        <Ionicons
                          name={newPassword === confirmPassword ? 'checkmark-circle' : 'close-circle'}
                          size={14}
                          color={newPassword === confirmPassword ? '#4ade80' : '#f87171'}
                        />
                        <Text style={[styles.matchText, { color: newPassword === confirmPassword ? '#4ade80' : '#f87171' }]}>
                          {newPassword === confirmPassword ? 'Passwords match' : 'Passwords do not match'}
                        </Text>
                      </View>
                    )}
                  </View>
                </>
              )}
            </Animated.View>

            {/* Primary button */}
            <TouchableOpacity
              onPress={step === 'email' ? handleSendCode : handleResetPassword}
              disabled={isLoading}
              activeOpacity={0.85}
              style={[styles.primaryBtn, isLoading && styles.primaryBtnDisabled]}
            >
              <LinearGradient colors={accentGradient} start={{x:0,y:0}} end={{x:1,y:1}} style={styles.primaryBg} />
              <LinearGradient colors={accentShine} start={{x:0,y:0}} end={{x:0,y:0.5}} style={styles.primaryShine} />
              {isLoading ? (
                <View style={styles.primaryBtnInner}>
                  <ActivityIndicator color={step === 'email' ? '#000' : '#fff'} size="small" />
                  <Text style={[styles.primaryBtnText, { color: step === 'email' ? '#000' : '#fff' }]}>
                    {step === 'email' ? 'Sending...' : 'Resetting...'}
                  </Text>
                </View>
              ) : (
                <View style={styles.primaryBtnInner}>
                  <Text style={[styles.primaryBtnText, { color: step === 'email' ? '#000' : '#fff' }]}>
                    {step === 'email' ? 'Send Reset Code' : 'Reset Password'}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Footer */}
            <View style={styles.footer}>
              <View style={styles.footerDivider} />
              <Text style={styles.footerText}>
                Remember your password?{'  '}
                <Text style={[styles.footerLink, { color: accentColor }]} onPress={() => navigation.navigate('Login')}>
                  Sign In →
                </Text>
              </Text>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0f1a' },

  orb: { position: 'absolute', borderRadius: 9999 },
  orb1: { width: 380, height: 380, top: -100, left: -80, backgroundColor: 'rgba(20,184,166,0.18)' },
  orb2: { width: 300, height: 300, bottom: -60, right: -60, backgroundColor: 'rgba(6,182,212,0.18)' },
  orb3: { width: 200, height: 200, top: '45%', left: '58%', backgroundColor: 'rgba(255,166,0,0.1)' },
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
    backgroundColor: 'rgba(20,184,166,0.1)',
    shadowColor: '#14b8a6', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35, shadowRadius: 60, elevation: 0,
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
    shadowColor: '#14b8a6', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 24, elevation: 12,
  },
  iconBadgeImage: { width: 64, height: 64, borderRadius: 32 },
  iconBadgeGlow: { position: 'absolute', inset: -8, borderRadius: 40 },

  heading: { alignItems: 'center', marginBottom: 28 },
  title: {
    fontSize: 28, fontWeight: '800', color: '#fff', marginBottom: 6, letterSpacing: -0.3,
    textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 10,
  },
  subtitle: { color: 'rgba(255,255,255,0.45)', fontSize: 14 },

  fieldGroup: { marginBottom: 16 },
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
  strengthBar: { height: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 4, overflow: 'hidden' },
  strengthFill: { height: '100%', borderRadius: 4 },
  strengthLabel: { fontSize: 11, fontWeight: '700', marginTop: 4, textAlign: 'right' },

  // Password match
  matchRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  matchText: { fontSize: 12, fontWeight: '600' },

  // Primary button
  primaryBtn: {
    borderRadius: 50, overflow: 'hidden', marginTop: 6, marginBottom: 4,
    shadowColor: '#14b8a6',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.55,
    shadowRadius: 22,
    elevation: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  primaryBg: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 50,
  },
  primaryShine: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 50,
  },
  primaryBtnDisabled: { backgroundColor: '#888' },
  primaryBtnInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 15, gap: 10,
  },
  primaryBtnText: { color: '#fff', fontSize: 17, fontWeight: '800', letterSpacing: 1, fontFamily: 'OutfitRegular' },
  primaryBtnArrow: { color: '#fff', fontSize: 18, fontWeight: '700' },

  // Footer
  footer: { marginTop: 24 },
  footerDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.07)', marginBottom: 22 },
  footerText: { textAlign: 'center', color: 'rgba(255,255,255,0.45)', fontSize: 14 },
  footerLink: { fontWeight: '700' },

});

export default ForgotPasswordScreen;
