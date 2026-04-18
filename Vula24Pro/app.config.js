/**
 * Loads Vula24Pro/.env (EXPO_PUBLIC_*) so `extra.apiUrl` is always set for the dev client.
 * Optional: GOOGLE_MAPS_ANDROID_KEY overrides Android Maps key from app.json.
 */
const path = require('path');

try {
  require('dotenv').config({ path: path.join(__dirname, '.env') });
} catch (_) {
  /* optional — Expo also loads .env when present */
}

const appJson = require('./app.json');

function withExtraApiUrl(expo) {
  const raw = process.env.EXPO_PUBLIC_API_URL;
  const apiUrl =
    typeof raw === 'string' && raw.trim().length > 0
      ? raw.trim().replace(/\/$/, '')
      : '';
  return {
    ...expo,
    extra: {
      ...(expo.extra || {}),
      apiUrl,
    },
  };
}

module.exports = () => {
  const key = process.env.GOOGLE_MAPS_ANDROID_KEY?.trim();
  const expoBase = withExtraApiUrl({ ...appJson.expo });

  if (!key) {
    return { expo: expoBase };
  }

  return {
    expo: {
      ...expoBase,
      android: {
        ...expoBase.android,
        config: {
          ...expoBase.android.config,
          googleMaps: { apiKey: key },
        },
      },
    },
  };
};
