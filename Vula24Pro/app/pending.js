import { useEffect, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { GoldButton } from '../components/GoldButton';
import { COLORS } from '../constants/theme';
import api from '../lib/api';
import { saveUser } from '../lib/storage';

export default function PendingScreen() {
  const [profile, setProfile] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/api/locksmith/profile');
      setProfile(data.locksmith);
      await saveUser(data.locksmith);
      if (data.locksmith.isVerified) {
        router.replace('/(tabs)/dashboard');
      }
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'Could not load profile.');
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load]);

  const docs = [
    { ok: !!profile?.idPhotoUrl, label: 'SA ID uploaded' },
    { ok: !!profile?.selfiePhotoUrl, label: 'Selfie with ID' },
    { ok: !!profile?.proofOfAddressUrl, label: 'Proof of address (optional)' },
    { ok: true, label: 'Bank details submitted' },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.iconCircle}>
          <Ionicons name="time" size={56} color={COLORS.accent} />
        </View>
        <Text style={styles.title}>Your application is under review</Text>
        <Text style={styles.body}>
          Our team is verifying your documents. You will receive a notification once approved.
        </Text>
        <Text style={styles.estimate}>Estimated review time: 24 hours</Text>

        <Text style={styles.section}>Submitted</Text>
        {docs.map((d) => (
          <View key={d.label} style={styles.row}>
            <Ionicons
              name={d.ok ? 'checkmark-circle' : 'ellipse-outline'}
              size={22}
              color={d.ok ? COLORS.success : COLORS.textMuted}
            />
            <Text style={styles.rowText}>{d.label}</Text>
          </View>
        ))}

        <GoldButton
          title="Update Documents"
          variant="outline"
          onPress={() =>
            Alert.alert(
              'Update documents',
              'Contact support or resubmit via a future in-app upload. For now, ensure your email is correct on your profile.'
            )
          }
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { padding: 24, paddingBottom: 40 },
  iconCircle: {
    alignSelf: 'center',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.accent,
    marginBottom: 24,
  },
  title: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  body: { color: COLORS.textMuted, fontSize: 16, lineHeight: 24, textAlign: 'center' },
  estimate: {
    color: COLORS.accent,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  section: { color: COLORS.text, fontSize: 17, fontWeight: '700', marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 10 },
  rowText: { color: COLORS.text, fontSize: 15 },
});
