import { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  Alert,
  RefreshControl,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/theme';
import api from '../../lib/api';

function statusStyle(status) {
  switch (status) {
    case 'COMPLETED':
      return { bg: '#3d3310', text: COLORS.accent, label: 'Completed' };
    case 'CANCELLED':
      return { bg: '#3a1515', text: '#ff8a80', label: 'Cancelled' };
    case 'DISPUTED':
      return { bg: '#2a1a00', text: '#ff9500', label: 'Disputed' };
    case 'IN_PROGRESS':
    case 'ARRIVED':
    case 'ACCEPTED':
    case 'DISPATCHED':
      return {
        bg: '#102a3a',
        text: '#64b5f6',
        label: status.replace(/_/g, ' '),
      };
    default:
      return {
        bg: '#2a2a2a',
        text: COLORS.textMuted,
        label: status ? status.replace(/_/g, ' ') : '—',
      };
  }
}

const serviceIcon = (type) => {
  const icons = {
    CAR_LOCKOUT: 'car',
    HOUSE_LOCKOUT: 'home',
    OFFICE_LOCKOUT: 'business',
    KEY_DUPLICATION: 'key-outline',
    CAR_KEY_PROGRAMMING: 'radio-outline',
    CAR_KEY_CUTTING: 'cut-outline',
    BROKEN_KEY_EXTRACTION: 'build-outline',
    LOST_KEY_REPLACEMENT: 'search-outline',
    IGNITION_REPAIR: 'flash-outline',
    LOCK_REPLACEMENT: 'lock-closed',
    LOCK_REPAIR: 'construct',
    LOCK_UPGRADE: 'shield-checkmark-outline',
    DEADLOCK_INSTALLATION: 'lock-open-outline',
    SAFE_OPENING: 'cube-outline',
    GATE_MOTOR_REPAIR: 'git-merge-outline',
    ACCESS_CONTROL: 'finger-print-outline',
    PADLOCK_REMOVAL: 'remove-circle-outline',
    GARAGE_DOOR: 'home-outline',
    SECURITY_GATE: 'shield-outline',
    ELECTRIC_FENCE_GATE: 'flash',
  };
  return icons[type] || 'key-outline';
};

const ACTIVE_STATUSES = new Set([
  'PENDING',
  'ACCEPTED',
  'DISPATCHED',
  'ARRIVED',
  'IN_PROGRESS',
  'DISPUTED',
]);
const COMPLETED_TAB_STATUSES = new Set(['COMPLETED', 'CANCELLED']);

function formatJobDetailDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const datePart = d.toLocaleDateString('en-ZA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const timePart = d.toLocaleTimeString('en-ZA', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${datePart} at ${timePart}`;
}

export default function MyJobsScreen() {
  const [jobs, setJobs] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState('all');

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/api/jobs/customer/my-jobs');
      setJobs(data.jobs || []);
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'Could not load jobs.');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const { data } = await api.get(
            '/api/jobs/customer/my-jobs'
          );
          if (!cancelled) {
            setJobs(data.jobs || []);
          }
        } catch (e) {
          if (!cancelled) {
            console.warn(
              '[my-jobs] load failed:',
              e?.message
            );
          }
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const filteredJobs = jobs.filter((j) => {
    if (filter === 'all') return true;
    if (filter === 'active') return ACTIVE_STATUSES.has(j.status);
    return COMPLETED_TAB_STATUSES.has(j.status);
  });

  const renderItem = ({ item }) => {
    const st = statusStyle(item.status);
    const dt = new Date(item.createdAt);
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.9}
        onPress={() => setSelected(item)}
      >
        <View style={styles.cardTop}>
          <Ionicons name={serviceIcon(item.serviceType)} size={28} color={COLORS.accent} />
          <View style={styles.cardMid}>
            <Text style={styles.service}>
              {item.serviceType?.replace(/_/g, ' ') || 'Job'}
            </Text>
            <Text style={styles.date}>
              {dt.toLocaleString()}
            </Text>
            <Text style={styles.addr} numberOfLines={2}>
              {item.customerAddress}
            </Text>
            {item.locksithId && item.locksmith?.name ? (
              <Text style={styles.locksmith} numberOfLines={1}>
                Locksmith: {item.locksmith.name}
              </Text>
            ) : null}
          </View>
        </View>
        <View style={styles.cardBot}>
          <View style={[styles.badge, { backgroundColor: st.bg }]}>
            <Text style={[styles.badgeText, { color: st.text }]}>{st.label}</Text>
          </View>
          <Text style={styles.price}>
            R {item.totalPrice != null ? Number(item.totalPrice).toFixed(2) : '—'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Text style={styles.h1}>My jobs</Text>
      <View style={styles.filterRow}>
        {[
          { key: 'all', label: 'All' },
          { key: 'active', label: 'Active' },
          { key: 'completed', label: 'Completed' },
        ].map(({ key, label }) => {
          const on = filter === key;
          return (
            <TouchableOpacity
              key={key}
              style={[
                styles.pill,
                on ? styles.pillOn : styles.pillOff,
              ]}
              onPress={() => setFilter(key)}
            >
              <Text style={[styles.pillText, on ? styles.pillTextOn : styles.pillTextOff]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <FlatList
        data={filteredJobs}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />
        }
        ListEmptyComponent={
          <Text style={styles.empty}>
            {jobs.length === 0
              ? 'No jobs yet. Book from Home.'
              : 'No jobs in this filter.'}
          </Text>
        }
      />

      <Modal visible={!!selected} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Job details</Text>
            {selected ? (
              <>
                {selected.locksithId && selected.locksmith?.name ? (
                  <View style={styles.modalRow}>
                    <Text style={styles.muted}>Locksmith: </Text>
                    <Text style={styles.modalVal}>{selected.locksmith.name}</Text>
                  </View>
                ) : null}
                <View style={styles.modalRow}>
                  <Text style={styles.muted}>Date: </Text>
                  <Text style={styles.modalVal}>
                    {formatJobDetailDate(selected.createdAt)}
                  </Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.muted}>Service: </Text>
                  <Text style={styles.modalVal}>
                    {selected.serviceType?.replace(/_/g, ' ')}
                  </Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.muted}>Status: </Text>
                  <Text style={styles.modalVal}>{selected.status}</Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.muted}>Address: </Text>
                  <Text style={styles.modalVal}>{selected.customerAddress}</Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.muted}>Total: </Text>
                  <Text style={styles.modalVal}>
                    R {Number(selected.totalPrice || 0).toFixed(2)}
                  </Text>
                </View>
                {selected.status === 'CANCELLED' ? (
                  <Text style={styles.cancelNote}>This job was cancelled</Text>
                ) : null}
                {selected.status === 'COMPLETED' ? (
                  <TouchableOpacity
                    style={styles.rateBtn}
                    onPress={() => {
                      const id = selected.id;
                      setSelected(null);
                      router.push({ pathname: '/review', params: { jobId: id } });
                    }}
                  >
                    <Text style={styles.rateBtnText}>Rate this job</Text>
                  </TouchableOpacity>
                ) : null}
              </>
            ) : null}
            <TouchableOpacity style={styles.closeBtn} onPress={() => setSelected(null)}>
              <Text style={styles.closeText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  h1: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: '700',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  pill: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  pillOn: { backgroundColor: COLORS.accent },
  pillOff: { backgroundColor: COLORS.inputBg },
  pillText: { fontSize: 14, fontWeight: '600' },
  pillTextOn: { color: COLORS.bg },
  pillTextOff: { color: COLORS.textMuted },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  empty: { color: COLORS.textMuted, textAlign: 'center', marginTop: 40 },
  card: {
    backgroundColor: COLORS.inputBg,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start' },
  cardMid: { flex: 1, marginLeft: 12 },
  service: { color: COLORS.text, fontSize: 17, fontWeight: '700' },
  date: { color: COLORS.textMuted, fontSize: 13, marginTop: 4 },
  addr: { color: COLORS.textMuted, fontSize: 14, marginTop: 6 },
  locksmith: { color: COLORS.textMuted, fontSize: 13, marginTop: 6, fontWeight: '600' },
  cardBot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  price: { color: COLORS.accent, fontSize: 18, fontWeight: '800' },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
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
    marginBottom: 12,
  },
  modalRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  muted: { color: COLORS.textMuted, marginRight: 6 },
  modalVal: { color: COLORS.text, flex: 1 },
  closeBtn: { marginTop: 16, alignSelf: 'flex-end' },
  closeText: { color: COLORS.accent, fontSize: 16, fontWeight: '600' },
  cancelNote: {
    color: COLORS.textMuted,
    fontSize: 14,
    marginTop: 12,
    fontStyle: 'italic',
  },
  rateBtn: {
    marginTop: 16,
    backgroundColor: COLORS.accent,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  rateBtnText: { color: COLORS.bg, fontSize: 16, fontWeight: '700' },
});
