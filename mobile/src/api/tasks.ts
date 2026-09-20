import { apiClient } from './client';
import type { Application, Invitation, Task, TaskStatus } from '../types';

export interface CreateTaskPayload {
  title: string;
  description: string;
  categoryId: string;
  city: string;
  address?: string;
  budgetCents: number;
  scheduledAt?: string;
}

export async function createTask(payload: CreateTaskPayload): Promise<{ task: Task }> {
  const { data } = await apiClient.post<{ task: Task }>('/tasks', payload);
  return data;
}

export interface TaskListFilters {
  categoryId?: string;
  city?: string;
  status?: TaskStatus;
  q?: string;
  minBudget?: number;
  maxBudget?: number;
  page?: number;
  pageSize?: number;
}

export interface TaskListResponse {
  tasks: Task[];
  total: number;
  page: number;
  pageSize: number;
}

export async function fetchTasks(filters: TaskListFilters): Promise<TaskListResponse> {
  const params: Record<string, string | number> = {};
  if (filters.categoryId) params.categoryId = filters.categoryId;
  if (filters.city) params.city = filters.city;
  if (filters.status) params.status = filters.status;
  if (filters.q) params.q = filters.q;
  if (filters.minBudget !== undefined) params.minBudget = filters.minBudget;
  if (filters.maxBudget !== undefined) params.maxBudget = filters.maxBudget;
  if (filters.page !== undefined) params.page = filters.page;
  if (filters.pageSize !== undefined) params.pageSize = filters.pageSize;
  const { data } = await apiClient.get<TaskListResponse>('/tasks', { params });
  return data;
}

export type MyTasksType = 'posted' | 'in_progress' | 'invites' | 'applications' | 'completed';

export interface MyTasksResponse {
  tasks?: Task[];
  invitations?: (Invitation & { task: Task })[];
  applications?: (Application & { task: Task })[];
}

export async function fetchMyTasks(type: MyTasksType): Promise<MyTasksResponse> {
  const { data } = await apiClient.get<MyTasksResponse>('/tasks/mine', { params: { type } });
  return data;
}

export async function fetchTask(id: string): Promise<{ task: Task }> {
  const { data } = await apiClient.get<{ task: Task }>(`/tasks/${id}`);
  return data;
}

export async function updateTask(id: string, payload: Partial<CreateTaskPayload>): Promise<{ task: Task }> {
  const { data } = await apiClient.patch<{ task: Task }>(`/tasks/${id}`, payload);
  return data;
}

export async function applyToTask(
  id: string,
  payload: { message?: string; proposedCents?: number }
): Promise<{ application: Application }> {
  const { data } = await apiClient.post<{ application: Application }>(`/tasks/${id}/apply`, payload);
  return data;
}

export async function acceptApplication(taskId: string, appId: string): Promise<{ task: Task }> {
  const { data } = await apiClient.post<{ task: Task }>(`/tasks/${taskId}/applications/${appId}/accept`);
  return data;
}

export async function inviteTasker(taskId: string, taskerId: string): Promise<{ invitation: Invitation }> {
  const { data } = await apiClient.post<{ invitation: Invitation }>(`/tasks/${taskId}/invite`, { taskerId });
  return data;
}

export async function respondToInvitation(
  taskId: string,
  invId: string,
  accept: boolean
): Promise<{ status: string }> {
  const { data } = await apiClient.post<{ status: string }>(`/tasks/${taskId}/invitations/${invId}/respond`, {
    accept,
  });
  return data;
}

export async function startTask(id: string): Promise<{ task: Task }> {
  const { data } = await apiClient.post<{ task: Task }>(`/tasks/${id}/start`);
  return data;
}

export async function completeTask(id: string): Promise<{ task: Task }> {
  const { data } = await apiClient.post<{ task: Task }>(`/tasks/${id}/complete`);
  return data;
}

export async function cancelTask(id: string): Promise<{ task: Task }> {
  const { data } = await apiClient.post<{ task: Task }>(`/tasks/${id}/cancel`);
  return data;
}
