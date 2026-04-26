import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { VulaLogoPro } from '../components/VulaLogoPro';
import { getToken, getUser } from '../lib/storage';
import { COLORS } from '../constants/theme';

export default function SplashScreen() {
  useEffect(() => {
    const t = setTimeout(async () => {
      const token = await getToken();
      const user = await getUser();
      if (token) {
        if (user != null && user.isVerified !== true) {
          router.replace('/pending');
        } else {
          router.replace('/(tabs)/dashboard');
        }
      } else {
        router.replace('/welcome');
      }
    }, 2000);
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={styles.container}>
      <VulaLogoPro size={88} />
      <Text style={styles.tagline}>Your jobs. Your earnings.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  tagline: {
    color: COLORS.textMuted,
    fontSize: 17,
    marginTop: 24,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
});
