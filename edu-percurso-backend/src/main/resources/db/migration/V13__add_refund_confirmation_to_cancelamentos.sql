ALTER TABLE solicitacoes_cancelamento
    ADD COLUMN reembolsado_por_email VARCHAR(255),
    ADD COLUMN reembolsado_em TIMESTAMP;
