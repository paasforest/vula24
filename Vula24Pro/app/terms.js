import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../constants/theme';

const SECTIONS = [
  {
    title: 'Independent Contractor Agreement',
    body: `By registering on Vula24 Pro you confirm that you operate as an independent contractor and not as an employee of Vula24.

You are responsible for your own tools, vehicle, insurance, tax obligations, and compliance with all applicable South African laws and regulations.

You agree to only accept jobs you are qualified and able to complete professionally and on time.`,
  },
  {
    title: 'Code of Conduct',
    body: `You must treat all customers with respect and professionalism at all times.

You must arrive within a reasonable time after accepting a job. You must complete the job to a professional standard.

The price agreed before the job starts is final. No additional charges may be added on site without the customer's prior agreement through the app.

Repeated cancellations, poor service ratings, or any form of misconduct may result in suspension or permanent removal from the platform.`,
  },
  {
    title: 'Earnings & Payments',
    body: `When a customer books through Vula24, a service fee is added on top of your quoted price. You receive your full quoted amount — the customer pays your price plus the Vula24 service fee. You are not charged any hidden deductions on your earnings.

Your earnings are held for a short period after job completion to allow for dispute resolution. Once released, your balance reflects in your Vula24 wallet.

You may withdraw your wallet balance to your registered bank account at any time. Withdrawals are processed within 1 to 3 business days.`,
  },
  {
    title: 'Verification & Compliance',
    body: `You must complete your profile including identity verification before you can go online and receive jobs.

Your profile photo and vehicle information must be accurate and up to date at all times. Customers use this information to identify you when you arrive.

Vula24 reserves the right to suspend or remove any locksmith who provides false information, fails verification, or does not meet our service standards.`,
  },
  {
    title: 'Disputes',
    body: `If a customer raises a dispute about a job you completed, your earnings for that job will be held until the matter is resolved by our team.

You may be asked to provide proof of completion such as photos or customer confirmation.

Disputes are resolved by Vula24 based on evidence from both parties. The decision is final.`,
  },
  {
    title: 'Contact & Support',
    body: `For support, payment queries, or account issues:

Email: support@vula24.co.za
WhatsApp: 066 123 5067
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
