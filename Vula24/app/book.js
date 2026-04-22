import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  Alert,
  TouchableOpacity,
  Image,
  TextInput,
  Keyboard,
  Linking,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import PlacesAutocompletePkg from 'react-native-google-places-autocomplete';

const { GooglePlacesAutocomplete } = PlacesAutocompletePkg;
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { FormInput } from '../components/FormInput';
import { GoldButton } from '../components/GoldButton';
import { COLORS } from '../constants/theme';
import api, { postMultipart } from '../lib/api';
import {
  reverseGeocodeFormatted,
  formatExpoReversePlace,
} from '../lib/googleGeocoding';

function readPlaceLatLng(details) {
  if (!details?.geometry?.location) return null;
  const loc = details.geometry.location;
  const lat = typeof loc.lat === 'function' ? loc.lat() : loc.lat;
  const lng = typeof loc.lng === 'function' ? loc.lng() : loc.lng;
  if (lat == null || lng == null) return null;
  return { lat: Number(lat), lng: Number(lng) };
}

function mimeFromUri(uri) {
  const u = String(uri).toLowerCase();
  if (u.endsWith('.png')) return 'image/png';
  if (u.endsWith('.webp')) return 'image/webp';
  if (u.endsWith('.heic') || u.endsWith('.heif')) return 'image/heic';
  return 'image/jpeg';
}

const MAP_DELTA = { latitudeDelta: 0.005, longitudeDelta: 0.005 };

export default function BookScreen() {
  const insets = useSafeAreaInsets();
  const { serviceType: st, mode: modeParam } = useLocalSearchParams();
  const serviceType = Array.isArray(st) ? st[0] : st;
  const mode = Array.isArray(modeParam) ? modeParam[0] : modeParam;
  const isEmergency = mode === 'EMERGENCY';

  const [lat, setLat] = useState(-26.2041);
  const [lng, setLng] = useState(28.0473);
  const [placesBiasLat, setPlacesBiasLat] = useState(-26.2041);
  const [placesBiasLng, setPlacesBiasLng] = useState(28.0473);
  const [address, setAddress] = useState('');
  const [addressResolving, setAddressResolving] = useState(false);
  const [note, setNote] = useState('');
  const [description, setDescription] = useState('');
  const [scheduledAt, setScheduledAt] = useState(new Date(Date.now() + 3600000));
  const [showPicker, setShowPicker] = useState(false);
  const [photoUri, setPhotoUri] = useState(null);
  const [loading, setLoading] = useState(false);
  const [keyboardBottomInset, setKeyboardBottomInset] = useState(0);

  const placesApiKey =
    (typeof process !== 'undefined' && process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY
      ? String(process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY).trim()
      : '') ||
    Constants.expoConfig?.extra?.googlePlacesApiKey ||
    Constants.expoConfig?.android?.config?.googleMaps?.apiKey ||
    '';

  const reverseGeocodeSeqRef = useRef(0);
  const placesPickGenerationRef = useRef(0);
  const mapRef = useRef(null);
  const placesRef = useRef(null);
  const skipReverseOnNextRegionCompleteRef = useRef(false);
  const initialGpsDoneRef = useRef(false);
  const userChosePlaceBeforeGpsRef = useRef(false);

  const reverseGeocode = useCallback(
    async (latitude, longitude) => {
      const pickBaseline = placesPickGenerationRef.current;
      const seq = ++reverseGeocodeSeqRef.current;
      const stillOwnsAddressLine = () =>
        placesPickGenerationRef.current === pickBaseline &&
        seq === reverseGeocodeSeqRef.current;

      setAddressResolving(true);
      try {
        if (placesApiKey) {
          try {
            const formatted = await reverseGeocodeFormatted(
              latitude,
              longitude,
              placesApiKey
            );
            if (!stillOwnsAddressLine()) return;
            if (formatted) {
              setAddress(formatted);
              return;
            }
          } catch {
            /* fall through */
          }
        }
        if (!stillOwnsAddressLine()) return;
        try {
          const [place] = await Location.reverseGeocodeAsync({
            latitude,
            longitude,
          });
          if (!stillOwnsAddressLine()) return;
          const line = formatExpoReversePlace(place);
          setAddress(
            line || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
          );
        } catch {
          if (!stillOwnsAddressLine()) return;
          setAddress(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
        }
      } finally {
        if (
          placesPickGenerationRef.current === pickBaseline &&
          seq === reverseGeocodeSeqRef.current
        ) {
          setAddressResolving(false);
        }
      }
    },
    [placesApiKey]
  );

  const placesQuery = useMemo(
    () => ({
      key: placesApiKey,
      language: 'en',
      location: `${placesBiasLat},${placesBiasLng}`,
      radius: 50000,
    }),
    [placesApiKey, placesBiasLat, placesBiasLng]
  );

  const animateMapTo = useCallback((latitude, longitude) => {
    mapRef.current?.animateToRegion(
      {
        latitude,
        longitude,
        ...MAP_DELTA,
      },
      450
    );
  }, []);

  const onRegionChangeComplete = useCallback(
    (region) => {
      const { latitude, longitude } = region;
      setLat(latitude);
      setLng(longitude);

      if (skipReverseOnNextRegionCompleteRef.current) {
        skipReverseOnNextRegionCompleteRef.current = false;
        return;
      }
      reverseGeocode(latitude, longitude);
    },
    [reverseGeocode]
  );

  useEffect(() => {
    if (initialGpsDoneRef.current) return;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({});
      if (userChosePlaceBeforeGpsRef.current) {
        initialGpsDoneRef.current = true;
        return;
      }
      initialGpsDoneRef.current = true;
      const { latitude, longitude } = loc.coords;
      setPlacesBiasLat(latitude);
      setPlacesBiasLng(longitude);
      setLat(latitude);
      setLng(longitude);
      animateMapTo(latitude, longitude);
    })();
  }, [animateMapTo]);

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = (e) => {
      setKeyboardBottomInset(e?.endCoordinates?.height ?? 0);
    };
    // Reset to 0 so the absolute bottom sheet sits flush with the screen bottom again
    // (paddingBottom still uses safe-area via insets below).
    const onHide = () => setKeyboardBottomInset(0);
    const subShow = Keyboard.addListener(showEvt, onShow);
    const subHide = Keyboard.addListener(hideEvt, onHide);
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, []);

  const onPlaceSelected = useCallback(
    (data, details = null) => {
      userChosePlaceBeforeGpsRef.current = true;
      placesPickGenerationRef.current += 1;
      const coords = readPlaceLatLng(details);
      if (!coords) return;
      const line =
        details?.formatted_address || data.description || '';
      setAddress(line);
      setAddressResolving(false);
      setLat(coords.lat);
      setLng(coords.lng);
      setPlacesBiasLat(coords.lat);
      setPlacesBiasLng(coords.lng);
      skipReverseOnNextRegionCompleteRef.current = true;
      animateMapTo(coords.lat, coords.lng);
      placesRef.current?.setAddressText('');
      placesRef.current?.blur();
    },
    [animateMapTo]
  );

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission', 'Photo access is needed to attach a lock photo.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!res.canceled && res.assets[0]) {
      setPhotoUri(res.assets[0].uri);
    }
  };

  const submitEmergency = async () => {
    if (!address.trim()) {
      Alert.alert(
        'Address',
        'Move the map until the pin is on your location, or search for an address.'
      );
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('/api/jobs/emergency/create', {
        serviceType,
        customerLat: lat,
        customerLng: lng,
        customerAddress: address.trim(),
        customerNote: note.trim() || undefined,
      });
      router.replace({
        pathname: '/waiting',
        params: { jobId: data.job.id },
      });
    } catch (e) {
      const msg = e.response?.data?.error || '';
      if (
        e.response?.status === 404 &&
        msg.includes('locksmith')
      ) {
        Alert.alert(
          'No locksmiths available',
          'There are no verified locksmiths available in your area right now. Please try again in a few minutes or call us directly.',
          [
            {
              text: 'Call us',
              onPress: () => Linking.openURL('tel:+27661235067'),
            },
            {
              text: 'WhatsApp us',
              onPress: () =>
                Linking.openURL('https://wa.me/27661235067'),
            },
            { text: 'Try again', style: 'cancel' },
          ]
        );
      } else {
        Alert.alert(
          'Error',
          e.response?.data?.error ||
            e.message ||
            'Could not create job.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const submitScheduled = async () => {
    if (!address.trim()) {
      Alert.alert(
        'Address',
        'Move the map or search for your address, then try again.'
      );
      return;
    }
    setLoading(true);
    try {
      let jobPhotoUrl;
      if (photoUri) {
        const form = new FormData();
        form.append('photo', {
          uri: photoUri,
          type: mimeFromUri(photoUri),
          name: 'job-photo.jpg',
        });
        const upload = await postMultipart('/api/customer/upload-photo', form);
        jobPhotoUrl = upload.url;
      }
      const { data } = await api.post('/api/jobs/scheduled/create', {
        serviceType,
        description: description.trim() || undefined,
        jobPhotoUrl: jobPhotoUrl || undefined,
        scheduledDate: scheduledAt.toISOString(),
        customerLat: lat,
        customerLng: lng,
        customerAddress: address.trim(),
      });
      router.replace({
        pathname: '/quotes',
        params: { jobId: data.jobId },
      });
    } catch (e) {
      Alert.alert(
        'Error',
        e.response?.data?.error || e.message || 'Could not request quotes.'
      );
    } finally {
      setLoading(false);
    }
  };

  const searchTop = Math.max(insets.top, 8) + 52;

  return (
    <View style={styles.root}>
        <MapView
          ref={mapRef}
          style={styles.mapFill}
          mapType="standard"
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          googleRenderer="LATEST"
          loadingEnabled={Platform.OS === 'android'}
          loadingBackgroundColor="#E8EAED"
          initialRegion={{
            latitude: lat,
            longitude: lng,
            ...MAP_DELTA,
          }}
          onRegionChangeComplete={onRegionChangeComplete}
          rotateEnabled={false}
          pitchEnabled={false}
          scrollEnabled
          zoomEnabled
          showsUserLocation={false}
          showsMyLocationButton={false}
        />

        <View style={styles.pinOverlay} pointerEvents="none">
          <View style={styles.pinHalo} />
          <Ionicons
            name="location-sharp"
            size={48}
            color={COLORS.accent}
            style={styles.pinIcon}
          />
        </View>

        <View
          style={[
            styles.searchRow,
            { top: searchTop, left: 16, right: 16 },
          ]}
          pointerEvents="box-none"
        >
          <TouchableOpacity
            style={styles.backCircle}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Ionicons name="arrow-back" size={22} color={COLORS.text} />
          </TouchableOpacity>

          <View style={styles.searchCard}>
            {placesApiKey ? (
              <GooglePlacesAutocomplete
                ref={placesRef}
                placeholder="Where do you need help?"
                fetchDetails
                enablePoweredByContainer={false}
                debounce={300}
                minLength={2}
                keepResultsAfterBlur={false}
                keyboardShouldPersistTaps="handled"
                predefinedPlaces={[]}
                GooglePlacesDetailsQuery={{
                  fields: 'geometry,formatted_address,name',
                }}
                textInputProps={{
                  placeholderTextColor: COLORS.textMuted,
                  returnKeyType: 'search',
                  selectionColor: COLORS.accent,
                }}
                onPress={onPlaceSelected}
                query={placesQuery}
                styles={{
                  container: styles.placesContainer,
                  textInputContainer: styles.placesInputContainer,
                  textInput: styles.placesInput,
                  listView: styles.placesList,
                  row: styles.placesRow,
                  separator: styles.placesSeparator,
                  description: styles.placesDescription,
                }}
              />
            ) : (
              <TextInput
                style={styles.fallbackInput}
                value={address}
                editable={false}
                placeholder="Pan the map — pin shows where help goes"
                placeholderTextColor={COLORS.textMuted}
              />
            )}
          </View>
        </View>

        <View
          style={[
            styles.bottomSheet,
            {
              paddingBottom: Math.max(insets.bottom, 16),
              bottom: keyboardBottomInset,
            },
          ]}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
            nestedScrollEnabled
          >
            <Text style={styles.serviceLabel}>Service</Text>
            <Text style={styles.serviceType}>
              {serviceType?.replace(/_/g, ' ') || '—'}
            </Text>

            <Text style={styles.sheetAddrLabel}>Pickup / service address</Text>
            <Text style={styles.sheetAddress} numberOfLines={4}>
              {addressResolving && !address.trim()
                ? 'Locating…'
                : address.trim() || 'Locating…'}
            </Text>

            {isEmergency ? (
              <View style={styles.sheetSection}>
                <FormInput
                  label="Note (optional)"
                  value={note}
                  onChangeText={setNote}
                  placeholder='e.g. "Blue Toyota, Level 2 parking"'
                />
                <View style={styles.sheetBtnWrap}>
                  <GoldButton
                    title="Find Locksmith Near Me"
                    onPress={submitEmergency}
                    loading={loading}
                  />
                </View>
              </View>
            ) : (
              <View style={styles.sheetSection}>
                <FormInput
                  label="Describe the job"
                  value={description}
                  onChangeText={setDescription}
                  placeholder="What needs to be done?"
                  multiline
                  numberOfLines={4}
                />
                <TouchableOpacity style={styles.photoBtn} onPress={pickImage}>
                  <Ionicons
                    name="camera"
                    size={22}
                    color={COLORS.accent}
                    style={styles.photoIcon}
                  />
                  <Text style={styles.photoBtnText}>Add a photo of your lock</Text>
                </TouchableOpacity>
                {photoUri ? (
                  <Image source={{ uri: photoUri }} style={styles.preview} />
                ) : null}

                <Text style={styles.dtLabel}>When do you need this done?</Text>
                <TouchableOpacity
                  style={styles.dtBtn}
                  onPress={() => setShowPicker(true)}
                >
                  <Text style={styles.dtText}>
                    {(() => {
                      try {
                        return scheduledAt?.toLocaleString?.() || 'Select date and time';
                      } catch {
                        return 'Select date and time';
                      }
                    })()}
                  </Text>
                </TouchableOpacity>
                {showPicker && (
                  <DateTimePicker
                    value={scheduledAt}
                    mode="datetime"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event, d) => {
                      try {
                        if (Platform.OS === 'android') {
                          setShowPicker(false);
                        }
                        if (Platform.OS === 'ios' && event?.type === 'dismissed') {
                          setShowPicker(false);
                        }
                        if (!(d instanceof Date) || Number.isNaN(d.getTime())) {
                          return;
                        }
                        if (d.getTime() < Date.now()) {
                          Alert.alert('Please select a future date and time');
                          return;
                        }
                        setScheduledAt(d);
                      } catch {
                        /* never crash the screen */
                      }
                    }}
                  />
                )}
                <View style={styles.sheetBtnWrap}>
                  <GoldButton
                    title="Request Quotes"
                    onPress={submitScheduled}
                    loading={loading}
                  />
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  mapFill: {
    ...StyleSheet.absoluteFillObject,
  },
  pinOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 48,
  },
  pinHalo: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.bg,
    opacity: 0.85,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pinIcon: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 3,
    elevation: 4,
  },
  searchRow: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'flex-start',
    zIndex: 20,
    elevation: 8,
  },
  backCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  searchCard: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'visible',
  },
  placesContainer: {
    flex: 0,
  },
  placesInputContainer: {
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  placesInput: {
    backgroundColor: 'transparent',
    color: COLORS.text,
    fontSize: 16,
    height: 48,
    paddingHorizontal: 14,
  },
  placesList: {
    backgroundColor: COLORS.inputBg,
    borderRadius: 12,
    marginTop: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    maxHeight: 220,
  },
  placesRow: {
    backgroundColor: COLORS.inputBg,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  placesSeparator: {
    height: 1,
    backgroundColor: COLORS.border,
  },
  placesDescription: {
    color: COLORS.text,
    fontSize: 14,
  },
  fallbackInput: {
    color: COLORS.textMuted,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 14,
    minHeight: 48,
  },
  bottomSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    maxHeight: '46%',
    borderTopWidth: 1,
    borderColor: COLORS.border,
  },
  serviceLabel: {
    color: COLORS.textMuted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  serviceType: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  sheetAddrLabel: {
    color: COLORS.textMuted,
    fontSize: 13,
    marginBottom: 6,
  },
  sheetAddress: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
    marginBottom: 16,
  },
  sheetSection: {
    paddingBottom: 8,
  },
  sheetBtnWrap: {
    marginTop: 8,
  },
  photoIcon: { marginRight: 10 },
  photoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    backgroundColor: COLORS.inputBg,
  },
  photoBtnText: { color: COLORS.text, fontSize: 15 },
  preview: {
    width: '100%',
    height: 140,
    borderRadius: 12,
    marginBottom: 12,
  },
  dtLabel: { color: COLORS.textMuted, marginBottom: 8 },
  dtBtn: {
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  dtText: { color: COLORS.text, fontSize: 16 },
});
