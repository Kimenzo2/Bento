/**
 * Image persistence layer — uploads generated images to Supabase Storage
 * so they survive beyond Bytez temporary URL expiry.
 *
 * Uses the `page-images` public bucket (RLS scoped to userId folder).
 */
import { supabase } from './supabaseClient';

/**
 * Persist a generated image (base64 data URL or remote URL) to Supabase Storage.
 * Returns the permanent public URL, or the original value on failure.
 */
export async function persistImage(
  imageData: string,
  userId: string,
  bookId: string,
  pageNumber: number
): Promise<string> {
  try {
    // Already a Supabase storage URL — no-op
    if (imageData.includes('/storage/v1/object/public/page-images/')) {
      return imageData;
    }

    let blob: Blob;

    if (imageData.startsWith('data:')) {
      // Base64 data URL → Blob
      blob = dataURLtoBlob(imageData);
    } else if (imageData.startsWith('http://') || imageData.startsWith('https://')) {
      // Remote URL → fetch → Blob
      const resp = await fetch(imageData);
      if (!resp.ok) return imageData; // Can't fetch, keep original
      blob = await resp.blob();
    } else {
      // Raw base64 string without prefix — assume PNG
      try {
        const binary = atob(imageData.substring(0, 100).replace(/\s/g, ''));
        // If atob succeeded on a sample, it's likely raw base64
        blob = dataURLtoBlob(`data:image/png;base64,${imageData}`);
      } catch {
        // Not valid base64, return as-is
        return imageData;
      }
    }

    const ext = blob.type === 'image/jpeg' ? 'jpg' : 'png';
    const path = `${userId}/${bookId}/page-${pageNumber}.${ext}`;

    const { error } = await supabase.storage
      .from('page-images')
      .upload(path, blob, { upsert: true, contentType: blob.type });

    if (error) {
      console.error('Failed to persist image to storage:', error.message);
      return imageData; // Fall back to original
    }

    const { data } = supabase.storage.from('page-images').getPublicUrl(path);
    return data.publicUrl;
  } catch (err) {
    console.error('Image persistence error:', err);
    return imageData; // Fall back to original
  }
}

function dataURLtoBlob(dataURL: string): Blob {
  const [header, base64] = dataURL.split(',');
  const mime = header.match(/:(.*?);/)?.[1] || 'image/png';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}
