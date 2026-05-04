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
import { getUser } from '../lib/storage';

export default function ActiveJobScreen() {
  const { jobId: jid } = useLocalSearchParams();
  const jobId = Array.isArray(jid) ? jid[0] : jid;

  const [job, setJob] = useState(null);
  const [isMember, setIsMember] = useState(false);
  const locInterval = useRef(null);

  useEffect(() => {
    getUser().then((u) => setIsMember(u?.isMember === true));
  }, []);

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
      const lat = loc.coords.latitude;
      const lng = loc.coords.longitude;
      if (isMember) {
        await api.post('/api/member/location/update', {
          lat,
          lng,
        });
      } else {
        await api.post('/api/locksmith/location/update', {
          lat,
          lng,
        });
      }
    } catch {
      /* ignore */
    }
  }, [isMember]);

  useEffect(() => {
    const s = job?.status;
    const mode = job?.mode;
    let shouldPing = false;
    if (mode === 'EMERGENCY') {
      shouldPing =
        s === 'DISPATCHED' || s === 'ARRIVED' || s === 'IN_PROGRESS';
    } else {
      shouldPing =
        s === 'ACCEPTED' || s === 'ARRIVED' || s === 'IN_PROGRESS';
    }

    if (!shouldPing) {
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
  }, [job?.status, job?.mode, sendLocation]);

  const action = async (path) => {
    if (!jobId) return;
    try {
      if (isMember) {
        await api.post(
          `/api/member/jobs/${jobId}${path}`
        );
      } else {
        await api.post(
          `/api/jobs/${jobId}${path}`
        );
      }
      await load();
    } catch (e) {
      Alert.alert(
        'Error',
        e.response?.data?.error || 'Action failed.'
      );
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

  const jobStatus = job?.status;
  const jobMode = job?.mode;
  const isDisputed = job?.isDisputed === true;
  let primary = null;
  if (!isDisputed) {
    if (jobStatus === 'ACCEPTED' && jobMode === 'EMERGENCY') {
      primary = null;
    } else if (jobStatus === 'DISPATCHED') {
      primary = { label: 'I Have Arrived', onPress: () => action('/arrived') };
    } else if (jobStatus === 'ACCEPTED' && jobMode !== 'EMERGENCY') {
      primary = { label: 'I Have Arrived', onPress: () => action('/arrived') };
    } else if (jobStatus === 'ARRIVED') {
      primary = { label: 'Start Job', onPress: () => action('/start') };
    } else if (jobStatus === 'IN_PROGRESS') {
      primary = { label: 'Complete Job', onPress: () => action('/complete') };
    }
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
        <Text style={styles.navHint}>
          {isDisputed
            ? 'Dispute in progress — check notifications'
            : jobStatus === 'ACCEPTED' && jobMode === 'EMERGENCY'
              ? 'Waiting for customer payment…'
              : 'Head out now — navigate to the customer pin'}
        </Text>
      </SafeAreaView>

      <SafeAreaView style={styles.cardWrap} edges={['bottom']}>
        <View style={styles.card}>
          <Text style={styles.custName}>{job?.customer?.name || 'Customer'}</Text>
          {job?.customerNote ? (
            <Text style={styles.note}>{job.customerNote}</Text>
          ) : null}
          <Text style={styles.svc}>{job?.serviceType?.replace(/_/g, ' ')}</Text>
          <Text style={styles.addr}>{job?.customerAddress}</Text>

          {!isDisputed && jobStatus === 'ACCEPTED' && jobMode === 'EMERGENCY' ? (
            <Text style={styles.waitPay}>Waiting for customer payment…</Text>
          ) : null}

          {isDisputed ? (
            <View style={styles.disputeCard}>
              <Text style={styles.disputeTitle}>Dispute in progress</Text>
              <Text style={styles.disputeBody}>
                A dispute has been raised for this job. Your payout is on hold until it is
                resolved. Please check your notifications for updates or contact support.
              </Text>
              <TouchableOpacity
                style={styles.disputeBtn}
                onPress={() => Linking.openURL('https://wa.me/27661235067')}
              >
                <Text style={styles.disputeBtnText}>Contact Support</Text>
              </TouchableOpacity>
            </View>
          ) : primary ? (
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

          {job?.status === 'COMPLETED' && !isMember && (
            <TouchableOpacity
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: COLORS.inputBg,
                borderWidth: 1,
                borderColor: COLORS.accent,
                borderRadius: 12,
                padding: 14,
                marginTop: 12,
              }}
              onPress={() => router.push({ pathname: '/job-receipt', params: { jobId: job.id } })}
            >
              <Ionicons name="receipt-outline" size={18} color={COLORS.accent} style={{ marginRight: 8 }} />
              <Text style={{ color: COLORS.accent, fontWeight: '700' }}>View Receipt</Text>
            </TouchableOpacity>
          )}
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
  waitPay: {
    color: COLORS.accent,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  disputeCard: {
    margin: 16,
    backgroundColor: '#1a0a00',
    borderWidth: 1.5,
    borderColor: '#ff9500',
    borderRadius: 16,
    padding: 20,
  },
  disputeTitle: {
    color: '#ff9500',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  disputeBody: {
    color: COLORS.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  disputeBtn: {
    backgroundColor: '#ff9500',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  disputeBtnText: {
    color: '#111',
    fontWeight: '700',
    fontSize: 14,
  },
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
