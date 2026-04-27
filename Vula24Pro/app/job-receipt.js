import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Share, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import api from '../lib/api';

export default function JobReceiptScreen() {
  const { jobId } = useLocalSearchParams();
  const [receipt, setReceipt] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/api/locksmith/jobs/${jobId}/receipt`)
      .then(({ data }) => setReceipt(data.receipt))
      .catch(() => router.back())
      .finally(() => setLoading(false));
  }, [jobId]);

  const shareReceipt = async () => {
    if (!receipt) return;
    const text = `
VULA24 JOB RECEIPT
==================
Ref: ${receipt.id.slice(0, 8).toUpperCase()}
Date: ${new Date(receipt.completedAt).toLocaleDateString('en-ZA')}
Service: ${String(receipt.serviceType).replace(/_/g, ' ')}
Address: ${receipt.customerAddress}
Customer: ${receipt.customer?.name}
==================
Service amount:  R ${receipt.locksithBasePrice?.toFixed(2)}
Platform fee:    R ${receipt.platformFee?.toFixed(2)}
Total charged:   R ${receipt.totalPrice?.toFixed(2)}
Your earnings:   R ${receipt.locksithEarning?.toFixed(2)}
==================
Payment: ${receipt.paymentMethod}
Powered by Vula24
    `.trim();
    await Share.share({ message: text });
  };

  if (loading) return (
    <SafeAreaView style={styles.safe}>
      <ActivityIndicator color={COLORS.accent} size="large" />
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Job Receipt</Text>
        <TouchableOpacity onPress={shareReceipt}>
          <Ionicons name="share-outline" size={24} color={COLORS.accent} />
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.refBadge}>
          <Text style={styles.refText}>
            REF: {receipt?.id?.slice(0, 8).toUpperCase()}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Date</Text>
          <Text style={styles.value}>
            {new Date(receipt?.completedAt).toLocaleDateString('en-ZA')}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Service</Text>
          <Text style={styles.value}>
            {String(receipt?.serviceType).replace(/_/g, ' ')}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Address</Text>
          <Text style={styles.value}>{receipt?.customerAddress}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Customer</Text>
          <Text style={styles.value}>{receipt?.customer?.name}</Text>
        </View>
        {receipt?.teamMember?.name && (
          <View style={styles.row}>
            <Text style={styles.label}>Completed by</Text>
            <Text style={styles.value}>{receipt.teamMember.name}</Text>
          </View>
        )}
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={styles.label}>Service Amount</Text>
          <Text style={styles.value}>
            R {receipt?.locksithBasePrice?.toFixed(2)}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Platform Fee</Text>
          <Text style={[styles.value, { color: '#ff6b6b' }]}>
            - R {receipt?.platformFee?.toFixed(2)}
          </Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={[styles.label, { fontWeight: '700' }]}>Your Earnings</Text>
          <Text style={[styles.value, { color: COLORS.accent, fontWeight: '700', fontSize: 18 }]}>
            R {receipt?.locksithEarning?.toFixed(2)}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Payment Method</Text>
          <Text style={styles.value}>{receipt?.paymentMethod}</Text>
        </View>
        <Text style={styles.footer}>Thank you for using Vula24</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  title: { color: COLORS.text, fontSize: 18, fontWeight: '700' },
  content: { padding: 24 },
  refBadge: {
    backgroundColor: COLORS.accent,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 24,
  },
  refText: { color: '#111', fontWeight: '800', fontSize: 14 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 10,
  },
  label: { color: COLORS.textMuted, fontSize: 14, flex: 1 },
  value: { color: COLORS.text, fontSize: 14, flex: 1, textAlign: 'right' },
  divider: { height: 1, backgroundColor: '#2a2a2a', marginVertical: 8 },
  footer: {
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 32,
    fontSize: 13,
  },
});
