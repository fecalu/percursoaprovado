ALTER TABLE usuarios
    ADD COLUMN IF NOT EXISTS senha_alterada_em TIMESTAMP;

CREATE TABLE password_reset_tokens (
    id UUID PRIMARY KEY,
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    token_hash VARCHAR(128) NOT NULL UNIQUE,
    expira_em TIMESTAMP NOT NULL,
    usado_em TIMESTAMP NULL,
    criado_em TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_password_reset_tokens_usuario_id
    ON password_reset_tokens (usuario_id);

CREATE INDEX idx_password_reset_tokens_expira_em
    ON password_reset_tokens (expira_em);
