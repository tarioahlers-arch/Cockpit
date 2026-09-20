import { apiClient } from './client';
import type { AppNotification } from '../types';

export async function fetchNotifications(): Promise<{ notifications: AppNotification[]; unreadCount: number }> {
  const { data } = await apiClient.get<{ notifications: AppNotification[]; unreadCount: number }>('/notifications');
  return data;
}

export async function markNotificationRead(id: string): Promise<{ notification: AppNotification }> {
  const { data } = await apiClient.patch<{ notification: AppNotification }>(`/notifications/${id}/read`);
  return data;
}

export async function markAllNotificationsRead(): Promise<{ ok: true }> {
  const { data } = await apiClient.post<{ ok: true }>('/notifications/read-all');
  return data;
}
