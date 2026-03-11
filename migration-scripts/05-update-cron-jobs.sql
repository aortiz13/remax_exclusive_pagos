-- ============================================
-- Script 5: Actualizar Cron Jobs y URLs
-- Ejecutar EN EL SERVIDOR después de restaurar la DB
-- ============================================
-- IMPORTANTE: Reemplazá TU_NUEVA_URL con la URL real de tu Supabase self-hosted
-- Ejemplo: https://supabase.remax-exclusive.cl

-- ── Eliminar cron jobs viejos que apuntan a supabase.co ──
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobid IN (1, 4, 5, 6);

-- ── Recrear cron jobs con la nueva URL ──

-- 1. Sync YouTube Playlists (diario a las 3 AM)
SELECT cron.schedule(
  'sync-youtube-playlists',
  '0 3 * * *',
  $$
    SELECT net.http_post(
      url := 'TU_NUEVA_URL/functions/v1/sync-youtube-playlists',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := '{}'::jsonb
    )
  $$
);

-- 2. Sync Remax Listings (diario a las 3 AM)
SELECT cron.schedule(
  'sync-remax-listings',
  '0 3 * * *',
  $$
    SELECT net.http_post(
      url := 'TU_NUEVA_URL/functions/v1/sync-remax-listings',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer TU_NUEVA_ANON_KEY'
      ),
      body := '{}'::jsonb
    )
  $$
);

-- 3. Camera Reminders (cada 30 min)
SELECT cron.schedule(
  'camera-reminders',
  '*/30 * * * *',
  $$
    SELECT net.http_post(
      url := 'TU_NUEVA_URL/functions/v1/camera-reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    )
  $$
);

-- 4. Google Calendar Cron (cada 5 min)
SELECT cron.schedule(
  'google-calendar-cron',
  '*/5 * * * *',
  $$
    SELECT net.http_post(
      url := 'TU_NUEVA_URL/functions/v1/google-calendar-cron',
      headers := jsonb_build_object(
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    )
  $$
);

-- ── Verificar que los cron jobs se crearon correctamente ──
SELECT jobid, jobname, schedule, command FROM cron.job ORDER BY jobid;
