-- Rename profile free-text field: bio → about (skip if already migrated or created with "about")

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'bio'
  ) THEN
    ALTER TABLE public.profiles RENAME COLUMN bio TO about;
  END IF;
END $$;
