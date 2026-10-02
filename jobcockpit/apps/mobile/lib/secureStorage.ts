/**
 * Supabase-Session-Storage auf Basis von expo-secure-store.
 *
 * SecureStore-Werte sollten 2048 Bytes nicht überschreiten, eine Supabase-Session ist
 * aber oft größer. Deshalb werden Werte in Chunks aufgeteilt.
 */
export interface KeyValueBackend {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

export const CHUNK_SIZE = 1800;

// SecureStore erlaubt nur [A-Za-z0-9._-] in Keys.
export function sanitizeKey(key: string): string {
  return key.replace(/[^A-Za-z0-9._-]/g, '_');
}

export function splitIntoChunks(value: string, size: number = CHUNK_SIZE): string[] {
  if (value.length === 0) return [''];
  const chunks: string[] = [];
  for (let i = 0; i < value.length; i += size) {
    chunks.push(value.slice(i, i + size));
  }
  return chunks;
}

export function createChunkedStorage(backend: KeyValueBackend) {
  const countKey = (key: string) => `${sanitizeKey(key)}.count`;
  const chunkKey = (key: string, i: number) => `${sanitizeKey(key)}.${i}`;

  async function removeItem(key: string): Promise<void> {
    const count = Number((await backend.getItemAsync(countKey(key))) ?? '0');
    await Promise.all(
      Array.from({ length: count }, (_, i) => backend.deleteItemAsync(chunkKey(key, i))),
    );
    await backend.deleteItemAsync(countKey(key));
  }

  return {
    async getItem(key: string): Promise<string | null> {
      const raw = await backend.getItemAsync(countKey(key));
      if (raw === null) return null;
      const count = Number(raw);
      const parts = await Promise.all(
        Array.from({ length: count }, (_, i) => backend.getItemAsync(chunkKey(key, i))),
      );
      if (parts.some((p) => p === null)) return null;
      return parts.join('');
    },
    async setItem(key: string, value: string): Promise<void> {
      await removeItem(key);
      const chunks = splitIntoChunks(value);
      await Promise.all(chunks.map((c, i) => backend.setItemAsync(chunkKey(key, i), c)));
      await backend.setItemAsync(countKey(key), String(chunks.length));
    },
    removeItem,
  };
}
