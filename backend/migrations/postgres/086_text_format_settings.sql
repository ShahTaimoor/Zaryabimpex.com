-- Global text formatting settings (case style applied across the whole system)
ALTER TABLE settings ADD COLUMN IF NOT EXISTS text_format_settings JSONB NOT NULL DEFAULT '{"mode":"capitalize"}'::jsonb;
