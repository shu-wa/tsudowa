import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const CHUNK_SIZE = 1800;
const MAX_CHUNKS = 64;
const secureOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

type Manifest = { generation: string; count: number };
type StorageAdapter = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

const manifestKey = (key: string) => `${key}.manifest`;
const chunkKey = (key: string, generation: string, index: number) => `${key}.${generation}.${index}`;

const readManifest = async (key: string): Promise<Manifest | null> => {
  const raw = await SecureStore.getItemAsync(manifestKey(key), secureOptions);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Manifest;
    if (!/^[a-z0-9_-]{1,40}$/i.test(parsed.generation)
      || !Number.isInteger(parsed.count)
      || parsed.count < 1
      || parsed.count > MAX_CHUNKS) return null;
    return parsed;
  } catch {
    return null;
  }
};

const removeGeneration = async (key: string, manifest: Manifest | null) => {
  if (!manifest) return;
  await Promise.all(Array.from({ length: manifest.count }, (_, index) => (
    SecureStore.deleteItemAsync(chunkKey(key, manifest.generation, index), secureOptions)
  )));
};

const pendingMutations = new Map<string, Promise<void>>();

const afterPendingMutation = async (key: string) => {
  await pendingMutations.get(key)?.catch(() => undefined);
};

const enqueueMutation = (key: string, operation: () => Promise<void>) => {
  const previous = pendingMutations.get(key) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(operation);
  pendingMutations.set(key, current);
  return current.finally(() => {
    if (pendingMutations.get(key) === current) pendingMutations.delete(key);
  });
};

const writeSecureValue = async (key: string, value: string) => {
  const chunks = value.match(new RegExp(`.{1,${CHUNK_SIZE}}`, 'gs')) ?? [''];
  if (chunks.length > MAX_CHUNKS) throw new Error('secure_storage_value_too_large');
  const previous = await readManifest(key);
  const generation = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  await Promise.all(chunks.map((chunk, index) => (
    SecureStore.setItemAsync(chunkKey(key, generation, index), chunk, secureOptions)
  )));
  await SecureStore.setItemAsync(manifestKey(key), JSON.stringify({ generation, count: chunks.length }), secureOptions);
  await removeGeneration(key, previous);
  await AsyncStorage.removeItem(key);
};

const nativeSecureStorage: StorageAdapter = {
  getItem: async (key: string) => {
    await afterPendingMutation(key);
    const manifest = await readManifest(key);
    if (manifest) {
      const chunks = await Promise.all(Array.from({ length: manifest.count }, (_, index) => (
        SecureStore.getItemAsync(chunkKey(key, manifest.generation, index), secureOptions)
      )));
      if (chunks.every((chunk): chunk is string => chunk !== null)) return chunks.join('');
      await removeGeneration(key, manifest);
      await SecureStore.deleteItemAsync(manifestKey(key), secureOptions);
    }

    // One-time migration from the previous plaintext AsyncStorage session.
    const legacy = await AsyncStorage.getItem(key);
    if (!legacy) return null;
    await writeSecureValue(key, legacy);
    await AsyncStorage.removeItem(key);
    return legacy;
  },
  setItem: (key: string, value: string) => enqueueMutation(key, () => writeSecureValue(key, value)),
  removeItem: (key: string) => enqueueMutation(key, async () => {
    const manifest = await readManifest(key);
    await removeGeneration(key, manifest);
    await Promise.all([
      SecureStore.deleteItemAsync(manifestKey(key), secureOptions),
      AsyncStorage.removeItem(key),
    ]);
  }),
};

export const authStorage = Platform.OS === 'web' ? AsyncStorage : nativeSecureStorage;
