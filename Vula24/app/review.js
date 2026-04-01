import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { FormInput } from '../components/FormInput';
import { GoldButton } from '../components/GoldButton';
import { COLORS } from '../constants/theme';
import api from '../lib/api';

export default function ReviewScreen() {
  const { jobId: jid } = useLocalSearchParams();
  const jobId = Array.isArray(jid) ? jid[0] : jid;

  const [job, setJob] = useState(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!jobId) return;
    (async () => {
      try {
        const { data } = await api.get(`/api/jobs/${jobId}`);
        setJob(data.job);
      } catch (e) {
        Alert.alert('Error', e.response?.data?.error || 'Could not load job.');
      }
    })();
  }, [jobId]);

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

  const photo =
    job?.locksmith?.selfiePhotoUrl || job?.locksmith?.idPhotoUrl || null;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.h1}>How was your experience?</Text>
        <Text style={styles.name}>{job?.locksmith?.name || 'Locksmith'}</Text>
        {photo ? (
          <Image source={{ uri: photo }} style={styles.photo} />
        ) : (
          <View style={styles.ph}>
            <Ionicons name="person" size={48} color={COLORS.accent} />
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
      </ScrollView>
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
  name: { color: COLORS.accent, fontSize: 20, fontWeight: '600', marginBottom: 12 },
  photo: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignSelf: 'center',
    marginBottom: 16,
  },
  ph: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.inputBg,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  label: { color: COLORS.textMuted, marginBottom: 8 },
  stars: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 24,
  },
  starBtn: { marginHorizontal: 4 },
});
