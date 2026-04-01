import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { FormInput } from '../components/FormInput';
import { GoldButton } from '../components/GoldButton';
import { COLORS } from '../constants/theme';
import { estimateCustomerPays } from '../lib/pricingPreview';
import api from '../lib/api';

const SERVICES = [
  { key: 'CAR_LOCKOUT', label: 'Car lockout', icon: 'car' },
  { key: 'HOUSE_LOCKOUT', label: 'House lockout', icon: 'home' },
  { key: 'KEY_DUPLICATION', label: 'Key duplication', icon: 'key-outline' },
  { key: 'LOCK_REPLACEMENT', label: 'Lock replacement', icon: 'lock-closed' },
  { key: 'LOCK_REPAIR', label: 'Lock repair', icon: 'construct' },
];

export default function PricingScreen() {
  const [rows, setRows] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/api/locksmith/pricing');
      const map = {};
      (data.pricing || []).forEach((p) => {
        map[p.serviceType] = {
          isOffered: p.isOffered,
          basePrice: String(p.basePrice > 0 ? p.basePrice : ''),
        };
      });
      SERVICES.forEach((s) => {
        if (!map[s.key]) {
          map[s.key] = { isOffered: false, basePrice: '' };
        }
      });
      setRows(map);
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'Could not load pricing.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const updatePrice = (key, text) => {
    setRows((prev) => ({
      ...prev,
      [key]: { ...prev[key], basePrice: text.replace(/[^0-9.]/g, '') },
    }));
  };

  const toggle = (key, v) => {
    setRows((prev) => ({
      ...prev,
      [key]: { ...prev[key], isOffered: v },
    }));
  };

  const save = async () => {
    const payload = SERVICES.map((s) => {
      const r = rows[s.key] || { isOffered: false, basePrice: '' };
      const bp = parseFloat(String(r.basePrice), 10);
      if (r.isOffered && (Number.isNaN(bp) || bp <= 0)) {
        Alert.alert('Pricing', `Enter a valid price for ${s.label}.`);
        throw new Error('validation');
      }
      return {
        serviceType: s.key,
        basePrice: r.isOffered ? bp : 1,
        isOffered: !!r.isOffered,
      };
    });
    setSaving(true);
    try {
      await api.post('/api/locksmith/pricing', payload);
      Alert.alert('Saved', 'Your pricing has been updated.');
      router.back();
    } catch (e) {
      if (e.message !== 'validation') {
        Alert.alert('Error', e.response?.data?.error || 'Could not save.');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ActivityIndicator color={COLORS.accent} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <TouchableOpacity style={styles.back} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.accent} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.h1}>My services & pricing</Text>
        <Text style={styles.hint}>
          Platform adds 25% on top of your price; travel fee depends on distance (shown to customer
          at booking).
        </Text>

        {SERVICES.map((s) => {
          const r = rows[s.key] || { isOffered: false, basePrice: '' };
          const bp = parseFloat(String(r.basePrice), 10);
          const preview = !Number.isNaN(bp) && bp > 0 && r.isOffered
            ? estimateCustomerPays(bp, 8)
            : null;
          return (
            <View key={s.key} style={styles.card}>
              <View style={styles.row}>
                <Ionicons name={s.icon} size={28} color={COLORS.accent} />
                <Text style={styles.svc}>{s.label}</Text>
                <Switch
                  value={r.isOffered}
                  onValueChange={(v) => toggle(s.key, v)}
                  trackColor={{ false: '#444', true: '#3d3310' }}
                  thumbColor={r.isOffered ? COLORS.accent : '#888'}
                />
              </View>
              {r.isOffered ? (
                <>
                  <FormInput
                    label="My price (R)"
                    value={r.basePrice}
                    onChangeText={(t) => updatePrice(s.key, t)}
                    keyboardType="decimal-pad"
                    placeholder="0"
                  />
                  {preview ? (
                    <Text style={styles.customer}>
                      Customer pays (approx., 8km): R {preview.totalPrice.toFixed(2)}
                    </Text>
                  ) : null}
                </>
              ) : null}
            </View>
          );
        })}

        <GoldButton title="Save pricing" onPress={save} loading={saving} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { padding: 20, paddingBottom: 40 },
  back: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  backText: { color: COLORS.accent, marginLeft: 8, fontSize: 16 },
  h1: { color: COLORS.text, fontSize: 22, fontWeight: '800', marginBottom: 8 },
  hint: { color: COLORS.accent, fontSize: 13, marginBottom: 16, lineHeight: 20 },
  card: {
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    backgroundColor: COLORS.inputBg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  svc: { flex: 1, color: COLORS.text, fontSize: 17, fontWeight: '700', marginLeft: 12 },
  customer: { color: COLORS.textMuted, fontSize: 14, marginTop: 4 },
});
