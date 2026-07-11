import { createApp } from '../src/server.js';
import { pool } from '../src/shared/database.js';

const app = createApp();

// Initialize DB connection once for the serverless container
pool.query('SELECT 1').catch((err) => {
  console.error('Failed to initialize database connection', err);
});

export default app;
