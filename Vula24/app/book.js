import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TouchableOpacity,
  Image,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { FormInput } from '../components/FormInput';
import { GoldButton } from '../components/GoldButton';
import { COLORS } from '../constants/theme';
import api from '../lib/api';

export default function BookScreen() {
  const { serviceType: st } = useLocalSearchParams();
  const serviceType = Array.isArray(st) ? st[0] : st;

  const isEmergency =
    serviceType === 'CAR_LOCKOUT' || serviceType === 'HOUSE_LOCKOUT';

  const [lat, setLat] = useState(-26.2041);
  const [lng, setLng] = useState(28.0473);
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [description, setDescription] = useState('');
  const [scheduledAt, setScheduledAt] = useState(new Date(Date.now() + 3600000));
  const [showPicker, setShowPicker] = useState(false);
  const [photoUri, setPhotoUri] = useState(null);
  const [loading, setLoading] = useState(false);

  const reverseGeocode = useCallback(async (latitude, longitude) => {
    try {
      const [place] = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });
      if (place) {
        const line = [place.name, place.street, place.city, place.region]
          .filter(Boolean)
          .join(', ');
        setAddress(line || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
      } else {
        setAddress(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
      }
    } catch {
      setAddress(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({});
      setLat(loc.coords.latitude);
      setLng(loc.coords.longitude);
      reverseGeocode(loc.coords.latitude, loc.coords.longitude);
    })();
  }, [reverseGeocode]);

  const onMarkerDragEnd = (e) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setLat(latitude);
    setLng(longitude);
    reverseGeocode(latitude, longitude);
  };

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
      Alert.alert('Address', 'Could not resolve address. Move the pin or try again.');
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
      Alert.alert(
        'Error',
        e.response?.data?.error || e.message || 'Could not create job.'
      );
    } finally {
      setLoading(false);
    }
  };

  const submitScheduled = async () => {
    if (!address.trim()) {
      Alert.alert('Address', 'Set your location on the map.');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('/api/jobs/scheduled/create', {
        serviceType,
        description: description.trim() || undefined,
        jobPhotoUrl: undefined,
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

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll}>
          <TouchableOpacity style={styles.back} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.accent} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>
            {isEmergency ? 'Emergency booking' : 'Schedule a service'}
          </Text>
          <Text style={styles.meta}>{serviceType?.replace(/_/g, ' ')}</Text>

          <View style={styles.mapWrap}>
            <MapView
              style={styles.map}
              provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
              region={{
                latitude: lat,
                longitude: lng,
                latitudeDelta: 0.02,
                longitudeDelta: 0.02,
              }}
            >
              <Marker
                coordinate={{ latitude: lat, longitude: lng }}
                draggable
                onDragEnd={onMarkerDragEnd}
                tracksViewChanges={false}
              >
                <View style={styles.goldPin} />
              </Marker>
            </MapView>
          </View>
          <Text style={styles.addrLabel}>Detected address</Text>
          <Text style={styles.addr}>{address || 'Locating…'}</Text>

          {isEmergency ? (
            <>
              <FormInput
                label="Add a note (optional)"
                value={note}
                onChangeText={setNote}
                placeholder='e.g. "Blue Toyota, Level 2 parking"'
              />
              <GoldButton
                title="Find Locksmith Near Me"
                onPress={submitEmergency}
                loading={loading}
              />
            </>
          ) : (
            <>
              <FormInput
                label="Describe the job"
                value={description}
                onChangeText={setDescription}
                placeholder="What needs to be done?"
                multiline
                numberOfLines={4}
              />
              <TouchableOpacity style={styles.photoBtn} onPress={pickImage}>
                <Ionicons name="camera" size={22} color={COLORS.accent} style={styles.photoIcon} />
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
                  {scheduledAt.toLocaleString()}
                </Text>
              </TouchableOpacity>
              {showPicker && (
                <DateTimePicker
                  value={scheduledAt}
                  mode="datetime"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(event, d) => {
                    if (Platform.OS === 'android') {
                      setShowPicker(false);
                    }
                    if (d) setScheduledAt(d);
                    if (Platform.OS === 'ios' && event?.type === 'dismissed') {
                      setShowPicker(false);
                    }
                  }}
                />
              )}
              <GoldButton
                title="Request Quotes"
                onPress={submitScheduled}
                loading={loading}
              />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  flex: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 40 },
  back: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  backText: { color: COLORS.accent, marginLeft: 8, fontSize: 16 },
  title: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '700',
  },
  meta: { color: COLORS.textMuted, marginTop: 4, marginBottom: 16 },
  mapWrap: {
    height: 240,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  map: { flex: 1 },
  goldPin: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.accent,
    borderWidth: 3,
    borderColor: '#fff',
  },
  addrLabel: {
    color: COLORS.textMuted,
    marginTop: 12,
    fontSize: 13,
  },
  addr: { color: COLORS.text, fontSize: 15, marginBottom: 8 },
  photoIcon: { marginRight: 10 },
  photoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  photoBtnText: { color: COLORS.text, fontSize: 15 },
  preview: {
    width: '100%',
    height: 160,
    borderRadius: 12,
    marginBottom: 16,
  },
  dtLabel: { color: COLORS.textMuted, marginBottom: 8 },
  dtBtn: {
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  dtText: { color: COLORS.text, fontSize: 16 },
});
