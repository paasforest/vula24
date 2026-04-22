import axios from 'axios';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { getToken } from './storage';

/**
 * POST multipart FormData via native fetch (reliable on RN Android).
 * Do not set Content-Type — fetch sets the boundary. Adds Bearer token when present.
 * @param {string} path Absolute path e.g. /api/customer/upload-photo
 * @param {FormData} form
 * @param {{ timeoutMs?: number }} [options]
 * @returns {Promise<Record<string, unknown>>} Parsed JSON body
 */
export async function postMultipart(path, form, options = {}) {
  const base = getBaseURL();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${base}${normalizedPath}`;
  const token = await getToken();
  /** @type {Record<string, string>} */
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const timeoutMs = options.timeoutMs ?? 120000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'POST',
      body: form,
      headers,
      signal: controller.signal,
    });
    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(
        text?.slice(0, 200) || `Invalid response (HTTP ${res.status})`
      );
    }
    if (!res.ok) {
      throw new Error(data.error || `Request failed (HTTP ${res.status})`);
    }
    return data;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Resolves API base URL for dev:
 * - EXPO_PUBLIC_API_URL in .env (highest priority)
 * - Expo Go / dev client: same LAN host as Metro (physical phone works without manual IP)
 * - Android emulator: 10.0.2.2
 * - iOS simulator / fallback: localhost
 */
function getBaseURL() {
  const fromEnv =
    typeof process !== 'undefined' && process.env.EXPO_PUBLIC_API_URL
      ? process.env.EXPO_PUBLIC_API_URL
      : null;
  if (fromEnv) {
    return fromEnv.replace(/\/$/, '');
  }

  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.expoGoConfig?.debuggerHost ||
    Constants.manifest?.debuggerHost ||
    Constants.manifest2?.extra?.expoGo?.debuggerHost ||
    Constants.manifest2?.extra?.expoClient?.hostUri;
  if (typeof hostUri === 'string' && hostUri.length > 0) {
    const host = hostUri.split(':')[0];
    if (host && host !== '127.0.0.1' && host !== 'localhost') {
      return `http://${host}:3000`;
    }
  }

  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3000';
  }
  return 'http://localhost:3000';
}

const api = axios.create({
  baseURL: getBaseURL(),
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

if (typeof __DEV__ !== 'undefined' && __DEV__) {
  // eslint-disable-next-line no-console
  console.log('[Vula24 api] base URL:', getBaseURL());
}

api.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * Clear message when signup/login fails (network vs misconfigured production API).
 */
function formatAuthError(error) {
  const base = getBaseURL();
  if (!error.response) {
    const hint =
      error.code === 'ECONNABORTED'
        ? 'Request timed out.'
        : 'Cannot reach the server.';
    return `${hint}\n\nAPI: ${base}\nSame Wi‑Fi as your PC? For a phone, set EXPO_PUBLIC_API_URL to http://<your-computer-LAN-IP>:3000 in Vula24/.env`;
  }
  const status = error.response.status;
  const serverMsg = error.response.data?.error;
  if (status === 500 && serverMsg === 'Internal server error') {
    return `Server error from:\n${base}\n\nIf this is Railway/production, run database migrations there (e.g. npx prisma migrate deploy) and check deploy logs. For local backend, set EXPO_PUBLIC_API_URL=http://<LAN-IP>:3000.`;
  }
  return serverMsg || error.message || 'Request failed.';
}

export default api;
export { getBaseURL, formatAuthError };
