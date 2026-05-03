CREATE TABLE duvidas_percurso (
    id UUID PRIMARY KEY,
    percurso_id UUID NOT NULL REFERENCES percursos(id) ON DELETE CASCADE,
    usuario_id UUID NOT NULL REFERENCES usuarios(id),
    duvida_principal_id UUID REFERENCES duvidas_percurso(id),
    timestamp_segundos INTEGER NOT NULL,
    titulo VARCHAR(180) NOT NULL,
    descricao TEXT,
    status VARCHAR(40) NOT NULL,
    resposta_oficial TEXT,
    respondida_por_id UUID REFERENCES usuarios(id),
    publicada_em TIMESTAMP,
    resposta_criada_em TIMESTAMP,
    criada_em TIMESTAMP NOT NULL DEFAULT NOW(),
    atualizada_em TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_duvidas_percurso_percurso_status
    ON duvidas_percurso (percurso_id, status, timestamp_segundos);

CREATE INDEX idx_duvidas_percurso_status_criada
    ON duvidas_percurso (status, criada_em DESC);

CREATE TABLE duvidas_percurso_apoios (
    id UUID PRIMARY KEY,
    duvida_id UUID NOT NULL REFERENCES duvidas_percurso(id) ON DELETE CASCADE,
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    criada_em TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_duvidas_percurso_apoios UNIQUE (duvida_id, usuario_id)
);

CREATE INDEX idx_duvidas_percurso_apoios_duvida
    ON duvidas_percurso_apoios (duvida_id);
