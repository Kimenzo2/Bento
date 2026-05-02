import { supabase } from './supabaseClient';

export const LIFE_IN_COLOUR_SOURCE_BUCKET = 'life-in-colour-sources';

export interface UploadedLifeInColourSource {
  sourcePath: string;
  sourceMimeType: string;
  sourceFileName: string;
}

export function sanitizeLifeInColourFileName(fileName: string): string {
  const trimmed = fileName.trim().toLowerCase();
  const lastDotIndex = trimmed.lastIndexOf('.');
  const stem = lastDotIndex > 0 ? trimmed.slice(0, lastDotIndex) : trimmed;
  const extension = lastDotIndex > 0 ? trimmed.slice(lastDotIndex).replace(/[^a-z0-9.]+/g, '') : '';
  const cleanedStem = stem
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  const cleaned = `${cleanedStem || 'life-in-colour-source'}${extension || '.png'}`;

  return cleaned;
}

export async function uploadLifeInColourSource(file: File): Promise<UploadedLifeInColourSource> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw sessionError;
  }

  const userId = session?.user?.id;
  if (!userId) {
    throw new Error('You need to be signed in to generate a colouring page.');
  }

  const sourceFileName = sanitizeLifeInColourFileName(file.name || 'life-in-colour-source.png');
  const sourcePath = `${userId}/${crypto.randomUUID()}-${sourceFileName}`;
  const sourceMimeType = file.type || 'image/jpeg';

  const { error } = await supabase.storage.from(LIFE_IN_COLOUR_SOURCE_BUCKET).upload(sourcePath, file, {
    cacheControl: '3600',
    contentType: sourceMimeType,
    upsert: false,
  });

  if (error) {
    throw new Error(error.message);
  }

  return {
    sourcePath,
    sourceMimeType,
    sourceFileName,
  };
}
