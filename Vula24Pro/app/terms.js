import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../constants/theme';

const SECTIONS = [
  {
    title: 'Locksmith Agreement',
    body: `By registering on Vula24 Pro, you agree to operate as an independent contractor. You are not an employee of Vula24. You are responsible for your own tools, vehicle, insurance, and compliance with South African law.

You agree to only accept jobs you can complete professionally and timeously. Repeated cancellations, poor service, or fraudulent behaviour will result in suspension or permanent removal from the platform.`,
  },
  {
    title: 'Earnings & Fees',
    body: `Vula24 charges a service fee on each completed job. This fee is deducted from the customer payment before your earnings are credited to your wallet.

Your earnings are held briefly after job completion before being released to your wallet. This protects customers against disputes. For emergency jobs the hold period is 49 hours. For scheduled jobs the deposit is released immediately and the final payment after a short hold.

You can withdraw your wallet balance to your registered bank account at any time, subject to minimum withdrawal amounts.

Your earnings will reflect in your Vula24 wallet within 49 hours of customer payment confirmation. This holding period exists to protect customers and maintain platform integrity. Once released to your wallet, you may withdraw at any time. Withdrawals are processed within 1 to 3 business days.`,
  },
  {
    title: 'Verification & Compliance',
    body: `All locksmiths must be verified by Vula24 before going online. Verification includes identity verification and review of your documents.

You must maintain accurate vehicle and profile information at all times. Customers use your profile photo and vehicle details to identify you on arrival.

Vula24 reserves the right to suspend or remove any locksmith who provides false information or fails to meet our service standards.`,
  },
  {
    title: 'Disputes',
    body: `If a customer raises a dispute about your job, your payout will be held until the dispute is resolved by Vula24 admin. You may be asked to submit proof of completion.

Disputes are resolved at Vula24's discretion based on evidence provided by both parties. The decision is final.`,
  },
  {
    title: 'Contact',
    body: `For support or queries contact us at:

Email: support@vula24.com
Website: www.vula24.co.za`,
  },
];

export default function TermsScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <TouchableOpacity style={styles.back} onPress={() => router.back()}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>
      <Text style={styles.h1}>Terms & Privacy</Text>
      <ScrollView contentContainerStyle={styles.scroll}>
        {SECTIONS.map((s) => (
          <View key={s.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{s.title}</Text>
            <Text style={styles.sectionBody}>{s.body}</Text>
          </View>
        ))}
      </ScrollView>
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
  scroll: { padding: 20, paddingBottom: 40 },
  section: { marginBottom: 28 },
  sectionTitle: {
    color: COLORS.accent,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  sectionBody: {
    color: COLORS.textMuted,
    fontSize: 14,
    lineHeight: 22,
  },
});
