/**
 * Optional: set GOOGLE_MAPS_ANDROID_KEY in .env or EAS Secrets so you do not
 * commit the key in app.json. If unset, values from app.json are used.
 */
const appJson = require('./app.json');

module.exports = () => {
  const key = process.env.GOOGLE_MAPS_ANDROID_KEY?.trim();
  if (!key) return appJson;
  return {
    expo: {
      ...appJson.expo,
      android: {
        ...appJson.expo.android,
        config: {
          ...appJson.expo.android.config,
          googleMaps: { apiKey: key },
        },
      },
    },
  };
};
