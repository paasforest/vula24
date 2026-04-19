import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/theme';
import { getUser, clearAuth } from '../../lib/storage';

const MENU = [
  { key: 'edit', label: 'Edit Profile', icon: 'person-outline' },
  { key: 'pay', label: 'Payment Methods', icon: 'card-outline' },
  { key: 'notif', label: 'Notifications', icon: 'notifications-outline' },
  { key: 'help', label: 'Help & Support', icon: 'help-circle-outline' },
  { key: 'terms', label: 'Terms & Privacy', icon: 'document-text-outline' },
];

export default function ProfileScreen() {
  const [user, setUser] = useState(null);

  useFocusEffect(
    useCallback(() => {
      getUser().then(setUser);
    }, [])
  );

  const onMenu = (key) => {
    if (key === 'notif') {
      router.push({ pathname: '/notifications' });
      return;
    }
    Alert.alert('Coming soon', 
      'This section will be available in a future update.');
  };

  const signOut = async () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await clearAuth();
          router.replace('/login');
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Text style={styles.h1}>Profile</Text>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={40} color={COLORS.accent} />
        </View>
        <Text style={styles.name}>{user?.name || 'Customer'}</Text>
        <Text style={styles.email}>{user?.email || ''}</Text>
      </View>

      <View style={styles.menu}>
        {MENU.map((item) => (
          <TouchableOpacity
            key={item.key}
            style={styles.row}
            onPress={() => onMenu(item.key)}
            activeOpacity={0.8}
          >
            <Ionicons name={item.icon} size={22} color={COLORS.text} />
            <Text style={styles.rowLabel}>{item.label}</Text>
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
    fontWeight: '700',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  header: {
    alignItems: 'center',
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
    marginHorizontal: 16,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: COLORS.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.accent,
  },
  name: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '700',
    marginTop: 12,
  },
  email: { color: COLORS.textMuted, marginTop: 4, fontSize: 15 },
  menu: { padding: 16, marginTop: 8 },
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
