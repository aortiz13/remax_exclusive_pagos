-- Fix unique constraint error on properties.listing_link
-- This allows multiple properties to have empty or null listing links

-- 1. Convert existing empty strings to NULL
UPDATE properties SET listing_link = NULL WHERE listing_link = '';

-- 2. Drop old index and recreate excluding both NULL and empty strings
DROP INDEX IF EXISTS idx_properties_listing_link_unique;
CREATE UNIQUE INDEX idx_properties_listing_link_unique 
ON public.properties USING btree (listing_link) 
WHERE (listing_link IS NOT NULL AND listing_link != '');
