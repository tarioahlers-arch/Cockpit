import {
  CHUNK_SIZE,
  createChunkedStorage,
  sanitizeKey,
  splitIntoChunks,
  type KeyValueBackend,
} from '@/lib/secureStorage';

function memoryBackend(): KeyValueBackend & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItemAsync: async (k) => data.get(k) ?? null,
    setItemAsync: async (k, v) => {
      data.set(k, v);
    },
    deleteItemAsync: async (k) => {
      data.delete(k);
    },
  };
}

describe('secureStorage', () => {
  it('ersetzt unzulässige Zeichen in Keys', () => {
    expect(sanitizeKey('sb-abc:auth/token')).toBe('sb-abc_auth_token');
  });

  it('teilt Werte in Chunks', () => {
    expect(splitIntoChunks('abcdef', 4)).toEqual(['abcd', 'ef']);
    expect(splitIntoChunks('')).toEqual(['']);
  });

  it('speichert und lädt große Werte über mehrere Chunks', async () => {
    const backend = memoryBackend();
    const storage = createChunkedStorage(backend);
    const value = 'x'.repeat(CHUNK_SIZE * 2 + 10);
    await storage.setItem('session', value);
    expect(backend.data.get('session.count')).toBe('3');
    await expect(storage.getItem('session')).resolves.toBe(value);
  });

  it('entfernt alte Chunks beim Überschreiben und Löschen', async () => {
    const backend = memoryBackend();
    const storage = createChunkedStorage(backend);
    await storage.setItem('k', 'y'.repeat(CHUNK_SIZE * 3));
    await storage.setItem('k', 'short');
    expect(backend.data.size).toBe(2);
    await storage.removeItem('k');
    expect(backend.data.size).toBe(0);
    await expect(storage.getItem('k')).resolves.toBeNull();
  });

  it('liefert null bei fehlendem Chunk', async () => {
    const backend = memoryBackend();
    const storage = createChunkedStorage(backend);
    await storage.setItem('k', 'z'.repeat(CHUNK_SIZE + 1));
    backend.data.delete('k.1');
    await expect(storage.getItem('k')).resolves.toBeNull();
  });
});
