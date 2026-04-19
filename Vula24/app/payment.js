import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { GoldButton } from '../components/GoldButton';
import { COLORS } from '../constants/theme';
import api from '../lib/api';

export default function PaymentScreen() {
  const { jobId: jid } = useLocalSearchParams();
  const jobId = Array.isArray(jid) ? jid[0] : jid;

  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(false);
  const sentToReviewRef = useRef(false);

  const load = useCallback(async () => {
    if (!jobId) return null;
    try {
      const { data } = await api.get(`/api/jobs/${jobId}`);
      setJob(data.job);
      return data.job;
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'Could not load job.');
      return null;
    }
  }, [jobId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!jobId || !job?.finalPaid || sentToReviewRef.current) return;
    if (job.status !== 'COMPLETED') return;
    sentToReviewRef.current = true;
    router.replace({ pathname: '/review', params: { jobId } });
  }, [jobId, job?.finalPaid, job?.status]);

  const simulateAndContinue = async () => {
    setLoading(true);
    try {
      await api.post('/api/payments/simulate', { jobId });
      await api.post(`/api/jobs/${jobId}/dispatch`);
      router.replace({ pathname: '/tracking', params: { jobId } });
    } catch (e) {
      Alert.alert(
        'Error',
        e.response?.data?.error || 'Payment simulation or dispatch failed.'
      );
    } finally {
      setLoading(false);
    }
  };

  const serviceLabel = job?.serviceType?.replace(/_/g, ' ') || '—';
  const paid = job?.depositPaid && job?.finalPaid;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.testBanner}>
        <Text style={styles.testBannerText}>
          TEST MODE — PayFast not configured
        </Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.h1}>Payment</Text>
        <Text style={styles.subtitle}>
          Development only: simulate a successful payment without PayFast. After
          simulate, the job is dispatched and you go to tracking.
        </Text>

        <View style={styles.card}>
          <Text style={styles.label}>Service</Text>
          <Text style={styles.value}>{serviceLabel}</Text>
          <Text style={[styles.label, styles.mt]}>Locksmith</Text>
          <Text style={styles.value}>{job?.locksmith?.name || '—'}</Text>
          <Text style={styles.totalLabel}>Total due</Text>
          <Text style={styles.total}>
            R {job?.totalPrice != null ? Number(job.totalPrice).toFixed(2) : '0.00'}
          </Text>
        </View>

        <View style={styles.step}>
          <View style={styles.stepRow}>
            {paid ? (
              <Ionicons name="checkmark-circle" size={28} color={COLORS.success} />
            ) : (
              <View style={styles.stepDot} />
            )}
            <Text style={styles.stepText}>Simulate payment (test mode)</Text>
          </View>
          {!paid ? (
            <GoldButton
              title="Simulate Payment (Test Mode)"
              onPress={simulateAndContinue}
              loading={loading}
            />
          ) : (
            <Text style={styles.paid}>Payment received — thank you</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  testBanner: {
    backgroundColor: '#8B0000',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  testBannerText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  scroll: { padding: 20, paddingBottom: 40 },
  h1: { color: COLORS.text, fontSize: 24, fontWeight: '700', marginBottom: 10 },
  subtitle: {
    color: COLORS.textMuted,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
  },
  card: {
    backgroundColor: COLORS.inputBg,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    marginBottom: 24,
  },
  label: { color: COLORS.textMuted, fontSize: 13 },
  mt: { marginTop: 12 },
  value: { color: COLORS.text, fontSize: 17, fontWeight: '600' },
  totalLabel: { color: COLORS.textMuted, marginTop: 16 },
  total: {
    color: COLORS.accent,
    fontSize: 32,
    fontWeight: '800',
    marginTop: 4,
  },
  step: { marginBottom: 24 },
  stepRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  stepDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#444',
    marginRight: 10,
  },
  stepText: { color: COLORS.text, fontSize: 16, fontWeight: '600', flex: 1 },
  paid: { color: COLORS.success, marginTop: 8 },
});
