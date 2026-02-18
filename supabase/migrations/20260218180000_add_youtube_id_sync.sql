-- Add youtube_id to virtual_classroom_videos
ALTER TABLE virtual_classroom_videos ADD COLUMN IF NOT EXISTS youtube_id TEXT UNIQUE;

-- Populate youtube_id from existing video_url
UPDATE virtual_classroom_videos 
SET youtube_id = (
    CASE 
        WHEN video_url LIKE '%youtu.be/%' THEN split_part(split_part(video_url, 'youtu.be/', 2), '?', 1)
        WHEN video_url LIKE '%v=%' THEN split_part(split_part(video_url, 'v=', 2), '&', 1)
        WHEN video_url LIKE '%embed/%' THEN split_part(split_part(video_url, 'embed/', 2), '?', 1)
        ELSE NULL
    END
)
WHERE youtube_id IS NULL AND (video_url LIKE '%youtube.com%' OR video_url LIKE '%youtu.be%');
