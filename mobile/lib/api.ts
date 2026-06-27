import Constants from 'expo-constants';
import { ApiClient } from '@nuskhaa/shared';

// Base URL precedence: EXPO_PUBLIC_API_BASE_URL env → app.json extra → localhost.
// NOTE: on a physical iOS device, "localhost" points at the phone — set
// EXPO_PUBLIC_API_BASE_URL to your machine's LAN IP (e.g. http://192.168.1.5:8080).
const baseUrl =
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  (Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined)?.apiBaseUrl ??
  'http://localhost:8080';

export const api = new ApiClient({ baseUrl });
