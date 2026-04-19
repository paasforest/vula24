import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Alert,
  Easing,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GoldButton } from '../components/GoldButton';
import { COLORS } from '../constants/theme';
import api from '../lib/api';

export default function WaitingScreen() {
  const { jobId: jid } = useLocalSearchParams();
  const jobId = Array.isArray(jid) ? jid[0] : jid;
  const [loading, setLoading] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.25,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [scale]);

  useEffect(() => {
    if (!jobId) return undefined;
    const id = setInterval(async () => {
      try {
        const { data } = await api.get(`/api/jobs/${jobId}`);
        const status = data.job?.status;
        if (status === 'ACCEPTED') {
          clearInterval(id);
          router.replace({
            pathname: '/payment',
            params: { jobId },
          });
        }
        if (status === 'CANCELLED') {
          clearInterval(id);
          Alert.alert('Cancelled', 'This request was cancelled.');
          router.replace('/(tabs)/home');
        }
        if (status === 'COMPLETED') {
          clearInterval(id);
          router.replace({
            pathname: '/review',
            params: { jobId },
          });
          return;
        }
        if (status === 'DISPATCHED') {
          clearInterval(id);
          router.replace({
            pathname: '/tracking',
            params: { jobId },
          });
          return;
        }
      } catch {
        /* keep polling */
      }
    }, 5000);
    return () => clearInterval(id);
  }, [jobId]);

  const cancel = async () => {
    if (!jobId) return;
    setLoading(true);
    try {
      await api.post(`/api/jobs/${jobId}/cancel`);
      Alert.alert('Cancelled', 'Your request has been cancelled.');
      router.replace('/(tabs)/home');
    } catch (e) {
      Alert.alert(
        'Error',
        e.response?.data?.error || e.message || 'Could not cancel.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.center}>
        <Animated.View style={[styles.circle, { transform: [{ scale }] }]} />
        <Text style={styles.title}>Finding your locksmith...</Text>
        <Text style={styles.sub}>
          We are matching you with the nearest available locksmith
        </Text>
      </View>
      <View style={styles.footer}>
        <GoldButton
          title="Cancel Request"
          onPress={cancel}
          loading={loading}
          variant="outline"
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  circle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.accent,
    opacity: 0.85,
    marginBottom: 32,
  },
  title: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  sub: {
    color: COLORS.textMuted,
    fontSize: 16,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 22,
  },
  footer: { padding: 24 },
});
