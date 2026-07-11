import pg from 'pg';
import { config } from '../config/index.js';
import { logger } from './logger.js';

const dbLogger = logger.child({ component: 'database' });

export const pool = new pg.Pool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.name,
  user: config.db.user,
  password: config.db.password,
  ssl: config.db.ssl ? { rejectUnauthorized: false } : false,
  min: config.db.poolMin,
  max: config.db.poolMax,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  dbLogger.error({ err }, 'Unexpected database pool error');
});

pool.on('connect', () => {
  dbLogger.debug('New database connection established');
});

/**
 * Execute a query with parameterized values.
 * SECURITY: Always use parameterized queries — never string concatenation.
 */
export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<pg.QueryResult<T>> {
  const start = Date.now();
  const result = await pool.query<T>(text, params);
  const duration = Date.now() - start;

  dbLogger.debug({ query: text.substring(0, 100), duration, rows: result.rowCount }, 'Query executed');
  return result;
}

/**
 * Execute multiple queries within a transaction.
 */
export async function withTransaction<T>(
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Check database connectivity (for health/readiness).
 */
export async function checkDbHealth(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}
