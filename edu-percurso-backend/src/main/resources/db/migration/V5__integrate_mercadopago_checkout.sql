ALTER TABLE pedidos
    DROP CONSTRAINT IF EXISTS pedidos_metodo_pagamento_check;

ALTER TABLE pedidos
    ADD COLUMN checkout_id VARCHAR(120),
    ADD COLUMN checkout_url TEXT,
    ADD COLUMN payment_id VARCHAR(60),
    ADD COLUMN payment_type VARCHAR(40),
    ADD COLUMN payment_status VARCHAR(40),
    ADD COLUMN payment_status_detail VARCHAR(120);

ALTER TABLE pedidos
    ADD CONSTRAINT pedidos_metodo_pagamento_check
    CHECK (metodo_pagamento IN ('PIX_MANUAL', 'MERCADO_PAGO'));

CREATE INDEX idx_pedidos_referencia ON pedidos(referencia);
CREATE INDEX idx_pedidos_payment_id ON pedidos(payment_id);
