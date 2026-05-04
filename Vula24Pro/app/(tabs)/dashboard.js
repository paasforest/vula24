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
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { COLORS } from '../../constants/theme';
import api from '../../lib/api';
import { getUser, saveUser } from '../../lib/storage';

async function registerPushToken(isMember = false) {
  try {
    console.log('[push] start, isMember:', isMember);
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.warn('[push] permission denied');
      return;
    }
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    console.log('[push] projectId:', projectId);
    const token = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    console.log('[push] token received:', token?.data?.substring(0, 30));
    if (token?.data) {
      const endpoint = isMember
        ? '/api/member/push-token'
        : '/api/locksmith/push-token';
      console.log('[push] sending to:', endpoint);
      await api.put(endpoint, {
        pushToken: token.data,
      });
      console.log('[push] saved successfully');
    }
  } catch (e) {
    console.warn('[push] failed:', e?.message || e);
  }
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export default function DashboardScreen() {
  const [user, setUser] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [wallet, setWallet] = useState(null);
  const [hasScheduledJobs, setHasScheduledJobs] = useState(false);
  const [toggleLoading, setToggleLoading] = useState(false);
  const [online, setOnline] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const pushedJobRef = useRef(null);
  const pushRegisteredRef = useRef(false);
  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    getUser().then((u) => setIsMember(u?.isMember === true));
  }, []);

  const loadProfile = useCallback(async () => {
    const stored = await getUser();
    const memberFlag = stored?.isMember === true;

    if (memberFlag) {
      setUser(stored);
      setIsMember(true);
      try {
        const { data } = await api.get('/api/member/profile');
        setOnline(data.member?.isOnline || false);
      } catch (e) {
        console.warn(
          '[loadProfile] member profile failed:',
          e?.response?.status,
          e?.response?.data
        );
      }
      return;
    }

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
  }, [isMember]);

  const loadJobs = useCallback(async () => {
    if (isMember) {
      try {
        const { data } = await api.get('/api/member/jobs/available');
        setJobs(data.jobs || []);
      } catch { /* ignore */ }
      return;
    }
    try {
      const { data } = await api.get('/api/jobs/locksmith/my-jobs');
      setJobs(data.jobs || []);
    } catch {
      /* ignore */
    }
  }, [isMember]);

  const loadWallet = useCallback(async () => {
    if (isMember) return;
    try {
      const { data } = await api.get('/api/wallet/my-wallet');
      setWallet(data);
    } catch {
      /* ignore */
    }
  }, [isMember]);

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

  useEffect(() => {
    if (!online) return;
    const interval = setInterval(postLocationIfPossible, 30000);
    return () => clearInterval(interval);
  }, [online]);

  useEffect(() => {
    if (!isMember || !online) return;
    const interval = setInterval(async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const loc = await Location.getCurrentPositionAsync({});
        await api.post('/api/member/location/update', {
          lat: loc.coords.latitude,
          lng: loc.coords.longitude,
        });
      } catch { /* ignore */ }
    }, 30000);
    return () => clearInterval(interval);
  }, [isMember, online]);

  useEffect(() => {
    if (pushRegisteredRef.current) return;

    const tryRegister = async () => {
      const stored = await getUser();
      if (!stored) return;

      pushRegisteredRef.current = true;
      const memberFlag = stored?.isMember === true;
      await registerPushToken(memberFlag);
    };

    tryRegister();
  }, []);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data;
        if (data?.screen === 'scheduled-quotes') {
          router.push('/scheduled-quotes');
          return;
        }
        const jobId = data?.jobId;
        if (jobId) {
          router.push({
            pathname: '/job-request',
            params: { jobId: String(jobId) },
          });
        }
      }
    );
    return () => sub.remove();
  }, []);

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
      if (!u?.id) return;

      if (isMember) {
        // Member polling
        if (!u.isOnline) return;
        await loadJobs();

        try {
          const { data } = await api.get(
            '/api/member/jobs/available'
          );
          const list = data.jobs || [];
          // For members find jobs assigned
          // to them OR to their business
          // with no member assigned yet
          const mine = list.find(
            (j) =>
              j.status === 'PENDING' &&
              (j.teamMemberId === u.id ||
                (j.teamMemberId === null &&
                  j.locksithId === u.businessId))
          );
          if (!mine) return;
          const dismissed = await AsyncStorage.getItem(
            `dismiss_job_${mine.id}`
          );
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
        return;
      }

      // Locksmith polling (existing logic)
      if (!u.isVerified || !u.isOnline) return;
      await loadJobs();
      await loadWallet();

      try {
        const { data: sq } = await api.get(
          '/api/jobs/locksmith/scheduled-open'
        );
        setHasScheduledJobs((sq?.jobs?.length || 0) > 0);
      } catch {
        /* ignore */
      }

      try {
        const { data } = await api.get(
          '/api/jobs/locksmith/my-jobs'
        );
        const list = data.jobs || [];
        const mine = list.find(
          (j) =>
            j.status === 'PENDING' && j.locksithId === u.id
        );
        if (!mine) return;
        const dismissed = await AsyncStorage.getItem(
          `dismiss_job_${mine.id}`
        );
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
  }, [isMember, loadJobs, loadWallet]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', async (next) => {
      if (appStateRef.current.match(/inactive|background/) && next === 'active') {
        try {
          await loadProfile();
          await postLocationIfPossible();
        } catch {
          /* ignore */
        }
      }
      appStateRef.current = next;
    });
    return () => sub.remove();
  }, [loadProfile]);

  const onToggleOnline = async (value) => {
    setToggleLoading(true);
    try {
      if (isMember) {
        let body = {};
        if (value) {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === 'granted') {
            const loc = await Location.getCurrentPositionAsync({});
            body = {
              lat: loc.coords.latitude,
              lng: loc.coords.longitude,
            };
          }
        }
        const { data } = await api.put('/api/member/toggle-online', body);
        setOnline(!!data.isOnline);
        setToggleLoading(false);
        return;
      }
      const { data: profileData } = await api.get(
        '/api/locksmith/profile'
      );
      const currentlyOnline = !!profileData.locksmith.isOnline;

      if (value !== currentlyOnline) {
        if (value) {
          await postLocationIfPossible();
        }
        const { data: toggleData } = await api.put(
          '/api/locksmith/toggle-online'
        );
        setOnline(!!toggleData.isOnline);
      } else {
        setOnline(currentlyOnline);
      }
    } catch (e) {
      const data = e.response?.data;
      if (e.response?.status === 400 && data?.incomplete) {
        Alert.alert(
          'Profile incomplete',
          'Add your profile photo and vehicle details before going online.',
          [
            {
              text: 'Complete Profile',
              onPress: () => router.push('/(tabs)/profile'),
            },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
      } else {
        Alert.alert('Error', data?.error || data?.message || 'Could not update status.');
      }
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
    ['ACCEPTED', 'DISPATCHED', 'ARRIVED', 'IN_PROGRESS'].includes(j.status)
  );

  const recent = jobs.slice(0, 5);

  const profileComplete =
    u &&
    u.profilePhoto?.trim() &&
    u.vehicleType?.trim() &&
    u.vehicleColor?.trim() &&
    u.vehiclePlateNumber?.trim();

  const timeOfDay = () => {
    const h = new Date().getHours();
    if (h < 12) return 'morning';
    if (h < 17) return 'afternoon';
    return 'evening';
  };

  const getJobIcon = (type) => {
    if (!type) return 'key-outline';
    if (type.includes('CAR')) return 'car';
    if (type.includes('HOUSE')) return 'home';
    if (type.includes('OFFICE')) return 'business';
    if (type.includes('KEY')) return 'key-outline';
    if (type.includes('LOCK')) return 'lock-closed';
    if (type.includes('SAFE')) return 'cube-outline';
    if (type.includes('GATE')) return 'git-merge-outline';
    return 'construct';
  };

  const getStatusBg = (status) => {
    const map = {
      COMPLETED: '#0a2a0a',
      CANCELLED: '#2a0a0a',
      IN_PROGRESS: '#0a1a2a',
      ARRIVED: '#0a1a2a',
      DISPATCHED: '#1a1a0a',
      ACCEPTED: '#1a1a0a',
      PENDING: '#1a1a1a',
      DISPUTED: '#2a1a00',
    };
    return map[status] || '#1a1a1a';
  };

  const getStatusColor = (status) => {
    const map = {
      COMPLETED: '#34c759',
      CANCELLED: '#ff3b30',
      IN_PROGRESS: '#0a84ff',
      ARRIVED: '#0a84ff',
      DISPATCHED: '#D4A017',
      ACCEPTED: '#D4A017',
      PENDING: '#888',
      DISPUTED: '#ff9500',
    };
    return map[status] || '#888';
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerGreet}>Good {timeOfDay()}, {name}</Text>
            <Text style={styles.headerSub}>{online ? 'You are online' : 'You are offline'}</Text>
          </View>
          <TouchableOpacity style={styles.notifBtn} onPress={() => router.push('/notifications')}>
            <Ionicons name="notifications-outline" size={22} color={COLORS.accent} />
          </TouchableOpacity>
        </View>

        {isMember && (
          <View style={{
            backgroundColor: COLORS.inputBg,
            marginHorizontal: 20,
            marginBottom: 16,
            borderRadius: 12,
            padding: 16,
            borderWidth: 1,
            borderColor: COLORS.accent,
            flexDirection: 'row',
            alignItems: 'center',
          }}>
            <Ionicons name="business-outline" size={20} color={COLORS.accent} style={{ marginRight: 12 }} />
            <View>
              <Text style={{ color: COLORS.accent, fontWeight: '700', fontSize: 15 }}>
                {user?.businessName || 'Team Member'}
              </Text>
              <Text style={{ color: COLORS.textMuted, fontSize: 13, marginTop: 2 }}>
                Team Member Account
              </Text>
            </View>
          </View>
        )}

        <TouchableOpacity
          style={[styles.onlineCard, { borderColor: online ? '#34c759' : '#444' }]}
          onPress={() => onToggleOnline(!online)}
          disabled={toggleLoading}
          activeOpacity={0.9}
        >
          <View style={styles.onlineCardLeft}>
            <View style={[styles.onlineDot, { backgroundColor: online ? '#34c759' : '#666' }]} />
            <View>
              <Text style={styles.onlineCardTitle}>{online ? 'Online' : 'Offline'}</Text>
              <Text style={styles.onlineCardSub}>
                {online ? 'Receiving job requests' : 'Tap to go online'}
              </Text>
            </View>
          </View>
          <Switch
            value={online}
            onValueChange={onToggleOnline}
            disabled={toggleLoading}
            trackColor={{ false: '#333', true: '#1a3a1a' }}
            thumbColor={online ? '#34c759' : '#666'}
          />
        </TouchableOpacity>

        {!profileComplete ? (
          <TouchableOpacity style={styles.incompleteBanner} onPress={() => router.push('/(tabs)/profile')}>
            <Ionicons name="warning-outline" size={18} color="#111" style={{ marginRight: 8 }} />
            <Text style={styles.incompleteBannerText}>Complete your profile to go online</Text>
            <Ionicons name="chevron-forward" size={18} color="#111" />
          </TouchableOpacity>
        ) : null}

        {activeJob ? (
          <TouchableOpacity
            style={styles.activeJobCard}
            onPress={() =>
              router.push({
                pathname: '/active-job',
                params: { jobId: activeJob.id },
              })
            }
          >
            <View style={styles.activeJobLeft}>
              <View style={styles.activeJobDot} />
              <View>
                <Text style={styles.activeJobTitle}>Active Job</Text>
                <Text style={styles.activeJobSub}>
                  {activeJob.serviceType?.replace(/_/g, ' ')} · {activeJob.status}
                </Text>
              </View>
            </View>
            <View style={styles.activeJobRight}>
              <Text style={styles.activeJobBtn}>View</Text>
              <Ionicons name="chevron-forward" size={18} color={COLORS.accent} />
            </View>
          </TouchableOpacity>
        ) : null}

        {hasScheduledJobs && (
          <TouchableOpacity
            style={styles.scheduledBanner}
            onPress={() => router.push('/scheduled-quotes')}
          >
            <Ionicons name="calendar-outline" size={18} color="#111" 
              style={{ marginRight: 8 }} />
            <Text style={styles.scheduledBannerText}>
              New quote requests — tap to view
            </Text>
            <Ionicons name="chevron-forward" size={16} color="#111" />
          </TouchableOpacity>
        )}

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statVal}>{jobsToday}</Text>
            <Text style={styles.statLbl}>Jobs today</Text>
          </View>
          <View style={[styles.statCard, styles.statCardMid]}>
            <Text style={styles.statVal}>R{earnedToday.toFixed(0)}</Text>
            <Text style={styles.statLbl}>Earned today</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statVal}>{Number(u?.rating ?? 5).toFixed(1)}★</Text>
            <Text style={styles.statLbl}>Rating</Text>
          </View>
        </View>

        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Recent jobs</Text>
          <TouchableOpacity onPress={() => router.push('/my-jobs')}>
            <Text style={styles.seeAll}>See all</Text>
          </TouchableOpacity>
        </View>

        {recent.length === 0 ? (
          <Text style={styles.empty}>No jobs yet. Go online to receive requests.</Text>
        ) : (
          recent.map((j) => (
            <View key={j.id} style={styles.jobCard}>
              <View style={styles.jobIconWrap}>
                <Ionicons name={getJobIcon(j.serviceType)} size={20} color={COLORS.accent} />
              </View>
              <View style={styles.jobInfo}>
                <Text style={styles.jobService}>{j.serviceType?.replace(/_/g, ' ')}</Text>
                <Text style={styles.jobDate}>
                  {new Date(j.createdAt).toLocaleDateString('en-ZA', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
              <View style={[styles.jobBadge, { backgroundColor: getStatusBg(j.status) }]}>
                <Text style={[styles.jobBadgeText, { color: getStatusColor(j.status) }]}>
                  {j.status}
                </Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  headerGreet: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '800',
  },
  headerSub: {
    color: COLORS.textMuted,
    fontSize: 14,
    marginTop: 2,
  },
  notifBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  onlineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: COLORS.inputBg,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
  },
  onlineCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  onlineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  onlineCardTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
  },
  onlineCardSub: {
    color: COLORS.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
  incompleteBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.accent,
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 12,
    padding: 14,
  },
  incompleteBannerText: {
    color: '#111',
    fontWeight: '700',
    fontSize: 14,
    flex: 1,
  },
  scheduledBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4a9eff',
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 12,
    padding: 14,
  },
  scheduledBannerText: {
    color: '#111',
    fontWeight: '700',
    fontSize: 14,
    flex: 1,
  },
  activeJobCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: '#0a1a0a',
    borderWidth: 1.5,
    borderColor: '#34c759',
    borderRadius: 16,
    padding: 16,
  },
  activeJobLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  activeJobDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#34c759',
  },
  activeJobTitle: {
    color: '#34c759',
    fontSize: 15,
    fontWeight: '700',
  },
  activeJobSub: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  activeJobRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  activeJobBtn: {
    color: COLORS.accent,
    fontWeight: '700',
    fontSize: 14,
  },
  statsGrid: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 24,
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.inputBg,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  statCardMid: {
    borderColor: COLORS.accent,
    borderWidth: 1,
  },
  statVal: {
    color: COLORS.accent,
    fontSize: 20,
    fontWeight: '800',
  },
  statLbl: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 4,
    textAlign: 'center',
  },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '700',
  },
  seeAll: {
    color: COLORS.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  jobCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
    gap: 12,
  },
  jobIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  jobInfo: { flex: 1 },
  jobService: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },
  jobDate: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  jobBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  jobBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  empty: {
    color: COLORS.textMuted,
    fontSize: 15,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
});
