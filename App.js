import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { AuthProvider } from './src/contexts/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import GoogleAuthScreen from './src/screens/GoogleAuthScreen';
import HomeScreen from './src/screens/HomeScreen';
import ListScreen from './src/screens/ListScreen';
import SearchScreen from './src/screens/SearchScreen';
import AIScreen from './src/screens/AIScreen';
import ProfileScreen from './src/screens/ProfileScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  const navTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: '#0a0f1e',
      card: '#0a0f1e',
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
      <NavigationContainer theme={navTheme}>
        <StatusBar style="light" backgroundColor="#0a0f1e" />
        <Stack.Navigator
          initialRouteName="Home"
          screenOptions={({ route }) => ({
            headerShown: false,
            contentStyle: { backgroundColor: '#0a0f1e' },
            animation:
              route.params?.transition === 'left' ||
                route.params?.transition === 'right'
                ? 'fade_from_bottom'
                : 'slide_from_right',
            statusBarColor: '#0a0f1e',
            statusBarStyle: 'light',
          })}
        >
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
          <Stack.Screen name="GoogleAuth" component={GoogleAuthScreen} />
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="List" component={ListScreen} />
          <Stack.Screen name="Search" component={SearchScreen} />
          <Stack.Screen name="AI" component={AIScreen} />
          <Stack.Screen name="Profile" component={ProfileScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </AuthProvider>
  );
}
