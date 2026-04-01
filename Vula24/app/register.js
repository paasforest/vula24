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
import api from '../lib/api';
import { saveToken, saveUser } from '../lib/storage';

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!name.trim() || !phone.trim() || !email.trim() || !password) {
      Alert.alert('Missing fields', 'Please fill in all fields.');
      return;
    }
    if (password !== confirm) {
      Alert.alert('Passwords do not match', 'Please confirm your password.');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Password', 'Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('/api/auth/customer/register', {
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim().toLowerCase(),
        password,
      });
      await saveToken(data.token);
      await saveUser(data.customer);
      router.replace('/(tabs)/home');
    } catch (e) {
      const msg =
        e.response?.data?.error ||
        e.message ||
        'Registration failed. Please try again.';
      Alert.alert('Error', msg);
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
          <Text style={styles.h1}>Create your account</Text>
          <FormInput label="Full Name" value={name} onChangeText={setName} placeholder="Your name" autoCapitalize="words" />
          <FormInput label="Phone Number" value={phone} onChangeText={setPhone} placeholder="+27 …" keyboardType="phone-pad" />
          <FormInput label="Email Address" value={email} onChangeText={setEmail} placeholder="you@email.com" keyboardType="email-address" autoCapitalize="none" />
          <FormInput label="Password" value={password} onChangeText={setPassword} placeholder="Min 8 characters" secureTextEntry />
          <FormInput label="Confirm Password" value={confirm} onChangeText={setConfirm} placeholder="Repeat password" secureTextEntry />
          <GoldButton title="Create Account" onPress={submit} loading={loading} />
          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => router.push('/login')}
          >
            <Text style={styles.muted}>Already have an account? </Text>
            <Text style={styles.link}>Sign in</Text>
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
