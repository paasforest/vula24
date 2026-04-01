import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Linking,
  Alert,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { GoldButton } from '../components/GoldButton';
import { COLORS } from '../constants/theme';
import api from '../lib/api';

export default function ActiveJobScreen() {
  const { jobId: jid } = useLocalSearchParams();
  const jobId = Array.isArray(jid) ? jid[0] : jid;

  const [job, setJob] = useState(null);
  const locInterval = useRef(null);

  const load = useCallback(async () => {
    if (!jobId) return;
    try {
      const { data } = await api.get(`/api/jobs/locksmith/job/${jobId}`);
      setJob(data.job);
      if (data.job?.status === 'COMPLETED' || data.job?.status === 'CANCELLED') {
        router.replace('/(tabs)/dashboard');
      }
    } catch {
      /* ignore */
    }
  }, [jobId]);

  useEffect(() => {
    load();
    const p = setInterval(load, 5000);
    return () => clearInterval(p);
  }, [load]);

  const sendLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({});
      await api.post('/api/locksmith/location/update', {
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
      });
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const s = job?.status;
    const active = s === 'ACCEPTED' || s === 'ARRIVED' || s === 'IN_PROGRESS';
    if (!active) {
      if (locInterval.current) {
        clearInterval(locInterval.current);
        locInterval.current = null;
      }
      return undefined;
    }
    sendLocation();
    locInterval.current = setInterval(sendLocation, 10000);
    return () => {
      if (locInterval.current) clearInterval(locInterval.current);
      locInterval.current = null;
    };
  }, [job?.status, sendLocation]);

  const action = async (path) => {
    if (!jobId) return;
    try {
      await api.post(`/api/jobs/${jobId}${path}`);
      await load();
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'Action failed.');
    }
  };

  const custLat = job?.customerLat;
  const custLng = job?.customerLng;
  const region =
    custLat != null && custLng != null
      ? {
          latitude: custLat,
          longitude: custLng,
          latitudeDelta: 0.06,
          longitudeDelta: 0.06,
        }
      : {
          latitude: -26.2,
          longitude: 28.05,
          latitudeDelta: 0.1,
          longitudeDelta: 0.1,
        };

  const status = job?.status;
  let primary = null;
  if (status === 'ACCEPTED') {
    primary = { label: 'I Have Arrived', onPress: () => action('/arrived') };
  } else if (status === 'ARRIVED') {
    primary = { label: 'Start Job', onPress: () => action('/start') };
  } else if (status === 'IN_PROGRESS') {
    primary = { label: 'Complete Job', onPress: () => action('/complete') };
  }

  const phone = job?.customer?.phone;

  return (
    <View style={styles.flex}>
      <MapView
        style={StyleSheet.absoluteFill}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        region={region}
      >
        {custLat != null && custLng != null ? (
          <Marker coordinate={{ latitude: custLat, longitude: custLng }} tracksViewChanges={false}>
            <View style={styles.pin} />
          </Marker>
        ) : null}
      </MapView>

      <SafeAreaView style={styles.topBar} edges={['top']}>
        <Text style={styles.navHint}>Navigate to the customer pin</Text>
      </SafeAreaView>

      <SafeAreaView style={styles.cardWrap} edges={['bottom']}>
        <View style={styles.card}>
          <Text style={styles.custName}>{job?.customer?.name || 'Customer'}</Text>
          {job?.customerNote ? (
            <Text style={styles.note}>{job.customerNote}</Text>
          ) : null}
          <Text style={styles.svc}>{job?.serviceType?.replace(/_/g, ' ')}</Text>
          <Text style={styles.addr}>{job?.customerAddress}</Text>

          {primary ? (
            <GoldButton title={primary.label} onPress={primary.onPress} />
          ) : null}

          <TouchableOpacity
            style={styles.call}
            onPress={() => {
              if (phone) Linking.openURL(`tel:${phone}`);
              else Alert.alert('Phone', 'No phone on file.');
            }}
          >
            <Ionicons name="call" size={22} color={COLORS.bg} style={{ marginRight: 8 }} />
            <Text style={styles.callText}>Call customer</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.bg },
  pin: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.accent,
    borderWidth: 3,
    borderColor: '#fff',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  navHint: {
    backgroundColor: 'rgba(17,17,17,0.9)',
    marginHorizontal: 16,
    padding: 12,
    borderRadius: 12,
    color: COLORS.text,
    textAlign: 'center',
    overflow: 'hidden',
  },
  cardWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  card: {
    backgroundColor: COLORS.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  custName: { color: COLORS.text, fontSize: 20, fontWeight: '800' },
  note: { color: COLORS.textMuted, marginTop: 8, fontSize: 15 },
  svc: { color: COLORS.accent, marginTop: 12, fontSize: 17, fontWeight: '700' },
  addr: { color: COLORS.textMuted, marginTop: 8, marginBottom: 16, fontSize: 15 },
  call: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.accent,
    padding: 14,
    borderRadius: 12,
    marginTop: 12,
  },
  callText: { color: COLORS.bg, fontWeight: '700', fontSize: 16 },
});
