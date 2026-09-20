import { apiClient, API_URL } from './client';

export interface PickedFile {
  uri: string;
  name: string;
  mimeType: string;
}

export interface UploadResponse {
  url: string;
  filename: string;
}

/** Uploads a picked image (multipart/form-data, field "file") and returns its relative URL. */
export async function uploadFile(file: PickedFile): Promise<UploadResponse> {
  const formData = new FormData();
  // React Native's FormData accepts this { uri, name, type } shape for file fields.
  formData.append('file', {
    uri: file.uri,
    name: file.name,
    type: file.mimeType,
  } as unknown as Blob);

  const { data } = await apiClient.post<UploadResponse>('/uploads', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

/** The upload endpoint returns a relative URL (e.g. "/uploads/xyz.png"); resolve it to an absolute one for <Image>. */
export function resolveUploadUrl(relativeOrAbsoluteUrl: string): string {
  if (/^https?:\/\//i.test(relativeOrAbsoluteUrl)) return relativeOrAbsoluteUrl;
  const apiOrigin = API_URL.replace(/\/api\/?$/, '');
  return `${apiOrigin}${relativeOrAbsoluteUrl.startsWith('/') ? '' : '/'}${relativeOrAbsoluteUrl}`;
}
