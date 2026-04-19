import { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GoldButton } from '../components/GoldButton';
import { COLORS } from '../constants/theme';
import api from '../lib/api';

function timeAgo(iso) {
  const d = new Date(iso);
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function NotificationsScreen() {
  const [items, setItems] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/api/notifications');
      setItems(data.notifications || []);
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error ||
        'Could not load notifications.');
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

  const markRead = async (id) => {
    try {
      await api.post(`/api/notifications/${id}/read`);
      await load();
    } catch {
      /* ignore */
    }
  };

  const markAll = async () => {
    try {
      await api.post('/api/notifications/read-all');
      await load();
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'Failed.');
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <TouchableOpacity
        style={styles.back}
        onPress={() => router.back()}
      >
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>
      <Text style={styles.h1}>Notifications</Text>
      <GoldButton
        title="Mark all as read"
        onPress={markAll}
        variant="outline"
      />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.accent}
          />
        }
      >
        {items.length === 0 ? (
          <Text style={styles.empty}>
            No notifications yet.
          </Text>
        ) : (
          items.map((n) => (
            <TouchableOpacity
              key={n.id}
              style={[
                styles.card,
                !n.isRead && styles.cardUnread
              ]}
              onPress={() => markRead(n.id)}
              activeOpacity={0.85}
            >
              <View style={styles.row}>
                <Text style={styles.title}>{n.title}</Text>
                {!n.isRead ? (
                  <View style={styles.dot} />
                ) : null}
              </View>
              <Text style={styles.msg}>{n.message}</Text>
              <Text style={styles.time}>
                {timeAgo(n.createdAt)}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  back: { paddingHorizontal: 20, marginBottom: 8 },
  backText: { color: COLORS.accent, fontSize: 16 },
  h1: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: '800',
    paddingHorizontal: 20,
    marginBottom: 12
  },
  scroll: { padding: 20, paddingBottom: 40 },
  empty: {
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 40
  },
  card: {
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    backgroundColor: COLORS.inputBg,
  },
  cardUnread: {
    borderColor: COLORS.accent,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  title: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
    flex: 1
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.accent,
    marginLeft: 8,
  },
  msg: {
    color: COLORS.textMuted,
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22
  },
  time: { color: '#666', marginTop: 8, fontSize: 12 },
});
