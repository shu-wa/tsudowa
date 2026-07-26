import { supabase } from '@/lib/supabase';
import { ChatImageInput } from '@/types/event';

export const APP_MEDIA_BUCKET = 'app-media';
export const MAX_APP_IMAGE_BYTES = 8 * 1024 * 1024;

export async function uploadAppImage(path: string, image: ChatImageInput) {
  if (!supabase) return;
  if (image.fileSize && image.fileSize > MAX_APP_IMAGE_BYTES) throw new Error('image_too_large');
  const response = await fetch(image.uri);
  if (!response.ok) throw new Error('image_read_failed');
  const data = await response.arrayBuffer();
  if (data.byteLength > MAX_APP_IMAGE_BYTES) throw new Error('image_too_large');
  const { error } = await supabase.storage.from(APP_MEDIA_BUCKET).upload(path, data, {
    contentType: image.mimeType,
    cacheControl: '3600',
    upsert: false,
  });
  if (error) throw error;
}

export async function createAppImageUrls(paths: string[]) {
  const urls = new Map<string, string>();
  if (!supabase || paths.length === 0) return urls;
  const uniquePaths = [...new Set(paths)];
  const { data, error } = await supabase.storage.from(APP_MEDIA_BUCKET).createSignedUrls(uniquePaths, 7 * 24 * 60 * 60);
  if (error) return urls;
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl);
  }
  return urls;
}

export function appImageExtension(mimeType: string, fileName?: string) {
  const byMimeType: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/heic': 'heic',
    'image/heif': 'heif',
  };
  if (byMimeType[mimeType]) return byMimeType[mimeType];
  const fromName = fileName?.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '');
  return fromName && fromName.length <= 5 ? fromName : 'jpg';
}
