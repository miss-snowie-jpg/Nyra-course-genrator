
-- Add color_theme column to courses to persist the chosen theme
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS color_theme JSONB DEFAULT NULL;
