import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
  Alert,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { FormInput } from '../components/FormInput';
import { GoldButton } from '../components/GoldButton';
import { COLORS } from '../constants/theme';
import api from '../lib/api';

export default function ScheduledQuotesScreen() {
  const [jobs, setJobs] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [modalJob, setModalJob] = useState(null);
  const [price, setPrice] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/api/jobs/locksmith/scheduled-open');
      setJobs(data.jobs || []);
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'Could not load opportunities.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const submitQuote = async () => {
    if (!modalJob) return;
    const p = parseFloat(String(price).replace(',', '.'));
    if (Number.isNaN(p) || p <= 0) {
      Alert.alert('Price', 'Enter a valid price.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/api/jobs/${modalJob.id}/quote/submit`, {
        price: p,
        message: message.trim() || undefined,
      });
      Alert.alert('Sent', 'Your quote was submitted.');
      setModalJob(null);
      setPrice('');
      setMessage('');
      await load();
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'Could not submit quote.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <TouchableOpacity style={styles.back} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={22} color={COLORS.accent} />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>
      <Text style={styles.h1}>Scheduled job quotes</Text>
      <Text style={styles.sub}>Jobs in your area awaiting a quote.</Text>

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />
        }
        contentContainerStyle={styles.scroll}
      >
        {jobs.length === 0 ? (
          <Text style={styles.empty}>No open scheduled requests right now.</Text>
        ) : (
          jobs.map((j) => (
            <View key={j.id} style={styles.card}>
              <Text style={styles.svc}>{j.serviceType?.replace(/_/g, ' ')}</Text>
              <Text style={styles.addr}>{j.customerAddress}</Text>
              {j.scheduledDate ? (
                <Text style={styles.dt}>
                  Requested: {new Date(j.scheduledDate).toLocaleString()}
                </Text>
              ) : null}
              {j.jobPhotoUrl ? (
                <Image source={{ uri: j.jobPhotoUrl }} style={styles.img} />
              ) : null}
              {j.customerNote ? (
                <Text style={styles.note}>{j.customerNote}</Text>
              ) : null}
              <GoldButton title="Submit Quote" onPress={() => setModalJob(j)} />
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={!!modalJob} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalKav}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        >
          <View style={styles.modalBg}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.modalScroll}
            >
              <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>Your quote</Text>
                <FormInput label="Price (R)" value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
                <FormInput
                  label="Message (optional)"
                  value={message}
                  onChangeText={setMessage}
                  multiline
                  numberOfLines={3}
                />
                <GoldButton title="Submit" onPress={submitQuote} loading={submitting} />
                <TouchableOpacity onPress={() => setModalJob(null)}>
                  <Text style={styles.cancel}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  back: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 8 },
  backText: { color: COLORS.accent, marginLeft: 8, fontSize: 16 },
  h1: { color: COLORS.text, fontSize: 22, fontWeight: '800', paddingHorizontal: 20 },
  sub: { color: COLORS.textMuted, paddingHorizontal: 20, marginBottom: 12 },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  empty: { color: COLORS.textMuted, textAlign: 'center', marginTop: 40 },
  card: {
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    backgroundColor: COLORS.inputBg,
  },
  svc: { color: COLORS.text, fontSize: 18, fontWeight: '700' },
  addr: { color: COLORS.textMuted, marginTop: 8, fontSize: 15 },
  dt: { color: COLORS.accent, marginTop: 8, fontSize: 14 },
  img: { width: '100%', height: 140, borderRadius: 12, marginTop: 12 },
  note: { color: COLORS.textMuted, marginTop: 8, marginBottom: 12 },
  modalKav: { flex: 1 },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  modalScroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  modalCard: {
    backgroundColor: COLORS.bg,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  modalTitle: { color: COLORS.text, fontSize: 20, fontWeight: '700', marginBottom: 12 },
  cancel: { color: COLORS.accent, textAlign: 'center', marginTop: 16, fontSize: 16 },
});
