import { apiClient } from './client';
import type { Category } from '../types';

export async function fetchCategories(): Promise<{ categories: Category[] }> {
  const { data } = await apiClient.get<{ categories: Category[] }>('/categories');
  return data;
}
