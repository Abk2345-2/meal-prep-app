'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { api } from './api';

const TOKEN_KEY = 'ptp_token';
const USER_KEY  = 'ptp_user';

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
  login: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  token: null,
  loading: true,
  login: () => {},
  logout: () => {},
});

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Always start with null/true — identical on server and first client render.
  // This prevents the SSR ↔ client hydration mismatch.
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser]   = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const applyToken = useCallback((t: string | null, u: AuthUser | null) => {
    setToken(t);
    setUser(u);
    api.setToken(t);
    if (t) {
      localStorage.setItem(TOKEN_KEY, t);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
    if (u) {
      localStorage.setItem(USER_KEY, JSON.stringify(u));
    } else {
      localStorage.removeItem(USER_KEY);
    }
  }, []);

  // On mount: read localStorage and immediately set state, then verify with server.
  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY);

    if (!stored) {
      setLoading(false);
      return;
    }

    // Restore session from localStorage right away so the page renders.
    const storedUser = (() => {
      try {
        const raw = localStorage.getItem(USER_KEY);
        return raw ? (JSON.parse(raw) as AuthUser) : null;
      } catch {
        return null;
      }
    })();

    setToken(stored);
    setUser(storedUser);
    api.setToken(stored);

    // Background verify — confirm the token is still valid.
    fetch(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${stored}` },
    })
      .then((r) => (r.ok ? (r.json() as Promise<AuthUser>) : Promise.reject(r.status)))
      .then((u) => {
        setUser(u);
        api.setToken(stored);
        localStorage.setItem(USER_KEY, JSON.stringify(u));
      })
      .catch((err) => {
        if (err === 401 || err === 403) {
          // Token definitively rejected — clear session.
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(USER_KEY);
          api.setToken(null);
          setToken(null);
          setUser(null);
        }
        // Network errors: leave existing session intact — token may still be valid.
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(() => {
    window.location.href = `${API_BASE}/api/auth/login`;
  }, []);

  const logout = useCallback(() => {
    applyToken(null, null);
  }, [applyToken]);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
