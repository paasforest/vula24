import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { VulaLogoPro } from '../components/VulaLogoPro';
import { FormInput } from '../components/FormInput';
import { GoldButton } from '../components/GoldButton';
import { COLORS } from '../constants/theme';
import api from '../lib/api';
import { saveToken, saveUser } from '../lib/storage';

export default function MemberLoginScreen() {
  const [appEmail, setAppEmail] = useState('');
  const [appPassword, setAppPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!appEmail.trim() || !appPassword) {
      Alert.alert('Missing fields', 'Enter email and password.');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('/api/auth/member/login', {
        appEmail: appEmail.trim().toLowerCase(),
        appPassword,
      });
      await saveToken(data.token);
      await saveUser({
        id: data.memberId,
        name: data.name,
        businessId: data.businessId,
        isMember: true,
        isVerified: true,
      });
      router.replace('/(tabs)/dashboard');
    } catch (e) {
      const msg = e.response?.data?.error || e.message || 'Login failed.';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, styles.scrollGrow]}
          keyboardShouldPersistTaps="handled"
        >
          <VulaLogoPro iconSize={56} />
          <Text style={styles.h1}>Team member sign in</Text>
          <Text style={styles.sub}>Use the email and password provided by your business owner.</Text>
          <FormInput
            label="Email"
            value={appEmail}
            onChangeText={setAppEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <FormInput
            label="Password"
            value={appPassword}
            onChangeText={setAppPassword}
            secureTextEntry
          />
          <GoldButton title="Sign In" onPress={submit} loading={loading} />

          <TouchableOpacity style={styles.link} onPress={() => router.back()}>
            <Text style={styles.muted}>Back to login</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  flex: { flex: 1 },
  scroll: { padding: 24, paddingBottom: 48 },
  scrollGrow: { flexGrow: 1 },
  h1: { color: COLORS.text, fontSize: 24, fontWeight: '700', marginTop: 24 },
  sub: { color: COLORS.textMuted, marginTop: 8, marginBottom: 20 },
  link: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  muted: { color: COLORS.textMuted },
});

