import { Router } from 'express';
import { z } from 'zod';
import { PostgresStoryRepository } from '../postgres.js';
import { getDbPool } from '../../../../shared/db.js';
import { authMiddleware } from '../../../../middleware/auth.js';

export const storiesRouter = Router();

const createStorySchema = z.object({
  mediaUrl: z.string().url(),
  mediaType: z.enum(['image', 'video']),
  caption: z.string().max(500).optional(),
  backgroundColor: z.string().max(7).optional(),
  duration: z.coerce.number().int().positive().optional(),
});

function getStoryRepo() {
  return new PostgresStoryRepository(getDbPool());
}

/**
 * GET /v1/stories
 * Get story feed ranked by affinity algorithm.
 */
storiesRouter.get('/', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.userId!;
    const repo = getStoryRepo();
    const feed = await repo.getStoryFeedRankedByAffinity(userId);
    res.json({ data: feed });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /v1/stories
 * Create a new story.
 */
storiesRouter.post('/', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.userId!;
    const body = createStorySchema.parse(req.body);

    const repo = getStoryRepo();
    const story = await repo.createStory(
      userId,
      body.mediaUrl,
      body.mediaType,
      body.caption,
      body.backgroundColor,
      body.duration,
    );
    res.status(201).json(story);
  } catch (error) {
    next(error);
  }
});
