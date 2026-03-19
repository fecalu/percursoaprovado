CREATE TABLE solicitacoes_cancelamento (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pedido_id UUID NOT NULL UNIQUE REFERENCES pedidos(id) ON DELETE CASCADE,
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    motivo VARCHAR(120) NOT NULL,
    observacao_aluno TEXT,
    status VARCHAR(24) NOT NULL,
    observacao_admin TEXT,
    processado_por_email VARCHAR(255),
    criado_em TIMESTAMP NOT NULL DEFAULT now(),
    processado_em TIMESTAMP
);

CREATE INDEX idx_cancelamento_usuario ON solicitacoes_cancelamento(usuario_id);
CREATE INDEX idx_cancelamento_status ON solicitacoes_cancelamento(status);
