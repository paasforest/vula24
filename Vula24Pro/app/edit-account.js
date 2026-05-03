import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { FormInput } from '../components/FormInput';
import { GoldButton } from '../components/GoldButton';
import { COLORS } from '../constants/theme';
import api from '../lib/api';
import { saveUser, getUser } from '../lib/storage';

export default function EditAccountScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [accountType, setAccountType] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/locksmith/profile');
      const ls = data.locksmith;
      setEmail(ls?.email || '');
      setName(ls?.name || '');
      setPhone(ls?.phone || '');
      setBusinessName(ls?.businessName || '');
      setAccountType(ls?.accountType || null);
    } catch (e) {
      Alert.alert(
        'Error',
        e.response?.data?.error || e.message || 'Could not load profile.'
      );
      router.back();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!name.trim() || !phone.trim()) {
      Alert.alert('Missing fields', 'Name and phone are required.');
      return;
    }
    if (accountType === 'BUSINESS' && !businessName.trim()) {
      Alert.alert('Business name', 'Please enter your business name.');
      return;
    }
    setSaving(true);
    try {
      const body = {
        name: name.trim(),
        phone: phone.trim(),
      };
      if (accountType === 'BUSINESS') {
        body.businessName = businessName.trim();
      }
      const { data } = await api.put('/api/locksmith/profile', body);
      const ls = data.locksmith;
      const prev = await getUser();
      await saveUser({ ...prev, ...ls });
      Alert.alert('Saved', 'Account details updated.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert(
        'Error',
        e.response?.data?.error ||
          e.response?.data?.message ||
          'Could not save changes.'
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.loadingWrap}>
          <Text style={styles.muted}>Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isBusiness = accountType === 'BUSINESS';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            hitSlop={12}
          >
            <Ionicons name="chevron-back" size={24} color={COLORS.accent} />
            <Text style={styles.backLabel}>Back</Text>
          </TouchableOpacity>
        </View>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>Edit Account Details</Text>

          <FormInput
            label="Email (cannot be changed)"
            value={email}
            onChangeText={setEmail}
            editable={false}
            keyboardType="email-address"
          />
          <FormInput
            label="Full name"
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            autoCapitalize="words"
          />
          <FormInput
            label="Phone"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
          {isBusiness ? (
            <FormInput
              label="Business name"
              value={businessName}
              onChangeText={setBusinessName}
              placeholder="Business name"
              autoCapitalize="words"
            />
          ) : null}

          <GoldButton title="Save" onPress={save} loading={saving} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  flex: { flex: 1 },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  muted: { color: COLORS.textMuted, fontSize: 16 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backLabel: {
    color: COLORS.accent,
    fontSize: 17,
    fontWeight: '600',
  },
  scroll: { padding: 24, paddingBottom: 48 },
  title: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 20,
  },
});
