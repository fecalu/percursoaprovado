ALTER TABLE planos
    ADD COLUMN trilha_principal_id UUID;

UPDATE planos p
SET trilha_principal_id = t.id
FROM trilhas t
WHERE p.trilha_principal_id IS NULL
  AND t.codigo = CASE
      WHEN EXISTS (
          SELECT 1
          FROM planos_grupos_acesso pga
          JOIN grupos_acesso ga ON ga.id = pga.grupo_acesso_id
          WHERE pga.plano_id = p.id
            AND ga.codigo IN ('primeiros_passos', 'documentos_taxas', 'curso_teorico')
      ) THEN 'comecando_do_zero'
      ELSE 'reta_final_prova'
  END;

ALTER TABLE planos
    ALTER COLUMN trilha_principal_id SET NOT NULL;

ALTER TABLE planos
    ADD CONSTRAINT fk_planos_trilha_principal
    FOREIGN KEY (trilha_principal_id) REFERENCES trilhas(id);

CREATE INDEX idx_planos_trilha_principal ON planos(trilha_principal_id);
