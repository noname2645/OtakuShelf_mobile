# Profile Pill Component Implementation

## Overview
Replicated the "Profile Dropdown" from the web application (`header.jsx`) into React Native as a reusable `ProfilePill` component.

## Component Details

### File
`src/components/ProfilePill.js`

### Features
1.  **Visual Design**:
    -   **Pill Shape**: Rounded container with semi-transparent background.
    -   **Gradient**: subtle orange gradient background (`rgba(255, 89, 0, 0.1)`).
    -   **Avatar**: Displays user photo if available, otherwise shows initials on an orange background.
    -   **Glow Effect**: Subtle border glow around the avatar.
    -   **Text**: Displays "Welcome" (small label) and User's Name/Email.
    -   **Icon**: Chevron down indicating interactivity.

2.  **Interaction**:
    -   **Tap**: Opens a dropdown menu.
    -   **Dropdown**:
        -   Shows User Name and Auth Type (e.g., "OtakuShelf Member").
        -   **View Profile**: Navigates to Profile screen.
        -   **Settings**: (Placeholder) Closes dropdown.
        -   **Logout**: Logs user out and closes dropdown.
    -   **Click Outside**: Uses a transparent `Modal` overlay to detect clicks outside the menu and close it.

3.  **Platform Adaptation**:
    -   Uses `Modal` for z-index management (ensures menu floats above everything).
    -   Uses `Ionicons` for icons.
    -   Adjusts positioning based on `Platform.OS`.

## Usage

In `HomeScreen.js`:

```javascript
import ProfilePill from '../components/ProfilePill';

// ... inside render ...
<View style={styles.header}>
  <Text style={styles.logo}>OtakuShelf</Text>
  {!user ? (
    <TouchableOpacity ... Get Started ... />
  ) : (
    <ProfilePill user={user} logout={logout} navigation={navigation} />
  )}
</View>
```

## Styling
The component is self-contained with its own `StyleSheet`.
- **Colors**: Uses brand orange `#ff5900` and dark theme `#0f1423`.
- **Shadows**: iOS shadow and Android elevation for depth.

## Dependencies
- `react-native`: View, Text, TouchableOpacity, Image, Modal, TouchableWithoutFeedback, StyleSheet, Platform
- `expo-linear-gradient`: For the pill background
- `@expo/vector-icons`: Ionicons

---
**Last Updated**: February 4, 2026
**Status**: ✅ Complete and Integrated
