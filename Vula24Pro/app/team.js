import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { FormInput } from '../components/FormInput';
import { GoldButton } from '../components/GoldButton';
import { COLORS } from '../constants/theme';
import api from '../lib/api';

export default function TeamScreen() {
  const insets = useSafeAreaInsets();
  const [members, setMembers] = useState([]);
  const [profile, setProfile] = useState(null);
  const [modal, setModal] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [appEmail, setAppEmail] = useState('');
  const [appPassword, setAppPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/api/locksmith/profile');
      setProfile(data.locksmith);
      if (data.locksmith.accountType !== 'BUSINESS') {
        return;
      }
      const { data: t } = await api.get('/api/locksmith/team');
      setMembers(t.members || []);
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'Could not load team.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const addMember = async () => {
    setLoading(true);
    try {
      await api.post('/api/locksmith/team/add', {
        name: name.trim(),
        phone: phone.trim(),
        appEmail: appEmail.trim().toLowerCase(),
        appPassword,
      });
      Alert.alert(
        'Team member added',
        'Share these login details with ' + name.trim() +
        ':\n\nEmail: ' + appEmail.trim() +
        '\nPassword: ' + appPassword +
        '\n\nThey can login using the "Team member? Login here"' +
        ' option on the Pro app login screen.',
        [{ text: 'OK' }]
      );
      setModal(false);
      setName('');
      setPhone('');
      setAppEmail('');
      setAppPassword('');
      await load();
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'Could not add member.');
    } finally {
      setLoading(false);
    }
  };

  const deactivate = (memberId) => {
    Alert.alert('Deactivate', 'This member will lose access.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Deactivate',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.post(`/api/locksmith/team/${memberId}/deactivate`);
            await load();
          } catch (e) {
            Alert.alert('Error', e.response?.data?.error || 'Failed.');
          }
        },
      },
    ]);
  };

  if (profile && profile.accountType !== 'BUSINESS') {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <TouchableOpacity style={styles.back} onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.h1}>Team</Text>
        <Text style={styles.empty}>Not available for individual accounts.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <TouchableOpacity style={styles.back} onPress={() => router.back()}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>
      <Text style={styles.h1}>Team management</Text>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />
        }
        contentContainerStyle={styles.scroll}
      >
        {members.map((m) => (
          <View key={m.id} style={styles.card}>
            <Text style={styles.n}>{m.name}</Text>
            <Text style={styles.p}>{m.phone}</Text>
            <View style={styles.row}>
              <View
                style={[
                  styles.badge,
                  { backgroundColor: m.isActive ? '#1b3d1b' : '#3a1515' },
                ]}
              >
                <Text style={styles.badgeT}>{m.isActive ? 'Active' : 'Inactive'}</Text>
              </View>
              {m.isActive ? (
                <TouchableOpacity onPress={() => deactivate(m.id)}>
                  <Text style={styles.deact}>Deactivate</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        ))}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom + 16, 32) }]}>
        <GoldButton title="Add Team Member" onPress={() => setModal(true)} />
      </View>

      <Modal visible={modal} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalKav}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        >
          <View style={styles.modalBg}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.modalScroll}
            >
              <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>New team member</Text>
                <FormInput label="Name" value={name} onChangeText={setName} />
                <FormInput label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
                <FormInput
                  label="App email"
                  value={appEmail}
                  onChangeText={setAppEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <FormInput
                  label="App password"
                  value={appPassword}
                  onChangeText={setAppPassword}
                  secureTextEntry
                />
                <GoldButton title="Create" onPress={addMember} loading={loading} />
                <TouchableOpacity onPress={() => setModal(false)}>
                  <Text style={styles.cancel}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  back: { paddingHorizontal: 20, marginBottom: 8 },
  backText: { color: COLORS.accent, fontSize: 16 },
  h1: { color: COLORS.text, fontSize: 22, fontWeight: '800', paddingHorizontal: 20, marginBottom: 12 },
  scroll: { paddingHorizontal: 20, paddingBottom: 160 },
  empty: { color: COLORS.textMuted, padding: 20 },
  card: {
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    backgroundColor: COLORS.inputBg,
  },
  n: { color: COLORS.text, fontSize: 17, fontWeight: '700' },
  p: { color: COLORS.textMuted, marginTop: 4 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeT: { color: COLORS.text, fontSize: 12, fontWeight: '700' },
  deact: { color: COLORS.error, fontWeight: '700' },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.bg,
  },
  modalKav: { flex: 1 },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
  },
  modalScroll: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  modalCard: {
    backgroundColor: COLORS.bg,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  modalTitle: { color: COLORS.text, fontSize: 20, fontWeight: '700', marginBottom: 12 },
  cancel: { color: COLORS.accent, textAlign: 'center', marginTop: 12 },
});
