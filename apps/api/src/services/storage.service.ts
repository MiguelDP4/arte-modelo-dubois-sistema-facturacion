import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { UploadImageInput } from '@arte-modelo/shared';
import { env } from '../config/env';
import { badRequest, notFound } from '../lib/errors';

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

const MIME_TO_EXT: Record<UploadImageInput['mimeType'], string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

function sanitizeBaseName(fileName: string): string {
  const stem = path.parse(fileName).name || 'producto';
  const clean = stem
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 60);
  return clean || 'producto';
}

function decodeBase64Image(dataBase64: string): Buffer {
  const base64Clean = dataBase64.includes(';base64,')
    ? dataBase64.split(';base64,')[1] || ''
    : dataBase64;
  return Buffer.from(base64Clean.trim(), 'base64');
}

export function getLocalUploadsDir(): string {
  return path.resolve(process.cwd(), 'uploads', 'products');
}

export function isR2Configured(): boolean {
  return Boolean(
    env.r2AccountId &&
      env.r2AccessKeyId &&
      env.r2SecretAccessKey &&
      env.r2PublicUrl,
  );
}

export async function uploadProductImage(input: UploadImageInput): Promise<{
  url: string;
  fileName: string;
  provider: 'cloudflare-r2' | 'local-storage';
  sizeBytes: number;
}> {
  const ext = MIME_TO_EXT[input.mimeType];
  if (!ext) {
    throw badRequest('Formato de imagen no soportado. Usa JPG, PNG o WebP.');
  }

  const buffer = decodeBase64Image(input.dataBase64);
  if (buffer.length === 0) {
    throw badRequest('El archivo de imagen está vacío.');
  }
  if (buffer.length > MAX_UPLOAD_BYTES) {
    throw badRequest('La imagen supera el tamaño máximo permitido de 5 MB.');
  }

  const safeStem = sanitizeBaseName(input.fileName);
  const uniqueSuffix = crypto.randomBytes(4).toString('hex');
  const uniqueFileName = `${Date.now()}-${uniqueSuffix}-${safeStem}${ext}`;

  if (isR2Configured()) {
    const key = `products/${uniqueFileName}`;
    const s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${env.r2AccountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.r2AccessKeyId,
        secretAccessKey: env.r2SecretAccessKey,
      },
    });

    await s3.send(
      new PutObjectCommand({
        Bucket: env.r2BucketName,
        Key: key,
        Body: buffer,
        ContentType: input.mimeType,
      }),
    );

    return {
      url: `${env.r2PublicUrl.replace(/\/$/, '')}/${key}`,
      fileName: uniqueFileName,
      provider: 'cloudflare-r2',
      sizeBytes: buffer.length,
    };
  }

  const dir = getLocalUploadsDir();
  fs.mkdirSync(dir, { recursive: true });
  const targetPath = path.join(dir, uniqueFileName);
  fs.writeFileSync(targetPath, buffer);

  return {
    url: `${env.apiBaseUrl.replace(/\/$/, '')}/api/uploads/products/${uniqueFileName}`,
    fileName: uniqueFileName,
    provider: 'local-storage',
    sizeBytes: buffer.length,
  };
}

export function resolveLocalProductImagePath(fileName: string): {
  filePath: string;
  safeName: string;
} {
  const safeName = path.basename(fileName);
  const filePath = path.join(getLocalUploadsDir(), safeName);
  if (!safeName || !fs.existsSync(filePath)) {
    throw notFound('Imagen no encontrada.');
  }
  return { filePath, safeName };
}
