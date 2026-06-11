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
import MapView, {
  Marker,
  Polyline,
  PROVIDER_GOOGLE,
} from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../constants/theme';
import api, { getBaseURL } from '../lib/api';
import { io } from 'socket.io-client';

const SOCKET_URL = getBaseURL();

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

function getETA(distanceKm) {
  if (!distanceKm) return null;
  const minutes = Math.round((distanceKm / 40) * 60);
  if (minutes < 2) return 'Arriving now';
  if (minutes > 60) return 'Over 1 hour';
  return '~' + minutes + ' min away';
}

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

function decodePolyline(encoded) {
  const poly = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : result >> 1;
    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : result >> 1;
    poly.push({
      latitude: lat / 1e5,
      longitude: lng / 1e5,
    });
  }
  return poly;
}

export default function TrackingScreen() {
  const { jobId: jid } = useLocalSearchParams();
  const jobId = Array.isArray(jid) ? jid[0] : jid;

  const [job, setJob] = useState(null);
  const [ll, setLl] = useState({ lat: null, lng: null });
  const completedNavigated = useRef(false);
  const locksmithMarkerRef = useRef(null);
  const mapRef = useRef(null);
  const [routeCoords, setRouteCoords] = useState([]);
  const prevLlRef = useRef(null);
  const routeFetchRef = useRef(0);
  const socketRef = useRef(null);
  const custLatRef = useRef(null);
  const custLngRef = useRef(null);
  const [showReceipt, setShowReceipt] = useState(false);

  const GOOGLE_MAPS_KEY = 'AIzaSyDZ_7hL_97LzMvKbdB4PQOSmare2ogZ514';

  const fetchRoute = async (fromLat, fromLng, toLat, toLng) => {
    try {
      const res = await fetch(
        'https://routes.googleapis.com/directions/v2:computeRoutes',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': GOOGLE_MAPS_KEY,
            'X-Goog-FieldMask': 'routes.polyline.encodedPolyline',
          },
          body: JSON.stringify({
            origin: {
              location: {
                latLng: {
                  latitude: fromLat,
                  longitude: fromLng,
                },
              },
            },
            destination: {
              location: {
                latLng: {
                  latitude: toLat,
                  longitude: toLng,
                },
              },
            },
            travelMode: 'DRIVE',
          }),
        }
      );
      const data = await res.json();
      const encoded = data?.routes?.[0]?.polyline?.encodedPolyline;
      if (encoded) {
        setRouteCoords(decodePolyline(encoded));
      }
    } catch (e) {
      console.warn('[fetchRoute]', e?.message);
    }
  };

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
          const newLat = lat;
          const newLng = lng;
          const custLat = data.job?.customerLat;
          const custLng = data.job?.customerLng;

          if (locksmithMarkerRef.current) {
            locksmithMarkerRef.current.animateMarkerToCoordinate(
              {
                latitude: newLat,
                longitude: newLng,
              },
              4500
            );
          }

          if (mapRef.current && custLat && custLng) {
            mapRef.current.fitToCoordinates(
              [
                {
                  latitude: newLat,
                  longitude: newLng,
                },
                {
                  latitude: custLat,
                  longitude: custLng,
                },
              ],
              {
                edgePadding: {
                  top: 100,
                  right: 50,
                  bottom: 350,
                  left: 50,
                },
                animated: true,
              }
            );
          }

          const now = Date.now();
          if (
            now - routeFetchRef.current > 15000 &&
            custLat &&
            custLng
          ) {
            routeFetchRef.current = now;
            fetchRoute(newLat, newLng, custLat, custLng);
          }

          prevLlRef.current = { lat: newLat, lng: newLng };
          setLl({ lat: newLat, lng: newLng });
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
    const t = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [jobId]);

  const custLat = job?.customerLat;
  const custLng = job?.customerLng;
  const lock = job?.locksmith;

  useEffect(() => {
    custLatRef.current = custLat;
    custLngRef.current = custLng;
  }, [custLat, custLng]);

  useEffect(() => {
    if (!jobId) return;

    const connectSocket = async () => {
      try {
        const AsyncStorage = (
          await import('@react-native-async-storage/async-storage')
        ).default;
        const token = await AsyncStorage.getItem('vula24_token');
        if (!token) return;

        const socket = io(SOCKET_URL, {
          auth: { token },
          transports: ['websocket'],
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 2000,
        });

        socket.on('connect', () => {
          socket.emit('join:job', jobId);
        });

        socket.on('location:update', (data) => {
          const { lat, lng } = data;
          if (
            typeof lat !== 'number' ||
            typeof lng !== 'number' ||
            isNaN(lat) ||
            isNaN(lng)
          ) {
            return;
          }

          if (locksmithMarkerRef.current) {
            locksmithMarkerRef.current.animateMarkerToCoordinate(
              { latitude: lat, longitude: lng },
              1000
            );
          }

          if (mapRef.current && custLatRef.current && custLngRef.current) {
            mapRef.current.fitToCoordinates(
              [
                { latitude: lat, longitude: lng },
                { latitude: custLatRef.current, longitude: custLngRef.current },
              ],
              {
                edgePadding: {
                  top: 100,
                  right: 50,
                  bottom: 350,
                  left: 50,
                },
                animated: true,
              }
            );
          }

          setLl({ lat, lng });
        });

        socket.on('connect_error', (e) => {
          console.warn('[socket]', e?.message);
        });

        socketRef.current = socket;
      } catch (e) {
        console.warn('[socket connect]', e?.message);
      }
    };

    connectSocket();

    return () => {
      if (socketRef.current) {
        socketRef.current.emit('leave:job', jobId);
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [jobId]);

  const custLatOk =
    typeof custLat === 'number' && !isNaN(custLat);
  const custLngOk =
    typeof custLng === 'number' && !isNaN(custLng);
  const llLatOk =
    typeof ll.lat === 'number' && !isNaN(ll.lat);
  const llLngOk =
    typeof ll.lng === 'number' && !isNaN(ll.lng);

  const distanceKm =
    custLatOk && custLngOk && llLatOk && llLngOk
      ? (() => {
          const R = 6371;
          const dLat = (custLat - ll.lat) * Math.PI / 180;
          const dLng = (custLng - ll.lng) * Math.PI / 180;
          const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(ll.lat * Math.PI / 180) *
            Math.cos(custLat * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
          return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        })()
      : null;
  const eta = job?.status === 'DISPATCHED' ? getETA(distanceKm) : null;

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

  const cancelJob = async () => {
    const isFree = job?.status !== 'DISPATCHED';
    const message = isFree
      ? 'Are you sure you want to cancel this job?'
      : 'A cancellation fee of R120 applies because the locksmith is already on the way. Cancel anyway?';

    Alert.alert(
      'Cancel Job',
      message,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              const { data } = await api.post(
                `/api/jobs/${jobId}/cancel`
              );
              if (data.cancellationFee > 0) {
                Alert.alert(
                  'Job Cancelled',
                  `A cancellation fee of R${data.cancellationFee} has been charged.`,
                  [{
                    text: 'OK',
                    onPress: () => router.replace('/(tabs)/home'),
                  }]
                );
              } else {
                router.replace('/(tabs)/home');
              }
            } catch (e) {
              Alert.alert(
                'Error',
                e.response?.data?.error || 'Could not cancel job.'
              );
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.flex}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        region={region}
        mapPadding={{
          top: 60,
          right: 20,
          bottom: 220,
          left: 20,
        }}
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
            ref={locksmithMarkerRef}
            coordinate={{
              latitude: ll.lat,
              longitude: ll.lng,
            }}
            tracksViewChanges={false}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.carMarker}>
              <Ionicons name="car" size={16} color="#111111" />
            </View>
          </Marker>
        ) : null}
        {routeCoords.length > 1 && (
          <Polyline
            coordinates={routeCoords}
            strokeWidth={3}
            strokeColor="#D4A017"
            lineDashPattern={[0]}
          />
        )}
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
              {eta && (
                <Text style={styles.eta}>{eta}</Text>
              )}
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
          <TouchableOpacity
            style={styles.receiptToggle}
            onPress={() =>
              setShowReceipt((prev) => !prev)
            }
            activeOpacity={0.7}
          >
            <Text style={styles.receiptToggleText}>
              {showReceipt
                ? 'Hide breakdown ▲'
                : 'View breakdown ▼'}
            </Text>
          </TouchableOpacity>

          {showReceipt && (
            <>
              <View style={styles.divider} />
              <View style={styles.receiptSection}>
            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Service</Text>
              <Text style={styles.receiptValue}>
                {job?.serviceType?.replace(/_/g, ' ')}
              </Text>
            </View>
            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Booking ID</Text>
              <Text style={styles.receiptValue}>
                #{job?.id?.slice(0, 8).toUpperCase()}
              </Text>
            </View>
            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Service charge</Text>
              <Text style={styles.receiptValue}>
                R{job?.locksithEarning?.toFixed(2)}
              </Text>
            </View>
            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Platform fee</Text>
              <Text style={styles.receiptValue}>
                R{job?.platformFee?.toFixed(2)}
              </Text>
            </View>
            <View style={[styles.receiptRow, styles.receiptTotal]}>
              <Text style={styles.receiptTotalLabel}>Total</Text>
              <Text style={styles.receiptTotalValue}>
                R{job?.totalPrice?.toFixed(2)}
              </Text>
            </View>
            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Payment status</Text>
              <Text style={[styles.receiptValue,
                { color: job?.depositPaid ? '#43A047' : '#D4A017' }]}>
                {job?.depositPaid ? 'Paid' : 'Pending'}
              </Text>
            </View>
              </View>
            </>
          )}
        </View>
        <TouchableOpacity style={styles.sos} onPress={() => Linking.openURL('tel:10111')}>
          <Text style={styles.sosText}>SOS</Text>
        </TouchableOpacity>
        {(job?.status === 'PENDING' ||
          job?.status === 'ACCEPTED' ||
          job?.status === 'DISPATCHED') && (
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={cancelJob}
          >
            <Text style={styles.cancelBtnText}>
              {job?.status === 'DISPATCHED'
                ? 'Cancel Job (R120 fee)'
                : 'Cancel Job'}
            </Text>
          </TouchableOpacity>
        )}
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
  carMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#D4A017',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
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
    backgroundColor: 'rgba(17,17,17,0.95)',
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
  eta: {
    color: '#D4A017',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
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
  cancelBtn: {
    marginTop: 8,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E53935',
    borderRadius: 12,
    marginHorizontal: 0,
  },
  cancelBtnText: {
    color: '#E53935',
    fontSize: 14,
    fontWeight: '600',
  },
  receiptToggle: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  receiptToggleText: {
    color: '#D4A017',
    fontSize: 13,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: '#333333',
    marginVertical: 12,
  },
  receiptSection: {
    width: '100%',
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  receiptLabel: {
    fontSize: 13,
    color: '#AAAAAA',
  },
  receiptValue: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  receiptTotal: {
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#333333',
  },
  receiptTotalLabel: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  receiptTotalValue: {
    fontSize: 15,
    color: '#D4A017',
    fontWeight: '700',
  },
});
