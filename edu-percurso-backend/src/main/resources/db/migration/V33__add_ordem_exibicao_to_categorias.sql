ALTER TABLE categorias
    ADD COLUMN ordem_exibicao INTEGER NOT NULL DEFAULT 0;

WITH categorias_ordenadas AS (
    SELECT id,
           ROW_NUMBER() OVER (ORDER BY nome, id) AS ordem
    FROM categorias
)
UPDATE categorias categoria
SET ordem_exibicao = categorias_ordenadas.ordem
FROM categorias_ordenadas
WHERE categoria.id = categorias_ordenadas.id;
