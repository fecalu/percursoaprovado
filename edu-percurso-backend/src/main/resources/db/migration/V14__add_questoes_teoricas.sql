CREATE TABLE questoes_teoricas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enunciado TEXT NOT NULL,
    tema VARCHAR(40) NOT NULL,
    dificuldade VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,
    explicacao_curta TEXT NOT NULL,
    explicacao_detalhada TEXT,
    video_url TEXT,
    ordem_exibicao INTEGER NOT NULL DEFAULT 0,
    criado_em TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE questoes_alternativas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    questao_id UUID NOT NULL REFERENCES questoes_teoricas(id) ON DELETE CASCADE,
    texto TEXT NOT NULL,
    ordem INTEGER NOT NULL,
    correta BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE respostas_questoes_aluno (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    questao_id UUID NOT NULL REFERENCES questoes_teoricas(id) ON DELETE CASCADE,
    alternativa_id UUID NOT NULL REFERENCES questoes_alternativas(id) ON DELETE CASCADE,
    correta BOOLEAN NOT NULL,
    respondida_em TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_questoes_tema ON questoes_teoricas(tema);
CREATE INDEX idx_questoes_status ON questoes_teoricas(status);
CREATE INDEX idx_alternativas_questao ON questoes_alternativas(questao_id);
CREATE INDEX idx_respostas_questao_usuario ON respostas_questoes_aluno(usuario_id);
CREATE INDEX idx_respostas_questao ON respostas_questoes_aluno(questao_id);
