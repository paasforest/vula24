import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { GoldButton } from '../components/GoldButton';
import { COLORS } from '../constants/theme';
import api from '../lib/api';

export default function QuotesScreen() {
  const { jobId: jid } = useLocalSearchParams();
  const jobId = Array.isArray(jid) ? jid[0] : jid;

  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [accepting, setAccepting] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!jobId) return;
    try {
      const { data } = await api.get(`/api/jobs/${jobId}/quotes`);
      setQuotes(data.quotes || []);
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'Could not load quotes.');
    }
  }, [jobId]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const accept = async (quoteId) => {
    setAccepting(quoteId);
    try {
      await api.post(`/api/jobs/${jobId}/quote/${quoteId}/accept`);
      Alert.alert('Accepted', 'Your locksmith has been selected.', [
        {
          text: 'OK',
          onPress: () =>
            router.replace({
              pathname: '/tracking',
              params: { jobId },
            }),
        },
      ]);
    } catch (e) {
      Alert.alert(
        'Error',
        e.response?.data?.error || 'Could not accept quote.'
      );
    } finally {
      setAccepting(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <TouchableOpacity style={styles.back} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={22} color={COLORS.accent} />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>
      <Text style={styles.h1}>Quotes for your job</Text>
      <Text style={styles.sub}>
        Compare prices from locksmiths in your area. Pull to refresh.
      </Text>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />
        }
      >
        {quotes.length === 0 ? (
          <Text style={styles.empty}>No quotes yet. Check back soon.</Text>
        ) : (
          quotes.map((q) => (
            <View key={q.id} style={styles.card}>
              <Text style={styles.lockName}>{q.locksmith?.name}</Text>
              <View style={styles.row}>
                <Ionicons name="star" size={16} color={COLORS.accent} />
                <Text style={styles.rating}>
                  {Number(q.locksmith?.rating || 5).toFixed(1)}
                </Text>
              </View>
              {q.message ? (
                <Text style={styles.msg}>{q.message}</Text>
              ) : null}
              <Text style={styles.price}>R {Number(q.price).toFixed(2)}</Text>
              <GoldButton
                title="Accept quote"
                onPress={() => accept(q.id)}
                loading={accepting === q.id}
              />
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg, paddingHorizontal: 16 },
  back: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  backText: { color: COLORS.accent, marginLeft: 8, fontSize: 16 },
  h1: { color: COLORS.text, fontSize: 22, fontWeight: '700', marginTop: 8 },
  sub: { color: COLORS.textMuted, marginBottom: 16, marginTop: 6 },
  empty: { color: COLORS.textMuted, textAlign: 'center', marginTop: 40 },
  card: {
    backgroundColor: COLORS.inputBg,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  lockName: { color: COLORS.text, fontSize: 18, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  rating: { color: COLORS.accent, marginLeft: 6, fontWeight: '600' },
  msg: { color: COLORS.textMuted, marginTop: 10 },
  price: {
    color: COLORS.accent,
    fontSize: 24,
    fontWeight: '800',
    marginVertical: 12,
  },
});
