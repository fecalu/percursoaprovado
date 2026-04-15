INSERT INTO percursos_grupos_acesso (percurso_id, grupo_acesso_id)
SELECT p.id, g.id
FROM percursos p
JOIN grupos_acesso g ON g.codigo = 'pegadinhas_local'
LEFT JOIN categorias c ON c.id = p.categoria_id
WHERE p.local_prova_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1
      FROM percursos_grupos_acesso pga
      WHERE pga.percurso_id = p.id
  )
  AND (
      lower(coalesce(p.titulo, '')) LIKE '%pegadinh%'
      OR lower(coalesce(p.titulo, '')) LIKE '%reprova%'
      OR lower(coalesce(c.nome, '')) LIKE '%dica%'
      OR lower(coalesce(c.nome, '')) LIKE '%pegadinh%'
  )
ON CONFLICT DO NOTHING;

INSERT INTO percursos_grupos_acesso (percurso_id, grupo_acesso_id)
SELECT p.id, g.id
FROM percursos p
JOIN grupos_acesso g ON g.codigo = 'percursos_local'
WHERE p.local_prova_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1
      FROM percursos_grupos_acesso pga
      WHERE pga.percurso_id = p.id
  )
ON CONFLICT DO NOTHING;

INSERT INTO planos_grupos_acesso (plano_id, grupo_acesso_id)
SELECT pl.id, ga.id
FROM planos pl
JOIN grupos_acesso ga
  ON ga.codigo IN (
      'pratica_geral',
      'percursos_local',
      'pegadinhas_local',
      'revisao_final',
      'dia_da_prova'
  )
WHERE NOT EXISTS (
    SELECT 1
    FROM planos_grupos_acesso pga
    WHERE pga.plano_id = pl.id
)
ON CONFLICT DO NOTHING;
