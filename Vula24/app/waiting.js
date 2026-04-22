import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Alert,
  Easing,
  Linking,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GoldButton } from '../components/GoldButton';
import { COLORS } from '../constants/theme';
import api from '../lib/api';

const POLL_MS = 5000;
const MAX_POLLS = 36; // 36 × 5s = 3 minutes
const MAX_CONSECUTIVE_ERRORS = 3;
const REASSURE_AFTER_MS = 60000;

export default function WaitingScreen() {
  const { jobId: jid } = useLocalSearchParams();
  const jobId = Array.isArray(jid) ? jid[0] : jid;
  const [loading, setLoading] = useState(false);
  const [showReassurance, setShowReassurance] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  const pollAttemptRef = useRef(0);
  const consecutiveErrorsRef = useRef(0);
  const stoppedRef = useRef(false);

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
    pollAttemptRef.current = 0;
    consecutiveErrorsRef.current = 0;
    stoppedRef.current = false;
    setShowReassurance(false);

    const reassureTimer = setTimeout(
      () => setShowReassurance(true),
      REASSURE_AFTER_MS
    );

    const goHome = () => router.replace('/(tabs)/home');

    const id = setInterval(async () => {
      if (stoppedRef.current) return;

      pollAttemptRef.current += 1;

      try {
        const { data } = await api.get(`/api/jobs/${jobId}`);
        consecutiveErrorsRef.current = 0;

        const status = data.job?.status;
        if (status === 'ACCEPTED') {
          stoppedRef.current = true;
          clearInterval(id);
          router.replace({
            pathname: '/payment',
            params: { jobId },
          });
          return;
        }
        if (status === 'CANCELLED') {
          stoppedRef.current = true;
          clearInterval(id);
          Alert.alert('Cancelled', 'This request was cancelled.');
          goHome();
          return;
        }
        if (status === 'COMPLETED') {
          stoppedRef.current = true;
          clearInterval(id);
          router.replace({
            pathname: '/review',
            params: { jobId },
          });
          return;
        }
        if (status === 'DISPATCHED') {
          stoppedRef.current = true;
          clearInterval(id);
          router.replace({
            pathname: '/tracking',
            params: { jobId },
          });
          return;
        }
      } catch {
        consecutiveErrorsRef.current += 1;
        if (consecutiveErrorsRef.current >= MAX_CONSECUTIVE_ERRORS) {
          stoppedRef.current = true;
          clearInterval(id);
          Alert.alert(
            'Connection Error',
            'Lost connection while searching. Please try again.',
            [{ text: 'OK', onPress: goHome }]
          );
          return;
        }
      }

      if (
        !stoppedRef.current &&
        pollAttemptRef.current >= MAX_POLLS
      ) {
        stoppedRef.current = true;
        clearInterval(id);
        Alert.alert(
          'No locksmith available',
          'We could not find an available locksmith in your area right now. Please try again or contact us directly.',
          [
            {
              text: 'Call us',
              onPress: () => {
                Linking.openURL('tel:+27661235067');
                goHome();
              },
            },
            {
              text: 'WhatsApp us',
              onPress: () => {
                Linking.openURL('https://wa.me/27661235067');
                goHome();
              },
            },
            {
              text: 'Try again',
              style: 'cancel',
              onPress: goHome,
            },
          ]
        );
      }
    }, POLL_MS);

    return () => {
      clearInterval(id);
      clearTimeout(reassureTimer);
    };
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
        {showReassurance ? (
          <Text style={styles.reassurance}>Still searching…</Text>
        ) : null}
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
  reassurance: {
    color: COLORS.textMuted,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 20,
    fontStyle: 'italic',
    opacity: 0.9,
  },
  footer: { padding: 24 },
});
