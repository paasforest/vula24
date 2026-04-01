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
import { useFocusEffect } from 'expo-router';
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
    case 'IN_PROGRESS':
    case 'ARRIVED':
    case 'ACCEPTED':
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

function serviceIcon(type) {
  const t = type || '';
  if (t.includes('CAR')) return 'car';
  if (t.includes('HOUSE')) return 'home';
  if (t.includes('KEY')) return 'key-outline';
  if (t.includes('REPLACEMENT')) return 'lock-closed';
  if (t.includes('REPAIR')) return 'construct';
  return 'key';
}

export default function MyJobsScreen() {
  const [jobs, setJobs] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState(null);

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
      load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

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
      <FlatList
        data={jobs}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />
        }
        ListEmptyComponent={
          <Text style={styles.empty}>No jobs yet. Book from Home.</Text>
        }
      />

      <Modal visible={!!selected} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Job details</Text>
            {selected ? (
              <>
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
});
