import { apiClient } from './client';
import type { Conversation, Message } from '../types';

export async function fetchConversations(): Promise<{ conversations: Conversation[] }> {
  const { data } = await apiClient.get<{ conversations: Conversation[] }>('/conversations');
  return data;
}

export async function fetchMessages(conversationId: string): Promise<{ messages: Message[] }> {
  const { data } = await apiClient.get<{ messages: Message[] }>(`/conversations/${conversationId}/messages`);
  return data;
}

export async function postMessage(
  conversationId: string,
  payload: { text?: string; attachmentUrl?: string }
): Promise<{ message: Message }> {
  const { data } = await apiClient.post<{ message: Message }>(`/conversations/${conversationId}/messages`, payload);
  return data;
}
