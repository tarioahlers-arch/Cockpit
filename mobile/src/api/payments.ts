import { apiClient } from './client';
import type { Payment } from '../types';

export async function createPaymentIntent(
  taskId: string
): Promise<{ payment: Payment; clientSecret: string; testMode: boolean }> {
  const { data } = await apiClient.post<{ payment: Payment; clientSecret: string; testMode: boolean }>(
    `/payments/tasks/${taskId}/create-intent`
  );
  return data;
}

export async function confirmPayment(paymentId: string): Promise<{ payment: Payment }> {
  const { data } = await apiClient.post<{ payment: Payment }>(`/payments/${paymentId}/confirm`);
  return data;
}

export async function connectOnboard(): Promise<{ connected: true; testMode: boolean }> {
  const { data } = await apiClient.post<{ connected: true; testMode: boolean }>('/payments/connect/onboard');
  return data;
}

export async function requestPayout(taskId: string): Promise<{ payment: Payment; payoutCents: number }> {
  const { data } = await apiClient.post<{ payment: Payment; payoutCents: number }>('/payments/payout', { taskId });
  return data;
}
