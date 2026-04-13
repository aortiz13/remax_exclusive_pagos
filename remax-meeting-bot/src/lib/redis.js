/**
 * Meeting Bot — Redis Connection
 */
import IORedis from 'ioredis';
import { config } from '../config.js';

export const redisConnection = new IORedis(config.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
});

redisConnection.on('error', (err) => {
    console.error('[Redis] Connection error:', err.message);
});
