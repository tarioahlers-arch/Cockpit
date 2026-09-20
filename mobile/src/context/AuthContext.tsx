import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TOKEN_STORAGE_KEY, USER_STORAGE_KEY } from '../api/client';
import { fetchMe, login as loginRequest, register as registerRequest, RegisterPayload, RegisterResponse } from '../api/auth';
import type { User } from '../types';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<RegisterResponse>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setUser: (user: User) => Promise<void>;
  /** Persists an already-obtained token/user pair (e.g. after RegisterScreen's own register() call). */
  setSession: (token: string, user: User) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [storedToken, storedUser] = await Promise.all([
          AsyncStorage.getItem(TOKEN_STORAGE_KEY),
          AsyncStorage.getItem(USER_STORAGE_KEY),
        ]);
        if (cancelled) return;
        if (storedToken) {
          setToken(storedToken);
          if (storedUser) {
            try {
              setUserState(JSON.parse(storedUser) as User);
            } catch {
              // corrupt cache, ignore and fall through to refetch below
            }
          }
          // Validate/refresh the cached user against the backend in case it's stale.
          try {
            const { user: freshUser } = await fetchMe();
            if (!cancelled) {
              setUserState(freshUser);
              await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(freshUser));
            }
          } catch {
            // Token likely invalid/expired — clear auth state.
            if (!cancelled) {
              await AsyncStorage.multiRemove([TOKEN_STORAGE_KEY, USER_STORAGE_KEY]);
              setToken(null);
              setUserState(null);
            }
          }
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback(async (nextToken: string, nextUser: User) => {
    await AsyncStorage.setItem(TOKEN_STORAGE_KEY, nextToken);
    await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(nextUser));
    setToken(nextToken);
    setUserState(nextUser);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const { token: newToken, user: newUser } = await loginRequest(email, password);
      await persist(newToken, newUser);
    },
    [persist]
  );

  const register = useCallback(
    async (payload: RegisterPayload) => {
      const response = await registerRequest(payload);
      await persist(response.token, response.user);
      return response;
    },
    [persist]
  );

  const logout = useCallback(async () => {
    await AsyncStorage.multiRemove([TOKEN_STORAGE_KEY, USER_STORAGE_KEY]);
    setToken(null);
    setUserState(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const { user: freshUser } = await fetchMe();
    setUserState(freshUser);
    await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(freshUser));
  }, []);

  const setUser = useCallback(async (nextUser: User) => {
    setUserState(nextUser);
    await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(nextUser));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, token, isLoading, login, register, logout, refreshUser, setUser, setSession: persist }),
    [user, token, isLoading, login, register, logout, refreshUser, setUser, persist]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
