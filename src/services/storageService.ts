import { getSupabaseClient } from './auth';
import { toByteArray } from 'base64-js';

/**
 * Helper to convert base64 string to ArrayBuffer.
 * This is more reliable for Supabase uploads in React Native than FormData/Blob.
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const cleanBase64 = (base64.includes(',') ? base64.split(',')[1] : base64)
    .trim()
    .replace(/[\r\n\s]/g, '');
  const byteArray = toByteArray(cleanBase64);
  return byteArray.buffer.slice(
    byteArray.byteOffset,
    byteArray.byteOffset + byteArray.byteLength,
  );
}

/**
 * Uploads a file to Supabase Storage in the 'avatars' bucket.
 * Path is constructed as userId/filename to match RLS policies.
 */
export async function uploadAvatar(
  userId: string,
  base64OrPath: string,
  fileName: string,
  mimeType: string
): Promise<string> {
  if (!base64OrPath) {
    throw new Error('No image data or path provided');
  }

  const supabase = getSupabaseClient();

  // Clean filename and ensure it's unique
  const extension = fileName.split('.').pop();
  const storagePath = `${userId}/avatar_${Date.now()}.${extension}`;

  let uploadData: ArrayBuffer | FormData;

  const isBase64 = typeof base64OrPath === 'string' && 
    !base64OrPath.startsWith('/') && 
    !base64OrPath.startsWith('file://') && 
    !base64OrPath.startsWith('content://');

  if (isBase64) {
    // It's a base64 string
    uploadData = base64ToArrayBuffer(base64OrPath);
  } else {
    // Fallback to FormData if only path is provided (less reliable in some RN environments)
    const formData = new FormData();
    formData.append('file', {
      uri: base64OrPath.startsWith('file://') ? base64OrPath : `file://${base64OrPath}`,
      name: fileName,
      type: mimeType,
    } as any);
    uploadData = formData;
  }

  const { error } = await supabase.storage
    .from('avatars')
    .upload(storagePath, uploadData, {
      contentType: mimeType,
      upsert: true,
    });

  if (error) {
    throw error;
  }

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('avatars')
    .getPublicUrl(storagePath);

  return publicUrl;
}
