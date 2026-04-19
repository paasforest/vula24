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
  Animated,
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
const SCHEDULED_CARD_W = (width - 48) / 2;

const SERVICES = {
  emergency: [
    { key: 'CAR_LOCKOUT', label: 'Car Lockout', icon: 'car' },
    { key: 'HOUSE_LOCKOUT', label: 'House Lockout', icon: 'home' },
    { key: 'OFFICE_LOCKOUT', label: 'Office Lockout', icon: 'business' },
  ],
  scheduled: [
    { key: 'KEY_DUPLICATION', label: 'Key Duplication', icon: 'key-outline' },
    { key: 'CAR_KEY_PROGRAMMING', label: 'Car Key Programming', icon: 'radio-outline' },
    { key: 'CAR_KEY_CUTTING', label: 'Car Key Cutting', icon: 'cut-outline' },
    { key: 'BROKEN_KEY_EXTRACTION', label: 'Broken Key Extraction', icon: 'build-outline' },
    { key: 'LOST_KEY_REPLACEMENT', label: 'Lost Key Replacement', icon: 'search-outline' },
    { key: 'IGNITION_REPAIR', label: 'Ignition Repair', icon: 'flash-outline' },
    { key: 'LOCK_REPLACEMENT', label: 'Lock Replacement', icon: 'lock-closed' },
    { key: 'LOCK_REPAIR', label: 'Lock Repair', icon: 'construct' },
    { key: 'LOCK_UPGRADE', label: 'Lock Upgrade', icon: 'shield-checkmark-outline' },
    { key: 'DEADLOCK_INSTALLATION', label: 'Deadlock Installation', icon: 'lock-open-outline' },
    { key: 'SAFE_OPENING', label: 'Safe Opening', icon: 'cube-outline' },
    { key: 'GATE_MOTOR_REPAIR', label: 'Gate Motor Repair', icon: 'git-merge-outline' },
    { key: 'ACCESS_CONTROL', label: 'Access Control', icon: 'finger-print-outline' },
    { key: 'PADLOCK_REMOVAL', label: 'Padlock Removal', icon: 'remove-circle-outline' },
    { key: 'GARAGE_DOOR', label: 'Garage Door', icon: 'home-outline' },
    { key: 'SECURITY_GATE', label: 'Security Gate', icon: 'shield-outline' },
    { key: 'ELECTRIC_FENCE_GATE', label: 'Electric Fence/Gate', icon: 'flash' },
  ],
};

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
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

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
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.mapContainer}>
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
            >
              <View style={styles.userPin}>
                <View style={styles.userPinInner} />
              </View>
            </Marker>
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

          <View style={styles.mapOverlay} pointerEvents="none">
            <View style={styles.mapOverlayCard}>
              <Text style={styles.greet}>
                {greeting()}, {name}
              </Text>
              <Text style={styles.sub}>
                What do you need help with?
              </Text>
              <View style={styles.availabilityRow}>
                <View
                  style={[
                    styles.availabilityDot,
                    {
                      backgroundColor:
                        nearbyLocksmiths.length > 0 ? '#34c759' : '#888',
                    },
                  ]}
                />
                <Text
                  style={[
                    styles.availabilityText,
                    {
                      color:
                        nearbyLocksmiths.length > 0
                          ? '#34c759'
                          : COLORS.textMuted,
                    },
                  ]}
                >
                  {nearbyLocksmiths.length > 0
                    ? `${nearbyLocksmiths.length} locksmith${
                        nearbyLocksmiths.length > 1 ? 's' : ''
                      } available near you`
                    : 'Searching for locksmiths...'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.servicesWrap}>
          {/* Emergency section */}
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderLeft}>
              <Animated.View
                style={[styles.emergencyDot, { opacity: pulseAnim }]}
              />
              <Text style={styles.sectionTitle}>Emergency</Text>
            </View>
            <Text style={[styles.sectionRight, { color: '#ff3b30' }]}>
              Available 24/7
            </Text>
          </View>

          <View style={styles.emergencyRow}>
            {SERVICES.emergency.map((s) => (
              <TouchableOpacity
                key={s.key}
                style={styles.emergencyCard}
                activeOpacity={0.85}
                onPress={() =>
                  router.push({
                    pathname: '/book',
                    params: { serviceType: s.key, mode: 'EMERGENCY' },
                  })
                }
              >
                <View style={styles.emergencyIconWrap}>
                  <Ionicons name={s.icon} size={26} color="#ff3b30" />
                </View>
                <Text style={styles.emergencyLabel}>{s.label}</Text>
                <View style={styles.urgentBadge}>
                  <Text style={styles.urgentText}>Urgent</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Scheduled section */}
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderLeft}>
              <View style={styles.scheduledDot} />
              <Text style={styles.sectionTitle}>Scheduled Services</Text>
            </View>
            <Text style={[styles.sectionRight, { color: COLORS.accent }]}>
              Book ahead
            </Text>
          </View>

          <View style={styles.scheduledGrid}>
            {SERVICES.scheduled.map((s) => (
              <TouchableOpacity
                key={s.key}
                style={[styles.scheduledCard, { width: SCHEDULED_CARD_W }]}
                activeOpacity={0.85}
                onPress={() =>
                  router.push({
                    pathname: '/book',
                    params: { serviceType: s.key, mode: 'SCHEDULED' },
                  })
                }
              >
                <View style={styles.scheduledIconWrap}>
                  <Ionicons name={s.icon} size={24} color={COLORS.accent} />
                </View>
                <Text style={styles.scheduledLabel} numberOfLines={2}>
                  {s.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scrollContent: { paddingBottom: 32 },
  mapContainer: {
    height: 260,
    position: 'relative',
  },
  mapOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: 16,
  },
  mapOverlayCard: {
    backgroundColor: 'rgba(17,17,17,0.82)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  greet: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '700',
  },
  sub: {
    color: COLORS.textMuted,
    marginTop: 4,
    fontSize: 14,
  },
  availabilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  availabilityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  availabilityText: {
    fontSize: 13,
    fontWeight: '500',
  },
  userPin: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(212,160,23,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.accent,
  },
  userPinInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.accent,
  },
  map: { flex: 1 },
  bluePin: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#1a73e8',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  servicesWrap: { paddingHorizontal: 16, paddingBottom: 24 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    marginTop: 20,
  },
  sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  sectionRight: { fontSize: 12 },
  emergencyDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ff3b30',
  },
  scheduledDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.accent,
  },
  emergencyRow: { flexDirection: 'row', gap: 10 },
  emergencyCard: {
    flex: 1,
    backgroundColor: '#1a0000',
    borderWidth: 1.5,
    borderColor: '#ff3b30',
    borderRadius: 16,
    padding: 16,
  },
  emergencyIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,59,48,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emergencyLabel: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 10,
  },
  urgentBadge: {
    backgroundColor: '#ff3b30',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  urgentText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  scheduledGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -5,
  },
  scheduledCard: {
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 14,
    padding: 14,
    margin: 5,
  },
  scheduledIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(212,160,23,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduledLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 10,
  },
});
