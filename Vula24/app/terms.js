import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';

const SECTIONS = [
  {
    title: 'Service Agreement',
    body:
      'Placeholder: This section will describe the agreement between you and Vula24 for locksmith services. Replace with final legal text before launch.',
  },
  {
    title: 'Privacy Policy',
    body:
      'Placeholder: This section will explain how we collect, use, and protect your personal data. Replace with final privacy policy before launch.',
  },
  {
    title: 'Payment Terms',
    body:
      'Placeholder: This section will cover pricing, payment methods, refunds, and platform fees. Replace with final payment terms before launch.',
  },
  {
    title: 'Cancellation Policy',
    body:
      'Placeholder: This section will describe how cancellations and rescheduling work. Replace with final cancellation policy before launch.',
  },
];

export default function TermsScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <TouchableOpacity style={styles.back} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={22} color={COLORS.accent} />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.h1}>Terms & Privacy</Text>
        {SECTIONS.map((s) => (
          <View key={s.title} style={styles.block}>
            <Text style={styles.sectionTitle}>{s.title}</Text>
            <Text style={styles.body}>{s.body}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  backText: { color: COLORS.accent, marginLeft: 8, fontSize: 16 },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  h1: { color: COLORS.text, fontSize: 24, fontWeight: '800', marginBottom: 20 },
  block: { marginBottom: 24 },
  sectionTitle: {
    color: COLORS.accent,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 8,
  },
  body: {
    color: COLORS.textMuted,
    fontSize: 15,
    lineHeight: 22,
  },
});
