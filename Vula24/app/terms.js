import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';

const SECTIONS = [
  {
    title: 'Service Agreement',
    body: `Vula24 is a platform that connects customers with independent locksmith professionals. By using this app you agree to use it only for lawful purposes.

You must provide accurate location and contact information when making a booking. False bookings or abusive behaviour toward service providers may result in account suspension.

Vula24 does not employ locksmiths directly. All locksmiths on the platform are independent professionals who have been verified before being listed.`,
  },
  {
    title: 'Privacy Policy',
    body: `We collect your name, phone number, email address, and location to provide our service. Your location is used to find nearby locksmiths and track job progress.

We do not sell your personal information to third parties. Your data is stored securely and used only to operate the Vula24 platform.

You may request deletion of your account and data by contacting us at support@vula24.co.za.`,
  },
  {
    title: 'Payments',
    body: `The price shown before you confirm your booking is the total amount you will be charged. There are no hidden fees or surprise charges.

Payment is processed securely through PayFast. Vula24 does not store your card details.

For emergency bookings, full payment is required before the locksmith is dispatched to your location.

For scheduled services, a deposit is required when you accept a quote. The remaining balance is due on completion of the job.`,
  },
  {
    title: 'Cancellations & Refunds',
    body: `You may cancel an emergency booking while waiting for a locksmith to accept your request at no charge.

Once a locksmith has accepted your booking and payment has been made, cancellation fees may apply depending on the circumstances.

For scheduled bookings, cancellations made more than 24 hours before the scheduled time are eligible for a full refund. Cancellations within 24 hours may result in a partial refund at Vula24s discretion.

Refunds are processed within 3 to 5 business days.`,
  },
  {
    title: 'Disputes',
    body: `If you are unhappy with the service received, you may raise a dispute within 24 hours of job completion through the app.

Disputes are reviewed by our team and resolved fairly based on information provided by both parties.

For support contact us at support@vula24.co.za or WhatsApp 066 123 5067.`,
  },
  {
    title: 'Contact Us',
    body: `For any queries, support, or concerns:

Email: support@vula24.co.za
WhatsApp: 066 123 5067
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
