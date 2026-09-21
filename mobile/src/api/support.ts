import { apiClient } from './client';
import type { SupportTicket } from '../types';

export async function createSupportTicket(payload: {
  subject: string;
  message: string;
}): Promise<{ ticket: SupportTicket }> {
  const { data } = await apiClient.post<{ ticket: SupportTicket }>('/support', payload);
  return data;
}

export async function fetchMySupportTickets(): Promise<{ tickets: SupportTicket[] }> {
  const { data } = await apiClient.get<{ tickets: SupportTicket[] }>('/support/mine');
  return data;
}

export async function reportUser(payload: { reportedUserId: string; reason: string }): Promise<{ report: unknown }> {
  const { data } = await apiClient.post<{ report: unknown }>('/reports', payload);
  return data;
}
