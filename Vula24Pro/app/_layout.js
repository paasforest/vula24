import 'react-native-gesture-handler';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function RootLayout() {
  useEffect(() => {
    if (Platform.OS === 'android') {
      (async () => {
        try {
          const { status } = await Notifications.getPermissionsAsync();
          if (status !== 'granted') {
            await Notifications.requestPermissionsAsync();
          }
          const result = await Notifications.setNotificationChannelAsync(
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
          console.log(
            '[notifications] channel created:',
            result?.id || 'no result'
          );
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
  );
}
