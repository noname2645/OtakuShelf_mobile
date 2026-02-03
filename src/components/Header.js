// components/header.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  TextInput,
  Image,
  Animated,
  Dimensions,
  Platform,
  TouchableWithoutFeedback,
  Modal,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialIcons, Feather } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';

// Custom hook for scroll detection
const useScroll = (threshold = 100) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;

  const onScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    {
      listener: (event) => {
        const y = event.nativeEvent.contentOffset.y;
        setIsScrolled(y > threshold);
      },
      useNativeDriver: true,
    }
  );

  return { isScrolled, scrollY, onScroll };
};

// ProfileDropdown Component
const ProfileDropdown = ({ user, onLogout }) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const navigation = useNavigation();
  const route = useRoute();

  const getInitials = (email) => {
    return email ? email.charAt(0).toUpperCase() : 'U';
  };

  const handleProfilePress = () => {
    setShowDropdown(false);
    navigation.navigate('Profile');
  };

  const handleLogout = async () => {
    setShowDropdown(false);
    onLogout();
  };

  if (!user) {
    return <Text style={styles.authText}>Please log in</Text>;
  }

  return (
    <View style={styles.profileContainer} ref={dropdownRef}>
      <TouchableOpacity
        onPress={() => setShowDropdown(!showDropdown)}
        style={styles.profileButton}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={['rgba(48, 34, 34, 0.75)', 'rgba(35, 25, 25, 0.45)']}
          style={styles.profileGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {user.photo ? (
            <View style={styles.profileAvatar}>
              <Image source={{ uri: user.photo }} style={styles.avatarImage} />
            </View>
          ) : (
            <LinearGradient
              colors={['#6366f1', '#8b5cf6']}
              style={styles.profileInitials}
            >
              <Text style={styles.initialsText}>{getInitials(user.email)}</Text>
            </LinearGradient>
          )}
          <View style={styles.profileInfo}>
            <Text style={styles.welcomeText}>Welcome</Text>
            <LinearGradient
              colors={['#fcd34d', '#f59e0b', '#f88383']}
              style={styles.usernameGradient}
            >
              <Text style={styles.username} numberOfLines={1}>
                {user.name || user.email}
              </Text>
            </LinearGradient>
          </View>
          <Ionicons
            name={showDropdown ? 'chevron-up' : 'chevron-down'}
            size={14}
            color="rgba(255, 255, 255, 0.7)"
            style={styles.dropdownArrow}
          />
        </LinearGradient>
      </TouchableOpacity>

      <Modal
        visible={showDropdown}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDropdown(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowDropdown(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.profileDropdown}>
              <View style={styles.userInfoSection}>
                <Text style={styles.userName}>{user.name || user.email}</Text>
                <Text style={styles.authType}>
                  {user.authType === 'google' ? 'Signed in with Google' : 'Local Account'}
                </Text>
              </View>

              <TouchableOpacity
                onPress={handleProfilePress}
                style={styles.dropdownItem}
                activeOpacity={0.7}
              >
                <Feather name="user" size={16} color="#374151" />
                <Text style={styles.dropdownText}>View Profile</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setShowDropdown(false)}
                style={styles.dropdownItem}
                activeOpacity={0.7}
              >
                <Feather name="settings" size={16} color="#374151" />
                <Text style={styles.dropdownText}>Settings</Text>
              </TouchableOpacity>

              <View style={styles.dropdownDivider} />

              <TouchableOpacity
                onPress={handleLogout}
                style={[styles.dropdownItem, styles.logoutButton]}
                activeOpacity={0.7}
              >
                <Feather name="log-out" size={16} color="#dc2626" />
                <Text style={[styles.dropdownText, styles.logoutText]}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
};

export const Header = ({ showSearch = true, onSearchChange, user, onLogout }) => {
  const navigation = useNavigation();
  const [searchText, setSearchText] = useState('');
  const [isSearchActive, setIsSearchActive] = useState(false);
  const { isScrolled } = useScroll();
  const screenWidth = Dimensions.get('window').width;

  const handleSearchChange = (text) => {
    setSearchText(text);
    onSearchChange && onSearchChange(text);
  };

  const handleSearchFocus = () => {
    setIsSearchActive(true);
  };

  const handleSearchBlur = () => {
    if (!searchText) {
      setIsSearchActive(false);
    }
  };

  const handleLogoPress = () => {
    navigation.navigate('Home');
  };

  const handleAuthPress = (screen) => {
    navigation.navigate(screen);
  };

  // Dynamic width calculations based on screen size
  const getSearchWidth = () => {
    if (screenWidth < 375) return 100;
    if (screenWidth < 576) return 120;
    if (screenWidth < 768) return 140;
    return 180;
  };

  const getActiveSearchWidth = () => {
    if (screenWidth < 576) return 120;
    if (screenWidth < 768) return 300;
    return 450;
  };

  const getHeaderHeight = () => {
    if (screenWidth < 576) return 30;
    if (screenWidth < 768) return 35;
    return 65;
  };

  const getLogoSize = () => {
    if (screenWidth < 400) return 18;
    if (screenWidth < 576) return 22;
    if (screenWidth < 768) return 26;
    return 38;
  };

  return (
    <Animated.View
      style={[
        styles.header,
        isScrolled && styles.headerScrolled,
        {
          height: getHeaderHeight(),
          width: screenWidth * 0.9,
          maxWidth: 1200,
          paddingHorizontal: screenWidth < 576 ? 12 : 24,
        },
      ]}
    >
      {/* Center Section */}
      <View style={styles.headerCenter}>
        {showSearch ? (
          <Animated.View
            style={[
              styles.inputContainer,
              isSearchActive && styles.inputContainerActive,
              {
                width: isSearchActive ? getActiveSearchWidth() : getSearchWidth(),
                transform: [{ scale: isSearchActive ? 1.05 : 1 }],
              },
            ]}
          >
            <Ionicons
              name="search"
              size={screenWidth < 768 ? 14 : 16}
              color={isSearchActive ? '#ff6b6b' : 'rgba(255, 255, 255, 0.6)'}
              style={styles.searchIcon}
            />
            <TextInput
              style={[
                styles.input,
                {
                  height: screenWidth < 768 ? 32 : 40,
                  fontSize: screenWidth < 768 ? 12 : 14,
                  paddingLeft: screenWidth < 768 ? 35 : 45,
                  borderRadius: screenWidth < 768 ? 15 : 20,
                },
              ]}
              placeholder="Quick Search (Title Only)"
              placeholderTextColor="rgba(237, 235, 235, 0.822)"
              value={searchText}
              onChangeText={handleSearchChange}
              onFocus={handleSearchFocus}
              onBlur={handleSearchBlur}
              selectionColor="#ff6b6b"
            />
          </Animated.View>
        ) : (
          <View style={styles.otakuLabel}>
            <Text style={styles.otakuText}>🤖 OtakuAI</Text>
          </View>
        )}
      </View>

      {/* Logo Section */}
      <TouchableOpacity onPress={handleLogoPress} activeOpacity={0.8}>
        <LinearGradient
          colors={['#ff6a00', '#ffcc00', '#ff0066', '#ff33cc']}
          style={[
            styles.logoGradient,
            {
              borderRadius: screenWidth < 768 ? 15 : 20,
            },
          ]}
        >
          <Text
            style={[
              styles.logoText,
              {
                fontSize: getLogoSize(),
                letterSpacing: screenWidth < 768 ? 2 : 4,
              },
            ]}
          >
            OtakuShelf
          </Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* Auth Section */}
      <View style={styles.authButtons}>
        {user ? (
          <ProfileDropdown user={user} onLogout={onLogout} />
        ) : (
          <>
            <TouchableOpacity
              onPress={() => handleAuthPress('Login')}
              activeOpacity={0.9}
              style={styles.authButton}
            >
              <LinearGradient
                colors={['#04d42a', '#04d42a']}
                style={[
                  styles.buttonInner,
                  styles.loginButton,
                  {
                    borderRadius: screenWidth < 768 ? 15 : 25,
                    paddingHorizontal: screenWidth < 768 ? 12 : 20,
                    paddingVertical: screenWidth < 768 ? 8 : 10,
                  },
                ]}
              >
                <Text style={styles.loginText}>Login</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleAuthPress('Register')}
              activeOpacity={0.9}
              style={styles.authButton}
            >
              <View
                style={[
                  styles.buttonInner,
                  styles.registerButton,
                  {
                    borderRadius: screenWidth < 768 ? 15 : 25,
                    paddingHorizontal: screenWidth < 768 ? 12 : 20,
                    paddingVertical: screenWidth < 768 ? 8 : 10,
                  },
                ]}
              >
                <Text style={styles.registerText}>Register</Text>
              </View>
            </TouchableOpacity>
          </>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  header: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : StatusBar.currentHeight + 10,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 1000,
    borderRadius: 30,
    overflow: 'hidden',
  },
  headerScrolled: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    ...Platform.select({
      ios: {
        backdropFilter: 'blur(10px)',
      },
      android: {
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
      },
    }),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  headerCenter: {
    position: 'absolute',
    left: '50%',
    transform: [{ translateX: -Dimensions.get('window').width * 0.25 }],
  },
  inputContainer: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 1001,
  },
  inputContainerActive: {
    zIndex: 1200,
  },
  searchIcon: {
    position: 'absolute',
    left: 12,
    zIndex: 10,
  },
  input: {
    flex: 1,
    backgroundColor: 'black',
    color: '#ff9f00',
    fontWeight: '600',
    letterSpacing: 2,
    borderWidth: 2,
    borderColor: 'transparent',
    paddingRight: 18,
  },
  otakuLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  otakuText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    opacity: 0.9,
  },
  logoGradient: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  logoText: {
    fontFamily: Platform.OS === 'ios' ? 'System' : 'monospace',
    fontWeight: 'bold',
    color: 'transparent',
    backgroundColor: 'transparent',
  },
  authButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  authButton: {
    borderRadius: 25,
    overflow: 'hidden',
  },
  buttonInner: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginButton: {
    backgroundColor: '#04d42a',
    borderWidth: 2,
    borderColor: '#000',
  },
  loginText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 15,
  },
  registerButton: {
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: '#04d42a',
  },
  registerText: {
    color: '#04d42a',
    fontWeight: 'bold',
    fontSize: 15,
  },
  // Profile styles
  profileContainer: {
    position: 'relative',
  },
  profileButton: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  profileGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 32,
    elevation: 8,
  },
  profileAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  profileInitials: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  initialsText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
  },
  profileInfo: {
    alignItems: 'flex-start',
    maxWidth: 120,
  },
  welcomeText: {
    fontWeight: '600',
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.85)',
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  usernameGradient: {
    borderRadius: 4,
  },
  username: {
    fontSize: 13,
    fontWeight: '700',
    color: 'transparent',
    backgroundColor: 'transparent',
  },
  dropdownArrow: {
    marginLeft: 4,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    paddingTop: Platform.OS === 'ios' ? 100 : 80,
    alignItems: 'flex-end',
    paddingRight: 20,
  },
  profileDropdown: {
    minWidth: 220,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.25,
    shadowRadius: 40,
    elevation: 20,
    padding: 12,
  },
  userInfoSection: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
    marginBottom: 8,
  },
  userName: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '600',
  },
  authType: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 8,
    marginBottom: 4,
  },
  dropdownText: {
    fontSize: 13,
    color: '#374151',
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    marginVertical: 8,
    marginHorizontal: -12,
  },
  logoutButton: {
    padding: 10,
  },
  logoutText: {
    color: '#dc2626',
  },
  authText: {
    color: '#fff',
    fontSize: 14,
  },
});

export default Header;