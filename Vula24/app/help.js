import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Linking } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { GoldButton } from '../components/GoldButton';
import { COLORS } from '../constants/theme';

const WHATSAPP_URL = 'https://wa.me/27123456789';
const EMAIL = 'mailto:support@vula24.com';

const STEPS = [
  'Choose your service',
  'Confirm your location',
  'Get matched to a locksmith',
  'Pay securely after locksmith accepts',
  'Track your locksmith in real time',
];

export default function HelpScreen() {
  const openUrl = async (url, label) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert('Error', `Cannot open ${label}.`);
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert('Error', `Could not open ${label}.`);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <TouchableOpacity style={styles.back} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={22} color={COLORS.accent} />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.h1}>Help & Support</Text>

        <Text style={styles.sectionTitle}>Contact Us</Text>
        <GoldButton
          title="WhatsApp"
          onPress={() => openUrl(WHATSAPP_URL, 'WhatsApp')}
        />
        <View style={styles.btnSpacer} />
        <GoldButton
          title="Email support"
          variant="outline"
          onPress={() => openUrl(EMAIL, 'email')}
        />

        <Text style={[styles.sectionTitle, styles.sectionSpacer]}>How it works</Text>
        <Text style={styles.stepsIntro}>
          Emergency booking flow — quick steps:
        </Text>
        {STEPS.map((step, i) => (
          <View key={i} style={styles.stepRow}>
            <Text style={styles.stepNum}>{i + 1}.</Text>
            <Text style={styles.stepText}>{step}</Text>
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
  sectionTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  sectionSpacer: { marginTop: 28 },
  btnSpacer: { height: 12 },
  stepsIntro: { color: COLORS.textMuted, fontSize: 14, marginBottom: 12, lineHeight: 20 },
  stepRow: { flexDirection: 'row', marginBottom: 10, paddingRight: 8 },
  stepNum: {
    color: COLORS.accent,
    fontWeight: '700',
    width: 28,
    fontSize: 15,
  },
  stepText: { color: COLORS.text, fontSize: 15, flex: 1, lineHeight: 22 },
});
