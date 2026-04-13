# RE/MAX Meeting Bot — Deployment Guide

## Easypanel Configuration

### 1. Create New Service in Easypanel

In the `remax-crm` project on Easypanel, create a new **App** service:

| Setting        | Value                          |
|---------------|--------------------------------|
| **Name**       | `remax-meeting-bot`           |
| **Source**      | GitHub → `remax-exclusive-requests` (mono-repo) |
| **Build Path** | `/remax-meeting-bot`          |
| **Dockerfile**  | `Dockerfile` (within build path) |

### 2. Environment Variables

Set these environment variables in the Easypanel service:

```env
# Database (same as main backend)
DATABASE_URL=postgres://postgres:5a58ca9a00e2837be764@remax-db:5432/postgres

# Redis (internal Docker network)
REDIS_URL=redis://remax-redis:6379

# MinIO Storage (internal)
MINIO_ENDPOINT=remax-storage
MINIO_PORT=9000
MINIO_ACCESS_KEY=<from backend .env>
MINIO_SECRET_KEY=<from backend .env>
MINIO_BUCKET=recordings

# OpenAI
OPENAI_API_KEY=<your-key>

# Bot config
BOT_DISPLAY_NAME=Remax Exclusive Notetaker
BOT_CONCURRENCY=2
BOT_MAX_MEETING_DURATION=7200

# Public URL for generating links
PUBLIC_STORAGE_URL=https://remax-crm-remax-storage.jzuuqr.easypanel.host
```

### 3. Resource Limits

The bot runs a headless Chromium browser, so it needs more resources than typical services:

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| **CPU**   | 1 core  | 2 cores     |
| **RAM**   | 1 GB    | 2 GB        |
| **Disk**  | 5 GB    | 10 GB       |

### 4. Network

No ports need to be exposed — the bot is a worker service that consumes jobs from the Redis queue. The backend API handles all HTTP interactions.

### 5. Health Check

The bot doesn't have an HTTP endpoint. Monitor health via:
- Redis queue status (pending/active/completed/failed jobs)
- `meeting_bot_sessions` table status tracking
- Container logs

### 6. Deploy

Push changes to the `main` branch of `remax-exclusive-requests` repo. Easypanel will auto-deploy.

For the backend API changes, push the `remax-backend` repo to `main`.
