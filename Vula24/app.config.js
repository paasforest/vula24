/**
 * Shipping target: Android / Google Play only for now — what matters is:
 * - android.config.googleMaps.apiKey (Maps SDK for Android — real map tiles)
 * - EXPO_PUBLIC_GOOGLE_PLACES_API_KEY or the same key via extra (Places + Geocoding)
 * iOS entries in app.json can stay; you do not need Apple devices or App Store for this phase.
 *
 * Optional: GOOGLE_MAPS_ANDROID_KEY in .env or EAS Secrets overrides app.json.
 */
const appJson = require('./app.json');

module.exports = () => {
  const mapsOverride = process.env.GOOGLE_MAPS_ANDROID_KEY?.trim();
  const androidMapsApiKey =
    mapsOverride || appJson.expo?.android?.config?.googleMaps?.apiKey || '';
  const placesKey =
    process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY?.trim() || androidMapsApiKey || '';

  /** Always set native Android Maps key here so EAS/prebuild never relies on a partial merge. */
  const expo = {
    ...appJson.expo,
    android: {
      ...appJson.expo.android,
      config: {
        ...appJson.expo.android?.config,
        googleMaps: { apiKey: androidMapsApiKey },
      },
    },
    extra: {
      ...(appJson.expo.extra || {}),
      googlePlacesApiKey: placesKey,
    },
  };

  return { expo };
};
