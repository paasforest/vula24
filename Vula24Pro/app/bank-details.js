import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FormInput } from '../components/FormInput';
import { GoldButton } from '../components/GoldButton';
import { COLORS } from '../constants/theme';
import api from '../lib/api';

export default function BankDetailsScreen() {
  const [bankName, setBankName] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [bankHolder, setBankHolder] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/api/locksmith/profile');
      const p = data.locksmith;
      setBankName(p.bankName || '');
      setBankAccount(p.bankAccountNumber || '');
      setBankHolder(p.bankAccountHolder || '');
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'Could not load profile.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setLoading(true);
    try {
      await api.put('/api/locksmith/profile', {
        bankName: bankName.trim(),
        bankAccountNumber: bankAccount.trim(),
        bankAccountHolder: bankHolder.trim(),
      });
      Alert.alert('Saved', 'Bank details updated.');
      router.back();
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'Could not save.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scroll}>
          <TouchableOpacity style={styles.back} onPress={() => router.back()}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.h1}>Bank details</Text>
          <FormInput label="Bank name" value={bankName} onChangeText={setBankName} />
          <FormInput label="Account number" value={bankAccount} onChangeText={setBankAccount} keyboardType="number-pad" />
          <FormInput label="Account holder" value={bankHolder} onChangeText={setBankHolder} autoCapitalize="words" />
          <GoldButton title="Save" onPress={save} loading={loading} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  flex: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 40 },
  back: { marginBottom: 12 },
  backText: { color: COLORS.accent, fontSize: 16 },
  h1: { color: COLORS.text, fontSize: 22, fontWeight: '800', marginBottom: 16 },
});
