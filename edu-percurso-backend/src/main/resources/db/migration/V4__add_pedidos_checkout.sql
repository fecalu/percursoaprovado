CREATE TABLE pedidos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    plano_id UUID NOT NULL REFERENCES planos(id) ON DELETE RESTRICT,
    local_prova_id UUID NOT NULL REFERENCES locais_prova(id) ON DELETE RESTRICT,
    assinatura_id UUID UNIQUE REFERENCES assinaturas(id) ON DELETE SET NULL,
    valor_centavos INTEGER NOT NULL,
    referencia VARCHAR(40) NOT NULL UNIQUE,
    metodo_pagamento VARCHAR(30) NOT NULL CHECK (metodo_pagamento IN ('PIX_MANUAL')),
    status VARCHAR(20) NOT NULL CHECK (status IN ('PENDENTE', 'PAGO', 'CANCELADO')),
    pago_em TIMESTAMP,
    criado_em TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_pedidos_usuario ON pedidos(usuario_id);
CREATE INDEX idx_pedidos_status ON pedidos(status);
CREATE INDEX idx_pedidos_local_prova ON pedidos(local_prova_id);
