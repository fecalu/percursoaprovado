ALTER TABLE categorias
    ADD COLUMN IF NOT EXISTS formato_experiencia VARCHAR(30) NOT NULL DEFAULT 'AULAS';

CREATE TABLE IF NOT EXISTS categoria_guia_blocos (
    id UUID PRIMARY KEY,
    categoria_id UUID NOT NULL REFERENCES categorias(id) ON DELETE CASCADE,
    titulo VARCHAR(255) NOT NULL,
    descricao TEXT,
    icone VARCHAR(60),
    ordem_exibicao INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_categoria_guia_blocos_categoria
    ON categoria_guia_blocos(categoria_id);

CREATE INDEX IF NOT EXISTS idx_categoria_guia_blocos_ordem
    ON categoria_guia_blocos(categoria_id, ordem_exibicao);
