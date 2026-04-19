import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/theme';

const WHATSAPP_URL = 'https://wa.me/27600000000';
const EMAIL = 'mailto:support@vula24.com';

const STEPS = [
  'Complete your profile — add your photo, vehicle details, and service pricing before going online.',
  'Go online — toggle online on your dashboard when you are ready to accept jobs.',
  'Accept jobs — when a customer books near you, you will get a notification. Accept or let it pass.',
  'Wait for payment — the customer pays after you accept. You will be notified when payment is confirmed.',
  'Head out — once payment is confirmed, navigate to the customer location.',
  'Complete the job — mark the job as arrived, start, and complete through the app.',
  'Get paid — your earnings are credited to your wallet after a short hold period.',
];

export default function HelpScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <TouchableOpacity style={styles.back} onPress={() => router.back()}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>
      <Text style={styles.h1}>Help & Support</Text>
      <View style={styles.scroll}>
        <Text style={styles.sectionTitle}>Contact Us</Text>
        <TouchableOpacity
          style={styles.contactBtn}
          onPress={() => Linking.openURL(WHATSAPP_URL)}
        >
          <Ionicons name="logo-whatsapp" size={22} color="#25D366" />
          <Text style={styles.contactText}>WhatsApp Us</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.contactBtn}
          onPress={() => Linking.openURL(EMAIL)}
        >
          <Ionicons name="mail-outline" size={22} color={COLORS.accent} />
          <Text style={styles.contactText}>support@vula24.com</Text>
        </TouchableOpacity>

        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>How it works</Text>
        {STEPS.map((step, i) => (
          <View key={i} style={styles.step}>
            <View style={styles.stepNum}>
              <Text style={styles.stepNumText}>{i + 1}</Text>
            </View>
            <Text style={styles.stepText}>{step}</Text>
          </View>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  back: { paddingHorizontal: 20, paddingTop: 8, marginBottom: 4 },
  backText: { color: COLORS.accent, fontSize: 16 },
  h1: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: '800',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  scroll: { padding: 20 },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  contactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.inputBg,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  contactText: {
    color: COLORS.text,
    fontSize: 15,
    marginLeft: 12,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  stepNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 1,
    flexShrink: 0,
  },
  stepNumText: {
    color: COLORS.bg,
    fontSize: 12,
    fontWeight: '700',
  },
  stepText: {
    color: COLORS.textMuted,
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
});
