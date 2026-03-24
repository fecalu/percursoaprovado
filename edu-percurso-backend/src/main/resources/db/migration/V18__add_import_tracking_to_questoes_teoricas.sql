ALTER TABLE questoes_teoricas
    ADD COLUMN origem VARCHAR(60),
    ADD COLUMN origem_questao_id VARCHAR(120),
    ADD COLUMN fingerprint VARCHAR(64);

CREATE INDEX idx_questoes_teoricas_origem
    ON questoes_teoricas (origem);

CREATE UNIQUE INDEX uq_questoes_teoricas_origem_questao_id
    ON questoes_teoricas (origem, origem_questao_id)
    WHERE origem IS NOT NULL AND origem_questao_id IS NOT NULL;

CREATE UNIQUE INDEX uq_questoes_teoricas_fingerprint
    ON questoes_teoricas (fingerprint)
    WHERE fingerprint IS NOT NULL;
