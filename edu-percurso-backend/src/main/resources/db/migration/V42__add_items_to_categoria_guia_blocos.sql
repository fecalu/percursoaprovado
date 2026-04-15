CREATE TABLE categoria_guia_itens (
    id UUID PRIMARY KEY,
    guia_bloco_id UUID NOT NULL REFERENCES categoria_guia_blocos(id) ON DELETE CASCADE,
    titulo VARCHAR(255) NOT NULL,
    descricao TEXT,
    imagem_url TEXT,
    imagem_legenda VARCHAR(255),
    ordem_exibicao INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_categoria_guia_itens_bloco_ordem
    ON categoria_guia_itens (guia_bloco_id, ordem_exibicao, titulo);
