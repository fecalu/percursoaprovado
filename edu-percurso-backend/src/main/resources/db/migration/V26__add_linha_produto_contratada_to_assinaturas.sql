ALTER TABLE assinaturas
    ADD COLUMN linha_produto_contratada VARCHAR(30) NOT NULL DEFAULT 'DIRECAO';

UPDATE assinaturas AS assinatura
SET linha_produto_contratada = COALESCE(plano.linha_produto, 'DIRECAO')
FROM planos AS plano
WHERE assinatura.plano_id = plano.id;
