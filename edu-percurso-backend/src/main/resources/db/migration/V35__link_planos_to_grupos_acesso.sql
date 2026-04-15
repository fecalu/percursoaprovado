CREATE TABLE planos_grupos_acesso (
    plano_id UUID NOT NULL REFERENCES planos(id) ON DELETE CASCADE,
    grupo_acesso_id UUID NOT NULL REFERENCES grupos_acesso(id) ON DELETE CASCADE,
    PRIMARY KEY (plano_id, grupo_acesso_id)
);

CREATE INDEX idx_planos_grupos_acesso_grupo ON planos_grupos_acesso(grupo_acesso_id);
