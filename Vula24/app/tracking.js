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
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../constants/theme';
import api from '../lib/api';

function distKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function etaMinutes(distanceKm) {
  const speed = 30;
  const hours = distanceKm / speed;
  return Math.max(1, Math.round(hours * 60));
}

export default function TrackingScreen() {
  const { jobId: jid } = useLocalSearchParams();
  const jobId = Array.isArray(jid) ? jid[0] : jid;

  const [job, setJob] = useState(null);
  const [ll, setLl] = useState({ lat: null, lng: null });
  const completedNavigated = useRef(false);

  const poll = useCallback(async () => {
    if (!jobId) return;
    try {
      const { data } = await api.get(`/api/jobs/${jobId}`);
      setJob(data.job);
      const lockLat = data.job?.locksmith?.currentLat;
      const lockLng = data.job?.locksmith?.currentLng;
      if (lockLat != null && lockLng != null) {
        setLl({ lat: lockLat, lng: lockLng });
      }
      if (data.job?.status === 'COMPLETED' && !completedNavigated.current) {
        completedNavigated.current = true;
        if (data.job?.finalPaid) {
          router.replace({
            pathname: '/review',
            params: { jobId },
          });
        } else {
          router.replace({
            pathname: '/payment',
            params: { jobId },
          });
        }
      }
    } catch {
      /* ignore */
    }
  }, [jobId]);

  useEffect(() => {
    poll();
    const t = setInterval(poll, 5000);
    return () => clearInterval(t);
  }, [poll]);

  const custLat = job?.customerLat;
  const custLng = job?.customerLng;
  const lock = job?.locksmith;

  const minutes =
    custLat != null &&
    custLng != null &&
    ll.lat != null &&
    ll.lng != null
      ? etaMinutes(distKm(custLat, custLng, ll.lat, ll.lng))
      : null;

  const region =
    custLat != null && custLng != null
      ? {
          latitude: (custLat + (ll.lat || custLat)) / 2,
          longitude: (custLng + (ll.lng || custLng)) / 2,
          latitudeDelta: 0.08,
          longitudeDelta: 0.08,
        }
      : {
          latitude: -26.2,
          longitude: 28.05,
          latitudeDelta: 0.1,
          longitudeDelta: 0.1,
        };

  const banner = () => {
    const s = job?.status;
    if (s === 'ARRIVED') {
      return (
        <View style={styles.bannerGold}>
          <Text style={styles.bannerGoldText}>Your locksmith has arrived</Text>
        </View>
      );
    }
    if (s === 'IN_PROGRESS') {
      return (
        <View style={styles.bannerDark}>
          <Text style={styles.bannerText}>Job in progress...</Text>
        </View>
      );
    }
    return null;
  };

  return (
    <View style={styles.flex}>
      <MapView
        style={StyleSheet.absoluteFill}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        region={region}
      >
        {custLat != null && custLng != null ? (
          <Marker coordinate={{ latitude: custLat, longitude: custLng }} tracksViewChanges={false}>
            <View style={styles.pinGold} />
          </Marker>
        ) : null}
        {ll.lat != null && ll.lng != null ? (
          <Marker coordinate={{ latitude: ll.lat, longitude: ll.lng }} tracksViewChanges={false}>
            <View style={styles.pinWhite} />
          </Marker>
        ) : null}
      </MapView>

      {banner()}

      <SafeAreaView style={styles.cardWrap} edges={['bottom']}>
        <View style={styles.card}>
          <Text style={styles.name}>{lock?.name || 'Locksmith'}</Text>
          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((i) => (
              <Ionicons
                key={i}
                name={i <= Math.round(lock?.rating || 5) ? 'star' : 'star-outline'}
                size={18}
                color={COLORS.accent}
              />
            ))}
          </View>
          <Text style={styles.eta}>
            {minutes != null ? `Arriving in ~${minutes} minutes` : 'Calculating arrival…'}
          </Text>
          <View style={styles.row}>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => {
                if (lock?.phone) Linking.openURL(`tel:${lock.phone}`);
                else Alert.alert('Phone', 'No phone on file.');
              }}
            >
              <Ionicons name="call" size={26} color={COLORS.bg} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.sos}
              onPress={() => Linking.openURL('tel:10111')}
            >
              <Text style={styles.sosText}>SOS</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.bg },
  pinGold: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.accent,
    borderWidth: 2,
    borderColor: '#fff',
  },
  pinWhite: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: COLORS.accent,
  },
  bannerGold: {
    position: 'absolute',
    top: 48,
    left: 16,
    right: 16,
    backgroundColor: COLORS.accent,
    padding: 14,
    borderRadius: 12,
  },
  bannerGoldText: { color: COLORS.bg, fontWeight: '700', textAlign: 'center' },
  bannerDark: {
    position: 'absolute',
    top: 48,
    left: 16,
    right: 16,
    backgroundColor: '#1A1A1A',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  bannerText: { color: COLORS.text, textAlign: 'center' },
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
  name: { color: COLORS.text, fontSize: 20, fontWeight: '700' },
  stars: { flexDirection: 'row', marginTop: 8 },
  eta: { color: COLORS.textMuted, marginTop: 8, fontSize: 15 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  iconBtn: {
    backgroundColor: COLORS.accent,
    padding: 14,
    borderRadius: 12,
    marginRight: 12,
  },
  sos: {
    backgroundColor: COLORS.error,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  sosText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
