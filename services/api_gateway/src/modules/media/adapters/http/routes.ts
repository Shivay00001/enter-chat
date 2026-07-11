import { Router } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { Readable } from 'node:stream';
import { authMiddleware } from '../../../../middleware/auth.js';
import { getStorageAdapter, generateStorageKey } from '../../../../services/storage-adapter.js';
import { getDbPool } from '../../../../shared/db.js';
import { config } from '../../../../config/index.js';
import { BadRequestError } from '../../../../shared/errors.js';
import { logger } from '../../../../shared/logger.js';

const mediaLogger = logger.child({ component: 'media' });

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif',
  'video/mp4', 'video/quicktime', 'video/webm',
  'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/aac', 'audio/webm',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

const createUploadSessionSchema = z.object({
  fileName: z.string().min(1).max(255),
  sizeBytes: z.number().int().positive(),
  mimeType: z.string().min(1),
  chatId: z.string().uuid().optional(),
});

const mediaRouter = Router();

/**
 * POST /v1/media/upload
 * Direct single-file upload via multipart/form-data.
 * Uses raw body parsing since we don't want to add multer as a hard dependency.
 * For MVP, accepts base64-encoded body.
 */
mediaRouter.post('/upload', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.userId!;

    // Accept JSON with base64 payload for MVP simplicity
    // (avoids multer dependency — production would use multipart)
    const { fileName, mimeType, data, chatId } = req.body;

    if (!fileName || !mimeType || !data) {
      throw new BadRequestError(
        'Required fields: fileName, mimeType, data (base64)',
        'MISSING_FIELDS',
      );
    }

    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      throw new BadRequestError(
        `File type not allowed: ${mimeType}`,
        'INVALID_MIME_TYPE',
      );
    }

    const buffer = Buffer.from(data, 'base64');
    const maxBytes = config.media.maxFileSizeMb * 1024 * 1024;

    if (buffer.length > maxBytes) {
      throw new BadRequestError(
        `File too large. Max: ${config.media.maxFileSizeMb}MB`,
        'FILE_TOO_LARGE',
      );
    }

    const storageKey = generateStorageKey(fileName);
    const storage = getStorageAdapter();
    const stream = Readable.from(buffer);
    await storage.save(storageKey, stream, mimeType);

    const mediaUrl = storage.getUrl(storageKey);
    const mediaId = uuidv4();

    // Persist to media_objects table
    const pool = getDbPool();
    await pool.query(
      `INSERT INTO media_objects (id, uploader_user_id, storage_key, original_name, mime_type, size_bytes, processing_state, chat_id)
       VALUES ($1, $2, $3, $4, $5, $6, 'ready', $7)`,
      [mediaId, userId, storageKey, fileName, mimeType, buffer.length, chatId || null],
    );

    mediaLogger.info({ userId, mediaId, mimeType, sizeBytes: buffer.length }, 'Media uploaded');

    res.status(201).json({
      mediaId,
      url: mediaUrl,
      fileName,
      mimeType,
      sizeBytes: buffer.length,
      status: 'ready',
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /v1/media/uploads
 * Create an upload session for chunked uploads.
 */
mediaRouter.post('/uploads', authMiddleware, async (req, res, next) => {
  try {
    const body = createUploadSessionSchema.parse(req.body);

    if (!ALLOWED_MIME_TYPES.has(body.mimeType)) {
      throw new BadRequestError(
        `File type not allowed: ${body.mimeType}`,
        'INVALID_MIME_TYPE',
      );
    }

    const maxBytes = config.media.maxFileSizeMb * 1024 * 1024;
    if (body.sizeBytes > maxBytes) {
      throw new BadRequestError(
        `File too large. Max: ${config.media.maxFileSizeMb}MB`,
        'FILE_TOO_LARGE',
      );
    }

    const uploadId = uuidv4();
    const maxChunkSize = 5 * 1024 * 1024; // 5MB
    const totalChunks = Math.ceil(body.sizeBytes / maxChunkSize);

    const { redis } = await import('../../../../shared/redis.js');
    await redis.setex(
      `uploadSession:${uploadId}`,
      3600, // 1 hour TTL
      JSON.stringify({ ...body, totalChunks, userId: req.userId }),
    );

    res.status(201).json({
      uploadId,
      uploadUrl: `/v1/media/uploads/${uploadId}/chunks/0`,
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      maxChunkSize,
      totalChunks,
      status: 'created',
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /v1/media/uploads/:uploadId/chunks/:chunkIndex
 * Upload a chunk.
 */
mediaRouter.put('/uploads/:uploadId/chunks/:chunkIndex', authMiddleware, async (req, res, next) => {
  try {
    const { uploadId, chunkIndex } = req.params;
    const { data } = req.body;
    
    if (!data) {
      throw new BadRequestError('Missing chunk data (base64)', 'MISSING_DATA');
    }

    const { redis } = await import('../../../../shared/redis.js');
    const sessionStr = await redis.get(`uploadSession:${uploadId}`);
    if (!sessionStr) {
      throw new BadRequestError('Upload session expired or invalid', 'INVALID_SESSION');
    }

    const fs = await import('node:fs/promises');
    const os = await import('node:os');
    const path = await import('node:path');

    const buffer = Buffer.from(data, 'base64');
    const chunkPath = path.join(os.tmpdir(), `${uploadId}_${chunkIndex}`);
    await fs.writeFile(chunkPath, buffer);

    res.json({ status: 'chunk_received' });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /v1/media/uploads/:uploadId/complete
 * Complete a chunked upload session.
 */
mediaRouter.post('/uploads/:uploadId/complete', authMiddleware, async (req, res, next) => {
  try {
    const { uploadId } = req.params;
    
    const { redis } = await import('../../../../shared/redis.js');
    const sessionStr = await redis.get(`uploadSession:${uploadId}`);
    if (!sessionStr) {
      throw new BadRequestError('Upload session expired or invalid', 'INVALID_SESSION');
    }

    const session = JSON.parse(sessionStr);
    const fs = await import('node:fs/promises');
    const os = await import('node:os');
    const path = await import('node:path');
    const { createReadStream, createWriteStream } = await import('node:fs');

    const finalPath = path.join(os.tmpdir(), `${uploadId}_final`);
    const writeStream = createWriteStream(finalPath);

    // Assemble chunks
    for (let i = 0; i < session.totalChunks; i++) {
      const chunkPath = path.join(os.tmpdir(), `${uploadId}_${i}`);
      try {
        await fs.access(chunkPath);
      } catch {
        throw new BadRequestError(`Missing chunk ${i}`, 'MISSING_CHUNK');
      }

      const chunkData = await fs.readFile(chunkPath);
      writeStream.write(chunkData);
      
      // Cleanup chunk
      await fs.unlink(chunkPath).catch(() => {});
    }

    writeStream.end();

    // Wait for write to finish
    await new Promise((resolve, reject) => {
      writeStream.on('finish', () => resolve(undefined));
      writeStream.on('error', reject);
    });

    const storageKey = generateStorageKey(session.fileName);
    const storage = getStorageAdapter();
    const readStream = createReadStream(finalPath);
    
    await storage.save(storageKey, readStream, session.mimeType);
    
    // Cleanup final temp file
    await fs.unlink(finalPath).catch(() => {});
    await redis.del(`uploadSession:${uploadId}`);

    const mediaUrl = storage.getUrl(storageKey);
    const mediaId = uuidv4();

    const pool = getDbPool();
    await pool.query(
      `INSERT INTO media_objects (id, uploader_user_id, storage_key, original_name, mime_type, size_bytes, processing_state, chat_id)
       VALUES ($1, $2, $3, $4, $5, $6, 'ready', $7)`,
      [mediaId, session.userId, storageKey, session.fileName, session.mimeType, session.sizeBytes, session.chatId || null],
    );

    mediaLogger.info({ userId: session.userId, mediaId, mimeType: session.mimeType }, 'Media assembled and uploaded');

    res.json({
      mediaId,
      uploadId,
      status: 'ready',
      url: mediaUrl,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /v1/media/:mediaId
 * Get media metadata.
 */
mediaRouter.get('/:mediaId', authMiddleware, async (req, res, next) => {
  try {
    const mediaId = req.params['mediaId'];
    const pool = getDbPool();
    const { rows } = await pool.query(
      `SELECT id, storage_key, original_name, mime_type, size_bytes, processing_state, created_at
       FROM media_objects WHERE id = $1`,
      [mediaId],
    );

    if (rows.length === 0) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Media not found' } });
      return;
    }

    const row = rows[0];
    const storage = getStorageAdapter();

    res.json({
      mediaId: row.id,
      url: storage.getUrl(row.storage_key),
      fileName: row.original_name,
      mimeType: row.mime_type,
      sizeBytes: row.size_bytes,
      status: row.processing_state,
      createdAt: row.created_at,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /v1/media/:mediaId
 * Delete a media object.
 */
mediaRouter.delete('/:mediaId', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.userId!;
    const mediaId = req.params['mediaId'];
    const pool = getDbPool();

    const { rows } = await pool.query(
      `SELECT storage_key FROM media_objects WHERE id = $1 AND uploader_user_id = $2`,
      [mediaId, userId],
    );

    if (rows.length === 0) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Media not found or not owned' } });
      return;
    }

    const storage = getStorageAdapter();
    await storage.delete(rows[0].storage_key);

    await pool.query(`DELETE FROM media_objects WHERE id = $1`, [mediaId]);

    mediaLogger.info({ userId, mediaId }, 'Media deleted');
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export { mediaRouter };
