ALTER TABLE questoes_teoricas
    ADD COLUMN modalidade VARCHAR(20);

UPDATE questoes_teoricas
SET modalidade = 'TEORICO'
WHERE modalidade IS NULL;

ALTER TABLE questoes_teoricas
    ALTER COLUMN modalidade SET NOT NULL;

ALTER TABLE questoes_teoricas
    ALTER COLUMN modalidade SET DEFAULT 'TEORICO';
