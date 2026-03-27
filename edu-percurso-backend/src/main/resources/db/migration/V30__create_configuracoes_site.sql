CREATE TABLE configuracoes_site (
    id UUID PRIMARY KEY,
    home_json TEXT,
    local_page_json TEXT,
    checkout_json TEXT,
    criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
