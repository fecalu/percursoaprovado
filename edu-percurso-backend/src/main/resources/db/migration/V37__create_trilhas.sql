CREATE TABLE trilhas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(120) NOT NULL UNIQUE,
    nome VARCHAR(140) NOT NULL UNIQUE,
    descricao TEXT,
    ordem_exibicao INTEGER NOT NULL DEFAULT 0,
    ativo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE trilha_etapas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trilha_id UUID NOT NULL REFERENCES trilhas(id) ON DELETE CASCADE,
    grupo_acesso_id UUID NOT NULL REFERENCES grupos_acesso(id),
    titulo VARCHAR(140) NOT NULL,
    resumo TEXT,
    ordem_exibicao INTEGER NOT NULL DEFAULT 0,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT uk_trilha_etapa_grupo UNIQUE (trilha_id, grupo_acesso_id)
);

CREATE INDEX idx_trilhas_ordem ON trilhas(ordem_exibicao, nome);
CREATE INDEX idx_trilha_etapas_trilha ON trilha_etapas(trilha_id, ordem_exibicao);
CREATE INDEX idx_trilha_etapas_grupo ON trilha_etapas(grupo_acesso_id);

INSERT INTO trilhas (codigo, nome, descricao, ordem_exibicao, ativo)
VALUES
    ('comecando_do_zero', 'Comecando do zero', 'Jornada completa para quem quer entender o processo desde o inicio e chegar pronto no dia da prova.', 1, TRUE),
    ('reta_final_prova', 'Reta final para a prova', 'Jornada enxuta para quem ja passou pelas etapas iniciais e quer focar na pratica, nos percursos e na revisao final.', 2, TRUE)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO trilha_etapas (trilha_id, grupo_acesso_id, titulo, resumo, ordem_exibicao, ativo)
SELECT t.id, g.id, 'Primeiros passos', 'Entenda o que resolver logo no inicio do processo.', 1, TRUE
FROM trilhas t
JOIN grupos_acesso g ON g.codigo = 'primeiros_passos'
WHERE t.codigo = 'comecando_do_zero'
  AND NOT EXISTS (
      SELECT 1
      FROM trilha_etapas te
      WHERE te.trilha_id = t.id
        AND te.grupo_acesso_id = g.id
  );

INSERT INTO trilha_etapas (trilha_id, grupo_acesso_id, titulo, resumo, ordem_exibicao, ativo)
SELECT t.id, g.id, 'Documentos e taxas', 'Confira o que levar, pagar e organizar antes de avancar.', 2, TRUE
FROM trilhas t
JOIN grupos_acesso g ON g.codigo = 'documentos_taxas'
WHERE t.codigo = 'comecando_do_zero'
  AND NOT EXISTS (
      SELECT 1
      FROM trilha_etapas te
      WHERE te.trilha_id = t.id
        AND te.grupo_acesso_id = g.id
  );

INSERT INTO trilha_etapas (trilha_id, grupo_acesso_id, titulo, resumo, ordem_exibicao, ativo)
SELECT t.id, g.id, 'Curso teorico', 'Ganhe base antes de entrar com mais forca na pratica.', 3, TRUE
FROM trilhas t
JOIN grupos_acesso g ON g.codigo = 'curso_teorico'
WHERE t.codigo = 'comecando_do_zero'
  AND NOT EXISTS (
      SELECT 1
      FROM trilha_etapas te
      WHERE te.trilha_id = t.id
        AND te.grupo_acesso_id = g.id
  );

INSERT INTO trilha_etapas (trilha_id, grupo_acesso_id, titulo, resumo, ordem_exibicao, ativo)
SELECT t.id, g.id, 'Pratica geral', 'Fortalece controle do carro, baliza e confianca geral.', 4, TRUE
FROM trilhas t
JOIN grupos_acesso g ON g.codigo = 'pratica_geral'
WHERE t.codigo = 'comecando_do_zero'
  AND NOT EXISTS (
      SELECT 1
      FROM trilha_etapas te
      WHERE te.trilha_id = t.id
        AND te.grupo_acesso_id = g.id
  );

INSERT INTO trilha_etapas (trilha_id, grupo_acesso_id, titulo, resumo, ordem_exibicao, ativo)
SELECT t.id, g.id, 'Percursos do seu local', 'Treine exatamente o que costuma aparecer na sua prova.', 5, TRUE
FROM trilhas t
JOIN grupos_acesso g ON g.codigo = 'percursos_local'
WHERE t.codigo = 'comecando_do_zero'
  AND NOT EXISTS (
      SELECT 1
      FROM trilha_etapas te
      WHERE te.trilha_id = t.id
        AND te.grupo_acesso_id = g.id
  );

INSERT INTO trilha_etapas (trilha_id, grupo_acesso_id, titulo, resumo, ordem_exibicao, ativo)
SELECT t.id, g.id, 'Pegadinhas do local', 'Revise os pontos em que mais gente perde pontos.', 6, TRUE
FROM trilhas t
JOIN grupos_acesso g ON g.codigo = 'pegadinhas_local'
WHERE t.codigo = 'comecando_do_zero'
  AND NOT EXISTS (
      SELECT 1
      FROM trilha_etapas te
      WHERE te.trilha_id = t.id
        AND te.grupo_acesso_id = g.id
  );

INSERT INTO trilha_etapas (trilha_id, grupo_acesso_id, titulo, resumo, ordem_exibicao, ativo)
SELECT t.id, g.id, 'Revisao final', 'Amarre os pontos mais importantes para a reta final.', 7, TRUE
FROM trilhas t
JOIN grupos_acesso g ON g.codigo = 'revisao_final'
WHERE t.codigo = 'comecando_do_zero'
  AND NOT EXISTS (
      SELECT 1
      FROM trilha_etapas te
      WHERE te.trilha_id = t.id
        AND te.grupo_acesso_id = g.id
  );

INSERT INTO trilha_etapas (trilha_id, grupo_acesso_id, titulo, resumo, ordem_exibicao, ativo)
SELECT t.id, g.id, 'Dia da prova', 'Organize comportamento, documentos e tranquilidade no dia.', 8, TRUE
FROM trilhas t
JOIN grupos_acesso g ON g.codigo = 'dia_da_prova'
WHERE t.codigo = 'comecando_do_zero'
  AND NOT EXISTS (
      SELECT 1
      FROM trilha_etapas te
      WHERE te.trilha_id = t.id
        AND te.grupo_acesso_id = g.id
  );

INSERT INTO trilha_etapas (trilha_id, grupo_acesso_id, titulo, resumo, ordem_exibicao, ativo)
SELECT t.id, g.id, 'Pratica geral', 'Fortalece controle do carro, baliza e confianca geral.', 1, TRUE
FROM trilhas t
JOIN grupos_acesso g ON g.codigo = 'pratica_geral'
WHERE t.codigo = 'reta_final_prova'
  AND NOT EXISTS (
      SELECT 1
      FROM trilha_etapas te
      WHERE te.trilha_id = t.id
        AND te.grupo_acesso_id = g.id
  );

INSERT INTO trilha_etapas (trilha_id, grupo_acesso_id, titulo, resumo, ordem_exibicao, ativo)
SELECT t.id, g.id, 'Percursos do seu local', 'Treine exatamente o que costuma aparecer na sua prova.', 2, TRUE
FROM trilhas t
JOIN grupos_acesso g ON g.codigo = 'percursos_local'
WHERE t.codigo = 'reta_final_prova'
  AND NOT EXISTS (
      SELECT 1
      FROM trilha_etapas te
      WHERE te.trilha_id = t.id
        AND te.grupo_acesso_id = g.id
  );

INSERT INTO trilha_etapas (trilha_id, grupo_acesso_id, titulo, resumo, ordem_exibicao, ativo)
SELECT t.id, g.id, 'Pegadinhas do local', 'Revise os pontos em que mais gente perde pontos.', 3, TRUE
FROM trilhas t
JOIN grupos_acesso g ON g.codigo = 'pegadinhas_local'
WHERE t.codigo = 'reta_final_prova'
  AND NOT EXISTS (
      SELECT 1
      FROM trilha_etapas te
      WHERE te.trilha_id = t.id
        AND te.grupo_acesso_id = g.id
  );

INSERT INTO trilha_etapas (trilha_id, grupo_acesso_id, titulo, resumo, ordem_exibicao, ativo)
SELECT t.id, g.id, 'Revisao final', 'Amarre os pontos mais importantes para a reta final.', 4, TRUE
FROM trilhas t
JOIN grupos_acesso g ON g.codigo = 'revisao_final'
WHERE t.codigo = 'reta_final_prova'
  AND NOT EXISTS (
      SELECT 1
      FROM trilha_etapas te
      WHERE te.trilha_id = t.id
        AND te.grupo_acesso_id = g.id
  );

INSERT INTO trilha_etapas (trilha_id, grupo_acesso_id, titulo, resumo, ordem_exibicao, ativo)
SELECT t.id, g.id, 'Dia da prova', 'Organize comportamento, documentos e tranquilidade no dia.', 5, TRUE
FROM trilhas t
JOIN grupos_acesso g ON g.codigo = 'dia_da_prova'
WHERE t.codigo = 'reta_final_prova'
  AND NOT EXISTS (
      SELECT 1
      FROM trilha_etapas te
      WHERE te.trilha_id = t.id
        AND te.grupo_acesso_id = g.id
  );
