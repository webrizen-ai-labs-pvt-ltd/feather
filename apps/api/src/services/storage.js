/**
 * Photo storage. Cloudflare R2 (S3 compatible) in production, local disk for
 * development. Photos are private — viewers get short-lived signed links.
 */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '@/config/env.js';

const LINK_TTL_SECONDS = 60 * 60;
const LOCAL_ROOT = path.resolve(import.meta.dirname, '../../uploads');
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

let s3;
const client = () =>
  (s3 ??= new S3Client({
    region: 'auto',
    endpoint: `https://${env.storage.r2AccountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: env.storage.r2AccessKeyId, secretAccessKey: env.storage.r2SecretAccessKey },
  }));

export function makeKey(folder, contentType) {
  const d = new Date();
  const day = `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}`;
  return `${folder}/${day}/${crypto.randomUUID()}.${EXT[contentType] ?? 'bin'}`;
}

export async function putFile({ folder, buffer, contentType }) {
  const key = makeKey(folder, contentType);
  if (env.storage.driver === 'local') {
    const file = path.join(LOCAL_ROOT, key);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, buffer);
  } else {
    await client().send(
      new PutObjectCommand({ Bucket: env.storage.r2Bucket, Key: key, Body: buffer, ContentType: contentType }),
    );
  }
  return { key, contentType, size: buffer.length };
}

const sign = (key, exp) => crypto.createHmac('sha256', env.storage.fileUrlSecret).update(`${key}:${exp}`).digest('hex');

export async function fileUrl(key) {
  if (!key) return null;
  if (env.storage.driver === 'local') {
    const exp = Math.floor(Date.now() / 1000) + LINK_TTL_SECONDS;
    return `/api/files/local/${key}?exp=${exp}&sig=${sign(key, exp)}`;
  }
  return getSignedUrl(client(), new GetObjectCommand({ Bucket: env.storage.r2Bucket, Key: key }), {
    expiresIn: LINK_TTL_SECONDS,
  });
}

/** Resolve a signed local link to a file path, or null if the signature is bad / expired. */
export function verifyLocalLink(key, exp, sig) {
  if (!key || !exp || !sig || Number(exp) < Date.now() / 1000) return null;
  const expected = Buffer.from(sign(key, exp));
  const given = Buffer.from(String(sig));
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  const file = path.resolve(LOCAL_ROOT, key);
  return file.startsWith(LOCAL_ROOT + path.sep) ? file : null;
}
