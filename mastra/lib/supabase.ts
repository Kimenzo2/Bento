import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { LifeInColourGenerationRecord } from '../schemas';

export const LIFE_IN_COLOUR_SOURCE_BUCKET = 'life-in-colour-sources';
export const LIFE_IN_COLOUR_PAGE_BUCKET = 'life-in-colour-pages';

let adminClient: SupabaseClient | null = null;

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getSupabaseAdmin(): SupabaseClient {
  if (adminClient) {
    return adminClient;
  }

  adminClient = createClient(
    getRequiredEnv('SUPABASE_URL'),
    getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
    {
      auth: { autoRefreshToken: false, persistSession: false },
    }
  );

  return adminClient;
}

export async function downloadPrivateObject(bucket: string, path: string): Promise<Buffer> {
  const { data, error } = await getSupabaseAdmin().storage.from(bucket).download(path);
  if (error || !data) {
    throw new Error(error?.message || `Failed to download ${bucket}/${path}`);
  }

  return Buffer.from(await data.arrayBuffer());
}

export async function uploadPublicPng(path: string, buffer: Buffer): Promise<string> {
  const storage = getSupabaseAdmin().storage.from(LIFE_IN_COLOUR_PAGE_BUCKET);
  const { error } = await storage.upload(path, buffer, {
    upsert: true,
    contentType: 'image/png',
  });

  if (error) {
    throw new Error(error.message);
  }

  return storage.getPublicUrl(path).data.publicUrl;
}

export async function insertLifeInColourGeneration(input: {
  userId: string;
  title: string;
  brief: string;
  outlineMode: 'simple' | 'detailed' | 'mandala';
  sourcePath: string;
  sourceMimeType: string;
  sourceFileName: string;
}): Promise<LifeInColourGenerationRecord> {
  const { data, error } = await getSupabaseAdmin()
    .from('life_in_colour_generations')
    .insert({
      user_id: input.userId,
      status: 'queued',
      title: input.title,
      brief: input.brief,
      outline_mode: input.outlineMode,
      source_bucket: LIFE_IN_COLOUR_SOURCE_BUCKET,
      source_path: input.sourcePath,
      source_mime_type: input.sourceMimeType,
      source_file_name: input.sourceFileName,
    })
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to create Life in Colour generation.');
  }

  return data as LifeInColourGenerationRecord;
}

export async function getLifeInColourGeneration(
  id: string,
  userId: string
): Promise<LifeInColourGenerationRecord | null> {
  const { data, error } = await getSupabaseAdmin()
    .from('life_in_colour_generations')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as LifeInColourGenerationRecord | null) ?? null;
}

export async function listLifeInColourGenerations(
  userId: string,
  limit = 8
): Promise<LifeInColourGenerationRecord[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('life_in_colour_generations')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return (data as LifeInColourGenerationRecord[] | null) ?? [];
}

export async function updateLifeInColourGeneration(
  id: string,
  patch: Record<string, unknown>
): Promise<LifeInColourGenerationRecord> {
  const { data, error } = await getSupabaseAdmin()
    .from('life_in_colour_generations')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to update Life in Colour generation.');
  }

  return data as LifeInColourGenerationRecord;
}
