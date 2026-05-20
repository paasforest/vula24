import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { Platform, View, Text, TouchableOpacity } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import * as IntentLauncher from 'expo-intent-launcher';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('App crashed:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaProvider>
          <View
            style={{
              flex: 1,
              backgroundColor: '#111111',
              justifyContent: 'center',
              alignItems: 'center',
              padding: 24,
            }}
          >
            <Text
              style={{
                color: '#fff',
                fontSize: 18,
                marginBottom: 16,
                textAlign: 'center',
              }}
            >
              Something went wrong
            </Text>
            <Text
              style={{
                color: '#888',
                fontSize: 14,
                textAlign: 'center',
                marginBottom: 24,
              }}
            >
              Please close and reopen the app
            </Text>
            <TouchableOpacity
              onPress={() =>
                this.setState({
                  hasError: false,
                  error: null,
                })
              }
              style={{
                backgroundColor: '#D4A017',
                paddingHorizontal: 24,
                paddingVertical: 12,
                borderRadius: 8,
              }}
            >
              <Text
                style={{
                  color: '#000',
                  fontWeight: 'bold',
                }}
              >
                Try again
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaProvider>
      );
    }
    return this.props.children;
  }
}

export default function RootLayout() {
  useEffect(() => {
    if (Platform.OS === 'android') {
      (async () => {
        try {
          const { status } = await Notifications.getPermissionsAsync();
          if (status !== 'granted') {
            await Notifications.requestPermissionsAsync();
          }
          await Notifications.setNotificationChannelAsync(
            'job-requests',
            {
              name: 'Job Requests',
              importance: Notifications.AndroidImportance.MAX,
              vibrationPattern: [0, 500, 250, 500],
              lightColor: '#D4A017',
              sound: 'default',
              enableVibrate: true,
              showBadge: true,
              enableLights: true,
              bypassDnd: false,
              lockscreenVisibility:
                Notifications.AndroidNotificationVisibility.PUBLIC,
            }
          );

          const shown = await AsyncStorage.getItem('battery_opt_requested');
          if (!shown) {
            await AsyncStorage.setItem('battery_opt_requested', '1');
            try {
              await IntentLauncher.startActivityAsync(
                IntentLauncher.ActivityAction
                  .REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
                { data: 'package:com.vula24.pro' }
              );
            } catch {
              // ignore
            }
          }
        } catch (e) {
          console.error(
            '[notifications] channel failed:',
            e?.message || e
          );
        }
      })();
    }
  }, []);

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: '#111111' },
            }}
          />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
