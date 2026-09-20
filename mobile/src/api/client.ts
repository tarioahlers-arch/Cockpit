import axios, { AxiosError } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ApiError } from '../types';

// EXPO_PUBLIC_* env vars are inlined at build time by Expo (SDK 49+).
// Falls back to localhost, which only reaches the backend from a
// simulator/web build running on the same machine — see mobile/.env.
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000/api';
export const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL ?? 'http://localhost:4000';

export const TOKEN_STORAGE_KEY = 'helferhand.token';
export const USER_STORAGE_KEY = 'helferhand.user';

export const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 20000,
});

apiClient.interceptors.request.use(async (config) => {
  try {
    const token = await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
    if (token) {
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch {
    // AsyncStorage unavailable — proceed unauthenticated, request will 401 if needed.
  }
  return config;
});

/** Extracts a human-readable message from a failed API call. */
export function getApiErrorMessage(error: unknown, fallback = 'Ein Fehler ist aufgetreten.'): string {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ApiError>;
    return axiosError.response?.data?.message ?? axiosError.message ?? fallback;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}
