ALTER TABLE usuarios
    ADD COLUMN IF NOT EXISTS termos_aceitos_em TIMESTAMP,
    ADD COLUMN IF NOT EXISTS politica_privacidade_aceita_em TIMESTAMP;
