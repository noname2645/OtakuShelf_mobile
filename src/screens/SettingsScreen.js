import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Animated,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
  ActivityIndicator,
  Image,
  Dimensions,
  Platform,
  Share,
  KeyboardAvoidingView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import BottomNav from '../components/BottomNav';
import { APP_VERSION, BUILD_DATE } from '../config/api';

const { width } = Dimensions.get('window');

const TABS = [
  { id: 'security', label: 'Security', icon: 'lock-closed-outline' },
  { id: 'preferences', label: 'Preferences', icon: 'color-palette-outline' },
  { id: 'profile', label: 'Profile', icon: 'person-outline' },
  { id: 'data', label: 'Data & Privacy', icon: 'server-outline' },
  { id: 'notifications', label: 'Notifications', icon: 'notifications-outline' },
];

const ACCENT_COLORS = [
  { name: 'Coral Red', value: '#ff6b6b' },
  { name: 'Neon Pink', value: '#ec4899' },
  { name: 'Void Purple', value: '#8b5cf6' },
  { name: 'Ocean Blue', value: '#3b82f6' },
  { name: 'Mint Teal', value: '#4ecdc4' },
  { name: 'Cyber Yellow', value: '#fbbf24' },
  { name: 'Sunset Orange', value: '#f97316' },
  { name: 'Emerald', value: '#10b981' },
];

export default function SettingsScreen({ navigation }) {
  const { user, logout, refreshProfile, API } = useAuth();

  const [activeTab, setActiveTab] = useState('security');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  // Settings state
  const [settings, setSettings] = useState({
    preferences: {
      titleLanguage: 'romaji',
      defaultLayout: 'grid',
      nsfwContent: false,
      autoplayTrailers: true,
      accentColor: '#ff6b6b',
    },
    notifications: {
      episodeAlerts: true,
      securityEmails: true,
      marketingEmails: false,
    },
    privacy: {
      profileVisibility: 'public',
    }
  });

  // Security state
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [sessions, setSessions] = useState([]);

  const [mfaSetup, setMfaSetup] = useState(null);
  const [mfaTokenInput, setMfaTokenInput] = useState('');
  const [mfaPasswordInput, setMfaPasswordInput] = useState('');
  const [showMfaDisableModal, setShowMfaDisableModal] = useState(false);

  const [securityOtpInput, setSecurityOtpInput] = useState('');
  const [securityStep, setSecurityStep] = useState('password'); // password or otp
  const [actionLoading, setActionLoading] = useState(false);

  const userId = user?._id || user?.id;
  const scrollYSettings = useRef(new Animated.Value(0)).current;
  const headerBgOpacitySettings = scrollYSettings.interpolate({
    inputRange: [0, 100],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  // Show toast
  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };

  // Load settings
  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    const loadSettings = async () => {
      try {
        const token = await AsyncStorage.getItem("token");
        const response = await axios.get(`${API}/api/settings/${userId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = response.data.data;
        if (data) {
          setSettings(prev => ({
            preferences: { ...prev.preferences, ...data.preferences },
            notifications: { ...prev.notifications, ...data.notifications },
            privacy: { ...prev.privacy, ...data.privacy },
          }));
        }
      } catch (err) {
        console.log('Failed to load settings:', err.message);
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, [userId, API]);

  // Save settings
  const saveSettings = async (category, data) => {
    setSaving(true);
    try {
      const token = await AsyncStorage.getItem("token");
      await axios.put(`${API}/api/settings/${userId}`, { [category]: data }, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      showToast('Settings saved!');
      refreshProfile(); // update context globally
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Toggle handler
  const handleToggle = (category, key) => {
    const newSettings = { ...settings };
    newSettings[category][key] = !newSettings[category][key];
    setSettings(newSettings);
    saveSettings(category, { [key]: newSettings[category][key] });
  };

  // Select handler
  const handleSelect = (category, key, value) => {
    const newSettings = { ...settings };
    newSettings[category][key] = value;
    setSettings(newSettings);
    saveSettings(category, { [key]: value });
  };

  // Change password
  const handleChangePassword = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      return showToast('New passwords do not match', 'error');
    }
    if (passwordForm.newPassword.length < 6) {
      return showToast('Password must be at least 6 characters', 'error');
    }
    setSaving(true);
    try {
      const token = await AsyncStorage.getItem("token");
      await axios.put(`${API}/auth/change-password`, {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      }, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      showToast('Password changed successfully!');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to change password', 'error');
    } finally {
      setSaving(false);
    }
  };

  // MFA Handlers
  const handleSetupMfa = async () => {
    setSaving(true);
    try {
      const token = await AsyncStorage.getItem("token");
      const response = await axios.get(`${API}/api/mfa/setup/${userId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setMfaSetup(response.data.data);
    } catch (err) {
      showToast('Failed to initialize MFA setup', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleVerifyMfa = async () => {
    setSaving(true);
    try {
      const token = await AsyncStorage.getItem("token");
      await axios.post(`${API}/api/mfa/verify/${userId}`, { token: mfaTokenInput }, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      showToast('2FA successfully enabled!');
      refreshProfile();
      setMfaSetup(null);
      setMfaTokenInput('');
    } catch (err) {
      showToast(err.response?.data?.message || 'Invalid 2FA code', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRequestDisableOtp = async () => {
    if (!mfaPasswordInput && user?.authType === 'local') return showToast('Password required', 'error');
    setActionLoading(true);
    try {
      const token = await AsyncStorage.getItem("token");
      await axios.post(`${API}/api/auth/request-security-otp/${userId}`, {
        action: 'mfa_disable',
        password: mfaPasswordInput
      }, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      showToast('Verification code sent to your email');
      setSecurityStep('otp');
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to send verification code', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDisableMfa = async () => {
    if (!securityOtpInput) return showToast('Verification code required', 'error');
    setSaving(true);
    try {
      const token = await AsyncStorage.getItem("token");
      await axios.post(`${API}/api/mfa/disable/${userId}`, { otp: securityOtpInput }, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      showToast('2FA has been disabled');
      refreshProfile();
      setShowMfaDisableModal(false);
      setMfaPasswordInput('');
      setSecurityOtpInput('');
      setSecurityStep('password');
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to disable 2FA', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Delete account
  const handleRequestDeleteOtp = async () => {
    if (!deleteConfirm && user?.authType === 'local') return showToast('Password required', 'error');
    setActionLoading(true);
    try {
      const token = await AsyncStorage.getItem("token");
      await axios.post(`${API}/api/auth/request-security-otp/${userId}`, {
        action: 'delete_account',
        password: deleteConfirm
      }, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      showToast('Verification code sent to your email');
      setSecurityStep('otp');
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to send verification code', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!securityOtpInput) return showToast('Verification code required', 'error');
    setSaving(true);
    try {
      const token = await AsyncStorage.getItem("token");
      await axios.delete(`${API}/auth/delete-account`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        data: {
          otp: securityOtpInput,
          password: deleteConfirm
        }
      });
      showToast('Account deleted. Goodbye...');
      setTimeout(() => logout(), 1500);
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to delete account', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Load sessions
  const loadSessions = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      const response = await axios.get(`${API}/api/settings/${userId}/sessions`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setSessions(response.data.data?.sessions || []);
    } catch (err) {
      console.log('Failed to load sessions:', err.message);
    }
  };

  // Logout all other sessions
  const handleLogoutAll = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      await axios.delete(`${API}/api/settings/${userId}/sessions`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      showToast('All other sessions terminated');
      loadSessions();
    } catch (err) {
      showToast('Failed to terminate sessions', 'error');
    }
  };

  // Export data
  const handleExportData = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      const response = await axios.get(`${API}/api/settings/${userId}/export`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      await Share.share({
        message: JSON.stringify(response.data, null, 2),
        title: 'OtakuShelf Backup Export',
      });
      showToast('Data exported successfully!');
    } catch (err) {
      showToast('Failed to export data', 'error');
    }
  };

  // Load sessions when security tab is active
  useEffect(() => {
    if (activeTab === 'security' && userId) {
      loadSessions();
    }
  }, [activeTab, userId]);

  if (!user) {
    return (
      <View style={styles.container}>
        <View style={styles.notLoggedInContainer}>
          <Text style={styles.nliIcon}>🔐</Text>
          <Text style={styles.nliTitle}>Please log in to access settings</Text>
          <TouchableOpacity style={styles.loginBtn} onPress={() => navigation.navigate('Login')}>
            <Text style={styles.loginBtnText}>Go to Login</Text>
          </TouchableOpacity>
        </View>
        <BottomNav navigation={navigation} activeRoute="Profile" />
      </View>
    );
  }

  const renderSecurity = () => (
    <View style={styles.section}>
      {/* Change Password */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="key-outline" size={22} color="#ffae00" />
          <Text style={styles.cardTitle}>Change Password</Text>
        </View>
        {user?.authType === 'google' ? (
          <View style={styles.infoBanner}>
            <Ionicons name="information-circle-outline" size={20} color="#93c5fd" />
            <Text style={styles.infoBannerText}>
              Your account uses Google Sign-In. Password changes are managed through Google.
            </Text>
          </View>
        ) : (
          <View style={styles.form}>
            <Text style={styles.label}>Current Password</Text>
            <TextInput
              style={styles.input}
              value={passwordForm.currentPassword}
              onChangeText={(text) => setPasswordForm(p => ({ ...p, currentPassword: text }))}
              placeholder="Enter current password"
              placeholderTextColor="rgba(255,255,255,0.3)"
              secureTextEntry
            />

            <Text style={styles.label}>New Password</Text>
            <TextInput
              style={styles.input}
              value={passwordForm.newPassword}
              onChangeText={(text) => setPasswordForm(p => ({ ...p, newPassword: text }))}
              placeholder="At least 6 characters"
              placeholderTextColor="rgba(255,255,255,0.3)"
              secureTextEntry
            />

            <Text style={styles.label}>Confirm New Password</Text>
            <TextInput
              style={styles.input}
              value={passwordForm.confirmPassword}
              onChangeText={(text) => setPasswordForm(p => ({ ...p, confirmPassword: text }))}
              placeholder="Confirm new password"
              placeholderTextColor="rgba(255,255,255,0.3)"
              secureTextEntry
            />

            <TouchableOpacity style={styles.btnPrimary} onPress={handleChangePassword} disabled={saving}>
              <Text style={styles.btnText}>{saving ? 'Changing...' : 'Update Password'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Two-Factor Authentication */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="shield-checkmark-outline" size={22} color="#ffae00" />
          <Text style={styles.cardTitle}>Two-Factor Auth (2FA)</Text>
        </View>
        {user?.authType === 'google' ? (
          <View style={styles.infoBanner}>
            <Ionicons name="information-circle-outline" size={20} color="#93c5fd" />
            <Text style={styles.infoBannerText}>
              Your account uses Google Sign-In. Two-factor authentication is managed by Google.
            </Text>
          </View>
        ) : (
          <View>
            <Text style={styles.cardDesc}>
              Protect your account with an additional layer of security using an authenticator app.
            </Text>

            {user?.isMfaEnabled ? (
              <View style={styles.mfaStatusBox}>
                <Text style={styles.mfaEnabledBadge}>✓ 2FA is Currently Enabled</Text>
                <Text style={styles.mfaDesc}>Your account is protected. You will be asked for a code on login.</Text>
                <TouchableOpacity style={styles.btnDangerOutline} onPress={() => setShowMfaDisableModal(true)}>
                  <Text style={styles.btnDangerText}>Disable 2FA</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                {!mfaSetup ? (
                  <TouchableOpacity style={styles.btnPrimary} onPress={handleSetupMfa} disabled={saving}>
                    <Text style={styles.btnText}>{saving ? 'Setting up...' : 'Setup Authenticator App'}</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.mfaSetupFlow}>
                    <Text style={styles.setupStep}>1. Scan or enter key in your Authenticator app:</Text>
                    
                    {mfaSetup.qrCodeUrl ? (
                      <View style={styles.qrContainer}>
                        <Image source={{ uri: mfaSetup.qrCodeUrl }} style={styles.qrImage} />
                      </View>
                    ) : null}

                    <Text style={styles.label}>Manual Setup Key:</Text>
                    <Text selectTextOnFocus style={styles.keyBox}>{mfaSetup.secret}</Text>

                    <Text style={styles.setupStep}>2. Enter the 6-digit code to enable:</Text>
                    <TextInput
                      style={[styles.input, styles.otpInput]}
                      value={mfaTokenInput}
                      onChangeText={setMfaTokenInput}
                      placeholder="000000"
                      placeholderTextColor="rgba(255,255,255,0.3)"
                      keyboardType="number-pad"
                      maxLength={6}
                    />

                    <View style={styles.modalActionRow}>
                      <TouchableOpacity style={[styles.btnPrimary, { flex: 1 }]} onPress={handleVerifyMfa} disabled={saving || mfaTokenInput.length !== 6}>
                        <Text style={styles.btnText}>Verify & Enable</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.btnGhost, { marginLeft: 10 }]} onPress={() => { setMfaSetup(null); setMfaTokenInput(''); }}>
                        <Text style={styles.btnGhostText}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            )}
          </View>
        )}
      </View>

      {/* Active Sessions */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="phone-portrait-outline" size={22} color="#ffae00" />
          <Text style={styles.cardTitle}>Active Sessions</Text>
        </View>
        <Text style={styles.cardDesc}>Manage devices where you are logged in.</Text>
        
        {sessions.map((session, idx) => (
          <View key={idx} style={styles.sessionItem}>
            <Ionicons name="desktop-outline" size={20} color="rgba(255,255,255,0.5)" style={{ marginRight: 12 }} />
            <View style={{ flex: 1 }}>
              <View style={styles.sessionItemTop}>
                <Text style={styles.sessionName}>Session {idx + 1}</Text>
                {session.ip && <Text style={styles.sessionIp}>{session.ip}</Text>}
                {session.area && <Text style={styles.sessionArea}>📍 {session.area}</Text>}
              </View>
              <Text style={styles.sessionExpires}>Expires: {new Date(session.expires).toLocaleDateString()}</Text>
            </View>
            {idx === 0 && <Text style={styles.currentBadge}>Current</Text>}
          </View>
        ))}

        {sessions.length > 1 && (
          <TouchableOpacity style={styles.btnDangerOutline} onPress={handleLogoutAll}>
            <Text style={styles.btnDangerText}>🚪 Log Out All Other Devices</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Danger Zone */}
      <View style={[styles.card, styles.dangerCard]}>
        <View style={styles.cardHeader}>
          <Ionicons name="warning-outline" size={22} color="#ef4444" />
          <Text style={[styles.cardTitle, { color: '#fca5a5' }]}>Danger Zone</Text>
        </View>
        <Text style={styles.cardDesc}>
          Permanently delete your OtakuShelf account. This will erase all your anime lists, ratings, and details forever.
        </Text>
        <TouchableOpacity style={styles.btnDanger} onPress={() => setShowDeleteModal(true)}>
          <Text style={styles.btnText}>🗑️ Delete My Account</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderPreferences = () => (
    <View style={styles.section}>
      {/* Title Language */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="globe-outline" size={22} color="#ffae00" />
          <Text style={styles.cardTitle}>Title Language</Text>
        </View>
        <Text style={styles.cardDesc}>Choose how anime titles are displayed in the app.</Text>
        <View style={styles.optionPillsRow}>
          {[
            { value: 'romaji', label: 'Romaji', example: 'Shingeki no Kyojin' },
            { value: 'english', label: 'English', example: 'Attack on Titan' },
            { value: 'native', label: 'Native', example: '進撃の巨人' }
          ].map(opt => {
            const isActive = settings.preferences.titleLanguage === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[styles.pill, isActive && styles.pillActive]}
                onPress={() => handleSelect('preferences', 'titleLanguage', opt.value)}
              >
                <Text style={[styles.pillText, isActive && styles.pillTextActive]}>{opt.label}</Text>
                <Text style={[styles.pillSubtext, isActive && styles.pillSubtextActive]} numberOfLines={1}>{opt.example}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Default Layout */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="grid-outline" size={22} color="#ffae00" />
          <Text style={styles.cardTitle}>Default Layout</Text>
        </View>
        <Text style={styles.cardDesc}>Select list viewing layout preferences.</Text>
        <View style={styles.layoutBtnRow}>
          <TouchableOpacity
            style={[styles.layoutBtn, settings.preferences.defaultLayout === 'grid' && styles.layoutBtnActive]}
            onPress={() => handleSelect('preferences', 'defaultLayout', 'grid')}
          >
            <Ionicons name="apps-outline" size={24} color={settings.preferences.defaultLayout === 'grid' ? '#ff6b6b' : '#fff'} />
            <Text style={[styles.layoutBtnText, settings.preferences.defaultLayout === 'grid' && styles.layoutBtnTextActive]}>Grid View</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.layoutBtn, settings.preferences.defaultLayout === 'list' && styles.layoutBtnActive]}
            onPress={() => handleSelect('preferences', 'defaultLayout', 'list')}
          >
            <Ionicons name="list-outline" size={24} color={settings.preferences.defaultLayout === 'list' ? '#ff6b6b' : '#fff'} />
            <Text style={[styles.layoutBtnText, settings.preferences.defaultLayout === 'list' && styles.layoutBtnTextActive]}>List View</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Accent Color */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="color-palette-outline" size={22} color="#ffae00" />
          <Text style={styles.cardTitle}>Accent Color</Text>
        </View>
        <Text style={styles.cardDesc}>Personalize the application theme color.</Text>
        <View style={styles.colorGrid}>
          {ACCENT_COLORS.map(c => {
            const isActive = settings.preferences.accentColor === c.value;
            return (
              <TouchableOpacity
                key={c.value}
                style={[styles.colorSwatch, { backgroundColor: c.value }, isActive && styles.colorSwatchActive]}
                onPress={() => handleSelect('preferences', 'accentColor', c.value)}
              >
                {isActive && <Ionicons name="checkmark" size={20} color="#fff" />}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Switches */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="settings-outline" size={22} color="#ffae00" />
          <Text style={styles.cardTitle}>Display Preferences</Text>
        </View>
        <View style={styles.toggleRow}>
          <View style={styles.toggleInfo}>
            <Text style={styles.toggleLabel}>Autoplay Trailers</Text>
            <Text style={styles.toggleDesc}>Automatically play video trailers on homepage</Text>
          </View>
          <Switch
            value={settings.preferences.autoplayTrailers}
            onValueChange={() => handleToggle('preferences', 'autoplayTrailers')}
            trackColor={{ false: '#334155', true: '#ff6b6b' }}
            thumbColor="#fff"
          />
        </View>
        <View style={styles.toggleRow}>
          <View style={styles.toggleInfo}>
            <Text style={styles.toggleLabel}>NSFW Content</Text>
            <Text style={styles.toggleDesc}>Unblur covers and display adult listings</Text>
          </View>
          <Switch
            value={settings.preferences.nsfwContent}
            onValueChange={() => handleToggle('preferences', 'nsfwContent')}
            trackColor={{ false: '#334155', true: '#ff6b6b' }}
            thumbColor="#fff"
          />
        </View>
      </View>
    </View>
  );

  const renderProfile = () => (
    <View style={styles.section}>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="person-outline" size={22} color="#ffae00" />
          <Text style={styles.cardTitle}>Profile Information</Text>
        </View>
        <Text style={styles.cardDesc}>
          Manage profile details, bio, and covers directly from the Profile page.
        </Text>
        <View style={styles.profilePreview}>
          {user?.photo ? (
            <Image source={{ uri: user.photo }} style={styles.profileAvatar} />
          ) : (
            <View style={styles.profileAvatarPlaceholder}>
              <Text style={styles.profileAvatarText}>{(user?.name || user?.email || 'U')[0].toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.profileMeta}>
            <Text style={styles.profileName}>{user?.name || 'Anime Lover'}</Text>
            <Text style={styles.profileEmail}>{user?.email}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.btnSecondary} onPress={() => navigation.navigate('Profile')}>
          <Text style={styles.btnSecondaryText}>✏️ Go to Profile Page</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="lock-open-outline" size={22} color="#ffae00" />
          <Text style={styles.cardTitle}>Account Type</Text>
        </View>
        <View style={styles.accountTypeBadge}>
          <Text style={styles.accountTypeText}>
            {user?.authType === 'google' ? '🔵 Google Sign-In Account' : '🟢 Email & Password Account'}
          </Text>
        </View>
        <Text style={styles.cardDesc}>
          {user?.authType === 'google'
            ? 'Your security setup is managed by Google. Multi-factor auth or credentials updates must be made in Google accounts settings.'
            : 'You are logged in with local database records. Access settings and credentials update are fully manageable from this menu.'}
        </Text>
      </View>
    </View>
  );

  const renderData = () => (
    <View style={styles.section}>
      {/* Visibility */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="eye-outline" size={22} color="#ffae00" />
          <Text style={styles.cardTitle}>Profile Visibility</Text>
        </View>
        <Text style={styles.cardDesc}>Control who can view your libraries and stats pages.</Text>
        <View style={styles.optionPillsRow}>
          <TouchableOpacity
            style={[styles.pill, settings.privacy.profileVisibility === 'public' && styles.pillActive]}
            onPress={() => handleSelect('privacy', 'profileVisibility', 'public')}
          >
            <Text style={styles.pillIconText}>🌍</Text>
            <Text style={[styles.pillText, settings.privacy.profileVisibility === 'public' && styles.pillTextActive]}>Public</Text>
            <Text style={[styles.pillSubtext, settings.privacy.profileVisibility === 'public' && styles.pillSubtextActive]}>Anyone can view profile</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.pill, settings.privacy.profileVisibility === 'private' && styles.pillActive]}
            onPress={() => handleSelect('privacy', 'profileVisibility', 'private')}
          >
            <Text style={styles.pillIconText}>🔒</Text>
            <Text style={[styles.pillText, settings.privacy.profileVisibility === 'private' && styles.pillTextActive]}>Private</Text>
            <Text style={[styles.pillSubtext, settings.privacy.profileVisibility === 'private' && styles.pillSubtextActive]}>Only you can view data</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Backup */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="download-outline" size={22} color="#ffae00" />
          <Text style={styles.cardTitle}>Backup Your Library</Text>
        </View>
        <Text style={styles.cardDesc}>
          Download a complete export of your anime lists, ratings, progress, and settings to a JSON format.
        </Text>
        <TouchableOpacity style={styles.btnPrimary} onPress={handleExportData}>
          <Text style={styles.btnText}>📦 Export Library Data</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderNotifications = () => (
    <View style={styles.section}>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="notifications-outline" size={22} color="#ffae00" />
          <Text style={styles.cardTitle}>Notification Settings</Text>
        </View>
        <Text style={styles.cardDesc}>Select which emails you receive from OtakuShelf.</Text>
        
        <View style={styles.toggleRow}>
          <View style={styles.toggleInfo}>
            <Text style={styles.toggleLabel}>Episode Alerts</Text>
            <Text style={styles.toggleDesc}>When new episodes air for anime in your watchlist</Text>
          </View>
          <Switch
            value={settings.notifications.episodeAlerts}
            onValueChange={() => handleToggle('notifications', 'episodeAlerts')}
            trackColor={{ false: '#334155', true: '#ff6b6b' }}
            thumbColor="#fff"
          />
        </View>

        <View style={styles.toggleRow}>
          <View style={styles.toggleInfo}>
            <Text style={styles.toggleLabel}>Security Notifications</Text>
            <Text style={styles.toggleDesc}>Alerts about account changes, new logins, etc.</Text>
          </View>
          <Switch
            value={settings.notifications.securityEmails}
            onValueChange={() => handleToggle('notifications', 'securityEmails')}
            trackColor={{ false: '#334155', true: '#ff6b6b' }}
            thumbColor="#fff"
          />
        </View>

        <View style={styles.toggleRow}>
          <View style={styles.toggleInfo}>
            <Text style={styles.toggleLabel}>Product Updates</Text>
            <Text style={styles.toggleDesc}>Stay in the loop about new features and updates</Text>
          </View>
          <Switch
            value={settings.notifications.marketingEmails}
            onValueChange={() => handleToggle('notifications', 'marketingEmails')}
            trackColor={{ false: '#334155', true: '#ff6b6b' }}
            thumbColor="#fff"
          />
        </View>
      </View>
    </View>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'security': return renderSecurity();
      case 'preferences': return renderPreferences();
      case 'profile': return renderProfile();
      case 'data': return renderData();
      case 'notifications': return renderNotifications();
      default: return null;
    }
  };

  return (
    <View style={styles.container}>
      {/* ── Top scroll fade (ChatGPT style) ── */}
      <Animated.View style={[styles.scrollFade, { opacity: headerBgOpacitySettings }]} pointerEvents="none">
        <LinearGradient colors={['#030712', 'transparent']} style={StyleSheet.absoluteFill} />
      </Animated.View>

      {/* Toast Alert */}
      {toast.show && (
        <View style={[styles.toast, toast.type === 'success' ? styles.toastSuccess : styles.toastError]}>
          <Text style={styles.toastText}>
            {toast.type === 'success' ? '✅ ' : '❌ '}{toast.message}
          </Text>
        </View>
      )}

      {/* Header */}
      <LinearGradient colors={['#1e1b4b', '#0f172a']} style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 40 }} />
      </LinearGradient>

      {/* Tabs */}
      <View style={styles.tabScrollContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabBar}
          contentContainerStyle={styles.tabBarContent}
        >
          {TABS.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[styles.tabButton, isActive && styles.tabButtonActive]}
                onPress={() => setActiveTab(tab.id)}
              >
                <Ionicons
                  name={tab.icon}
                  size={16}
                  color={isActive ? '#ff6b6b' : 'rgba(255,255,255,0.6)'}
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.tabButtonText, isActive && styles.tabButtonTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Content */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={styles.content}
          contentContainerStyle={{ paddingBottom: 100 }}
          keyboardShouldPersistTaps="handled"
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollYSettings } } }],
            { useNativeDriver: false }
          )}
          scrollEventThrottle={16}
        >
          {loading ? (
            <ActivityIndicator size="large" color="#ff6b6b" style={{ marginTop: 40 }} />
          ) : (
            <>
              {renderTabContent()}
              <View style={styles.versionFooter}>
                <Text style={styles.versionText}>OtakuShelf v{APP_VERSION}</Text>
                <Text style={styles.buildText}>Build {BUILD_DATE} • Stable</Text>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* MFA disable verification modal */}
      {showMfaDisableModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Disable Two-Factor Auth?</Text>
            <Text style={styles.modalDesc}>Disabling 2FA will reduce account security. Verification is required.</Text>

            {securityStep === 'password' ? (
              <View style={{ width: '100%' }}>
                {user?.authType === 'local' && (
                  <View style={{ width: '100%', marginBottom: 16 }}>
                    <Text style={styles.label}>Confirm your Password</Text>
                    <TextInput
                      style={styles.input}
                      value={mfaPasswordInput}
                      onChangeText={setMfaPasswordInput}
                      placeholder="Your password"
                      placeholderTextColor="rgba(255,255,255,0.3)"
                      secureTextEntry
                    />
                  </View>
                )}
                <View style={styles.modalActionRow}>
                  <TouchableOpacity
                    style={[styles.btnPrimary, { flex: 1 }]}
                    onPress={handleRequestDisableOtp}
                    disabled={actionLoading || (user?.authType === 'local' && !mfaPasswordInput)}
                  >
                    <Text style={styles.btnText}>{actionLoading ? 'Sending...' : 'Send Code'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.btnGhost, { marginLeft: 10 }]} onPress={() => setShowMfaDisableModal(false)}>
                    <Text style={styles.btnGhostText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={{ width: '100%' }}>
                <Text style={styles.label}>Enter 6-digit Code sent to Email</Text>
                <TextInput
                  style={[styles.input, styles.otpInput]}
                  value={securityOtpInput}
                  onChangeText={setSecurityOtpInput}
                  placeholder="000000"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  keyboardType="number-pad"
                  maxLength={6}
                />
                <View style={styles.modalActionRow}>
                  <TouchableOpacity
                    style={[styles.btnDanger, { flex: 1 }]}
                    onPress={handleDisableMfa}
                    disabled={saving || securityOtpInput.length !== 6}
                  >
                    <Text style={styles.btnText}>{saving ? 'Disabling...' : 'Confirm Disable'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.btnGhost, { marginLeft: 10 }]} onPress={() => setSecurityStep('password')}>
                    <Text style={styles.btnGhostText}>Back</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Delete Account Forever?</Text>
            <Text style={styles.modalDesc}>This action cannot be undone. All your lists and progress will be deleted.</Text>

            {securityStep === 'password' ? (
              <View style={{ width: '100%' }}>
                {user?.authType === 'local' && (
                  <View style={{ width: '100%', marginBottom: 16 }}>
                    <Text style={styles.label}>Confirm your Password</Text>
                    <TextInput
                      style={styles.input}
                      value={deleteConfirm}
                      onChangeText={setDeleteConfirm}
                      placeholder="Your password"
                      placeholderTextColor="rgba(255,255,255,0.3)"
                      secureTextEntry
                    />
                  </View>
                )}
                <View style={styles.modalActionRow}>
                  <TouchableOpacity
                    style={[styles.btnDanger, { flex: 1 }]}
                    onPress={handleRequestDeleteOtp}
                    disabled={actionLoading || (user?.authType === 'local' && !deleteConfirm)}
                  >
                    <Text style={styles.btnText}>{actionLoading ? 'Sending...' : 'Send Code'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.btnGhost, { marginLeft: 10 }]} onPress={() => setShowDeleteModal(false)}>
                    <Text style={styles.btnGhostText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={{ width: '100%' }}>
                <Text style={styles.label}>Enter 6-digit Code sent to Email</Text>
                <TextInput
                  style={[styles.input, styles.otpInput]}
                  value={securityOtpInput}
                  onChangeText={setSecurityOtpInput}
                  placeholder="000000"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  keyboardType="number-pad"
                  maxLength={6}
                />
                <View style={styles.modalActionRow}>
                  <TouchableOpacity
                    style={[styles.btnDanger, { flex: 1 }]}
                    onPress={handleDeleteAccount}
                    disabled={saving || securityOtpInput.length !== 6}
                  >
                    <Text style={styles.btnText}>{saving ? 'Deleting...' : 'Confirm Delete'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.btnGhost, { marginLeft: 10 }]} onPress={() => setSecurityStep('password')}>
                    <Text style={styles.btnGhostText}>Back</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      )}

      <BottomNav navigation={navigation} activeRoute="Profile" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0f1e',
  },
  scrollFade: {
    position: 'absolute', top: 0, left: 0, right: 0,
    height: 170, zIndex: 200,
  },
  header: {
    height: Platform.OS === 'ios' ? 90 : 70,
    paddingTop: Platform.OS === 'ios' ? 40 : 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    fontFamily: 'OutfitRegular',
  },
  tabScrollContainer: {
    backgroundColor: '#0c0e1c',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  tabBar: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  tabBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 24,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  tabButtonActive: {
    backgroundColor: 'rgba(255,107,107,0.12)',
    borderColor: '#ff6b6b',
  },
  tabButtonText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'OutfitRegular',
  },
  tabButtonTextActive: {
    color: '#ff6b6b',
    fontWeight: '700',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    gap: 16,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
    fontFamily: 'OutfitRegular',
  },
  cardDesc: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
    fontFamily: 'JosefinSans',
  },
  label: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 6,
    letterSpacing: 0.5,
    fontFamily: 'OutfitRegular',
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    color: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 14,
    fontFamily: 'OutfitRegular',
  },
  form: {
    marginTop: 8,
  },
  btnPrimary: {
    backgroundColor: '#ff6b6b',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'OutfitRegular',
  },
  infoBanner: {
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    borderColor: 'rgba(59, 130, 246, 0.2)',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoBannerText: {
    color: '#93c5fd',
    fontSize: 12,
    flex: 1,
    marginLeft: 8,
    lineHeight: 16,
    fontFamily: 'JosefinSans',
  },
  toast: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 100 : 80,
    left: 16,
    right: 16,
    zIndex: 9999,
    padding: 12,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  toastSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.95)',
  },
  toastError: {
    backgroundColor: 'rgba(239, 68, 68, 0.95)',
  },
  toastText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'OutfitRegular',
  },
  mfaStatusBox: {
    backgroundColor: 'rgba(255,255,255,0.01)',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
  },
  mfaEnabledBadge: {
    color: '#10b981',
    fontWeight: '700',
    fontSize: 14,
    marginBottom: 4,
    fontFamily: 'OutfitRegular',
  },
  mfaDesc: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontFamily: 'JosefinSans',
  },
  btnDangerOutline: {
    borderWidth: 1.5,
    borderColor: 'rgba(239,68,68,0.4)',
    backgroundColor: 'rgba(239,68,68,0.05)',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  btnDangerText: {
    color: '#fca5a5',
    fontWeight: '700',
    fontSize: 13,
    fontFamily: 'OutfitRegular',
  },
  mfaSetupFlow: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    padding: 12,
    borderRadius: 10,
    marginTop: 8,
  },
  setupStep: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    fontFamily: 'OutfitRegular',
  },
  qrContainer: {
    backgroundColor: '#fff',
    padding: 8,
    borderRadius: 10,
    alignSelf: 'center',
    marginVertical: 12,
  },
  qrImage: {
    width: 140,
    height: 140,
  },
  keyBox: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: 10,
    color: '#fff',
    fontFamily: 'JetbrainsMono',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 16,
  },
  otpInput: {
    fontSize: 18,
    letterSpacing: 4,
    textAlign: 'center',
  },
  modalActionRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  btnGhost: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGhostText: {
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
    fontFamily: 'OutfitRegular',
  },
  sessionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  sessionItemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 2,
  },
  sessionName: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
    marginRight: 6,
    fontFamily: 'OutfitRegular',
  },
  sessionIp: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginRight: 6,
    fontFamily: 'JetbrainsMono',
  },
  sessionArea: {
    color: '#ff6b6b',
    fontSize: 10,
    fontWeight: '600',
    backgroundColor: 'rgba(255,107,107,0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    fontFamily: 'OutfitRegular',
  },
  sessionExpires: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 11,
    fontFamily: 'JosefinSans',
  },
  currentBadge: {
    color: '#6ee7b7',
    fontSize: 10,
    fontWeight: '700',
    backgroundColor: 'rgba(16,185,129,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.3)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    overflow: 'hidden',
    fontFamily: 'OutfitRegular',
  },
  dangerCard: {
    borderColor: 'rgba(239,68,68,0.2)',
    backgroundColor: 'rgba(239,68,68,0.02)',
  },
  btnDanger: {
    backgroundColor: '#ef4444',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionPillsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  pill: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  pillActive: {
    backgroundColor: 'rgba(255,107,107,0.08)',
    borderColor: '#ff6b6b',
  },
  pillText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
    fontFamily: 'OutfitRegular',
  },
  pillTextActive: {
    color: '#fff',
  },
  pillSubtext: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 10,
    textAlign: 'center',
    fontFamily: 'JosefinSans',
  },
  pillSubtextActive: {
    color: 'rgba(255,255,255,0.6)',
  },
  layoutBtnRow: {
    flexDirection: 'row',
    gap: 12,
  },
  layoutBtn: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  layoutBtnActive: {
    borderColor: '#ff6b6b',
    backgroundColor: 'rgba(255,107,107,0.08)',
  },
  layoutBtnText: {
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
    fontSize: 13,
    marginTop: 6,
    fontFamily: 'OutfitRegular',
  },
  layoutBtnTextActive: {
    color: '#fff',
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  colorSwatch: {
    width: (width - 64 - 70) / 8,
    height: (width - 64 - 70) / 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorSwatchActive: {
    borderWidth: 2,
    borderColor: '#fff',
    transform: [{ scale: 1.1 }],
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  toggleInfo: {
    flex: 1,
    paddingRight: 12,
  },
  toggleLabel: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'OutfitRegular',
  },
  toggleDesc: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    marginTop: 2,
    fontFamily: 'JosefinSans',
  },
  profilePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  profileAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(255,107,107,0.3)',
  },
  profileAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ff6b6b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    fontFamily: 'OutfitRegular',
  },
  profileMeta: {
    marginLeft: 12,
  },
  profileName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    fontFamily: 'OutfitRegular',
  },
  profileEmail: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
    fontFamily: 'JosefinSans',
  },
  btnSecondary: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  btnSecondaryText: {
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
    fontSize: 13,
    fontFamily: 'OutfitRegular',
  },
  accountTypeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 10,
  },
  accountTypeText: {
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '700',
    fontSize: 12,
    fontFamily: 'OutfitRegular',
  },
  pillIconText: {
    fontSize: 20,
    marginBottom: 6,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10000,
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: '#0d0f1a',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
    fontFamily: 'OutfitRegular',
  },
  modalDesc: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 20,
    fontFamily: 'JosefinSans',
  },
  notLoggedInContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  nliIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  nliTitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 24,
    fontFamily: 'OutfitRegular',
  },
  loginBtn: {
    backgroundColor: '#ff6b6b',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  loginBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    fontFamily: 'OutfitRegular',
  },
  versionFooter: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
    marginBottom: 20,
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  versionText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'OutfitRegular',
    letterSpacing: 0.8,
  },
  buildText: {
    color: 'rgba(255, 255, 255, 0.25)',
    fontSize: 10,
    marginTop: 4,
    fontFamily: 'JosefinSans',
    letterSpacing: 0.5,
  }
});
