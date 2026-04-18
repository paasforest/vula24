import { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Alert,
  Image,
  Modal,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { FormInput } from '../components/FormInput';
import { GoldButton } from '../components/GoldButton';
import { VulaLogoPro } from '../components/VulaLogoPro';
import { COLORS } from '../constants/theme';
import { getBaseURL } from '../lib/api';
import { saveToken, saveUser } from '../lib/storage';

function mimeFromUri(uri) {
  const u = String(uri).toLowerCase();
  if (u.endsWith('.png')) return 'image/png';
  if (u.endsWith('.webp')) return 'image/webp';
  if (u.endsWith('.heic') || u.endsWith('.heif')) return 'image/heic';
  return 'image/jpeg';
}

export default function RegisterScreen() {
  const { type: t } = useLocalSearchParams();
  const accountType = Array.isArray(t) ? t[0] : t;
  const isBusiness = accountType === 'BUSINESS';

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [idUri, setIdUri] = useState(null);
  const [selfieUri, setSelfieUri] = useState(null);
  const [proofUri, setProofUri] = useState(null);
  const [psira, setPsira] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [bankHolder, setBankHolder] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [camVisible, setCamVisible] = useState(false);
  const camRef = useRef(null);
  const [camPerm, requestCamPerm] = useCameraPermissions();

  const pickId = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission', 'Photo access is required.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (!res.canceled && res.assets[0]) setIdUri(res.assets[0].uri);
  };

  const pickProof = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (!res.canceled && res.assets[0]) setProofUri(res.assets[0].uri);
  };

  const openSelfieCam = async () => {
    if (!camPerm?.granted) {
      const r = await requestCamPerm();
      if (!r.granted) {
        Alert.alert('Camera', 'Camera permission is required for your verification selfie.');
        return;
      }
    }
    setCamVisible(true);
  };

  const takeSelfie = async () => {
    try {
      const photo = await camRef.current?.takePictureAsync?.({ quality: 0.85 });
      if (photo?.uri) {
        setSelfieUri(photo.uri);
        setCamVisible(false);
        return;
      }
    } catch {
      /* fall through */
    }
    const r = await ImagePicker.launchCameraAsync({ quality: 0.85 });
    if (!r.canceled && r.assets[0]) {
      setSelfieUri(r.assets[0].uri);
      setCamVisible(false);
    }
  };

  const submit = async () => {
    if (!name.trim() || !phone.trim() || !email.trim() || !password) {
      Alert.alert('Missing fields', 'Please fill in all required fields.');
      return;
    }
    if (isBusiness && !businessName.trim()) {
      Alert.alert('Business name', 'Please enter your business name.');
      return;
    }
    if (password !== confirm) {
      Alert.alert('Passwords', 'Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Password', 'Minimum 8 characters.');
      return;
    }
    setLoading(true);
    try {
      const form = new FormData();
      form.append('name', name.trim());
      form.append('phone', phone.trim());
      form.append('email', email.trim().toLowerCase());
      form.append('password', password);
      form.append('accountType', isBusiness ? 'BUSINESS' : 'INDIVIDUAL');
      if (isBusiness) form.append('businessName', businessName.trim());
      if (psira.trim()) form.append('psiraNumber', psira.trim());
      if (bankName.trim()) form.append('bankName', bankName.trim());
      if (bankAccount.trim()) form.append('bankAccountNumber', bankAccount.trim());
      if (bankHolder.trim()) form.append('bankAccountHolder', bankHolder.trim());

      if (idUri) {
        form.append('idPhoto', {
          uri: idUri,
          name: 'id.jpg',
          type: mimeFromUri(idUri),
        });
      }
      if (selfieUri) {
        form.append('selfiePhoto', {
          uri: selfieUri,
          name: 'selfie.jpg',
          type: mimeFromUri(selfieUri),
        });
      }
      if (proofUri) {
        form.append('proofOfAddress', {
          uri: proofUri,
          name: 'proof.jpg',
          type: mimeFromUri(proofUri),
        });
      }

      // Use fetch (not axios) for multipart — axios + FormData often yields bogus
      // "Network Error" on React Native Android even when the API URL is correct.
      const base = getBaseURL();
      const controller = new AbortController();
      const timeoutMs = 120000;
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      let res;
      try {
        res = await fetch(`${base}/api/auth/locksmith/register`, {
          method: 'POST',
          body: form,
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      const text = await res.text();
      let data;
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new Error(
          text?.slice(0, 200) || `Invalid response (HTTP ${res.status})`
        );
      }

      if (!res.ok) {
        throw new Error(data.error || `Registration failed (HTTP ${res.status})`);
      }

      await saveToken(data.token);
      await saveUser(data.locksmith);
      setSuccess(true);
    } catch (e) {
      const aborted = e?.name === 'AbortError';
      const raw = String(e?.message || e || '');
      let msg = aborted
        ? 'Request timed out.'
        : raw || 'Registration failed.';
      if (
        !aborted &&
        /network request failed|network error|failed to connect/i.test(raw)
      ) {
        msg = `Cannot reach the API.\n\nUsing: ${getBaseURL()}\n\nTry mobile data vs Wi‑Fi, or open ${getBaseURL()}/health in the phone browser.`;
      }
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  const continueAfterSuccess = () => {
    router.replace('/pending');
  };

  if (success) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.successScroll}>
          <Ionicons name="checkmark-circle" size={80} color={COLORS.accent} />
          <Text style={styles.successTitle}>Application Submitted</Text>
          <Text style={styles.successBody}>
            Thank you for applying to Vula24 Pro. Our team will review your documents and bank
            details manually.
          </Text>
          <Text style={styles.successBody}>
            We will notify you within 24 hours once your profile is approved.
          </Text>
          <GoldButton title="Continue" onPress={continueAfterSuccess} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <VulaLogoPro iconSize={48} />
          <Text style={styles.h1}>Create your pro account</Text>
          <Text style={styles.badge}>
            {isBusiness ? 'Business account' : 'Individual locksmith'}
          </Text>

          <FormInput label="Full Name" value={name} onChangeText={setName} placeholder="Your name" autoCapitalize="words" />
          <FormInput label="Phone Number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <FormInput label="Email Address" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          <FormInput label="Password" value={password} onChangeText={setPassword} secureTextEntry />
          <FormInput label="Confirm Password" value={confirm} onChangeText={setConfirm} secureTextEntry />
          {isBusiness ? (
            <FormInput label="Business Name" value={businessName} onChangeText={setBusinessName} />
          ) : null}

          <Text style={styles.section}>Documents</Text>
          <TouchableOpacity style={styles.uploadBtn} onPress={pickId}>
            <Ionicons name="document-text-outline" size={22} color={COLORS.accent} />
            <Text style={styles.uploadText}>Upload SA ID</Text>
          </TouchableOpacity>
          {idUri ? <Image source={{ uri: idUri }} style={styles.thumb} /> : null}

          <TouchableOpacity style={styles.uploadBtn} onPress={openSelfieCam}>
            <Ionicons name="camera-outline" size={22} color={COLORS.accent} />
            <Text style={styles.uploadText}>Take selfie holding your ID</Text>
          </TouchableOpacity>
          {selfieUri ? <Image source={{ uri: selfieUri }} style={styles.thumb} /> : null}

          <TouchableOpacity style={styles.uploadBtn} onPress={pickProof}>
            <Ionicons name="image-outline" size={22} color={COLORS.accent} />
            <Text style={styles.uploadText}>Upload proof of address (optional)</Text>
          </TouchableOpacity>
          {proofUri ? <Image source={{ uri: proofUri }} style={styles.thumb} /> : null}

          <FormInput label="PSIRA Number (optional)" value={psira} onChangeText={setPsira} placeholder="e.g. registration number" />
          <Text style={styles.hintGold}>
            Locksmiths with PSIRA registration get a verified badge after approval.
          </Text>

          <Text style={styles.section}>Bank details</Text>
          <FormInput label="Bank Name" value={bankName} onChangeText={setBankName} />
          <FormInput label="Account Number" value={bankAccount} onChangeText={setBankAccount} keyboardType="number-pad" />
          <FormInput label="Account Holder Name" value={bankHolder} onChangeText={setBankHolder} autoCapitalize="words" />

          <GoldButton title="Submit Application" onPress={submit} loading={loading} />
          <TouchableOpacity style={styles.link} onPress={() => router.push('/login')}>
            <Text style={styles.muted}>Already registered? </Text>
            <Text style={styles.linkC}>Sign in</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={camVisible} animationType="slide">
        <View style={styles.camWrap}>
          <CameraView ref={camRef} style={styles.camera} facing="front" />
          <View style={styles.camBar}>
            <TouchableOpacity onPress={() => setCamVisible(false)}>
              <Text style={styles.camCancel}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={takeSelfie}>
              <Text style={styles.camSnap}>Capture</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  flex: { flex: 1 },
  scroll: { padding: 24, paddingBottom: 48 },
  h1: { color: COLORS.text, fontSize: 22, fontWeight: '700', marginTop: 16 },
  badge: { color: COLORS.accent, marginTop: 8, marginBottom: 16, fontWeight: '600' },
  section: { color: COLORS.text, fontSize: 17, fontWeight: '700', marginTop: 8, marginBottom: 12 },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    gap: 10,
  },
  uploadText: { color: COLORS.text, fontSize: 15, flex: 1 },
  thumb: { width: '100%', height: 140, borderRadius: 12, marginBottom: 12 },
  hintGold: { color: COLORS.accent, fontSize: 13, marginBottom: 16, lineHeight: 20 },
  link: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  muted: { color: COLORS.textMuted },
  linkC: { color: COLORS.accent, fontWeight: '700' },
  successScroll: { padding: 24, alignItems: 'center', paddingTop: 60 },
  successTitle: { color: COLORS.text, fontSize: 24, fontWeight: '800', marginTop: 24, textAlign: 'center' },
  successBody: { color: COLORS.textMuted, fontSize: 16, lineHeight: 24, marginTop: 16, textAlign: 'center' },
  camWrap: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  camBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 24,
    paddingBottom: 48,
  },
  camCancel: { color: COLORS.textMuted, fontSize: 17 },
  camSnap: { color: COLORS.accent, fontSize: 18, fontWeight: '700' },
});
