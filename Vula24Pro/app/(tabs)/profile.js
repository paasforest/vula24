import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/theme';
import { getUser, clearAuth, saveUser } from '../../lib/storage';
import api from '../../lib/api';

export default function ProfileScreen() {
  const [user, setUser] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/api/locksmith/profile');
      setUser(data.locksmith);
      await saveUser(data.locksmith);
    } catch {
      const u = await getUser();
      setUser(u);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const signOut = () => {
    Alert.alert('Sign out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await clearAuth();
          router.replace('/welcome');
        },
      },
    ]);
  };

  const isBusiness = user?.accountType === 'BUSINESS';

  const items = [
    {
      key: 'sched',
      label: 'Scheduled quote requests',
      icon: 'calendar-outline',
      path: '/scheduled-quotes',
    },
    { key: 'pricing', label: 'My Services & Pricing', icon: 'pricetags-outline', path: '/pricing' },
    { key: 'docs', label: 'My Documents', icon: 'document-text-outline', path: '/documents' },
    { key: 'bank', label: 'Bank Details', icon: 'card-outline', path: '/bank-details' },
    ...(isBusiness
      ? [{ key: 'team', label: 'Team Management', icon: 'people-outline', path: '/team' }]
      : []),
    { key: 'notif', label: 'Notifications', icon: 'notifications-outline', path: '/notifications' },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Text style={styles.h1}>Profile</Text>
      <View style={styles.header}>
        <Text style={styles.name}>{user?.name || 'Locksmith'}</Text>
        <Text style={styles.email}>{user?.email || ''}</Text>
        <View style={styles.badges}>
          <View style={[styles.badge, { marginRight: 8 }]}>
            <Text style={styles.badgeText}>{user?.accountType || '—'}</Text>
          </View>
          {user?.psiraVerified ? (
            <View style={[styles.badge, styles.badgeGold]}>
              <Ionicons name="shield-checkmark" size={14} color={COLORS.bg} />
              <Text style={styles.badgeGoldText}> PSIRA verified</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.rating}>
          Rating: {Number(user?.rating ?? 5).toFixed(1)}{' '}
          <Ionicons name="star" size={16} color={COLORS.accent} />
        </Text>
      </View>

      <View style={styles.menu}>
        {items.map((it) => (
          <TouchableOpacity
            key={it.key}
            style={styles.row}
            onPress={() => router.push(it.path)}
            activeOpacity={0.85}
          >
            <Ionicons name={it.icon} size={22} color={COLORS.text} />
            <Text style={styles.rowLabel}>{it.label}</Text>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={styles.row} onPress={signOut}>
          <Ionicons name="log-out-outline" size={22} color={COLORS.error} />
          <Text style={styles.signOut}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  h1: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: '800',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  name: { color: COLORS.text, fontSize: 22, fontWeight: '700' },
  email: { color: COLORS.textMuted, marginTop: 6, fontSize: 15 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  badge: {
    backgroundColor: COLORS.inputBg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  badgeText: { color: COLORS.textMuted, fontSize: 12, fontWeight: '600' },
  badgeGold: {
    backgroundColor: COLORS.accent,
    flexDirection: 'row',
    alignItems: 'center',
  },
  badgeGoldText: { color: COLORS.bg, fontSize: 12, fontWeight: '700' },
  rating: { color: COLORS.textMuted, marginTop: 10, fontSize: 15 },
  menu: { padding: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.inputBg,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  rowLabel: {
    flex: 1,
    color: COLORS.text,
    fontSize: 16,
    marginLeft: 12,
    fontWeight: '500',
  },
  signOut: {
    flex: 1,
    color: COLORS.error,
    fontSize: 16,
    marginLeft: 12,
    fontWeight: '600',
  },
});
