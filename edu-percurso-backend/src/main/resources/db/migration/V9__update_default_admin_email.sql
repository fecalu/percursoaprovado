UPDATE usuarios
SET email = 'suporte@percursoaprovado.com.br'
WHERE email = 'admin@edupercurso.com'
  AND role = 'ADMIN'
  AND NOT EXISTS (
      SELECT 1
      FROM usuarios
      WHERE email = 'suporte@percursoaprovado.com.br'
  );
