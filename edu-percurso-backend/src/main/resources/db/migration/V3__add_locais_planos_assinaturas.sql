CREATE TABLE locais_prova (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(120) NOT NULL UNIQUE,
    slug VARCHAR(140) NOT NULL UNIQUE,
    descricao TEXT,
    cidade VARCHAR(120) NOT NULL DEFAULT 'Sao Luis',
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    ordem_exibicao INTEGER NOT NULL DEFAULT 0,
    criado_em TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE planos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    local_prova_id UUID NOT NULL REFERENCES locais_prova(id) ON DELETE CASCADE,
    nome VARCHAR(120) NOT NULL,
    duracao_dias INTEGER NOT NULL,
    preco_centavos INTEGER NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT uq_planos_local_duracao UNIQUE (local_prova_id, duracao_dias)
);

CREATE TABLE assinaturas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    plano_id UUID NOT NULL REFERENCES planos(id) ON DELETE RESTRICT,
    local_prova_id UUID NOT NULL REFERENCES locais_prova(id) ON DELETE RESTRICT,
    inicio_em TIMESTAMP NOT NULL,
    fim_em TIMESTAMP NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('ATIVA', 'EXPIRADA', 'CANCELADA')),
    payment_status VARCHAR(20) NOT NULL CHECK (payment_status IN ('PENDENTE', 'PAGO', 'FALHOU', 'REEMBOLSADO')),
    criado_em TIMESTAMP NOT NULL DEFAULT now()
);

ALTER TABLE percursos
    ADD COLUMN local_prova_id UUID REFERENCES locais_prova(id) ON DELETE SET NULL,
    ADD COLUMN tipo_conteudo VARCHAR(40) NOT NULL DEFAULT 'PERCURSO_REAL',
    ADD COLUMN resumo TEXT,
    ADD COLUMN thumbnail_url VARCHAR(500),
    ADD COLUMN ordem_exibicao INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN destaque BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX idx_percursos_local_prova ON percursos(local_prova_id);
CREATE INDEX idx_planos_local_prova ON planos(local_prova_id);
CREATE INDEX idx_assinaturas_usuario ON assinaturas(usuario_id);
CREATE INDEX idx_assinaturas_local_prova ON assinaturas(local_prova_id);

INSERT INTO locais_prova (nome, slug, descricao, cidade, ordem_exibicao)
VALUES
    ('Vila Palmeira', 'vila-palmeira', 'Conteudos do local de prova da Vila Palmeira.', 'Sao Luis', 1),
    ('Cohatrac', 'cohatrac', 'Conteudos do local de prova do Cohatrac.', 'Sao Luis', 2),
    ('Maiobao', 'maiobao', 'Conteudos do local de prova do Maiobao.', 'Paco do Lumiar', 3),
    ('Sao Jose de Ribamar', 'sao-jose-de-ribamar', 'Conteudos do local de prova de Sao Jose de Ribamar.', 'Sao Jose de Ribamar', 4),
    ('Raposa', 'raposa', 'Conteudos do local de prova da Raposa.', 'Raposa', 5)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO planos (local_prova_id, nome, duracao_dias, preco_centavos)
SELECT lp.id, p.nome, p.duracao_dias, p.preco_centavos
FROM locais_prova lp
CROSS JOIN (
    VALUES
        ('Plano 1 mes', 30, 9900),
        ('Plano 3 meses', 90, 19900),
        ('Plano 6 meses', 180, 29900),
        ('Plano 1 ano', 365, 39900)
) AS p(nome, duracao_dias, preco_centavos)
ON CONFLICT (local_prova_id, duracao_dias) DO NOTHING;
