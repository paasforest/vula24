import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Alert,
  Platform,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { COLORS } from '../../constants/theme';
import api from '../../lib/api';
import { getUser } from '../../lib/storage';

const FALLBACK_LAT = -26.2041;
const FALLBACK_LNG = 28.0473;

const { width } = Dimensions.get('window');
const CARD_W = width * 0.42;

const SERVICES = [
  {
    key: 'HOUSE_LOCKOUT',
    label: 'House Lockout',
    icon: 'home',
    mode: 'EMERGENCY',
  },
  {
    key: 'CAR_LOCKOUT',
    label: 'Car Lockout',
    icon: 'car',
    mode: 'EMERGENCY',
  },
  {
    key: 'KEY_DUPLICATION',
    label: 'Key Duplication',
    icon: 'key-outline',
    mode: 'SCHEDULED',
  },
  {
    key: 'LOCK_REPLACEMENT',
    label: 'Lock Replacement',
    icon: 'lock-closed',
    mode: 'SCHEDULED',
  },
  {
    key: 'LOCK_REPAIR',
    label: 'Lock Repair',
    icon: 'construct',
    mode: 'SCHEDULED',
  },
];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

async function registerPushToken() {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return;
    const token = await Notifications.getExpoPushTokenAsync({
      projectId: Constants.expoConfig?.extra?.eas?.projectId,
    });
    if (token?.data) {
      await api.put('/api/customer/push-token', {
        pushToken: token.data,
      });
    }
    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#D4A017',
      });
    }
  } catch {
    /* ignore — never block home load */
  }
}

export default function HomeScreen() {
  const [user, setUser] = useState(null);
  const [region, setRegion] = useState({
    latitude: -26.2041,
    longitude: 28.0473,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });
  const [nearbyLocksmiths, setNearbyLocksmiths] = useState([]);
  const pushRegisteredRef = useRef(false);

  useEffect(() => {
    if (pushRegisteredRef.current) return;
    pushRegisteredRef.current = true;
    registerPushToken();
  }, []);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data;
        const jobId = data?.jobId;
        if (jobId) {
          router.push({
            pathname: '/tracking',
            params: { jobId: String(jobId) },
          });
        }
      }
    );
    return () => sub.remove();
  }, []);

  useFocusEffect(
    useCallback(() => {
      getUser().then(setUser);
    }, [])
  );

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location',
          'Location permission is needed to show your position on the map.'
        );
        return;
      }
      try {
        const loc = await Location.getCurrentPositionAsync({});
        setRegion({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        });
      } catch {
        /* keep default */
      }
    })();
  }, []);

  useEffect(() => {
    const isFallback =
      region.latitude === FALLBACK_LAT && region.longitude === FALLBACK_LNG;
    if (isFallback) {
      setNearbyLocksmiths([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get('/api/jobs/nearby', {
          params: { lat: region.latitude, lng: region.longitude },
        });
        if (!cancelled) {
          setNearbyLocksmiths(data.locksmiths || []);
        }
      } catch {
        if (!cancelled) {
          setNearbyLocksmiths([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [region.latitude, region.longitude]);

  const name = user?.name?.split(' ')[0] || 'there';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.greet}>
          {greeting()}, {name}
        </Text>
        <Text style={styles.sub}>What do you need help with?</Text>
      </View>

      <View style={styles.mapSection}>
        <Text style={styles.mapSectionTitle}>Near you</Text>
        <Text style={styles.mapSectionSub}>
          Locksmiths on the map when location is on
        </Text>
      </View>
      <View style={styles.mapWrap}>
        <MapView
          style={styles.map}
          mapType="standard"
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          googleRenderer="LATEST"
          loadingEnabled={Platform.OS === 'android'}
          loadingBackgroundColor="#E8EAED"
          region={region}
          showsUserLocation={false}
          showsMyLocationButton={false}
          rotateEnabled={false}
          pitchEnabled={false}
        >
          <Marker
            coordinate={{
              latitude: region.latitude,
              longitude: region.longitude,
            }}
            tracksViewChanges={false}
          />
          {nearbyLocksmiths.map((lm) => (
            <Marker
              key={lm.id}
              coordinate={{
                latitude: lm.currentLat,
                longitude: lm.currentLng,
              }}
              tracksViewChanges={false}
            >
              <View style={styles.bluePin} />
            </Marker>
          ))}
        </MapView>
      </View>

      <Text style={styles.sectionLabel}>Services</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.cardsRow}
      >
        {SERVICES.map((s) => (
          <TouchableOpacity
            key={s.key}
            style={styles.card}
            activeOpacity={0.9}
            onPress={() =>
              router.push({
                pathname: '/book',
                params: { serviceType: s.key, mode: s.mode },
              })
            }
          >
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{s.mode}</Text>
            </View>
            <Ionicons name={s.icon} size={36} color={COLORS.accent} />
            <Text style={styles.cardTitle}>{s.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingHorizontal: 20, paddingBottom: 12 },
  greet: { color: COLORS.text, fontSize: 22, fontWeight: '700' },
  sub: { color: COLORS.textMuted, marginTop: 6, fontSize: 16 },
  mapSection: {
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  mapSectionTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
  },
  mapSectionSub: {
    color: COLORS.textMuted,
    fontSize: 13,
    marginTop: 4,
  },
  mapWrap: {
    height: 200,
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  map: { flex: 1 },
  sectionLabel: {
    color: COLORS.textMuted,
    fontSize: 14,
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 10,
  },
  cardsRow: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  bluePin: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#1a73e8',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  card: {
    width: CARD_W,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 16,
    padding: 16,
    minHeight: 140,
    marginRight: 12,
  },
  badge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: COLORS.accent,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    color: COLORS.bg,
    fontSize: 10,
    fontWeight: '800',
  },
  cardTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
    marginTop: 12,
  },
});
