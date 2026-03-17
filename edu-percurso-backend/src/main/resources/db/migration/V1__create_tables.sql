-- V1__create_tables.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Usuários ──────────────────────────────────────────────────────────────────
CREATE TABLE usuarios (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    nome        VARCHAR(150) NOT NULL,
    email       VARCHAR(255) NOT NULL UNIQUE,
    senha_hash  VARCHAR(255) NOT NULL,
    role        VARCHAR(10)  NOT NULL CHECK (role IN ('ALUNO', 'ADMIN')),
    criado_em   TIMESTAMP    NOT NULL DEFAULT now()
);

-- ── Categorias ────────────────────────────────────────────────────────────────
CREATE TABLE categorias (
    id        UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    nome      VARCHAR(100) NOT NULL UNIQUE,
    descricao TEXT
);

-- ── Percursos ─────────────────────────────────────────────────────────────────
CREATE TABLE percursos (
    id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo             VARCHAR(200) NOT NULL,
    descricao          TEXT,
    video_url          VARCHAR(500) NOT NULL,
    duracao_segundos   INTEGER,
    ativo              BOOLEAN      NOT NULL DEFAULT TRUE,
    categoria_id       UUID         REFERENCES categorias(id) ON DELETE SET NULL,
    criado_em          TIMESTAMP    NOT NULL DEFAULT now()
);

-- ── Progresso do aluno ────────────────────────────────────────────────────────
CREATE TABLE progresso_aluno (
    id                  UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id          UUID      NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    percurso_id         UUID      NOT NULL REFERENCES percursos(id) ON DELETE CASCADE,
    segundos_assistidos INTEGER   NOT NULL DEFAULT 0,
    concluido           BOOLEAN   NOT NULL DEFAULT FALSE,
    ultima_vez          TIMESTAMP,
    CONSTRAINT uq_progresso UNIQUE (usuario_id, percurso_id)
);

-- ── Índices ───────────────────────────────────────────────────────────────────
CREATE INDEX idx_percursos_ativo      ON percursos(ativo);
CREATE INDEX idx_percursos_categoria  ON percursos(categoria_id);
CREATE INDEX idx_progresso_usuario    ON progresso_aluno(usuario_id);

-- ── Admin padrão (troque a senha em produção) ─────────────────────────────────
INSERT INTO usuarios (nome, email, senha_hash, role)
VALUES (
    'Administrador',
    'admin@edupercurso.com',
    '$2a$10$7EqJtq98hPqEX7fNZaFWoO9jAvZ3oE6rLcICSb1j7CzUhVqx6RVAG', -- senha: admin123
    'ADMIN'
);

-- ── Categorias iniciais ───────────────────────────────────────────────────────
INSERT INTO categorias (nome, descricao) VALUES
    ('Manobras básicas',   'Baliza, garagem e manobras do exame'),
    ('Estacionamento',     'Paralelo, perpendicular e em aclive/declive'),
    ('Curvas e retornos',  'Curva em U, retorno e conversões'),
    ('Percursos urbanos',  'Circulação em via urbana completa'),
    ('Via expressa',       'Entrada, saída e ultrapassagem em rodovias');
