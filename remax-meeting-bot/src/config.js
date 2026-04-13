/**
 * Meeting Bot — Configuration
 */

export const config = {
    // Database
    DATABASE_URL: process.env.DATABASE_URL || 'postgres://postgres:5a58ca9a00e2837be764@panel.remax-exclusive.cl:5432/postgres?sslmode=disable',

    // Redis
    REDIS_URL: process.env.REDIS_URL || 'redis://127.0.0.1:6379',

    // MinIO Storage
    MINIO_ENDPOINT: process.env.MINIO_ENDPOINT || 'remax-crm-remax-storage.jzuuqr.easypanel.host',
    MINIO_PORT: parseInt(process.env.MINIO_PORT || '443'),
    MINIO_ACCESS_KEY: process.env.MINIO_ACCESS_KEY || 'remaxadmin',
    MINIO_SECRET_KEY: process.env.MINIO_SECRET_KEY || 'RemaxExclusive123!',
    MINIO_USE_SSL: process.env.MINIO_USE_SSL === 'true' || (parseInt(process.env.MINIO_PORT || '443') === 443),
    MINIO_PUBLIC_URL: process.env.MINIO_PUBLIC_URL || process.env.PUBLIC_STORAGE_URL || 'https://remax-crm-remax-storage.jzuuqr.easypanel.host',
    MINIO_BUCKET: process.env.MINIO_BUCKET || 'remax-storage',

    // OpenAI
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,

    // Bot Settings
    BOT_DISPLAY_NAME: process.env.BOT_DISPLAY_NAME || 'Remax Exclusive Notetaker',
    BOT_MAX_MEETING_DURATION: parseInt(process.env.BOT_MAX_MEETING_DURATION || '7200'), // 2h
    BOT_JOIN_TIMEOUT: parseInt(process.env.BOT_JOIN_TIMEOUT || '300'), // 5 min
    BOT_CONCURRENCY: parseInt(process.env.BOT_CONCURRENCY || '2'),

    // API
    API_BASE_URL: process.env.API_GATEWAY_URL || 'https://remax-crm-remax-app.jzuuqr.easypanel.host',
};
