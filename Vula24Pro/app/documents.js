import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import api from '../lib/api';

export default function DocumentsScreen() {
  const [profile, setProfile] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/api/locksmith/profile');
      setProfile(data.locksmith);
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'Could not load profile.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const rows = [
    { ok: !!profile?.idPhotoUrl, label: 'SA ID' },
    { ok: !!profile?.selfiePhotoUrl, label: 'Selfie with ID' },
    { ok: !!profile?.proofOfAddressUrl, label: 'Proof of address' },
    { ok: !!profile?.toolsPhotoUrl, label: 'Tools photo' },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <TouchableOpacity style={styles.back} onPress={() => router.back()}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>
      <Text style={styles.h1}>My documents</Text>
      <Text style={styles.sub}>Submitted for verification. Contact support to update files.</Text>
      <ScrollView contentContainerStyle={styles.scroll}>
        {rows.map((r) => (
          <View key={r.label} style={styles.row}>
            <Ionicons
              name={r.ok ? 'checkmark-circle' : 'ellipse-outline'}
              size={24}
              color={r.ok ? COLORS.success : COLORS.textMuted}
            />
            <Text style={[styles.rowLabel, { marginLeft: 12 }]}>{r.label}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  back: { paddingHorizontal: 20, marginBottom: 8 },
  backText: { color: COLORS.accent, fontSize: 16 },
  h1: { color: COLORS.text, fontSize: 22, fontWeight: '800', paddingHorizontal: 20 },
  sub: { color: COLORS.textMuted, paddingHorizontal: 20, marginBottom: 16, marginTop: 8 },
  scroll: { paddingHorizontal: 20 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  rowLabel: { color: COLORS.text, fontSize: 16 },
});
