import { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Linking,
  Alert,
  TouchableOpacity,
  Platform,
  Image,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../constants/theme';
import api from '../lib/api';

function initialsFromName(name) {
  if (!name?.trim()) return '?';
  const p = name.trim().split(/\s+/);
  if (p.length >= 2) return (p[0][0] + p[1][0]).toUpperCase();
  return name.trim().slice(0, 2).toUpperCase();
}

function vehicleColorAndType(lock) {
  if (!lock) return null;
  const c = lock.vehicleColor?.trim();
  const t = lock.vehicleType?.trim();
  const line = [c, t].filter(Boolean).join(' ');
  return line || null;
}

const DEFAULT_MAP_REGION = {
  latitude: -26.2,
  longitude: 28.05,
  latitudeDelta: 0.1,
  longitudeDelta: 0.1,
};

function safeRegion(region) {
  if (!region) return null;
  if (
    typeof region.latitude !== 'number' ||
    isNaN(region.latitude)
  )
    return null;
  if (
    typeof region.longitude !== 'number' ||
    isNaN(region.longitude)
  )
    return null;
  return region;
}

export default function TrackingScreen() {
  const { jobId: jid } = useLocalSearchParams();
  const jobId = Array.isArray(jid) ? jid[0] : jid;

  const [job, setJob] = useState(null);
  const [ll, setLl] = useState({ lat: null, lng: null });
  const completedNavigated = useRef(false);

  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;

    const poll = async () => {
      if (cancelled) return;
      try {
        const { data } = await api.get(`/api/jobs/${jobId}`);
        if (cancelled) return;
        setJob(data.job);

        const lat = data.job?.locksmith?.currentLat;
        const lng = data.job?.locksmith?.currentLng;
        if (
          typeof lat === 'number' &&
          typeof lng === 'number' &&
          !isNaN(lat) &&
          !isNaN(lng)
        ) {
          setLl({ lat, lng });
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
    };

    poll();
    const t = setInterval(poll, 5000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [jobId]);

  const custLat = job?.customerLat;
  const custLng = job?.customerLng;
  const lock = job?.locksmith;

  const custLatOk =
    typeof custLat === 'number' && !isNaN(custLat);
  const custLngOk =
    typeof custLng === 'number' && !isNaN(custLng);
  const llLatOk =
    typeof ll.lat === 'number' && !isNaN(ll.lat);
  const llLngOk =
    typeof ll.lng === 'number' && !isNaN(ll.lng);

  const rawRegion =
    custLatOk && custLngOk
      ? {
          latitude:
            (custLat + (llLatOk ? ll.lat : custLat)) / 2,
          longitude:
            (custLng + (llLngOk ? ll.lng : custLng)) / 2,
          latitudeDelta: 0.08,
          longitudeDelta: 0.08,
        }
      : DEFAULT_MAP_REGION;

  const region = safeRegion(rawRegion) ?? DEFAULT_MAP_REGION;

  const banner = () => {
    if (job?.isDisputed) {
      return (
        <View style={styles.disputeBanner}>
          <Text style={styles.disputeBannerText}>
            Dispute in progress — our team is reviewing your case
          </Text>
        </View>
      );
    }
    const s = job?.status;
    if (s === 'DISPATCHED' || s === 'ACCEPTED') {
      return (
        <View style={styles.bannerDark}>
          <Text style={styles.bannerText}>Locksmith is on the way</Text>
        </View>
      );
    }
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
        {typeof custLat === 'number' &&
        typeof custLng === 'number' &&
        !isNaN(custLat) &&
        !isNaN(custLng) ? (
          <Marker
            coordinate={{
              latitude: custLat,
              longitude: custLng,
            }}
            tracksViewChanges={false}
          >
            <View style={styles.pinGold} />
          </Marker>
        ) : null}
        {typeof ll.lat === 'number' &&
        typeof ll.lng === 'number' &&
        !isNaN(ll.lat) &&
        !isNaN(ll.lng) ? (
          <Marker
            coordinate={{
              latitude: ll.lat,
              longitude: ll.lng,
            }}
            tracksViewChanges={false}
          >
            <View style={styles.pinWhite} />
          </Marker>
        ) : null}
      </MapView>

      {banner()}

      <SafeAreaView style={styles.cardWrap} edges={['bottom']}>
        <View style={styles.card}>
          <View style={styles.cardTop}>
            {lock?.profilePhoto ? (
              <Image source={{ uri: lock.profilePhoto }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarInitials}>
                <Text style={styles.avatarInitialsText}>
                  {initialsFromName(lock?.name)}
                </Text>
              </View>
            )}
            <View style={styles.cardMid}>
              <Text style={styles.name} numberOfLines={1}>
                {lock?.name || 'Locksmith'}
              </Text>
              <Text style={styles.ratingJobsLine}>
                ★ {Number(lock?.rating ?? 5).toFixed(1)} · {lock?.totalJobs ?? 0} jobs
              </Text>
              {vehicleColorAndType(lock) ? (
                <Text style={styles.vehicleDesc} numberOfLines={1}>
                  {vehicleColorAndType(lock)}
                </Text>
              ) : null}
            </View>
            <TouchableOpacity
              style={styles.callCircle}
              onPress={() => {
                if (lock?.phone) Linking.openURL(`tel:${lock.phone}`);
                else Alert.alert('Phone', 'No phone on file.');
              }}
            >
              <Ionicons name="call" size={22} color={COLORS.bg} />
            </TouchableOpacity>
          </View>
          {lock?.vehiclePlateNumber?.trim() ? (
            <View style={styles.plateSection}>
              <Text style={styles.plateLabel}>Look for this plate</Text>
              <View style={styles.plateBox}>
                <Text style={styles.plateText}>{lock.vehiclePlateNumber.trim()}</Text>
              </View>
            </View>
          ) : null}
        </View>
        <TouchableOpacity style={styles.sos} onPress={() => Linking.openURL('tel:10111')}>
          <Text style={styles.sosText}>SOS</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.bg },
  disputeBanner: {
    position: 'absolute',
    top: 48,
    left: 16,
    right: 16,
    backgroundColor: '#2a1a00',
    borderWidth: 1,
    borderColor: '#ff9500',
    borderRadius: 10,
    padding: 12,
  },
  disputeBannerText: {
    color: '#ff9500',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
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
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: COLORS.accent,
  },
  avatarInitials: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitialsText: {
    color: COLORS.bg,
    fontSize: 18,
    fontWeight: '800',
  },
  cardMid: { flex: 1, marginLeft: 12, marginRight: 8, minWidth: 0, justifyContent: 'center' },
  name: { color: COLORS.text, fontSize: 18, fontWeight: '700' },
  ratingJobsLine: {
    color: COLORS.textMuted,
    fontSize: 13,
    marginTop: 4,
  },
  vehicleDesc: {
    color: COLORS.textMuted,
    fontSize: 13,
    marginTop: 4,
  },
  callCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plateSection: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#2a2a2a',
  },
  plateLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: 4,
  },
  plateBox: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 10,
  },
  plateText: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
  },
  sos: {
    backgroundColor: COLORS.error,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    alignItems: 'center',
  },
  sosText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
