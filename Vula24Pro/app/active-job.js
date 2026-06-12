import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Linking,
  Alert,
  TouchableOpacity,
  AppState,
  Animated,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  NavigationView,
  useNavigation,
  CameraPerspective,
  RouteStatus,
  useNavigationController,
} from '@googlemaps/react-native-navigation-sdk';
import * as Location from 'expo-location';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { GoldButton } from '../components/GoldButton';
import { COLORS } from '../constants/theme';
import api, { getBaseURL } from '../lib/api';
import { getUser } from '../lib/storage';
import { io } from 'socket.io-client';

const SOCKET_URL = getBaseURL();

export default function ActiveJobScreen() {
  const { jobId: jid } = useLocalSearchParams();
  const jobId = Array.isArray(jid) ? jid[0] : jid;

  const [job, setJob] = useState(null);
  const [jobLoaded, setJobLoaded] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [nearCustomer, setNearCustomer] = useState(false);
  const [currentDistance, setCurrentDistance] = useState(null);
  const locInterval = useRef(null);
  const proximityIntervalRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const { navigationController } = useNavigation();
  const [navReady, setNavReady] = useState(false);
  const [navStarted, setNavStarted] = useState(false);
  const [navViewController, setNavViewController] = useState(null);
  const navViewControllerRef = useRef(null);
  const [actionLoading, setActionLoading] = useState(false);
  const socketRef = useRef(null);

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
      setJobLoaded(true);
      if (data.job?.status === 'COMPLETED' || data.job?.status === 'CANCELLED') {
        router.replace('/(tabs)/dashboard');
      }
    } catch (e) {
      console.warn('[load]', e?.message);
      // Still mark as loaded so UI
      // doesn't stay blank
      setJobLoaded(true);
    }
  }, [jobId]);

  useEffect(() => {
    load();
    const p = setInterval(load, 5000);
    return () => clearInterval(p);
  }, [load]);

  const sendLocation = useCallback(async () => {
    if (sendLocation.running) return;
    sendLocation.running = true;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        timeInterval: 2000,
        distanceInterval: 5,
      });
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
      if (socketRef.current?.connected) {
        socketRef.current.emit(
          'location:update',
          { jobId, lat, lng }
        );
      }
    } catch (e) {
      console.warn('[sendLocation]', e?.message);
    } finally {
      sendLocation.running = false;
    }
  }, [isMember, jobId]);

  const startNavigation = useCallback(
    async () => {
      if (!custLat || !custLng || !navigationController) return;
      try {
        const termsAccepted =
          await navigationController.showTermsAndConditionsDialog();

        if (!termsAccepted) {
          Alert.alert(
            'Terms Required',
            'You must accept the navigation terms to use in-app navigation.',
            [{ text: 'OK' }]
          );
          return;
        }

        await navigationController.init();

        const waypoint = {
          title: job?.customerAddress || 'Customer',
          position: {
            lat: custLat,
            lng: custLng,
          },
        };
        await navigationController.setDestinations([waypoint]);
        await navigationController.startGuidance();
        // Set camera to follow driver
        // in tilted driving perspective
        if (navViewControllerRef.current) {
          try {
            await navViewControllerRef.current
              .setFollowingPerspective(
                CameraPerspective.TILTED,
                { zoomLevel: 17 }
              );
          } catch (e) {
            console.warn('[camera]', e?.message);
          }
        }
      } catch (e) {
        console.warn('[navigation] start failed:', e?.message);
        Alert.alert(
          'Navigation Error',
          'Could not start navigation. ' +
            (e?.message || '') +
            '\n\nYou can use Open in Google Maps instead.',
          [{ text: 'OK' }]
        );
      }
    },
    [custLat, custLng, navigationController, job]
  );

  useEffect(() => {
    if (
      jobStatus === 'DISPATCHED' &&
      navReady &&
      custLat &&
      custLng &&
      navigationController &&
      !navStarted
    ) {
      setNavStarted(true);
      startNavigation();
    }
  }, [
    jobStatus,
    navReady,
    custLat,
    custLng,
    navigationController,
    navStarted,
    startNavigation,
  ]);

  useEffect(() => {
    if (jobStatus !== 'DISPATCHED') {
      setNavStarted(false);
      setNavReady(false);
    }
  }, [jobStatus]);

  useEffect(() => {
    if (jobStatus !== 'DISPATCHED' && navigationController) {
      try {
        navigationController.stopGuidance();
      } catch (e) {
        // ignore
      }
    }
  }, [jobStatus, navigationController]);

  useEffect(() => {
    const s = job?.status;
    const mode = job?.mode;
    let shouldPing = false;
    if (mode === 'EMERGENCY') {
      shouldPing =
        s === 'DISPATCHED' || s === 'ARRIVED' || s === 'IN_PROGRESS';
    } else {
      shouldPing =
        s === 'ACCEPTED' ||
        s === 'DISPATCHED' ||
        s === 'ARRIVED' || s === 'IN_PROGRESS';
    }

    if (!shouldPing) {
      if (locInterval.current) {
        clearInterval(locInterval.current);
        locInterval.current = null;
      }
      return undefined;
    }
    sendLocation();
    locInterval.current = setInterval(sendLocation, 1000);
    return () => {
      if (locInterval.current) clearInterval(locInterval.current);
      locInterval.current = null;
    };
  }, [job?.status, job?.mode, sendLocation]);

  useEffect(() => {
    if (jobStatus !== 'DISPATCHED') {
      if (socketRef.current) {
        socketRef.current.emit(
          'leave:job', jobId
        );
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }
    const connectSocket = async () => {
      try {
        const { getToken } =
          await import('../lib/storage');
        const token = await getToken();
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
        socket.on('connect_error', (e) => {
          console.warn(
            '[socket]', e?.message
          );
        });
        socketRef.current = socket;
      } catch (e) {
        console.warn(
          '[socket connect]', e?.message
        );
      }
    };
    connectSocket();
    return () => {
      if (socketRef.current) {
        socketRef.current.emit(
          'leave:job', jobId
        );
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [jobStatus, jobId]);

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
    if (actionLoading) return;
    setActionLoading(true);
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
    } finally {
      setActionLoading(false);
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
    if (jobStatus !== 'DISPATCHED') return;
    Animated.spring(slideAnim, {
      toValue: nearCustomer ? 1 : 0,
      useNativeDriver: false,
      tension: 50,
      friction: 8,
    }).start();
  }, [nearCustomer, jobStatus, slideAnim]);

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

  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      async (nextState) => {
        if (
          appStateRef.current.match(/inactive|background/) &&
          nextState === 'active'
        ) {
          await load();
        }
        appStateRef.current = nextState;
      }
    );
    return () => subscription.remove();
  }, [load]);


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

  const CANCEL_REASONS = [
    'Vehicle breakdown',
    'Personal emergency',
    'Job location unsafe',
    'Customer unresponsive',
    'Other',
  ];

  const confirmCancel = async (reason) => {
    Alert.alert(
      'Confirm Cancellation',
      `Reason: "${reason}"\n\nThis cancellation will be permanently recorded. Are you sure?`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              const { data } = await api.post(
                `/api/jobs/${jobId}/cancel`,
                { reason }
              );

              if (data.warning === 'SUSPENDED') {
                Alert.alert(
                  'Account Suspended',
                  'You have been suspended due to too many cancellations. Contact support.',
                  [{
                    text: 'OK',
                    onPress: () => router.replace('/(tabs)/dashboard'),
                  }]
                );
              } else if (data.warning === 'FINAL_WARNING') {
                Alert.alert(
                  'Final Warning',
                  'You have cancelled 3 jobs. One more cancellation will suspend your account.',
                  [{
                    text: 'OK',
                    onPress: () => router.replace('/(tabs)/dashboard'),
                  }]
                );
              } else if (data.warning === 'FIRST_WARNING') {
                Alert.alert(
                  'Warning',
                  'This cancellation has been recorded. Repeated cancellations affect your standing.',
                  [{
                    text: 'OK',
                    onPress: () => router.replace('/(tabs)/dashboard'),
                  }]
                );
              } else {
                router.replace('/(tabs)/dashboard');
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

  const showReasonPicker = () => {
    const buttons = CANCEL_REASONS.map((reason) => ({
      text: reason,
      onPress: () => confirmCancel(reason),
    }));
    buttons.push({
      text: 'Back',
      style: 'cancel',
    });
    Alert.alert(
      'Select a reason',
      'Why are you cancelling?',
      buttons
    );
  };

  const cancelJob = () => {
    Alert.alert(
      '⚠️ Cancel Job',
      'Warning: Cancellations are logged against your account. Repeated cancellations may result in suspension.',
      [
        { text: 'Keep Job', style: 'cancel' },
        {
          text: 'Cancel Job',
          style: 'destructive',
          onPress: () => showReasonPicker(),
        },
      ]
    );
  };

  return (
    <View style={styles.flex}>
      {jobLoaded &&
      jobStatus === 'DISPATCHED' && (
      <NavigationView
        style={StyleSheet.absoluteFill}
        myLocationEnabled={true}
        recenterButtonEnabled={true}
        onRecenterButtonClick={async () => {
          if (navViewControllerRef.current) {
            try {
              await navViewControllerRef
                .current
                .setFollowingPerspective(
                  CameraPerspective.TILTED,
                  { zoomLevel: 17 }
                );
            } catch {
              // ignore
            }
          }
        }}
        androidStylingOptions={{
          primaryDayModeThemeColor: '#D4A017',
          headerDistanceValueTextColor: '#FFFFFF',
          headerInstructionsFirstRowTextSize: '20f',
          navigationHeaderPrimaryBackgroundColor: '#111111',
          navigationHeaderDistanceValueTextColor: '#D4A017',
        }}
        onMapViewControllerCreated={
          async (controller) => {
            setNavViewController(controller);
            try {
              await controller.setPadding({
                top: 0,
                left: 0,
                right: 0,
                bottom: 400,
              });
            } catch (e) {
              console.warn(
                '[mapPadding]', e?.message
              );
            }
          }
        }
        onNavigationViewControllerCreated={
          async (controller) => {
            navViewControllerRef.current =
              controller;
            try {
              await controller
                .setFollowingPerspective(
                  CameraPerspective.TILTED,
                  { zoomLevel: 17 }
                );
            } catch (e) {
              console.warn(
                '[navViewController]',
                e?.message
              );
            }
            setNavReady(true);
          }
        }
      />
      )}

      {jobStatus !== 'DISPATCHED' && (
      <SafeAreaView style={styles.topBar} edges={['top']}>
        <Text style={styles.navHint}>
          {isDisputed
            ? 'Dispute in progress — check notifications'
            : jobStatus === 'ACCEPTED' && jobMode === 'EMERGENCY'
              ? 'Waiting for customer payment…'
              : 'En route to customer'}
        </Text>
      </SafeAreaView>
      )}

      <SafeAreaView style={styles.cardWrap} edges={['bottom']}>
        <Animated.View style={[
          styles.card,
          jobStatus === 'DISPATCHED' &&
            styles.cardCompact,
        ]}>
          <Text style={styles.custName}>{job?.customer?.name || 'Customer'}</Text>
          {/* Show full details only when not navigating */}
          {jobStatus !== 'DISPATCHED' && (
            <>
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
            </>
          )}

          {!isDisputed && jobStatus === 'ACCEPTED' && jobMode === 'EMERGENCY' ? (
            <Text style={styles.waitPay}>Waiting for customer payment…</Text>
          ) : null}

          {/* DISPATCHED: Navigation flow */}
          {jobStatus === 'DISPATCHED' && !isDisputed && (
            <>
              {/* Always visible distance strip */}
              {!nearCustomer && (
                <View style={styles.distanceStrip}>
                  <Ionicons
                    name="navigate-circle"
                    size={16}
                    color="#D4A017"
                  />
                  <Text style={styles.distanceStripText}>
                    {currentDistance
                      ? `${currentDistance}m away`
                      : 'En route to customer...'}
                  </Text>
                </View>
              )}

              {/* Slide up controls when near */}
              <Animated.View style={{
                overflow: 'hidden',
                maxHeight: slideAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 300],
                }),
                opacity: slideAnim.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [0, 0.8, 1],
                }),
              }}>
                <TouchableOpacity
                  style={[
                    styles.arrivedBtn,
                    (!nearCustomer || actionLoading) &&
                      styles.arrivedBtnDisabled,
                  ]}
                  onPress={async () => {
                    if (nearCustomer && !actionLoading) {
                      await load();
                      action('/arrived');
                    }
                  }}
                  activeOpacity={nearCustomer ? 0.8 : 1}
                >
                  <Text style={[
                    styles.arrivedBtnText,
                    (!nearCustomer || actionLoading) &&
                      styles.arrivedBtnTextDisabled,
                  ]}>
                    {actionLoading
                      ? 'Please wait...'
                      : 'I Have Arrived'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.openMapsBtn}
                  onPress={() => {
                    const url =
                      'https://www.google.com/maps/dir/?api=1' +
                      '&destination=' + custLat +
                      ',' + custLng +
                      '&travelmode=driving';
                    Linking.openURL(url);
                  }}
                >
                  <Ionicons
                    name="navigate-outline"
                    size={16}
                    color="#AAAAAA"
                  />
                  <Text style={styles.openMapsBtnText}>
                    Open in Google Maps
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            </>
          )}

          {/* ARRIVED, IN_PROGRESS: normal flow */}
          {jobStatus !== 'DISPATCHED' && !isDisputed && primary && (
            <GoldButton
              title={actionLoading ?
                'Please wait...' : primary.label}
              onPress={primary.onPress}
              disabled={actionLoading}
            />
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

          {!isDisputed &&
            (jobStatus !== 'DISPATCHED' ||
              nearCustomer) && (
          <TouchableOpacity
            style={[
              styles.call,
              jobStatus === 'DISPATCHED' && styles.callCompact,
            ]}
            onPress={() => Linking.openURL('tel:' + job?.customer?.phone)}
          >
            <Ionicons name="call" size={18} color="#D4A017" />
            <Text style={styles.callText}>Call customer</Text>
          </TouchableOpacity>
          )}

          {(jobStatus === 'ACCEPTED' ||
            jobStatus === 'DISPATCHED') &&
            !isDisputed && (
            <TouchableOpacity
              style={[
                styles.locksmithCancelBtn,
                jobStatus === 'DISPATCHED' &&
                  styles.locksmithCancelBtnCompact,
              ]}
              onPress={cancelJob}
            >
              <Text style={styles.locksmithCancelText}>
                Cancel Job
              </Text>
            </TouchableOpacity>
          )}

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
        </Animated.View>
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
  cardCompact: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  custName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 2,
  },
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
  callCompact: {
    marginTop: 4,
    padding: 10,
  },
  callText: { color: COLORS.bg, fontWeight: '700', fontSize: 16, marginLeft: 8 },
  locksmithCancelBtn: {
    marginTop: 8,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#555555',
    borderRadius: 12,
  },
  locksmithCancelBtnCompact: {
    marginTop: 4,
    paddingVertical: 8,
  },
  locksmithCancelText: {
    color: '#AAAAAA',
    fontSize: 13,
    fontWeight: '500',
  },
  distanceStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 2,
  },
  distanceStripText: {
    color: '#AAAAAA',
    fontSize: 13,
    flex: 1,
  },
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
  navPanel: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333333',
  },
  navPanelTop: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 8,
  },
  navStat: {
    alignItems: 'center',
  },
  navStatValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  navStatLabel: {
    fontSize: 11,
    color: '#AAAAAA',
    marginTop: 1,
  },
  nextStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#333333',
  },
  nextStepText: {
    flex: 1,
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  arrivedBtn: {
    backgroundColor: '#D4A017',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 8,
  },
  arrivedBtnDisabled: {
    backgroundColor: '#3A3A3A',
  },
  arrivedBtnText: {
    color: '#111111',
    fontWeight: '700',
    fontSize: 16,
  },
  arrivedBtnTextDisabled: {
    color: '#666666',
  },
  openMapsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  openMapsBtnText: {
    color: '#AAAAAA',
    fontSize: 13,
  },
});
