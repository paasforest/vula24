import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GoldButton } from '../components/GoldButton';
import { COLORS } from '../constants/theme';
import api, { formatAuthError } from '../lib/api';
import { getUser, saveUser } from '../lib/storage';

const OTP_LEN = 6;
const RESEND_SEC = 60;

export default function VerifyPhoneScreen() {
  const params = useLocalSearchParams();
  const rawPhone = Array.isArray(params.phone) ? params.phone[0] : params.phone;
  const rawUserType = Array.isArray(params.userType) ? params.userType[0] : params.userType;
  const userType = rawUserType === 'locksmith' ? 'locksmith' : 'customer';
  const phone = rawPhone ? String(rawPhone) : '';

  const [digits, setDigits] = useState(() => Array(OTP_LEN).fill(''));
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [countdown, setCountdown] = useState(RESEND_SEC);
  const inputsRef = useRef([]);
  const initialSendDoneRef = useRef(false);

  const sendOtp = useCallback(async () => {
    if (!phone.trim()) return;
    setSending(true);
    try {
      await api.post('/api/auth/send-otp', {
        phone: phone.trim(),
        userType,
      });
      setCountdown(RESEND_SEC);
    } catch (e) {
      Alert.alert('Error', formatAuthError(e));
      setCountdown(0);
    } finally {
      setSending(false);
    }
  }, [phone, userType]);

  useEffect(() => {
    if (!phone.trim()) {
      Alert.alert('Missing phone', 'Go back and register again.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
      return;
    }
    if (initialSendDoneRef.current) return;
    initialSendDoneRef.current = true;
    sendOtp();
  }, [phone, sendOtp]);

  useEffect(() => {
    if (countdown <= 0) return undefined;
    const t = setInterval(() => setCountdown((c) => (c <= 1 ? 0 : c - 1)), 1000);
    return () => clearInterval(t);
  }, [countdown]);

  const setDigitAt = (index, char) => {
    const d = char.replace(/\D/g, '').slice(-1);
    setDigits((prev) => {
      const next = [...prev];
      next[index] = d;
      return next;
    });
    if (d && index < OTP_LEN - 1) {
      inputsRef.current[index + 1]?.focus?.();
    }
  };

  const onKeyPress = (index, key) => {
    if (key === 'Backspace' && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus?.();
    }
  };

  const code = digits.join('');

  const verify = async () => {
    if (code.length !== OTP_LEN) {
      Alert.alert('Code', 'Enter the 6-digit code.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/api/auth/verify-otp', {
        phone: phone.trim(),
        otp: code,
        userType,
      });
      const prev = await getUser();
      await saveUser({ ...(prev || {}), phoneVerified: true });
      if (userType === 'locksmith') {
        router.replace('/pending');
      } else {
        router.replace('/(tabs)/home');
      }
    } catch (e) {
      Alert.alert('Error', formatAuthError(e));
    } finally {
      setLoading(false);
    }
  };

  if (!phone.trim()) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Text style={styles.muted}>Missing phone number.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <View style={styles.inner}>
          <Text style={styles.h1}>Verify your phone</Text>
          <Text style={styles.body}>
            We sent a 6-digit code to{' '}
            <Text style={styles.phone}>{phone.trim()}</Text>
          </Text>

          <View style={styles.row}>
            {digits.map((d, i) => (
              <TextInput
                key={i}
                ref={(r) => {
                  inputsRef.current[i] = r;
                }}
                style={styles.box}
                value={d}
                onChangeText={(t) => setDigitAt(i, t)}
                onKeyPress={({ nativeEvent }) => onKeyPress(i, nativeEvent.key)}
                keyboardType="number-pad"
                maxLength={1}
                selectTextOnFocus
              />
            ))}
          </View>

          <GoldButton title="Verify" onPress={verify} loading={loading} />

          <TouchableOpacity
            style={styles.resendWrap}
            disabled={countdown > 0 || sending}
            onPress={sendOtp}
          >
            <Text style={[styles.resend, (countdown > 0 || sending) && styles.resendDisabled]}>
              {countdown > 0 ? `Resend code in ${countdown}s` : 'Resend code'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  flex: { flex: 1 },
  inner: { flex: 1, padding: 24, paddingTop: 32 },
  h1: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
  },
  body: {
    color: COLORS.textMuted,
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 28,
  },
  phone: { color: COLORS.text, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 28,
    gap: 8,
  },
  box: {
    flex: 1,
    minWidth: 42,
    maxWidth: 52,
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.inputBg,
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  resendWrap: { alignItems: 'center', marginTop: 24 },
  resend: { color: COLORS.accent, fontSize: 16, fontWeight: '600' },
  resendDisabled: { color: COLORS.textMuted },
  muted: { color: COLORS.textMuted, padding: 24 },
});
