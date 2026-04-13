/**
 * Meeting Bot — PostgreSQL Connection
 */
import pg from 'pg';
import { config } from '../config.js';

const pool = new pg.Pool({
    connectionString: config.DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 30000,
});

pool.on('error', (err) => {
    console.error('[DB] Unexpected error on idle client', err);
});

export default pool;
