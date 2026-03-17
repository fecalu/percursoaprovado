ALTER TABLE assinaturas
    ADD COLUMN origem VARCHAR(20) NOT NULL DEFAULT 'MANUAL',
    ADD COLUMN observacao_interna TEXT,
    ADD COLUMN cancelada_em TIMESTAMP,
    ADD COLUMN cancelada_por_email VARCHAR(160),
    ADD COLUMN motivo_cancelamento VARCHAR(255);

ALTER TABLE assinaturas
    ADD CONSTRAINT assinaturas_origem_check
    CHECK (origem IN ('CHECKOUT', 'MANUAL', 'CORTESIA'));

UPDATE assinaturas a
SET origem = 'CHECKOUT'
FROM pedidos p
WHERE p.assinatura_id = a.id;

CREATE INDEX idx_assinaturas_origem ON assinaturas(origem);
