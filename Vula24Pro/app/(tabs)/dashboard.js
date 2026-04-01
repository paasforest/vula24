import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  AppState,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/theme';
import api from '../../lib/api';
import { getUser, saveUser } from '../../lib/storage';

const LAST_ONLINE_KEY = 'vula24pro_intent_online';

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export default function DashboardScreen() {
  const [user, setUser] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [wallet, setWallet] = useState(null);
  const [toggleLoading, setToggleLoading] = useState(false);
  const [online, setOnline] = useState(false);
  const pushedJobRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);

  const loadProfile = useCallback(async () => {
    try {
      const { data } = await api.get('/api/locksmith/profile');
      setUser(data.locksmith);
      await saveUser(data.locksmith);
      setOnline(!!data.locksmith.isOnline);
      if (!data.locksmith.isVerified) {
        router.replace('/pending');
      }
    } catch {
      /* ignore */
    }
  }, []);

  const loadJobs = useCallback(async () => {
    try {
      const { data } = await api.get('/api/jobs/locksmith/my-jobs');
      setJobs(data.jobs || []);
    } catch {
      /* ignore */
    }
  }, []);

  const loadWallet = useCallback(async () => {
    try {
      const { data } = await api.get('/api/wallet/my-wallet');
      setWallet(data);
    } catch {
      /* ignore */
    }
  }, []);

  const postLocationIfPossible = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;
    try {
      const loc = await Location.getCurrentPositionAsync({});
      await api.post('/api/locksmith/location/update', {
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
      });
    } catch {
      /* ignore */
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadProfile();
      loadJobs();
      loadWallet();
    }, [loadProfile, loadJobs, loadWallet])
  );

  useEffect(() => {
    let interval;
    const run = async () => {
      const u = await getUser();
      if (!u?.id || !u.isVerified || !u.isOnline) return;
      await loadJobs();
      await loadWallet();
      try {
        const { data } = await api.get('/api/jobs/locksmith/my-jobs');
        const list = data.jobs || [];
        const mine = list.find(
          (j) => j.status === 'PENDING' && j.locksithId === u.id
        );
        if (!mine) return;
        const dismissed = await AsyncStorage.getItem(`dismiss_job_${mine.id}`);
        if (dismissed) return;
        if (pushedJobRef.current === mine.id) return;
        pushedJobRef.current = mine.id;
        router.push({
          pathname: '/job-request',
          params: { jobId: mine.id },
        });
      } catch {
        /* ignore */
      }
    };
    run();
    interval = setInterval(run, 10000);
    return () => clearInterval(interval);
  }, [loadJobs, loadWallet]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', async (next) => {
      if (
        appStateRef.current.match(/active/) &&
        next.match(/inactive|background/)
      ) {
        const wasOnline = online;
        await AsyncStorage.setItem(LAST_ONLINE_KEY, wasOnline ? '1' : '0');
        if (wasOnline) {
          try {
            await api.put('/api/locksmith/toggle-online');
            setOnline(false);
            await loadProfile();
          } catch {
            /* ignore */
          }
        }
      }
      if (appStateRef.current.match(/inactive|background/) && next === 'active') {
        const intent = await AsyncStorage.getItem(LAST_ONLINE_KEY);
        if (intent === '1') {
          try {
            const { data } = await api.get('/api/locksmith/profile');
            if (!data.locksmith.isOnline) {
              await api.put('/api/locksmith/toggle-online');
              await postLocationIfPossible();
            }
            await loadProfile();
          } catch {
            /* ignore */
          }
        }
      }
      appStateRef.current = next;
    });
    return () => sub.remove();
  }, [online, loadProfile]);

  const onToggleOnline = async (value) => {
    setToggleLoading(true);
    try {
      const { data } = await api.get('/api/locksmith/profile');
      const currentlyOn = !!data.locksmith.isOnline;
      if (value !== currentlyOn) {
        await api.put('/api/locksmith/toggle-online');
      }
      if (value) {
        await postLocationIfPossible();
      }
      await loadProfile();
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'Could not update status.');
    } finally {
      setToggleLoading(false);
    }
  };

  const u = user;
  const name = u?.name?.split(' ')[0] || 'there';

  const todayStart = startOfDay(new Date());
  const jobsToday = jobs.filter(
    (j) => j.createdAt && new Date(j.createdAt) >= todayStart
  ).length;

  let earnedToday = 0;
  if (wallet?.transactions) {
    const txs = wallet.transactions.filter((t) => {
      if (t.type !== 'CREDIT') return false;
      const d = new Date(t.createdAt);
      return d >= todayStart;
    });
    earnedToday = txs.reduce((s, t) => s + (t.amount || 0), 0);
  }

  const activeJob = jobs.find((j) =>
    ['ACCEPTED', 'ARRIVED', 'IN_PROGRESS'].includes(j.status)
  );

  const recent = jobs.slice(0, 5);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.greet}>Hi {name}</Text>

        <View style={styles.onlineRow}>
          <View style={styles.onlineTextCol}>
            <Text style={styles.onlineLabel}>Availability</Text>
            <Text style={[styles.onlineStatus, { color: online ? COLORS.success : COLORS.textMuted }]}>
              {online ? 'You are receiving jobs' : 'You are not receiving jobs'}
            </Text>
          </View>
          <Switch
            value={online}
            onValueChange={onToggleOnline}
            disabled={toggleLoading}
            trackColor={{ false: '#444', true: '#2d4a2d' }}
            thumbColor={online ? COLORS.accent : '#888'}
          />
        </View>
        <View style={styles.dotRow}>
          <View style={[styles.dot, { backgroundColor: online ? COLORS.success : '#666' }]} />
          <Text style={styles.dotLabel}>{online ? 'Online' : 'Offline'}</Text>
        </View>

        {activeJob ? (
          <TouchableOpacity
            style={styles.activeBanner}
            onPress={() =>
              router.push({
                pathname: '/active-job',
                params: { jobId: activeJob.id },
              })
            }
          >
            <Text style={styles.activeBannerText}>Active Job — tap to view</Text>
            <Ionicons name="chevron-forward" size={20} color={COLORS.bg} />
          </TouchableOpacity>
        ) : null}

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statNum}>{jobsToday}</Text>
            <Text style={styles.statLabel}>Jobs today</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statNum}>R {earnedToday.toFixed(0)}</Text>
            <Text style={styles.statLabel}>Earned today</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statNum}>{Number(u?.rating ?? 5).toFixed(1)}</Text>
            <Text style={styles.statLabel}>Rating</Text>
          </View>
        </View>

        <Text style={styles.section}>Recent jobs</Text>
        {recent.length === 0 ? (
          <Text style={styles.empty}>No jobs yet. Go online to receive requests.</Text>
        ) : (
          recent.map((j) => (
            <View key={j.id} style={styles.jobRow}>
              <Text style={styles.jobService}>{j.serviceType?.replace(/_/g, ' ')}</Text>
              <Text style={styles.jobStatus}>{j.status}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { padding: 20, paddingBottom: 32 },
  greet: { color: COLORS.text, fontSize: 24, fontWeight: '800', marginBottom: 20 },
  onlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  onlineTextCol: { flex: 1 },
  onlineLabel: { color: COLORS.textMuted, fontSize: 16 },
  onlineStatus: { fontSize: 15, marginTop: 4, fontWeight: '600' },
  dotRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  dotLabel: { color: COLORS.textMuted, fontSize: 14 },
  activeBanner: {
    backgroundColor: COLORS.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 14,
    marginBottom: 20,
  },
  activeBannerText: { color: COLORS.bg, fontWeight: '800', fontSize: 16 },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  stat: { alignItems: 'center', flex: 1 },
  statNum: { color: COLORS.accent, fontSize: 22, fontWeight: '800' },
  statLabel: { color: COLORS.textMuted, fontSize: 12, marginTop: 4 },
  section: { color: COLORS.text, fontSize: 17, fontWeight: '700', marginBottom: 12 },
  empty: { color: COLORS.textMuted, fontSize: 15 },
  jobRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  jobService: { color: COLORS.text, fontSize: 15, fontWeight: '600' },
  jobStatus: { color: COLORS.textMuted, fontSize: 14 },
});
