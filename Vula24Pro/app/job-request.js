import { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { GoldButton } from '../components/GoldButton';
import { COLORS } from '../constants/theme';
import api from '../lib/api';

function distKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function JobRequestScreen() {
  const { jobId: jid } = useLocalSearchParams();
  const jobId = Array.isArray(jid) ? jid[0] : jid;

  const [job, setJob] = useState(null);
  const [seconds, setSeconds] = useState(15);
  const [loading, setLoading] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  const timerDone = useRef(false);

  const load = useCallback(async () => {
    if (!jobId) return;
    try {
      const { data } = await api.get(`/api/jobs/locksmith/job/${jobId}`);
      let j = data.job;
      try {
        const loc = await Location.getCurrentPositionAsync({});
        const km = distKm(
          loc.coords.latitude,
          loc.coords.longitude,
          j.customerLat,
          j.customerLng
        );
        j = { ...j, _km: km };
      } catch {
        j = { ...j, _km: null };
      }
      setJob(j);
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'Could not load job.');
      router.back();
    }
  }, [jobId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.15,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [scale]);

  useEffect(() => {
    if (!jobId || !job) return undefined;
    if (seconds <= 0) {
      if (!timerDone.current) {
        timerDone.current = true;
        (async () => {
          await AsyncStorage.setItem(`dismiss_job_${jobId}`, '1');
          router.back();
        })();
      }
      return undefined;
    }
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds, job, jobId]);

  const decline = async () => {
    await AsyncStorage.setItem(`dismiss_job_${jobId}`, '1');
    router.back();
  };

  const accept = async () => {
    if (!jobId) return;
    setLoading(true);
    try {
      await api.post(`/api/jobs/${jobId}/accept`);
      router.replace({
        pathname: '/active-job',
        params: { jobId },
      });
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'Could not accept job.');
    } finally {
      setLoading(false);
    }
  };

  const service = job?.serviceType?.replace(/_/g, ' ') || 'Job request';
  const earn = job?.locksithEarning != null ? Number(job.locksithEarning).toFixed(0) : '—';
  const kmAway =
    job?._km != null ? `${Math.max(0.1, job._km).toFixed(1)} km away` : 'Distance…';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <Animated.View style={[styles.pulse, { transform: [{ scale }] }]} />
      <Text style={styles.notif}>New job request</Text>
      <View style={styles.card}>
        <Text style={styles.service}>{service}</Text>
        <Text style={styles.dist}>{kmAway}</Text>
        <Text style={styles.addr}>{job?.customerAddress || ''}</Text>
        {job?.customerNote ? (
          <Text style={styles.note}>Note: {job.customerNote}</Text>
        ) : null}
        <Text style={styles.earnLabel}>You will earn</Text>
        <Text style={styles.earn}>R {earn}</Text>
      </View>

      <View style={styles.timerWrap}>
        <Text style={styles.timer}>{seconds}</Text>
        <Text style={styles.timerLabel}>seconds to respond</Text>
      </View>

      <View style={{ flex: 1 }} />
      <View style={styles.footer}>
        <GoldButton title="ACCEPT" onPress={accept} loading={loading} />
        <View style={{ height: 12 }} />
        <GoldButton title="Decline" variant="outline" onPress={decline} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg, padding: 20, justifyContent: 'flex-start' },
  pulse: {
    alignSelf: 'center',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.accent,
    opacity: 0.9,
    marginBottom: 16,
  },
  notif: {
    color: COLORS.accent,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 20,
  },
  card: {
    backgroundColor: COLORS.inputBg,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  service: { color: COLORS.text, fontSize: 22, fontWeight: '800' },
  dist: { color: COLORS.accent, marginTop: 8, fontSize: 16, fontWeight: '700' },
  addr: { color: COLORS.textMuted, marginTop: 12, fontSize: 15, lineHeight: 22 },
  note: { color: COLORS.text, marginTop: 12, fontSize: 15 },
  earnLabel: { color: COLORS.textMuted, marginTop: 20, fontSize: 14 },
  earn: { color: COLORS.accent, fontSize: 36, fontWeight: '900', marginTop: 4 },
  timerWrap: { alignItems: 'center', marginVertical: 28 },
  timer: { color: COLORS.accent, fontSize: 48, fontWeight: '900' },
  timerLabel: { color: COLORS.textMuted, marginTop: 4 },
  footer: { paddingBottom: 8 },
});
