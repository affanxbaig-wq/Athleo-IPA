import EncryptedStorage from 'react-native-encrypted-storage';

export type SecureSessionPayload = {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  expires_at?: number;
  token_type?: string;
};

export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      return await EncryptedStorage.getItem(key);
    } catch (error) {
      console.warn('Secure storage read failed:', error);
      return null;
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    try {
      await EncryptedStorage.setItem(key, value);
    } catch (error) {
      console.warn('Secure storage write failed:', error);
    }
  },
  async removeItem(key: string): Promise<void> {
    try {
      await EncryptedStorage.removeItem(key);
    } catch (error) {
      console.warn('Secure storage remove failed:', error);
    }
  },
  async clear(): Promise<void> {
    try {
      await EncryptedStorage.clear();
    } catch (error) {
      console.warn('Secure storage clear failed:', error);
    }
  },
};

export const saveSecureSession = async (session: SecureSessionPayload): Promise<void> => {
  await secureStorage.setItem('athleo_secure_session', JSON.stringify(session));
};

export const loadSecureSession = async (): Promise<SecureSessionPayload | null> => {
  const raw = await secureStorage.getItem('athleo_secure_session');
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as SecureSessionPayload;
  } catch (error) {
    console.warn('Failed to parse secure session payload:', error);
    return null;
  }
};

export const clearSecureSession = async (): Promise<void> => {
  await secureStorage.removeItem('athleo_secure_session');
};
