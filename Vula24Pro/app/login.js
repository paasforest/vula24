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

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Missing fields', 'Enter email and password.');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('/api/auth/locksmith/login', {
        email: email.trim().toLowerCase(),
        password,
      });
      await saveToken(data.token);
      await saveUser(data.locksmith);
      if (data.locksmith.isVerified !== true) {
        router.replace('/pending');
      } else {
        router.replace('/(tabs)/dashboard');
      }
    } catch (e) {
      const status = e.response?.status;
      const msg = e.response?.data?.error || e.message || 'Login failed.';
      if (status === 403 && msg.toLowerCase().includes('suspended')) {
        Alert.alert('Account suspended', 'Your account has been suspended. Please contact support.');
      } else {
        Alert.alert('Error', msg);
      }
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
          <VulaLogoPro size={56} />
          <Text style={styles.h1}>Sign in</Text>
          <Text style={styles.sub}>Access your dashboard and incoming jobs.</Text>
          <FormInput label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          <FormInput label="Password" value={password} onChangeText={setPassword} secureTextEntry />
          <GoldButton title="Sign In" onPress={submit} loading={loading} />
          <TouchableOpacity style={styles.link} onPress={() => router.push('/welcome')}>
            <Text style={styles.muted}>Don&apos;t have an account? </Text>
            <Text style={styles.linkC}>Register</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{ alignItems: 'center', marginTop: 12 }}
            onPress={() => router.push('/member-login')}
          >
            <Text style={{ color: COLORS.textMuted, fontSize: 14 }}>
              Team member?{' '}
              <Text style={{ color: COLORS.accent }}>Login here</Text>
            </Text>
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
  linkC: { color: COLORS.accent, fontWeight: '700' },
});
