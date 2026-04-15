CREATE TABLE IF NOT EXISTS categorias_grupos_acesso (
    categoria_id UUID NOT NULL REFERENCES categorias(id) ON DELETE CASCADE,
    grupo_acesso_id UUID NOT NULL REFERENCES grupos_acesso(id) ON DELETE CASCADE,
    PRIMARY KEY (categoria_id, grupo_acesso_id)
);

CREATE INDEX IF NOT EXISTS idx_categorias_grupos_acesso_grupo
    ON categorias_grupos_acesso(grupo_acesso_id);

INSERT INTO categorias_grupos_acesso (categoria_id, grupo_acesso_id)
SELECT c.id, g.id
FROM categorias c
JOIN grupos_acesso g
    ON g.codigo = CASE
        WHEN lower(c.nome) LIKE '%dia%' AND lower(c.nome) LIKE '%prova%' THEN 'dia_da_prova'
        WHEN lower(c.nome) LIKE '%revis%' THEN 'revisao_final'
        WHEN lower(c.nome) LIKE '%pegadinh%' OR lower(c.nome) LIKE '%reprova%' THEN 'pegadinhas_local'
        WHEN lower(c.nome) LIKE '%percurso%' THEN 'percursos_local'
        ELSE 'pratica_geral'
    END
WHERE c.formato_experiencia IN ('GUIA', 'MISTO')
  AND EXISTS (
      SELECT 1
      FROM categoria_guia_blocos bloco
      WHERE bloco.categoria_id = c.id
  )
ON CONFLICT DO NOTHING;
