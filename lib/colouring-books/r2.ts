import { createHmac, createHash } from 'node:crypto';
import {
  COLOURING_R2_BUCKET,
  COLOURING_R2_PUBLIC_URL,
  getColouringEnv,
} from './shared';

export interface R2SigningOptions {
  method: 'GET' | 'PUT' | 'HEAD' | 'DELETE';
  key: string;
  expiresInSeconds: number;
  contentType?: string;
  now?: Date;
  bucketName?: string;
}

export interface R2UploadResult {
  key: string;
  signedPutUrl: string;
  signedGetUrl: string;
}

const AWS_ALGORITHM = 'AWS4-HMAC-SHA256';
const AWS_REGION = 'auto';
const AWS_SERVICE = 's3';

export function getR2AccountId(): string {
  const value = getColouringEnv('R2_ACCOUNT_ID');
  if (!value) {
    throw new Error('R2_ACCOUNT_ID is not configured');
  }
  return value;
}

export function getR2AccessKeyId(): string {
  const value = getColouringEnv('R2_ACCESS_KEY_ID');
  if (!value) {
    throw new Error('R2_ACCESS_KEY_ID is not configured');
  }
  return value;
}

export function getR2SecretAccessKey(): string {
  const value = getColouringEnv('R2_SECRET_ACCESS_KEY');
  if (!value) {
    throw new Error('R2_SECRET_ACCESS_KEY is not configured');
  }
  return value;
}

export function getR2BucketName(): string {
  return getColouringEnv('R2_BUCKET_NAME', COLOURING_R2_BUCKET);
}

export function getR2PublicUrl(): string {
  return COLOURING_R2_PUBLIC_URL;
}

export function buildR2ObjectKey(path: string): string {
  return path.replace(/^\/+/, '');
}

export function buildR2Host(bucketName = getR2BucketName()): string {
  return `${bucketName}.${getR2AccountId()}.r2.cloudflarestorage.com`;
}

export function buildR2ObjectUrl(key: string, bucketName = getR2BucketName()): string {
  const base = getR2PublicUrl();
  if (base) {
    return `${base.replace(/\/+$/, '')}/${key}`;
  }

  return `https://${buildR2Host(bucketName)}/${encodePath(key)}`;
}

export function createPresignedR2Url(options: R2SigningOptions): string {
  const bucketName = options.bucketName || getR2BucketName();
  const accountId = getR2AccountId();
  const accessKeyId = getR2AccessKeyId();
  const secretAccessKey = getR2SecretAccessKey();
  const host = `${bucketName}.${accountId}.r2.cloudflarestorage.com`;
  const now = options.now || new Date();
  const amzDate = toAmzDate(now);
  const dateStamp = amzDate.slice(0, 8);
  const scope = `${dateStamp}/${AWS_REGION}/${AWS_SERVICE}/aws4_request`;
  const credential = `${accessKeyId}/${scope}`;
  const signedHeaders = options.contentType ? 'content-type;host' : 'host';
  const canonicalUri = `/${encodePath(buildR2ObjectKey(options.key))}`;

  const canonicalQueryParams = new Map<string, string>([
    ['X-Amz-Algorithm', AWS_ALGORITHM],
    ['X-Amz-Content-Sha256', 'UNSIGNED-PAYLOAD'],
    ['X-Amz-Credential', credential],
    ['X-Amz-Date', amzDate],
    ['X-Amz-Expires', String(Math.max(1, Math.min(604800, options.expiresInSeconds)))],
    ['X-Amz-SignedHeaders', signedHeaders],
  ]);

  const canonicalQuery = [...canonicalQueryParams.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${encodeRfc3986(key)}=${encodeRfc3986(value)}`)
    .join('&');

  const canonicalHeaders = options.contentType
    ? `content-type:${normalizeHeaderValue(options.contentType)}\nhost:${host}\n`
    : `host:${host}\n`;

  const canonicalRequest = [
    options.method,
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    'UNSIGNED-PAYLOAD',
  ].join('\n');

  const hashedCanonicalRequest = sha256Hex(canonicalRequest);
  const stringToSign = [AWS_ALGORITHM, amzDate, scope, hashedCanonicalRequest].join('\n');
  const signingKey = getSigningKey(secretAccessKey, dateStamp, AWS_REGION, AWS_SERVICE);
  const signature = hmacHex(signingKey, stringToSign);

  return `https://${host}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

export async function uploadBufferToR2(options: {
  key: string;
  body: Buffer;
  contentType: string;
  bucketName?: string;
  expiresInSeconds?: number;
}): Promise<R2UploadResult> {
  const signedPutUrl = createPresignedR2Url({
    method: 'PUT',
    key: options.key,
    contentType: options.contentType,
    expiresInSeconds: options.expiresInSeconds ?? 900,
    bucketName: options.bucketName,
  });

  const response = await fetch(signedPutUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': options.contentType,
    },
    body: new Uint8Array(options.body),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`R2 upload failed (${response.status}): ${errorBody}`);
  }

  return {
    key: buildR2ObjectKey(options.key),
    signedPutUrl,
    signedGetUrl: createPresignedR2Url({
      method: 'GET',
      key: options.key,
      expiresInSeconds: options.expiresInSeconds ?? 900,
      bucketName: options.bucketName,
    }),
  };
}

export function createSignedR2GetUrl(key: string, expiresInSeconds = 900, bucketName?: string): string {
  return createPresignedR2Url({
    method: 'GET',
    key,
    expiresInSeconds,
    bucketName,
  });
}

export function createSignedR2HeadUrl(key: string, expiresInSeconds = 900, bucketName?: string): string {
  return createPresignedR2Url({
    method: 'HEAD',
    key,
    expiresInSeconds,
    bucketName,
  });
}

export async function downloadBufferFromR2(
  key: string,
  expiresInSeconds = 900,
  bucketName?: string
): Promise<Buffer> {
  const response = await fetch(createSignedR2GetUrl(key, expiresInSeconds, bucketName));
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`R2 download failed (${response.status}): ${body}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

function encodePath(path: string): string {
  return path
    .split('/')
    .map((segment) => encodeRfc3986(segment))
    .join('/');
}

function encodeRfc3986(value: string): string {
  return encodeURIComponent(value)
    .replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function normalizeHeaderValue(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function toAmzDate(date: Date): string {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, '');
}

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function hmacHex(key: Buffer | string, data: string): Buffer {
  return createHmac('sha256', key).update(data, 'utf8').digest();
}

function getSigningKey(secretAccessKey: string, dateStamp: string, region: string, service: string): Buffer {
  const kDate = hmacHex(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmacHex(kDate, region);
  const kService = hmacHex(kRegion, service);
  return hmacHex(kService, 'aws4_request');
}
