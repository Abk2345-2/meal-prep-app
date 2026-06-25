import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { api } from './api';

WebBrowser.maybeCompleteAuthSession();

const TOKEN_KEY = 'ptp_token';
const USER_KEY = 'ptp_user';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatar: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  applyToken: (token: string, user: AuthUser) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  token: null,
  loading: true,
  login: async () => {},
  logout: async () => {},
  applyToken: async () => {},
});

const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  (Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined)?.apiBaseUrl ??
  'http://localhost:8080';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function restore() {
      try {
        const [storedToken, storedUser] = await Promise.all([
          SecureStore.getItemAsync(TOKEN_KEY),
          SecureStore.getItemAsync(USER_KEY),
        ]);
        if (storedToken && storedUser) {
          const u = JSON.parse(storedUser) as AuthUser;
          setToken(storedToken);
          setUser(u);
          api.setToken(storedToken);

          // Background verify
          try {
            const res = await fetch(`${API_BASE}/api/auth/me`, {
              headers: { Authorization: `Bearer ${storedToken}` },
            });
            if (res.ok) {
              const fresh = (await res.json()) as AuthUser;
              setUser(fresh);
              await SecureStore.setItemAsync(USER_KEY, JSON.stringify(fresh));
            } else if (res.status === 401 || res.status === 403) {
              await _clear();
            }
          } catch {
            // network error — keep existing session
          }
        }
      } finally {
        setLoading(false);
      }
    }
    restore();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const _clear = useCallback(async () => {
    setToken(null);
    setUser(null);
    api.setToken(null);
    await Promise.all([
      SecureStore.deleteItemAsync(TOKEN_KEY),
      SecureStore.deleteItemAsync(USER_KEY),
    ]);
  }, []);

  const applyToken = useCallback(async (t: string, u: AuthUser) => {
    setToken(t);
    setUser(u);
    api.setToken(t);
    await Promise.all([
      SecureStore.setItemAsync(TOKEN_KEY, t),
      SecureStore.setItemAsync(USER_KEY, JSON.stringify(u)),
    ]);
  }, []);

  const login = useCallback(async () => {
    // Use Linking.createURL so the deep link scheme is correct for both
    // Expo Go (exp://) and standalone builds (pantrytoplate://).
    const deepLink = Linking.createURL('auth/callback');
    const loginUrl = `${API_BASE}/api/auth/login?redirect_to=${encodeURIComponent(deepLink)}`;

    // On Android, Chrome Custom Tabs doesn't auto-dismiss — we need to
    // listen for the incoming deep link via Linking and dismiss manually.
    if (Platform.OS === 'android') {
      const subscription = Linking.addEventListener('url', async (event) => {
        subscription.remove();
        await WebBrowser.dismissBrowser();
        const url = new URL(event.url);
        const t = url.searchParams.get('token');
        const id = url.searchParams.get('id');
        const name = url.searchParams.get('name');
        const email = url.searchParams.get('email');
        const avatar = url.searchParams.get('avatar');
        if (t && id && name && email) {
          await applyToken(t, { id, name, email, avatar: avatar ?? '' });
        }
      });
      await WebBrowser.openBrowserAsync(loginUrl);
    } else {
      // iOS: ASWebAuthenticationSession handles the redirect automatically
      const result = await WebBrowser.openAuthSessionAsync(loginUrl, deepLink);
      if (result.type !== 'success') return;
      const url = new URL(result.url);
      const t = url.searchParams.get('token');
      const id = url.searchParams.get('id');
      const name = url.searchParams.get('name');
      const email = url.searchParams.get('email');
      const avatar = url.searchParams.get('avatar');
      if (t && id && name && email) {
        await applyToken(t, { id, name, email, avatar: avatar ?? '' });
      }
    }
  }, [applyToken]);

  const logout = useCallback(async () => {
    await _clear();
  }, [_clear]);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, applyToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
