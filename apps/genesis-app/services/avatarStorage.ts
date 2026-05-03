import { supabase } from './supabaseClient';

function dataURLToBlob(dataURL: string): Blob {
  const [header, base64] = dataURL.split(',');
  const mime = header.match(/:(.*?);/)?.[1] || 'image/png';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return new Blob([bytes], { type: mime });
}

export async function persistAvatarImage(avatarData: string, userId: string): Promise<string> {
  try {
    if (avatarData.includes('/storage/v1/object/public/avatars/')) {
      return avatarData;
    }

    if (!avatarData.startsWith('data:')) {
      return avatarData;
    }

    const blob = dataURLToBlob(avatarData);
    const path = `${userId}/avatar`;

    const { error } = await supabase.storage.from('avatars').upload(path, blob, {
      upsert: true,
      contentType: blob.type,
    });

    if (error) {
      console.error('[AvatarStorage] Failed to persist avatar:', error.message);
      return avatarData;
    }

    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    return data.publicUrl;
  } catch (error) {
    console.error('[AvatarStorage] Avatar persistence error:', error);
    return avatarData;
  }
}
