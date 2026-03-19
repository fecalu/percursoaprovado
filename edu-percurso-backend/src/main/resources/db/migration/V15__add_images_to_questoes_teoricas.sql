ALTER TABLE questoes_teoricas
    ADD COLUMN imagem_url TEXT;

ALTER TABLE questoes_alternativas
    ADD COLUMN imagem_url TEXT;

ALTER TABLE questoes_alternativas
    ALTER COLUMN texto DROP NOT NULL;
