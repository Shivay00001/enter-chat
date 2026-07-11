import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { config } from '../config/index.js';
import { logger } from '../shared/logger.js';

const storageLogger = logger.child({ component: 'storage-adapter' });

/**
 * Pluggable storage adapter interface.
 * Implementations handle media file persistence.
 */
export interface StorageAdapter {
  /** Save a file. Returns the storage key. */
  save(key: string, stream: Readable, mimeType: string): Promise<string>;
  /** Get a publicly accessible URL for the file. */
  getUrl(key: string): string;
  /** Delete a file. */
  delete(key: string): Promise<void>;
  /** Ensure storage backend is ready (create directories, verify bucket). */
  initialize(): Promise<void>;
}

/**
 * Local disk storage — saves files to a configurable directory.
 * Best for development / single-server MVP.
 */
export class LocalDiskStorage implements StorageAdapter {
  private readonly basePath: string;
  private readonly baseUrl: string;

  constructor(basePath: string, baseUrl?: string) {
    this.basePath = path.resolve(basePath);
    this.baseUrl = baseUrl || `/media/files`;
  }

  async initialize(): Promise<void> {
    await fs.promises.mkdir(this.basePath, { recursive: true });
    storageLogger.info({ path: this.basePath }, 'LocalDiskStorage initialized');
  }

  async save(key: string, stream: Readable, _mimeType: string): Promise<string> {
    const filePath = path.join(this.basePath, key);
    const dir = path.dirname(filePath);
    await fs.promises.mkdir(dir, { recursive: true });

    const writeStream = fs.createWriteStream(filePath);
    await pipeline(stream, writeStream);

    storageLogger.debug({ key, path: filePath }, 'File saved to local disk');
    return key;
  }

  getUrl(key: string): string {
    return `${this.baseUrl}/${key}`;
  }

  async delete(key: string): Promise<void> {
    const filePath = path.join(this.basePath, key);
    try {
      await fs.promises.unlink(filePath);
      storageLogger.debug({ key }, 'File deleted from local disk');
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        throw err;
      }
      // File already deleted — no-op
    }
  }
}

/**
 * S3-compatible storage using @aws-sdk/client-s3.
 * Works perfectly with Cloudflare R2 (0 egress fees) or AWS S3.
 */
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';

export class S3Storage implements StorageAdapter {
  private s3Client!: S3Client;

  async initialize(): Promise<void> {
    const s3Config = config.media.s3;
    if (!s3Config.bucket || !s3Config.accessKeyId || !s3Config.secretAccessKey) {
      storageLogger.warn('S3Storage configured but missing bucket/credentials');
      return;
    }

    this.s3Client = new S3Client({
      region: s3Config.region,
      endpoint: s3Config.endpoint ? s3Config.endpoint : undefined,
      credentials: {
        accessKeyId: s3Config.accessKeyId,
        secretAccessKey: s3Config.secretAccessKey,
      },
      forcePathStyle: true, // Needed for some S3 compatible APIs
    });
    
    storageLogger.info({ bucket: s3Config.bucket, endpoint: s3Config.endpoint }, 'S3/R2 Storage initialized');
  }

  async save(key: string, stream: Readable, mimeType: string): Promise<string> {
    const s3Config = config.media.s3;
    
    const upload = new Upload({
      client: this.s3Client,
      params: {
        Bucket: s3Config.bucket,
        Key: key,
        Body: stream,
        ContentType: mimeType,
      },
    });

    await upload.done();
    storageLogger.debug({ key }, 'File uploaded to S3/R2');
    return key;
  }

  getUrl(key: string): string {
    const s3Config = config.media.s3;
    if (s3Config.publicUrlPrefix) {
      return `${s3Config.publicUrlPrefix}/${key}`;
    }
    // Fallback constructed URL
    return `${s3Config.endpoint || `https://s3.${s3Config.region}.amazonaws.com`}/${s3Config.bucket}/${key}`;
  }

  async delete(key: string): Promise<void> {
    const s3Config = config.media.s3;
    await this.s3Client.send(
      new DeleteObjectCommand({
        Bucket: s3Config.bucket,
        Key: key,
      })
    );
    storageLogger.debug({ key }, 'File deleted from S3/R2');
  }
}

/**
 * Generate a unique storage key for a file.
 * Format: YYYY/MM/DD/{randomHex}.{ext}
 */
export function generateStorageKey(originalName: string): string {
  const now = new Date();
  const datePrefix = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;
  const randomHex = crypto.randomBytes(16).toString('hex');
  const ext = path.extname(originalName).toLowerCase() || '.bin';
  return `${datePrefix}/${randomHex}${ext}`;
}

// --- Singleton ---

let storageAdapter: StorageAdapter | null = null;

export function getStorageAdapter(): StorageAdapter {
  if (!storageAdapter) {
    switch (config.media.storageProvider) {
      case 's3':
      case 'r2':
        storageAdapter = new S3Storage();
        break;
      default:
        storageAdapter = new LocalDiskStorage(config.media.localPath);
    }
  }
  return storageAdapter;
}

export async function initializeStorage(): Promise<void> {
  const adapter = getStorageAdapter();
  await adapter.initialize();
}
