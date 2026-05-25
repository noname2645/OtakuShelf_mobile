import React, { useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Image,
    Modal,
    TouchableWithoutFeedback,
    StyleSheet,
    Platform
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const ProfilePill = ({ user, logout, navigation }) => {
    const [showDropdown, setShowDropdown] = useState(false);

    // Helper to get initials
    const getInitials = (email) => {
        return email ? email.charAt(0).toUpperCase() : 'U';
    };

    if (!user) return null;

    return (
        <View style={localStyles.container}>
            {/* Pill Button */}
            <TouchableOpacity
                style={localStyles.pillButton}
                onPress={() => setShowDropdown(true)}
                activeOpacity={0.8}
            >
                <LinearGradient
                    colors={['rgba(15, 20, 35, 0.9)', 'rgba(30, 35, 50, 0.95)']}
                    style={localStyles.pillGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                >
                    {/* Avatar Area */}
                    <View style={localStyles.avatarContainer}>
                        {user.photo ? (
                            <Image source={{ uri: user.photo }} style={localStyles.avatar} />
                        ) : (
                            <View style={localStyles.initialsContainer}>
                                <Text style={localStyles.initialsText}>{getInitials(user.email)}</Text>
                            </View>
                        )}
                        <View style={localStyles.glow} />
                    </View>

                    {/* User Info */}
                    <View style={localStyles.infoContainer}>
                        <Text style={localStyles.welcomeText}>Welcome</Text>
                        <Text style={localStyles.nameText} numberOfLines={1}>
                            {user.name || user.email?.split('@')[0]}
                        </Text>
                    </View>

                    {/* Arrow */}
                    <Ionicons
                        name="chevron-down"
                        size={14}
                        color="rgba(255,255,255,0.7)"
                        style={{ marginLeft: 8 }}
                    />
                </LinearGradient>
            </TouchableOpacity>

            {/* Dropdown Modal */}
            <Modal
                visible={showDropdown}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowDropdown(false)}
            >
                <TouchableWithoutFeedback onPress={() => setShowDropdown(false)}>
                    <View style={localStyles.modalOverlay}>
                        <TouchableWithoutFeedback>
                            <View style={localStyles.dropdownMenu}>
                                {/* Header */}
                                <View style={localStyles.dropdownHeader}>
                                    <Text style={localStyles.dropdownUserName} numberOfLines={1}>
                                        {user.name || user.email}
                                    </Text>
                                    <Text style={localStyles.dropdownAuthType}>
                                        {user.authType === 'google' ? 'Signed in with Google' : 'Local Account'}
                                    </Text>
                                </View>

                                <View style={localStyles.dropdownDivider} />

                                {/* Items */}
                                <TouchableOpacity
                                    style={localStyles.dropdownItem}
                                    onPress={() => {
                                        setShowDropdown(false);
                                        navigation.navigate('Profile');
                                    }}
                                >
                                    <Ionicons name="person-outline" size={18} color="#aaa" />
                                    <Text style={localStyles.dropdownItemText}>View Profile</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={localStyles.dropdownItem}
                                    onPress={() => setShowDropdown(false)}
                                >
                                    <Ionicons name="settings-outline" size={18} color="#aaa" />
                                    <Text style={localStyles.dropdownItemText}>Settings</Text>
                                </TouchableOpacity>

                                <View style={localStyles.dropdownDivider} />

                                {/* Logout */}
                                <TouchableOpacity
                                    style={[localStyles.dropdownItem, { marginBottom: 0 }]}
                                    onPress={async () => {
                                        setShowDropdown(false);
                                        await logout();
                                    }}
                                >
                                    <Ionicons name="log-out-outline" size={18} color="#ff5900" />
                                    <Text style={[localStyles.dropdownItemText, { color: '#ff5900' }]}>Logout</Text>
                                </TouchableOpacity>
                            </View>
                        </TouchableWithoutFeedback>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>
        </View>
    );
};

const localStyles = StyleSheet.create({
    container: {
        zIndex: 20,
    },
    pillButton: {
        borderRadius: 30,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)',
    },
    pillGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 4,
        paddingHorizontal: 6,
        paddingRight: 12,
    },
    avatarContainer: {
        width: 32,
        height: 32,
        borderRadius: 16,
        marginRight: 10,
        position: 'relative',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    initialsContainer: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#ff5900',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    initialsText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: 'bold',
    },
    glow: {
        position: 'absolute',
        top: -2,
        left: -2,
        right: -2,
        bottom: -2,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#ff5900',
        opacity: 0.3,
    },
    infoContainer: {
        justifyContent: 'center',
    },
    welcomeText: {
        color: '#888',
        fontSize: 10,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    nameText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '600',
        maxWidth: 100,
    },

    // Dropdown Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.1)', // Subtle dim
    },
    dropdownMenu: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 90 : 80, // Adjust based on header height
        right: 20,
        width: 220,
        backgroundColor: '#0f1423', // Matches header/app bg
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        padding: 5,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 10,
        },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 10,
    },
    dropdownHeader: {
        padding: 12,
    },
    dropdownUserName: {
        color: '#fff',
        fontSize: 14,
        fontWeight: 'bold',
        marginBottom: 2,
    },
    dropdownAuthType: {
        color: '#666',
        fontSize: 11,
    },
    dropdownDivider: {
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.1)',
        marginHorizontal: 8,
        marginVertical: 4,
    },
    dropdownItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        borderRadius: 8,
        marginBottom: 2,
    },
    dropdownItemText: {
        color: '#ccc',
        fontSize: 14,
        marginLeft: 10,
        fontWeight: '500',
    },
});

export default ProfilePill;
