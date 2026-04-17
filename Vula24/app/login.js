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
import { VulaLogo } from '../components/VulaLogo';
import { FormInput } from '../components/FormInput';
import { GoldButton } from '../components/GoldButton';
import { COLORS } from '../constants/theme';
import api, { formatAuthError } from '../lib/api';
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
      const { data } = await api.post('/api/auth/customer/login', {
        email: email.trim().toLowerCase(),
        password,
      });
      await saveToken(data.token);
      await saveUser(data.customer);
      router.replace('/(tabs)/home');
    } catch (e) {
      Alert.alert('Error', formatAuthError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <VulaLogo iconSize={56} />
          <Text style={styles.h1}>Welcome back</Text>
          <FormInput label="Email" value={email} onChangeText={setEmail} placeholder="you@email.com" keyboardType="email-address" autoCapitalize="none" />
          <FormInput label="Password" value={password} onChangeText={setPassword} placeholder="Your password" secureTextEntry />
          <GoldButton title="Sign In" onPress={submit} loading={loading} />
          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => router.push('/register')}
          >
            <Text style={styles.muted}>Don&apos;t have an account? </Text>
            <Text style={styles.link}>Register</Text>
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
  h1: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '700',
    marginTop: 24,
    marginBottom: 8,
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  muted: { color: COLORS.textMuted, fontSize: 15 },
  link: { color: COLORS.accent, fontSize: 15, fontWeight: '600' },
});
