ALTER TABLE planos
    DROP CONSTRAINT IF EXISTS uq_planos_local_duracao;

ALTER TABLE planos
    ADD CONSTRAINT uq_planos_local_linha_duracao UNIQUE (local_prova_id, linha_produto, duracao_dias);
