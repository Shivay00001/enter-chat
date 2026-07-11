import { Pool } from 'pg';

export interface Story {
  id: string;
  userId: string;
  mediaUrl: string;
  mediaType: string;
  caption?: string;
  backgroundColor?: string;
  durationSeconds?: number;
  expiresAt: string;
  createdAt: string;
}

export interface UserStoryGroup {
  user: {
    id: string;
    name: string;
    avatar?: string;
  };
  stories: Story[];
  affinityScore: number;
}

export class PostgresStoryRepository {
  constructor(private readonly pool: Pool) {}

  /**
   * Retrieves the story feed for a user, ranked by a custom Affinity Algorithm.
   * 
   * Affinity Ranking Algorithm:
   * It calculates a score based on interactions:
   * 1. Recent direct messages exchanged with the story creator (+5 points each)
   * 2. Number of shared group chats (+10 points each)
   * 3. Stories are grouped by user. Users with higher affinity are returned first.
   */
  async getStoryFeedRankedByAffinity(currentUserId: string): Promise<UserStoryGroup[]> {
    const query = `
      WITH ActiveStories AS (
        SELECT s.*, u.display_name, u.avatar_url
        FROM stories s
        JOIN users u ON s.user_id = u.id
        WHERE s.expires_at > NOW()
          AND s.user_id != $1 -- Don't include my own stories in the main feed
      ),
      -- 1. Count Direct Messages Exchanged (Affinity Signal)
      DirectMessageAffinity AS (
        SELECT 
          CASE 
            WHEN m.sender_id = $1 THEN cm.user_id
            ELSE m.sender_id
          END as partner_id,
          COUNT(*) * 5 AS score
        FROM messages m
        JOIN chats c ON m.chat_id = c.id
        JOIN chat_members cm ON c.id = cm.chat_id
        WHERE c.type = 'direct'
          AND (m.sender_id = $1 OR cm.user_id = $1)
          AND m.created_at > NOW() - INTERVAL '30 days'
        GROUP BY partner_id
      ),
      -- 2. Count Shared Groups (Affinity Signal)
      SharedGroupsAffinity AS (
        SELECT cm2.user_id as partner_id, COUNT(*) * 10 AS score
        FROM chat_members cm1
        JOIN chat_members cm2 ON cm1.chat_id = cm2.chat_id AND cm1.user_id != cm2.user_id
        JOIN chats c ON cm1.chat_id = c.id
        WHERE cm1.user_id = $1 AND c.type = 'group'
        GROUP BY cm2.user_id
      ),
      -- 3. Calculate Total Affinity Score
      TotalAffinity AS (
        SELECT 
          COALESCE(dm.partner_id, sg.partner_id) AS user_id,
          COALESCE(dm.score, 0) + COALESCE(sg.score, 0) AS affinity_score
        FROM DirectMessageAffinity dm
        FULL OUTER JOIN SharedGroupsAffinity sg ON dm.partner_id = sg.partner_id
      )
      -- Aggregate stories by user and order by affinity score
      SELECT 
        a.user_id,
        a.display_name,
        a.avatar_url,
        COALESCE(ta.affinity_score, 0) AS affinity_score,
        json_agg(
          json_build_object(
            'id', a.id,
            'userId', a.user_id,
            'mediaUrl', a.media_url,
            'mediaType', a.media_type,
            'caption', a.caption,
            'backgroundColor', a.background_color,
            'duration', a.duration_seconds,
            'expiresAt', a.expires_at,
            'createdAt', a.created_at
          ) ORDER BY a.created_at ASC
        ) as stories
      FROM ActiveStories a
      LEFT JOIN TotalAffinity ta ON a.user_id = ta.user_id
      GROUP BY a.user_id, a.display_name, a.avatar_url, ta.affinity_score
      ORDER BY affinity_score DESC, MAX(a.created_at) DESC;
    `;

    const result = await this.pool.query(query, [currentUserId]);

    return result.rows.map(row => ({
      user: {
        id: row.user_id,
        name: row.display_name,
        avatar: row.avatar_url,
      },
      affinityScore: parseInt(row.affinity_score, 10),
      stories: row.stories,
    }));
  }

  async createStory(
    userId: string, 
    mediaUrl: string, 
    mediaType: string, 
    caption?: string, 
    backgroundColor?: string, 
    duration?: number
  ): Promise<Story> {
    const query = `
      INSERT INTO stories (user_id, media_url, media_type, caption, background_color, duration_seconds, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW() + INTERVAL '24 hours')
      RETURNING id, user_id as "userId", media_url as "mediaUrl", media_type as "mediaType", 
                caption, background_color as "backgroundColor", duration_seconds as "durationSeconds", 
                expires_at as "expiresAt", created_at as "createdAt"
    `;

    const values = [userId, mediaUrl, mediaType, caption, backgroundColor, duration];
    const result = await this.pool.query(query, values);
    return result.rows[0];
  }
}
