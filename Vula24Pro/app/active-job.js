import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Linking,
  Alert,
  TouchableOpacity,
  Platform,
  AppState,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { GoldButton } from '../components/GoldButton';
import { COLORS } from '../constants/theme';
import api from '../lib/api';
import { getUser } from '../lib/storage';

const GOOGLE_MAPS_KEY = 'AIzaSyDZ_7hL_97LzMvKbdB4PQOSmare2ogZ514';

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

export default function ActiveJobScreen() {
  const { jobId: jid } = useLocalSearchParams();
  const jobId = Array.isArray(jid) ? jid[0] : jid;

  const [job, setJob] = useState(null);
  const [isMember, setIsMember] = useState(false);
  const [nearCustomer, setNearCustomer] = useState(false);
  const [currentDistance, setCurrentDistance] = useState(null);
  const locInterval = useRef(null);
  const proximityIntervalRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);
  const [myLat, setMyLat] = useState(null);
  const [myLng, setMyLng] = useState(null);
  const [routeCoords, setRouteCoords] = useState([]);
  const mapRef = useRef(null);

  const custLat = job?.customerLat;
  const custLng = job?.customerLng;
  const jobStatus = job?.status;

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
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 5000,
        distanceInterval: 10,
      });
      const lat = loc.coords.latitude;
      const lng = loc.coords.longitude;
      setMyLat(lat);
      setMyLng(lng);
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
    } catch (e) {
      console.warn('[sendLocation]', e?.message);
    }
  }, [isMember]);

  const fetchRoute = useCallback(async () => {
    if (!myLat || !myLng || !custLat || !custLng) return;
    try {
      const response = await fetch(
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
                  latitude: myLat,
                  longitude: myLng,
                },
              },
            },
            destination: {
              location: {
                latLng: {
                  latitude: custLat,
                  longitude: custLng,
                },
              },
            },
            travelMode: 'DRIVE',
          }),
        }
      );
      const data = await response.json();
      const encoded = data?.routes?.[0]?.polyline?.encodedPolyline;
      if (encoded) {
        const coords = decodePolyline(encoded);
        setRouteCoords(coords);
        mapRef.current?.fitToCoordinates(coords, {
          edgePadding: {
            top: 80,
            right: 40,
            bottom: 300,
            left: 40,
          },
          animated: true,
        });
      } else {
        console.warn('[fetchRoute] no route:', JSON.stringify(data));
      }
    } catch (e) {
      console.warn('[fetchRoute] error:', e?.message);
    }
  }, [myLat, myLng, custLat, custLng]);

  useEffect(() => {
    if (jobStatus === 'DISPATCHED' && myLat && myLng && custLat && custLng) {
      fetchRoute();
    }
  }, [myLat, myLng, custLat, custLng, jobStatus, fetchRoute]);

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
    locInterval.current = setInterval(sendLocation, 5000);
    return () => {
      if (locInterval.current) clearInterval(locInterval.current);
      locInterval.current = null;
    };
  }, [job?.status, job?.mode, sendLocation]);

  function getDistanceMeters(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

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

  useEffect(() => {
    if (jobStatus !== 'DISPATCHED' || !custLat || !custLng) {
      if (proximityIntervalRef.current) {
        clearInterval(proximityIntervalRef.current);
        proximityIntervalRef.current = null;
      }
      return;
    }

    const checkProximity = async () => {
      try {
        let { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') {
          const result = await Location.requestForegroundPermissionsAsync();
          status = result.status;
        }
        if (status !== 'granted') return;
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const distance = getDistanceMeters(
          loc.coords.latitude,
          loc.coords.longitude,
          custLat,
          custLng
        );
        setCurrentDistance(Math.round(distance));
        if (distance <= 500) {
          setNearCustomer(true);
          if (proximityIntervalRef.current) {
            clearInterval(proximityIntervalRef.current);
            proximityIntervalRef.current = null;
          }
        }
      } catch (e) {
        console.warn('[proximity] error:', e?.message);
      }
    };

    checkProximity();
    proximityIntervalRef.current = setInterval(checkProximity, 10000);

    return () => {
      if (proximityIntervalRef.current) {
        clearInterval(proximityIntervalRef.current);
      }
    };
  }, [jobStatus, custLat, custLng]);

  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      async (nextState) => {
        if (
          appStateRef.current.match(/inactive|background/) &&
          nextState === 'active' &&
          jobStatus === 'DISPATCHED' &&
          custLat && custLng
        ) {
          try {
            let { status } = await Location.getForegroundPermissionsAsync();
            if (status !== 'granted') {
              const result = await Location.requestForegroundPermissionsAsync();
              status = result.status;
            }
            if (status !== 'granted') return;
            const loc = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            });
            const distance = getDistanceMeters(
              loc.coords.latitude,
              loc.coords.longitude,
              custLat,
              custLng
            );
            setCurrentDistance(Math.round(distance));
            if (distance <= 500) {
              setNearCustomer(true);
            }
          } catch (e) {
            console.warn('[appstate proximity]', e?.message);
          }
        }
        appStateRef.current = nextState;
      }
    );
    return () => subscription.remove();
  }, [jobStatus, custLat, custLng]);


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
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        region={region}
        showsUserLocation={true}
        showsMyLocationButton={false}
      >
        {custLat != null && custLng != null && (
          <Marker
            coordinate={{ latitude: custLat, longitude: custLng }}
            tracksViewChanges={false}
          >
            <View style={styles.pin} />
          </Marker>
        )}

        {routeCoords.length > 1 && (
          <Polyline
            coordinates={routeCoords}
            strokeWidth={5}
            strokeColor="#D4A017"
            lineDashPattern={[0]}
          />
        )}
      </MapView>

      <SafeAreaView style={styles.topBar} edges={['top']}>
        <Text style={styles.navHint}>
          {isDisputed
            ? 'Dispute in progress — check notifications'
            : jobStatus === 'ACCEPTED' && jobMode === 'EMERGENCY'
              ? 'Waiting for customer payment…'
              : 'Follow the route to the customer'}
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

          {job?.vehicleDetails && (
            job.vehicleDetails.make ||
            job.vehicleDetails.model ||
            job.vehicleDetails.color
          ) && (
            <View style={styles.vehicleCard}>
              <Ionicons name="car-outline" size={14} color="#D4A017" />
              <Text style={styles.vehicleText}>
                {[
                  job.vehicleDetails.make,
                  job.vehicleDetails.model,
                  job.vehicleDetails.color,
                ].filter(Boolean).join(' · ')}
              </Text>
            </View>
          )}

          {!isDisputed && jobStatus === 'ACCEPTED' && jobMode === 'EMERGENCY' ? (
            <Text style={styles.waitPay}>Waiting for customer payment…</Text>
          ) : null}

          {/* DISPATCHED: Navigation flow */}
          {jobStatus === 'DISPATCHED' && !isDisputed && (
            <>
              {nearCustomer && (
                <GoldButton
                  title="I Have Arrived"
                  onPress={() => action('/arrived')}
                />
              )}
              {!nearCustomer && (
                <Text style={styles.proximityHint}>
                  {currentDistance !== null
                    ? currentDistance + 'm away — "I Have Arrived" appears within 500m'
                    : '"I Have Arrived" appears when you are near the customer'}
                </Text>
              )}
            </>
          )}

          {/* ARRIVED, IN_PROGRESS: normal flow */}
          {jobStatus !== 'DISPATCHED' && !isDisputed && primary && (
            <GoldButton title={primary.label} onPress={primary.onPress} />
          )}

          {/* Dispute card */}
          {isDisputed && (
            <View style={styles.disputeCard}>
              <Text style={styles.disputeTitle}>Dispute in progress</Text>
              <Text style={styles.disputeBody}>
                This job is under review. Contact support for assistance.
              </Text>
              <TouchableOpacity
                style={styles.disputeBtn}
                onPress={() => Linking.openURL('https://wa.me/27661235067')}
              >
                <Text style={styles.disputeBtnText}>Contact Support</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            style={styles.call}
            onPress={() => Linking.openURL('tel:' + job?.customer?.phone)}
          >
            <Ionicons name="call" size={18} color="#D4A017" />
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
  callText: { color: COLORS.bg, fontWeight: '700', fontSize: 16, marginLeft: 8 },
  proximityHint: {
    textAlign: 'center',
    color: '#AAAAAA',
    fontSize: 13,
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 20,
  },
  vehicleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#333333',
  },
  vehicleText: {
    fontSize: 13,
    color: '#D4A017',
    fontWeight: '500',
  },
  routeLoading: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  routeLoadingText: {
    color: '#FFFFFF',
    fontSize: 13,
  },
});
