import { apiClient } from './client';
import type { PublicUser, Review, User } from '../types';

export interface UpdateMePayload {
  firstName?: string;
  lastName?: string;
  phone?: string;
  city?: string;
  bio?: string;
  avatarUrl?: string;
}

export async function updateMe(payload: UpdateMePayload): Promise<{ user: User }> {
  const { data } = await apiClient.patch<{ user: User }>('/users/me', payload);
  return data;
}

export interface TaskerOnboardingPayload {
  hourlyRate: number;
  radiusKm: number;
  categoryIds: string[];
  bio?: string;
}

export async function taskerOnboarding(payload: TaskerOnboardingPayload): Promise<{ user: User }> {
  const { data } = await apiClient.post<{ user: User }>('/users/me/tasker-onboarding', payload);
  return data;
}

export async function stripeConnectOnboard(): Promise<{ user: User; connected: true }> {
  const { data } = await apiClient.post<{ user: User; connected: true }>('/users/me/stripe-connect');
  return data;
}

export async function getPublicUser(id: string): Promise<{ user: PublicUser }> {
  const { data } = await apiClient.get<{ user: PublicUser }>(`/users/${id}`);
  return data;
}

export async function getUserReviews(id: string): Promise<{ reviews: Review[] }> {
  const { data } = await apiClient.get<{ reviews: Review[] }>(`/users/${id}/reviews`);
  return data;
}
