import { apiClient } from './client';
import type { User } from '../types';

export interface RegisterPayload {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  city?: string;
}

export interface RegisterResponse {
  token: string;
  user: User;
  devVerificationToken?: string;
}

export async function register(payload: RegisterPayload): Promise<RegisterResponse> {
  const { data } = await apiClient.post<RegisterResponse>('/auth/register', payload);
  return data;
}

export async function verifyEmail(token: string): Promise<{ user: User }> {
  const { data } = await apiClient.post<{ user: User }>('/auth/verify-email', { token });
  return data;
}

export async function login(email: string, password: string): Promise<{ token: string; user: User }> {
  const { data } = await apiClient.post<{ token: string; user: User }>('/auth/login', { email, password });
  return data;
}

export async function fetchMe(): Promise<{ user: User }> {
  const { data } = await apiClient.get<{ user: User }>('/auth/me');
  return data;
}
