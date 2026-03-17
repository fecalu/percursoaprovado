INSERT INTO usuarios (nome, email, senha_hash, role)
VALUES (
    'Administrador',
    'admin@edupercurso.com',
    '$2b$10$OZwGEG.650szM.vHg9xhdegPY9gyMvbZB/T/hxS0m7FSCrw9cviqy',
    'ADMIN'
)
ON CONFLICT (email) DO UPDATE
SET nome = EXCLUDED.nome,
    senha_hash = EXCLUDED.senha_hash,
    role = EXCLUDED.role;
