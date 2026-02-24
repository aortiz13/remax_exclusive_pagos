-- Add video_date to virtual_classroom_videos
ALTER TABLE virtual_classroom_videos ADD COLUMN IF NOT EXISTS video_date TIMESTAMPTZ;

-- Initialize video_date with created_at for existing records
UPDATE virtual_classroom_videos SET video_date = created_at WHERE video_date IS NULL;
