/**
 * Optional: set GOOGLE_MAPS_ANDROID_KEY in .env or EAS Secrets so you do not
 * commit the key in app.json. If unset, values from app.json are used.
 * EXPO_PUBLIC_GOOGLE_PLACES_API_KEY — Places Autocomplete + Geocoding reverse
 * address on book screen (enable Places API + Geocoding API for that key in GCP).
 * Android Maps key in app.json is separate (Maps SDK for Android).
 */
const appJson = require('./app.json');

module.exports = () => {
  const mapsOverride = process.env.GOOGLE_MAPS_ANDROID_KEY?.trim();
  const placesKey =
    process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY?.trim() ||
    appJson.expo?.android?.config?.googleMaps?.apiKey ||
    '';

  const expo = {
    ...appJson.expo,
    extra: {
      ...(appJson.expo.extra || {}),
      googlePlacesApiKey: placesKey,
    },
  };

  if (!mapsOverride) {
    return { expo };
  }

  return {
    expo: {
      ...expo,
      android: {
        ...expo.android,
        config: {
          ...expo.android.config,
          googleMaps: { apiKey: mapsOverride },
        },
      },
    },
  };
};
