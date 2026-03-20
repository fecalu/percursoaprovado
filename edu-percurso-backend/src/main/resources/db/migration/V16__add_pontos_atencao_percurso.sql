CREATE TABLE pontos_atencao_percurso (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    percurso_id UUID NOT NULL REFERENCES percursos(id) ON DELETE CASCADE,
    timestamp_segundos INTEGER NOT NULL,
    titulo VARCHAR(255) NOT NULL,
    descricao_curta TEXT,
    descricao_detalhada TEXT,
    tipo VARCHAR(40) NOT NULL,
    imagem_url TEXT,
    video_url TEXT,
    modo_exibicao VARCHAR(20) NOT NULL,
    ordem_exibicao INTEGER NOT NULL DEFAULT 0,
    ativo BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX idx_pontos_atencao_percurso_percurso ON pontos_atencao_percurso(percurso_id);
