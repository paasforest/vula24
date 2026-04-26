import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { VulaLogo } from '../components/VulaLogo';
import { getToken } from '../lib/storage';
import { COLORS } from '../constants/theme';

export default function SplashScreen() {
  useEffect(() => {
    const t = setTimeout(async () => {
      const token = await getToken();
      if (token) {
        router.replace('/(tabs)/home');
      } else {
        router.replace('/onboarding');
      }
    }, 2000);
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={styles.container}>
      <VulaLogo size={88} />
      <Text style={styles.tagline}>We open doors, day and night</Text>
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
    fontSize: 16,
    marginTop: 24,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
});
