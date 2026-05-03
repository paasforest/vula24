import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Image,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { COLORS } from '../../constants/theme';
import { getUser, clearAuth, saveUser } from '../../lib/storage';
import api, { postMultipart } from '../../lib/api';
import { GoldButton } from '../../components/GoldButton';

function mimeFromUri(uri) {
  const u = String(uri).toLowerCase();
  if (u.endsWith('.png')) return 'image/png';
  if (u.endsWith('.webp')) return 'image/webp';
  if (u.endsWith('.heic') || u.endsWith('.heif')) return 'image/heic';
  return 'image/jpeg';
}

function initialsFromName(name) {
  if (!name?.trim()) return '?';
  const p = name.trim().split(/\s+/);
  if (p.length >= 2) return (p[0][0] + p[1][0]).toUpperCase();
  return name.trim().slice(0, 2).toUpperCase();
}

export default function ProfileScreen() {
  const [isMember, setIsMember] = useState(false);
  const [user, setUser] = useState(null);
  const [memberData, setMemberData] = useState(null);
  const [memberLoading, setMemberLoading] = useState(false);
  const [vehicleType, setVehicleType] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [vehiclePlateNumber, setVehiclePlateNumber] = useState('');
  const [vehicleSaving, setVehicleSaving] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);

  useEffect(() => {
    getUser().then((u) => setIsMember(u?.isMember === true));
  }, []);

  const load = useCallback(async () => {
    const creds = await getUser();
    if (creds?.isMember) {
      setIsMember(true);
      setMemberLoading(true);
      try {
        const { data } = await api.get('/api/member/profile');
        setMemberData(data.member);
        setVehicleType(data.member?.vehicleType || '');
        setVehicleColor(data.member?.vehicleColor || '');
        setVehiclePlateNumber(data.member?.vehiclePlateNumber || '');
        const merged = {
          ...creds,
          ...data.member,
          email: data.member?.appEmail ?? creds?.email,
          businessName: data.member?.business?.businessName ?? creds?.businessName ?? null,
          isMember: true,
        };
        await saveUser(merged);
        setUser(merged);
        return;
      } catch {
        setMemberData(null);
        const u = await getUser();
        setUser(u);
        setVehicleType(u?.vehicleType || '');
        setVehicleColor(u?.vehicleColor || '');
        setVehiclePlateNumber(u?.vehiclePlateNumber || '');
        return;
      } finally {
        setMemberLoading(false);
      }
    }
    setMemberData(null);
    try {
      const { data } = await api.get('/api/locksmith/profile');
      const ls = data.locksmith;
      setUser(ls);
      await saveUser(ls);
      setVehicleType(ls?.vehicleType || '');
      setVehicleColor(ls?.vehicleColor || '');
      setVehiclePlateNumber(ls?.vehiclePlateNumber || '');
    } catch {
      const u = await getUser();
      setUser(u);
      setVehicleType(u?.vehicleType || '');
      setVehicleColor(u?.vehicleColor || '');
      setVehiclePlateNumber(u?.vehiclePlateNumber || '');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const pickAndUploadPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission', 'Photo access is needed to set your profile picture.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (res.canceled || !res.assets?.[0]?.uri) return;

    setPhotoUploading(true);
    try {
      const uri = res.assets[0].uri;
      const form = new FormData();
      form.append('profilePhoto', {
        uri,
        name: 'profile.jpg',
        type: mimeFromUri(uri),
      });
      if (isMember) {
        const up = await postMultipart('/api/member/profile/photo', form);
        const url = up.profilePhoto;
        if (!url) throw new Error('No image URL returned');
        await api.put('/api/member/profile', { profilePhoto: url });
        setUser((prev) => ({ ...prev, profilePhoto: url }));
        setMemberData((md) => ({ ...(md || {}), profilePhoto: url }));
        const p = await getUser();
        await saveUser({ ...p, profilePhoto: url, isMember: true });
        Alert.alert('Updated', 'Profile photo updated.');
        return;
      }
      const up = await postMultipart('/api/locksmith/profile/photo', form);
      const url = up.profilePhoto;
      if (!url) throw new Error('No image URL returned');

      await api.put('/api/locksmith/profile', { profilePhoto: url });
      const prev = await getUser();
      const merged = { ...prev, ...user, profilePhoto: url };
      await saveUser(merged);
      setUser(merged);
      Alert.alert('Updated', 'Profile photo saved.');
    } catch (e) {
      const msg =
        e?.response?.data?.error ||
        e?.message ||
        (e?.name === 'AbortError' ? 'Upload timed out.' : 'Upload failed.');
      Alert.alert('Error', msg);
    } finally {
      setPhotoUploading(false);
    }
  };

  const saveVehicle = async () => {
    setVehicleSaving(true);
    try {
      if (isMember) {
        await api.put('/api/member/profile', {
          vehicleType: vehicleType.trim() || undefined,
          vehicleColor: vehicleColor.trim() || undefined,
          vehiclePlateNumber: vehiclePlateNumber.trim() || undefined,
        });
        Alert.alert('Saved', 'Vehicle info updated.');
        return;
      }
      await api.put('/api/locksmith/profile', {
        vehicleType: vehicleType.trim() || undefined,
        vehicleColor: vehicleColor.trim() || undefined,
        vehiclePlateNumber: vehiclePlateNumber.trim() || undefined,
      });
      const prev = await getUser();
      const merged = {
        ...prev,
        ...user,
        vehicleType: vehicleType.trim() || null,
        vehicleColor: vehicleColor.trim() || null,
        vehiclePlateNumber: vehiclePlateNumber.trim() || null,
      };
      await saveUser(merged);
      await load();
      Alert.alert('Saved', 'Vehicle information updated.');
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'Could not save vehicle info.');
    } finally {
      setVehicleSaving(false);
    }
  };

  const signOut = () => {
    Alert.alert('Sign out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await clearAuth();
          router.replace('/welcome');
        },
      },
    ]);
  };

  const isBusiness = user?.accountType === 'BUSINESS';
  const headerProfilePhoto = isMember ? memberData?.profilePhoto : user?.profilePhoto;

  const vehAllSet =
    vehicleType.trim().length > 0 &&
    vehicleColor.trim().length > 0 &&
    vehiclePlateNumber.trim().length > 0;

  const items = isMember ? [
    { key: 'help', label: 'Help & Support', icon: 'help-circle-outline', path: '/help' },
    { key: 'terms', label: 'Terms & Privacy', icon: 'document-text-outline', path: '/terms' },
  ] : [
    {
      key: 'edit',
      label: 'Edit Account Details',
      icon: 'create-outline',
      path: '/edit-account',
    },
    { key: 'sched', label: 'Scheduled quote requests', icon: 'calendar-outline', path: '/scheduled-quotes' },
    { key: 'pricing', label: 'My Services & Pricing', icon: 'pricetags-outline', path: '/pricing' },
    { key: 'docs', label: 'My Documents', icon: 'document-text-outline', path: '/documents' },
    { key: 'bank', label: 'Bank Details', icon: 'card-outline', path: '/bank-details' },
    ...(isBusiness ? [{ key: 'team', label: 'Team Management', icon: 'people-outline', path: '/team' }] : []),
    { key: 'help', label: 'Help & Support', icon: 'help-circle-outline', path: '/help' },
    { key: 'terms', label: 'Terms & Privacy', icon: 'document-text-outline', path: '/terms' },
    { key: 'notif', label: 'Notifications', icon: 'notifications-outline', path: '/notifications' },
  ];

  if (isMember && memberLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={COLORS.accent} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, styles.scrollGrow]}
          keyboardShouldPersistTaps="handled"
        >
        <Text style={styles.h1}>Profile</Text>

        <View style={styles.photoSection}>
          <View style={styles.photoWrap}>
            <TouchableOpacity
              style={styles.photoTouchable}
              onPress={pickAndUploadPhoto}
              disabled={photoUploading}
              activeOpacity={0.85}
            >
              {photoUploading ? (
                <ActivityIndicator color={COLORS.accent} style={styles.photoLoader} />
              ) : (isMember ? memberData?.profilePhoto : user?.profilePhoto) ? (
                <Image
                  source={{ uri: isMember ? memberData?.profilePhoto : user?.profilePhoto }}
                  style={styles.photoImg}
                />
              ) : (
                <View style={styles.initialsCircle}>
                  <Text style={styles.initialsText}>
                    {initialsFromName(isMember ? memberData?.name : user?.name)}
                  </Text>
                </View>
              )}
              <View style={styles.photoHint}>
                <Ionicons name="camera" size={16} color={COLORS.bg} />
              </View>
            </TouchableOpacity>
            <View
              style={[
                styles.photoCompleteBadge,
                { backgroundColor: headerProfilePhoto ? COLORS.success : COLORS.error },
              ]}
            >
              <Ionicons
                name={headerProfilePhoto ? 'checkmark' : 'alert'}
                size={16}
                color="#fff"
              />
            </View>
          </View>
          <Text
            style={[
              styles.photoStatusLine,
              { color: headerProfilePhoto ? COLORS.success : COLORS.error },
            ]}
          >
            {headerProfilePhoto ? 'Profile photo added' : 'Add profile photo — required'}
          </Text>
        </View>

        <View style={styles.header}>
          <Text style={styles.name}>
            {isMember ? memberData?.name || user?.name : user?.name || 'Locksmith'}
          </Text>
          {!isMember && user?.businessName && (
            <Text style={{ color: COLORS.textMuted, fontSize: 14, textAlign: 'center', marginTop: 4 }}>
              {user.businessName}
            </Text>
          )}
          <Text style={styles.email}>{user?.email || ''}</Text>
          <View style={styles.badges}>
            <View style={[styles.badge, { marginRight: 8 }]}>
              <Text style={styles.badgeText}>{user?.accountType || '—'}</Text>
            </View>
            {user?.psiraVerified ? (
              <View style={[styles.badge, styles.badgeGold]}>
                <Ionicons name="shield-checkmark" size={14} color={COLORS.bg} />
                <Text style={styles.badgeGoldText}> PSIRA verified</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.rating}>
            Rating: {Number(user?.rating ?? 5).toFixed(1)}{' '}
            <Ionicons name="star" size={16} color={COLORS.accent} />
          </Text>
        </View>

        {isMember && user?.businessId && (
          <View style={{
            backgroundColor: COLORS.inputBg,
            marginHorizontal: 20,
            marginBottom: 16,
            borderRadius: 12,
            padding: 12,
            borderWidth: 1,
            borderColor: COLORS.accent,
            flexDirection: 'row',
            alignItems: 'center',
          }}>
            <Ionicons name="business-outline" size={16} color={COLORS.accent}
              style={{ marginRight: 8 }} />
            <Text style={{ color: COLORS.textMuted, fontSize: 13 }}>
              {user?.businessName
                ? `Working for: ${user.businessName}`
                : 'Team member account'}
            </Text>
          </View>
        )}

        <View style={styles.menu}>
          {items.map((it) => (
            <TouchableOpacity
              key={it.key}
              style={styles.row}
              onPress={() => router.push(it.path)}
              activeOpacity={0.85}
            >
              <Ionicons name={it.icon} size={22} color={COLORS.text} />
              <Text style={styles.rowLabel}>{it.label}</Text>
              <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.vehicleCard}>
          <Text
            style={[
              styles.vehicleCompletionStatus,
              { color: vehAllSet ? COLORS.success : COLORS.error },
            ]}
          >
            {vehAllSet
              ? 'Vehicle info complete'
              : isMember
                ? 'Vehicle info required to accept jobs'
                : 'Vehicle info required to go online'}
          </Text>
          <Text style={styles.vehicleTitle}>Vehicle information</Text>
          <Text style={styles.inputLabel}>Vehicle type</Text>
          <Text style={styles.inputHint}>e.g. Sedan, Bakkie, SUV</Text>
          <TextInput
            style={styles.input}
            value={vehicleType}
            onChangeText={setVehicleType}
            placeholder="Sedan, Bakkie, SUV…"
            placeholderTextColor="#666"
          />
          <Text style={styles.inputLabel}>Vehicle colour</Text>
          <Text style={styles.inputHint}>e.g. White, Silver, Black</Text>
          <TextInput
            style={styles.input}
            value={vehicleColor}
            onChangeText={setVehicleColor}
            placeholder="White, Silver, Black…"
            placeholderTextColor="#666"
          />
          <Text style={styles.inputLabel}>Plate number</Text>
          <Text style={styles.inputHint}>e.g. CA 123-456</Text>
          <TextInput
            style={styles.input}
            value={vehiclePlateNumber}
            onChangeText={setVehiclePlateNumber}
            placeholder="CA 123-456"
            placeholderTextColor="#666"
            autoCapitalize="characters"
          />
          <GoldButton title="Save Vehicle Info" onPress={saveVehicle} loading={vehicleSaving} />
        </View>

        <TouchableOpacity style={styles.row} onPress={signOut}>
          <Ionicons name="log-out-outline" size={22} color={COLORS.error} />
          <Text style={styles.signOut}>Sign Out</Text>
        </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  scroll: { paddingBottom: 32 },
  scrollGrow: { flexGrow: 1 },
  h1: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: '800',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  photoSection: { alignItems: 'center', marginBottom: 16 },
  photoWrap: { position: 'relative', alignSelf: 'center' },
  photoTouchable: { position: 'relative' },
  photoCompleteBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.bg,
  },
  photoStatusLine: { fontSize: 14, fontWeight: '600', marginTop: 10, textAlign: 'center' },
  photoImg: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    borderColor: COLORS.accent,
  },
  initialsCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: COLORS.inputBg,
    borderWidth: 2,
    borderColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: { color: COLORS.accent, fontSize: 32, fontWeight: '800' },
  photoLoader: { width: 96, height: 96 },
  photoHint: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: COLORS.accent,
    borderRadius: 14,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.bg,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  name: { color: COLORS.text, fontSize: 22, fontWeight: '700' },
  email: { color: COLORS.textMuted, marginTop: 6, fontSize: 15 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  badge: {
    backgroundColor: COLORS.inputBg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  badgeText: { color: COLORS.textMuted, fontSize: 12, fontWeight: '600' },
  badgeGold: {
    backgroundColor: COLORS.accent,
    flexDirection: 'row',
    alignItems: 'center',
  },
  badgeGoldText: { color: COLORS.bg, fontSize: 12, fontWeight: '700' },
  rating: { color: COLORS.textMuted, marginTop: 10, fontSize: 15 },
  menu: { padding: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.inputBg,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  rowLabel: {
    flex: 1,
    color: COLORS.text,
    fontSize: 16,
    marginLeft: 12,
    fontWeight: '500',
  },
  signOut: {
    flex: 1,
    color: COLORS.error,
    fontSize: 16,
    marginLeft: 12,
    fontWeight: '600',
  },
  vehicleCard: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
    padding: 16,
    backgroundColor: COLORS.inputBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  vehicleCompletionStatus: { fontSize: 14, fontWeight: '700', marginBottom: 10 },
  vehicleTitle: {
    color: COLORS.accent,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 12,
  },
  inputLabel: { color: COLORS.text, fontSize: 14, fontWeight: '600', marginBottom: 4 },
  inputHint: { color: COLORS.textMuted, fontSize: 12, marginBottom: 6 },
  input: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: COLORS.text,
    fontSize: 16,
    marginBottom: 12,
  },
});
