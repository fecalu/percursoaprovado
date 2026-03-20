ALTER TABLE percursos
    ADD COLUMN IF NOT EXISTS video_provider VARCHAR(20);

ALTER TABLE percursos
    ADD COLUMN IF NOT EXISTS video_asset_id VARCHAR(255);

UPDATE percursos
SET video_provider = CASE
    WHEN video_url ILIKE '%mediadelivery.net/embed/%' OR video_url ILIKE '%video.bunnycdn.com%' THEN 'BUNNY'
    WHEN video_url ILIKE '%vimeo.com%' THEN 'VIMEO'
    ELSE 'YOUTUBE'
END
WHERE video_provider IS NULL;

ALTER TABLE percursos
    ALTER COLUMN video_provider SET DEFAULT 'YOUTUBE';

UPDATE percursos
SET video_provider = 'YOUTUBE'
WHERE video_provider IS NULL;

ALTER TABLE percursos
    ALTER COLUMN video_provider SET NOT NULL;
