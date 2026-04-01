ALTER TABLE usuarios
    ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(20) NOT NULL DEFAULT 'LOCAL',
    ADD COLUMN IF NOT EXISTS google_sub VARCHAR(255),
    ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500),
    ADD COLUMN IF NOT EXISTS email_verificado BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE usuarios
    ALTER COLUMN senha_hash DROP NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'uk_usuarios_google_sub'
    ) THEN
        ALTER TABLE usuarios
            ADD CONSTRAINT uk_usuarios_google_sub UNIQUE (google_sub);
    END IF;
END $$;
