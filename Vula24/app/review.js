import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { FormInput } from '../components/FormInput';
import { GoldButton } from '../components/GoldButton';
import { COLORS } from '../constants/theme';
import api from '../lib/api';

function initialsFromName(name) {
  if (!name?.trim()) return '?';
  const p = name.trim().split(/\s+/);
  if (p.length >= 2) return (p[0][0] + p[1][0]).toUpperCase();
  return name.trim().slice(0, 2).toUpperCase();
}

export default function ReviewScreen() {
  const { jobId: jid } = useLocalSearchParams();
  const jobId = Array.isArray(jid) ? jid[0] : jid;

  const [job, setJob] = useState(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [disputeModal, setDisputeModal] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeLoading, setDisputeLoading] = useState(false);

  const loadJob = useCallback(async () => {
    if (!jobId) return;
    try {
      const { data } = await api.get(`/api/jobs/${jobId}`);
      setJob(data.job);
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'Could not load job.');
    }
  }, [jobId]);

  useEffect(() => {
    loadJob();
  }, [loadJob]);

  const canRaiseDispute =
    job?.status === 'COMPLETED' &&
    job?.completedAt &&
    !job?.isDisputed &&
    (Date.now() - new Date(job.completedAt).getTime()) / (1000 * 60 * 60) <= 24;

  const submit = async () => {
    if (!jobId) return;
    setLoading(true);
    try {
      await api.post('/api/reviews', {
        jobId,
        rating,
        comment: comment.trim() || undefined,
      });
      Alert.alert('Thank you', 'Your review has been submitted.', [
        {
          text: 'OK',
          onPress: () => router.replace('/(tabs)/home'),
        },
      ]);
    } catch (e) {
      Alert.alert(
        'Error',
        e.response?.data?.error || e.message || 'Could not submit review.'
      );
    } finally {
      setLoading(false);
    }
  };

  const submitDispute = async () => {
    const reason = disputeReason.trim();
    if (!reason) {
      Alert.alert('Reason', 'Please describe the issue.');
      return;
    }
    if (!jobId) return;
    setDisputeLoading(true);
    try {
      await api.post(`/api/jobs/${jobId}/dispute`, { reason });
      setDisputeModal(false);
      setDisputeReason('');
      await loadJob();
      Alert.alert(
        'Dispute raised',
        'Our team will review within 24 hours.'
      );
    } catch (e) {
      Alert.alert(
        'Error',
        e.response?.data?.error || 'Could not raise dispute.'
      );
    } finally {
      setDisputeLoading(false);
    }
  };

  const lock = job?.locksmith;
  const photoUri =
    lock?.profilePhoto?.trim() ||
    lock?.selfiePhotoUrl ||
    lock?.idPhotoUrl ||
    null;
  const vt = lock?.vehicleType?.trim();
  const vc = lock?.vehicleColor?.trim();
  const vehicleLine =
    vt || vc ? [vc, vt].filter(Boolean).join(' ') : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.h1}>How was your experience?</Text>
        <Text style={styles.name}>{lock?.name || 'Locksmith'}</Text>
        {vehicleLine ? (
          <Text style={styles.vehicleMeta}>{vehicleLine}</Text>
        ) : null}
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={styles.photo} />
        ) : (
          <View style={styles.avatarInitials}>
            <Text style={styles.avatarInitialsText}>
              {initialsFromName(lock?.name)}
            </Text>
          </View>
        )}
        <Text style={styles.label}>Your rating</Text>
        <View style={styles.stars}>
          {[1, 2, 3, 4, 5].map((n) => (
            <TouchableOpacity key={n} onPress={() => setRating(n)}>
              <Ionicons
                name={n <= rating ? 'star' : 'star-outline'}
                size={40}
                color={COLORS.accent}
                style={styles.starBtn}
              />
            </TouchableOpacity>
          ))}
        </View>
        <FormInput
          label="Leave a comment (optional)"
          value={comment}
          onChangeText={setComment}
          placeholder="Tell others about your experience"
          multiline
          numberOfLines={4}
        />
        <GoldButton title="Submit Review" onPress={submit} loading={loading} />

        {canRaiseDispute ? (
          <TouchableOpacity
            style={styles.disputeBtn}
            onPress={() => setDisputeModal(true)}
            activeOpacity={0.85}
          >
            <Text style={styles.disputeBtnText}>Raise a dispute</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>

      <Modal visible={disputeModal} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Raise a dispute</Text>
            <Text style={styles.modalHint}>
              Describe what went wrong. You can only dispute within 24 hours of completion.
            </Text>
            <TextInput
              style={styles.modalInput}
              value={disputeReason}
              onChangeText={setDisputeReason}
              placeholder="Reason"
              placeholderTextColor="#666"
              multiline
              numberOfLines={4}
            />
            <GoldButton
              title={disputeLoading ? 'Sending…' : 'Submit dispute'}
              onPress={submitDispute}
              loading={disputeLoading}
            />
            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => {
                setDisputeModal(false);
                setDisputeReason('');
              }}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { padding: 20, paddingBottom: 40 },
  h1: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 16,
  },
  name: { color: COLORS.accent, fontSize: 20, fontWeight: '600', marginBottom: 4 },
  vehicleMeta: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginBottom: 12,
  },
  photo: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignSelf: 'center',
    marginBottom: 16,
  },
  avatarInitials: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.accent,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  avatarInitialsText: {
    color: COLORS.bg,
    fontSize: 32,
    fontWeight: '800',
  },
  label: { color: COLORS.textMuted, marginBottom: 8 },
  stars: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 24,
  },
  starBtn: { marginHorizontal: 4 },
  disputeBtn: {
    marginTop: 20,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  disputeBtnText: {
    color: COLORS.accent,
    fontSize: 16,
    fontWeight: '600',
  },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: COLORS.bg,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  modalTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  modalHint: {
    color: COLORS.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  modalInput: {
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 12,
    padding: 14,
    color: COLORS.text,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  modalCancel: { marginTop: 12, alignItems: 'center' },
  modalCancelText: { color: COLORS.accent, fontSize: 16 },
});
