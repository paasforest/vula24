import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';

const SECTIONS = [
  {
    title: 'Service Agreement',
    body: `By using Vula24, you agree to these terms. Vula24 is a platform that connects customers with independent locksmith service providers. We do not employ locksmiths directly — they are independent contractors.

You agree to use the app only for lawful purposes. You must provide accurate location and contact information when booking a job. Misuse of the platform, including false bookings or abusive behaviour toward locksmiths, may result in account suspension.

Vula24 reserves the right to cancel any booking and suspend any account that violates these terms.`,
  },
  {
    title: 'Privacy Policy',
    body: `Vula24 collects your name, phone number, email address, and location data to provide our service. Your location is used to find nearby locksmiths and to track job progress.

We do not sell your personal information to third parties. Your data is stored securely and used only to operate the Vula24 platform.

By using Vula24 you consent to the collection and use of your information as described here. You may request deletion of your account and data by contacting support@vula24.com.`,
  },
  {
    title: 'Payment Terms',
    body: `All prices shown in the app include a Vula24 service fee. The total price shown before you confirm your booking is the amount you will be charged — there are no hidden fees.

Payment is processed securely through PayFast. Vula24 does not store your card details.

For emergency jobs, full payment is required before the locksmith is dispatched to your location. For scheduled jobs, a deposit is required when you accept a quote, with the remainder due on completion.

Refunds are processed within 3 to 5 business days where applicable.

Locksmith earnings are held for a short period after job completion to allow for dispute resolution. Earnings are released to the locksmith wallet within 49 hours of payment confirmation. Withdrawals are processed within 1 to 3 business days after the earnings are released to the wallet.`,
  },
  {
    title: 'Cancellation Policy',
    body: `You may cancel an emergency job while waiting for a locksmith to accept. Once a locksmith has accepted your job and payment has been made, cancellation fees may apply.

For scheduled jobs, cancellations made more than 24 hours before the scheduled time are eligible for a full refund. Cancellations within 24 hours may result in a partial refund at Vula24's discretion.

Locksmiths who repeatedly cancel accepted jobs may be suspended from the platform.`,
  },
  {
    title: 'Contact Us',
    body: `For support, disputes, or account queries contact us at:

Email: support@vula24.com
Website: www.vula24.co.za

We aim to respond to all queries within 24 hours on business days.`,
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
