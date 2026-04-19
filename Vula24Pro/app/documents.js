import { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { COLORS } from '../constants/theme';
import api from '../lib/api';

function mimeFromUri(uri) {
  const u = String(uri).toLowerCase();
  if (u.endsWith('.png')) return 'image/png';
  if (u.endsWith('.webp')) return 'image/webp';
  if (u.endsWith('.heic') || u.endsWith('.heif')) return 'image/heic';
  return 'image/jpeg';
}

const DOC_ROWS = [
  {
    key: 'id',
    documentType: 'idPhoto',
    field: 'idPhotoUrl',
    label: 'SA ID Photo',
  },
  {
    key: 'selfie',
    documentType: 'selfiePhoto',
    field: 'selfiePhotoUrl',
    label: 'Selfie with ID',
  },
  {
    key: 'poa',
    documentType: 'proofOfAddress',
    field: 'proofOfAddressUrl',
    label: 'Proof of Address',
  },
  {
    key: 'tools',
    documentType: 'toolsPhoto',
    field: 'toolsPhotoUrl',
    label: 'Tools Photo',
  },
];

export default function DocumentsScreen() {
  const [profile, setProfile] = useState(null);
  const [uploadingType, setUploadingType] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/api/locksmith/profile');
      setProfile(data.locksmith);
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'Could not load profile.');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const pickAndUpload = async (documentType) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission', 'Photo access is needed to upload documents.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (res.canceled || !res.assets?.[0]?.uri) return;

    const uri = res.assets[0].uri;
    setUploadingType(documentType);
    try {
      const form = new FormData();
      form.append('document', {
        uri,
        name: 'document.jpg',
        type: mimeFromUri(uri),
      });
      form.append('documentType', documentType);
      await api.post('/api/locksmith/documents/upload', form);
      Alert.alert('Uploaded', 'Document saved.');
      await load();
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || e.message || 'Upload failed.');
    } finally {
      setUploadingType(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <TouchableOpacity style={styles.back} onPress={() => router.back()}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>
      <Text style={styles.h1}>My documents</Text>
      <Text style={styles.sub}>
        Upload verification documents below. You can replace a file anytime before approval.
      </Text>
      <ScrollView contentContainerStyle={styles.scroll}>
        {DOC_ROWS.map((r) => {
          const ok = !!profile?.[r.field];
          const busy = uploadingType === r.documentType;
          return (
            <View key={r.key} style={styles.row}>
              <Ionicons
                name={ok ? 'checkmark-circle' : 'ellipse-outline'}
                size={24}
                color={ok ? COLORS.success : COLORS.textMuted}
              />
              <View style={styles.rowTextCol}>
                <Text style={styles.rowLabel}>{r.label}</Text>
                {ok ? <Text style={styles.uploadedBadge}>Uploaded</Text> : null}
              </View>
              {busy ? (
                <ActivityIndicator color={COLORS.accent} style={styles.rowSpinner} />
              ) : ok ? (
                <TouchableOpacity
                  style={styles.replaceBtn}
                  onPress={() => pickAndUpload(r.documentType)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.replaceBtnText}>Replace</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.uploadBtn}
                  onPress={() => pickAndUpload(r.documentType)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.uploadBtnText}>Upload</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
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
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  rowTextCol: { flex: 1, marginLeft: 12 },
  rowLabel: { color: COLORS.text, fontSize: 16, fontWeight: '600' },
  uploadedBadge: { color: COLORS.success, fontSize: 12, marginTop: 4, fontWeight: '600' },
  rowSpinner: { marginLeft: 8 },
  uploadBtn: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  uploadBtnText: { color: COLORS.bg, fontWeight: '700', fontSize: 14 },
  replaceBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  replaceBtnText: { color: COLORS.accent, fontWeight: '700', fontSize: 14 },
});
