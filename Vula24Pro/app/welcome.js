import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { VulaLogoPro } from '../components/VulaLogoPro';
import { COLORS } from '../constants/theme';

export default function WelcomeScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <VulaLogoPro size={64} />
      <Text style={styles.h1}>How do you work?</Text>
      <Text style={styles.sub}>Choose the option that best describes you.</Text>

      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.9}
        onPress={() =>
          router.push({ pathname: '/register', params: { type: 'INDIVIDUAL' } })
        }
      >
        <Ionicons name="person" size={36} color={COLORS.accent} />
        <Text style={styles.cardTitle}>I am an Individual Locksmith</Text>
        <Text style={styles.cardBody}>Solo operator — your profile, your schedule.</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.9}
        onPress={() =>
          router.push({ pathname: '/register', params: { type: 'BUSINESS' } })
        }
      >
        <Ionicons name="business" size={36} color={COLORS.accent} />
        <Text style={styles.cardTitle}>I represent a Business / Team</Text>
        <Text style={styles.cardBody}>Manage a team and shared jobs under one account.</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.link} onPress={() => router.push('/login')}>
        <Text style={styles.linkText}>Already have an account? </Text>
        <Text style={styles.linkBold}>Sign in</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bg,
    padding: 24,
  },
  h1: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: '700',
    marginTop: 32,
    marginBottom: 8,
  },
  sub: { color: COLORS.textMuted, fontSize: 16, marginBottom: 24 },
  card: {
    borderWidth: 2,
    borderColor: COLORS.accent,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    backgroundColor: COLORS.inputBg,
  },
  cardTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 12,
  },
  cardBody: { color: COLORS.textMuted, marginTop: 8, fontSize: 15, lineHeight: 22 },
  link: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
    flexWrap: 'wrap',
  },
  linkText: { color: COLORS.textMuted, fontSize: 15 },
  linkBold: { color: COLORS.accent, fontSize: 15, fontWeight: '700' },
});
