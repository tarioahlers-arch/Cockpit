import { apiClient } from './client';
import type { Review } from '../types';

export interface SubmitReviewPayload {
  rating: number;
  comment?: string;
  isAnonymous?: boolean;
}

export async function submitTaskReview(taskId: string, payload: SubmitReviewPayload): Promise<{ review: Review }> {
  const { data } = await apiClient.post<{ review: Review }>(`/tasks/${taskId}/review`, payload);
  return data;
}
