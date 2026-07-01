import axios, { AxiosRequestConfig, GenericAbortSignal } from 'axios';
import { MMKV } from 'react-native-mmkv';
import * as Keychain from 'react-native-keychain';

export const storage = new MMKV();
const API_URL_KEY = 'vidra:api_url';
const DEFAULT_API_URL = 'http://10.0.2.2:3000/api'; // Android emulator localhost alias

export function getBaseUrl(): string {
  return storage.getString(API_URL_KEY) || DEFAULT_API_URL;
}

export function setBaseUrl(url: string): void {
  storage.set(API_URL_KEY, url);
}

// Client-side scheme checker
export function validateUrlClient(url: string): boolean {
  if (!url) return false;
  const trimmed = url.trim().toLowerCase();
  
  if (trimmed.startsWith('javascript:') || trimmed.startsWith('file:')) {
    return false;
  }
  
  return trimmed.startsWith('http://') || trimmed.startsWith('https://');
}

// Fetch JWT from secure storage
export async function getJwtToken(): Promise<string | null> {
  try {
    const credentials = await Keychain.getGenericPassword({ service: 'vidra:jwt' });
    if (credentials) {
      return credentials.password;
    }
  } catch (err) {
    console.error('Keychain fetch error', err);
  }
  
  // Fallback to MMKV for non-secure testing if Keychain is unavailable
  return storage.getString('vidra:temp_jwt') || null;
}

// Save JWT securely
export async function saveJwtToken(token: string): Promise<void> {
  try {
    await Keychain.setGenericPassword('device_token', token, { service: 'vidra:jwt' });
  } catch {
    storage.set('vidra:temp_jwt', token);
  }
}

// Axios Instance
const apiClient = axios.create({
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor injecting token dynamic base URL
apiClient.interceptors.request.use(async (config) => {
  config.baseURL = getBaseUrl();
  
  const token = await getJwtToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// API Calls
export async function registerDevice(deviceId: string): Promise<string> {
  const baseUrl = getBaseUrl();
  const response = await axios.post(`${baseUrl}/device/register`, { deviceId });
  const token = response.data.token;
  await saveJwtToken(token);
  return token;
}

export interface ExtractStartResponse {
  status: 'completed' | 'pending';
  jobId?: string;
  result?: any;
}

export async function startExtraction(url: string, signal?: GenericAbortSignal): Promise<ExtractStartResponse> {
  const response = await apiClient.post('/extract', { url }, { signal });
  return response.data;
}

export async function checkExtractionStatus(jobId: string, signal?: GenericAbortSignal): Promise<any> {
  const response = await apiClient.get(`/extract/status/${jobId}`, { signal });
  return response.data;
}

export async function prepareDownload(url: string, formatId: string, signal?: GenericAbortSignal): Promise<any> {
  const response = await apiClient.post('/download/prepare', { url, formatId }, { signal });
  return response.data;
}

export async function checkPrepareStatus(mergeJobId: string, signal?: GenericAbortSignal): Promise<any> {
  const response = await apiClient.get(`/download/prepare/status/${mergeJobId}`, { signal });
  return response.data;
}

export async function resolveManifest(url: string, signal?: GenericAbortSignal): Promise<any> {
  const response = await apiClient.get(`/manifest/resolve?url=${encodeURIComponent(url)}`, { signal });
  return response.data;
}
