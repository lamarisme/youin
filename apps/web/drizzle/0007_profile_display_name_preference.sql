ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "display_name_preference" text DEFAULT 'full_name' NOT NULL;
