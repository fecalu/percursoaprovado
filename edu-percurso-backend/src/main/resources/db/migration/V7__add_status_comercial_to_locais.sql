ALTER TABLE locais_prova
    ADD COLUMN status_comercial VARCHAR(20) NOT NULL DEFAULT 'DISPONIVEL',
    ADD COLUMN mensagem_publica TEXT;

ALTER TABLE locais_prova
    ADD CONSTRAINT locais_prova_status_comercial_check
        CHECK (status_comercial IN ('RASCUNHO', 'EM_BREVE', 'DISPONIVEL', 'PAUSADO'));

UPDATE locais_prova
SET status_comercial = CASE
    WHEN ativo THEN 'DISPONIVEL'
    ELSE 'RASCUNHO'
END;
