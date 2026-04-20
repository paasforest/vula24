import axios from 'axios';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { getToken } from './storage';

/**
 * POST multipart FormData via native fetch (reliable on RN Android).
 * Do not set Content-Type — fetch sets the boundary. Adds Bearer token when present.
 * @param {string} path Absolute path e.g. /api/locksmith/profile/photo
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
      throw new Error(text?.slice(0, 200) || `Invalid response (HTTP ${res.status})`);
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
 * API base URL (priority):
 * 1) expo.extra.apiUrl — set in app.config.js from EXPO_PUBLIC_API_URL (reliable in dev client)
 * 2) process.env.EXPO_PUBLIC_API_URL — inlined by Metro when present
 * 3) Metro LAN host :3000 (local backend; fails for Railway if unset)
 */
function getBaseURL() {
  const fromExtra = Constants.expoConfig?.extra?.apiUrl;
  if (typeof fromExtra === 'string' && fromExtra.trim().length > 0) {
    return fromExtra.trim().replace(/\/$/, '');
  }

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
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(async (config) => {
  config.baseURL = getBaseURL();
  const token = await getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  return config;
});

if (typeof __DEV__ !== 'undefined' && __DEV__) {
  // eslint-disable-next-line no-console
  console.log('[Vula24 Pro api] base URL:', getBaseURL());
}

export default api;
export { getBaseURL };
