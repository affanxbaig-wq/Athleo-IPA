import {createMMKV, type MMKV} from 'react-native-mmkv';

let mmkvInstance: MMKV | null = null;
try {
  mmkvInstance = createMMKV();
} catch (e) {
  console.warn('MMKV initialization failed, falling back to memory store:', e);
}

const memoryStore = new Map<string, string>();

export const appStorage = {
  getString: (key: string): string | null => {
    if (mmkvInstance) {
      try {
        return mmkvInstance.getString(key) ?? null;
      } catch {
        return memoryStore.get(key) ?? null;
      }
    }
    return memoryStore.get(key) ?? null;
  },
  setString: (key: string, value: string): void => {
    if (mmkvInstance) {
      try {
        mmkvInstance.set(key, value);
        return;
      } catch {
        // Fallback to memory
      }
    }
    memoryStore.set(key, value);
  },
  getObject: <T>(key: string): T | null => {
    const raw = appStorage.getString(key);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },
  setObject: <T>(key: string, value: T): void => {
    try {
      appStorage.setString(key, JSON.stringify(value));
    } catch (e) {
      console.warn('Failed to stringify storage object:', e);
    }
  },
  delete: (key: string): void => {
    if (mmkvInstance) {
      try {
        mmkvInstance.remove(key);
      } catch {
        memoryStore.delete(key);
      }
    } else {
      memoryStore.delete(key);
    }
  },
  getAllKeys: (): string[] => {
    if (mmkvInstance) {
      try {
        return mmkvInstance.getAllKeys();
      } catch {
        return Array.from(memoryStore.keys());
      }
    }
    return Array.from(memoryStore.keys());
  },
  clearAll: (): void => {
    if (mmkvInstance) {
      try {
        mmkvInstance.clearAll();
      } catch {
        memoryStore.clear();
      }
    } else {
      memoryStore.clear();
    }
  },
};
