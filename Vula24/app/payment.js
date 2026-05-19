import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { GoldButton } from '../components/GoldButton';
import { PayFastWebView } from '../components/PayFastWebView';
import { COLORS } from '../constants/theme';
import api from '../lib/api';

export default function PaymentScreen() {
  const { jobId: jid } = useLocalSearchParams();
  const jobId = Array.isArray(jid) ? jid[0] : jid;

  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(false);
  const [payUrl, setPayUrl] = useState(null);
  const [payFields, setPayFields] = useState(null);
  const [webViewVisible, setWebViewVisible] = useState(false);
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
      const j = await load();
      if (j?.mode === 'EMERGENCY') {
        await api.post(`/api/jobs/${jobId}/dispatch`);
      }
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

  const startPayment = async () => {
    setLoading(true);
    try {
      const { data } = await api.post('/api/payments/deposit', { jobId });
      setPayUrl(data.payUrl);
      setPayFields(data.fields);
      setWebViewVisible(true);
    } catch (e) {
      Alert.alert(
        'Error',
        e.response?.data?.error || 'Could not initiate payment.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentReturn = async (url) => {
    setWebViewVisible(false);
    if (
      url.includes('status=deposit') ||
      url.includes('status=complete')
    ) {
      try {
        if (job?.mode === 'EMERGENCY') {
          await api.post(`/api/jobs/${jobId}/dispatch`);
        }
        router.replace({
          pathname: '/tracking',
          params: { jobId },
        });
      } catch (e) {
        Alert.alert(
          'Error',
          'Payment received but could not dispatch. Please contact support.'
        );
      }
    } else {
      Alert.alert(
        'Payment cancelled',
        'Your payment was cancelled. Please try again.'
      );
    }
  };

  const serviceLabel = job?.serviceType?.replace(/_/g, ' ') || '—';
  const paid = job?.depositPaid && job?.finalPaid;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.h1}>Payment</Text>
        <Text style={styles.subtitle}>
          Complete your secure payment via PayFast to confirm your booking.
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
            <Text style={styles.stepText}>Complete payment</Text>
          </View>
          {!paid ? (
            <>
              <GoldButton
                title="Pay Now"
                onPress={startPayment}
                loading={loading}
              />
              {__DEV__ && (
                <TouchableOpacity
                  onPress={simulateAndContinue}
                  style={{ marginTop: 12, alignItems: 'center' }}
                >
                  <Text style={{ color: COLORS.textMuted, fontSize: 12 }}>
                    [DEV] Simulate payment
                  </Text>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <Text style={styles.paid}>Payment received — thank you</Text>
          )}
        </View>
      </ScrollView>
      <PayFastWebView
        visible={webViewVisible}
        payUrl={payUrl}
        fields={payFields}
        onClose={() => setWebViewVisible(false)}
        onReturnUrl={handlePaymentReturn}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
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
