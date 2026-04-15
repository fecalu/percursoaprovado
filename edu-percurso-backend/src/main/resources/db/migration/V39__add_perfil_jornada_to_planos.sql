ALTER TABLE planos
    ADD COLUMN IF NOT EXISTS perfil_jornada VARCHAR(30);

UPDATE planos
SET perfil_jornada = 'COMPLETO'
WHERE perfil_jornada IS NULL;

ALTER TABLE planos
    ALTER COLUMN perfil_jornada SET DEFAULT 'COMPLETO';

ALTER TABLE planos
    ALTER COLUMN perfil_jornada SET NOT NULL;
