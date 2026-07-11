import { pool } from './database.js';

/**
 * Get the shared database pool.
 * CONSOLIDATED: Returns the same pool instance used by database.ts,
 * health checks, and index.ts — avoiding duplicate connection pools.
 */
export function getDbPool() {
  return pool;
}

export async function closeDbPool(): Promise<void> {
  await pool.end();
}
