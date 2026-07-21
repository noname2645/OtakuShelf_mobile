import React from 'react';
import { Platform, Text, TextInput } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as NavigationBar from 'expo-navigation-bar';
import { AuthProvider } from './src/contexts/AuthContext';
import { PreferenceProvider } from './src/contexts/PreferenceContext';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import GoogleAuthBrowser from './src/screens/GoogleAuthBrowser';
import ForgotPasswordScreen from './src/screens/ForgotPasswordScreen';
import HomeScreen from './src/screens/HomeScreen';
import ListScreen from './src/screens/ListScreen';
import SearchScreen from './src/screens/SearchScreen';
import AIScreen from './src/screens/AIScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import SettingsScreen from './src/screens/SettingsScreen';

// Patch Text and TextInput to default to Outfit font family
try {
  const defaultFont = { fontFamily: 'OutfitRegular' };

  if (Text.render) {
    const oldTextRender = Text.render;
    Text.render = function (...args) {
      const origin = oldTextRender.call(this, ...args);
      if (React.isValidElement(origin)) {
        return React.cloneElement(origin, {
          style: [defaultFont, origin.props.style],
        });
      }
      return origin;
    };
  } else {
    if (Text.defaultProps === undefined) {
      try {
        Text.defaultProps = {};
      } catch (_) {}
    }
    if (Text.defaultProps) {
      Text.defaultProps.style = { ...defaultFont, ...Text.defaultProps.style };
    }
  }
} catch (e) {
  console.warn("Failed to patch Text default style:", e);
}

try {
  const defaultFont = { fontFamily: 'OutfitRegular' };

  if (TextInput.render) {
    const oldTextInputRender = TextInput.render;
    TextInput.render = function (...args) {
      const origin = oldTextInputRender.call(this, ...args);
      if (React.isValidElement(origin)) {
        return React.cloneElement(origin, {
          style: [defaultFont, origin.props.style],
        });
      }
      return origin;
    };
  } else {
    if (TextInput.defaultProps === undefined) {
      try {
        TextInput.defaultProps = {};
      } catch (_) {}
    }
    if (TextInput.defaultProps) {
      TextInput.defaultProps.style = { ...defaultFont, ...TextInput.defaultProps.style };
    }
  }
} catch (e) {
  console.warn("Failed to patch TextInput default style:", e);
}

const Stack = createNativeStackNavigator();

export default function App() {
  React.useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setBackgroundColorAsync('#030712');
      NavigationBar.setButtonStyleAsync('light');
    }
  }, []);

  const navTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: '#030712',
      card: '#030712',
    },
  };

const [fontsLoaded] = useFonts({
  BricolageRegular: require('./assets/BricolageGrotesque-Regular.ttf'),
  OutfitRegular: require('./assets/Outfit-Regular.ttf'),
  SNProRegular: require('./assets/SNPro-Regular.ttf'),
  JosefinSans: require('./assets/JosefinSans-Regular.ttf'),
  JetbrainsMono: require('./assets/JetBrainsMono-Regular.ttf'),
  Prompt: require('./assets/Prompt-Medium.ttf')
});

  if (!fontsLoaded) {
    return null;
  }

  return (
    <AuthProvider>
      <PreferenceProvider>
        <NavigationContainer theme={navTheme}>
        <StatusBar style="light" backgroundColor="#030712" />
        <Stack.Navigator
          initialRouteName="Home"
          screenOptions={({ route }) => ({
            headerShown: false,
            contentStyle: { backgroundColor: '#030712' },
            animation:
              route.params?.transition === 'left'
                ? 'slide_from_left'
                : route.params?.transition === 'right'
                ? 'slide_from_right'
                : 'fade',
            statusBarColor: '#030712',
            statusBarStyle: 'light',
          })}
        >
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
          <Stack.Screen name="GoogleAuth" component={GoogleAuthBrowser} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="List" component={ListScreen} />
          <Stack.Screen name="Search" component={SearchScreen} />
          <Stack.Screen name="AI" component={AIScreen} />
          <Stack.Screen name="Profile" component={ProfileScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
        </Stack.Navigator>
        </NavigationContainer>
      </PreferenceProvider>
    </AuthProvider>
  );
}
