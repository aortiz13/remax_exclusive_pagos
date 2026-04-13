/**
 * Meeting Bot — MinIO Storage
 */
import { Client as MinioClient } from 'minio';
import { config } from '../config.js';

const minioClient = new MinioClient({
    endPoint: config.MINIO_ENDPOINT,
    port: config.MINIO_PORT,
    useSSL: config.MINIO_USE_SSL,
    accessKey: config.MINIO_ACCESS_KEY,
    secretKey: config.MINIO_SECRET_KEY,
});

/**
 * Upload a file buffer to MinIO
 * @param {string} path - Storage path (e.g., "recruitment-recordings/uuid/file.webm")
 * @param {Buffer} buffer - File content
 * @param {string} contentType - MIME type
 * @returns {string} Public URL
 */
export async function uploadFile(path, buffer, contentType = 'audio/webm') {
    await minioClient.putObject(config.MINIO_BUCKET, path, buffer, buffer.length, {
        'Content-Type': contentType,
    });

    return `${config.MINIO_PUBLIC_URL}/${config.MINIO_BUCKET}/${path}`;
}
