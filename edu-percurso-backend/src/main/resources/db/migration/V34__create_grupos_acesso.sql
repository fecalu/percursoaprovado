CREATE TABLE grupos_acesso (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(120) NOT NULL UNIQUE,
    nome VARCHAR(140) NOT NULL UNIQUE,
    descricao TEXT,
    ordem_exibicao INTEGER NOT NULL DEFAULT 0,
    ativo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE percursos_grupos_acesso (
    percurso_id UUID NOT NULL REFERENCES percursos(id) ON DELETE CASCADE,
    grupo_acesso_id UUID NOT NULL REFERENCES grupos_acesso(id) ON DELETE CASCADE,
    PRIMARY KEY (percurso_id, grupo_acesso_id)
);

CREATE INDEX idx_grupos_acesso_ordem ON grupos_acesso(ordem_exibicao, nome);
CREATE INDEX idx_percursos_grupos_acesso_grupo ON percursos_grupos_acesso(grupo_acesso_id);

INSERT INTO grupos_acesso (codigo, nome, descricao, ordem_exibicao, ativo)
VALUES
    ('primeiros_passos', 'Primeiros passos', 'Conteudos iniciais para quem ainda vai comecar a jornada no DETRAN.', 1, TRUE),
    ('documentos_taxas', 'Documentos e taxas', 'Conteudos sobre documentos, taxas e organizacao inicial do processo.', 2, TRUE),
    ('curso_teorico', 'Curso teorico', 'Conteudos da etapa teorica, incluindo preparacao para a prova teorica.', 3, TRUE),
    ('pratica_geral', 'Pratica geral', 'Conteudos praticos que servem para qualquer aluno antes do foco em local especifico.', 4, TRUE),
    ('percursos_local', 'Percursos do local', 'Conteudos ligados ao percurso real de um local de prova especifico.', 5, TRUE),
    ('pegadinhas_local', 'Pegadinhas do local', 'Pontos criticos e armadilhas comuns do local de prova.', 6, TRUE),
    ('revisao_final', 'Revisao final', 'Conteudos de revisao para a reta final antes da prova.', 7, TRUE),
    ('dia_da_prova', 'Dia da prova', 'Conteudos sobre comportamento, organizacao e preparacao no dia da prova.', 8, TRUE)
ON CONFLICT (codigo) DO NOTHING;
