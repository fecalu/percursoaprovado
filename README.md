# EduPercurso — Projeto Completo

Plataforma de estudo por vídeo para preparação na prova prática de habilitação.

Stack: **Java 17 + Spring Boot 3 · React 18 + Vite · PostgreSQL 16 · Docker**

---

## Como rodar (um único comando)

### Pré-requisito
Ter o **Docker Desktop** instalado e aberto.
→ https://www.docker.com/products/docker-desktop/

### Passos

```bash
# 1. Entre na pasta do projeto
cd edu-percurso-completo

# 2. Suba tudo
docker compose up --build
```

Aguarde o build (primeira vez demora ~3 min). Quando aparecer:

```
edu_backend  | Started EduPercursoApplication
```

Acesse: **http://localhost**

---

## Credenciais padrão

| Perfil | E-mail                  | Senha    |
|--------|-------------------------|----------|
| Admin  | admin@edupercurso.com   | admin123 |
| Aluno  | crie uma conta nova     | —        |

---

## O que está rodando

| Container      | O que faz                          | Porta interna |
|----------------|------------------------------------|---------------|
| `edu_db`       | PostgreSQL com as tabelas criadas  | 5432          |
| `edu_backend`  | API REST Spring Boot               | 8080          |
| `edu_frontend` | React servido pelo Nginx           | 80 → localhost|

O banco é criado e populado automaticamente pelo Flyway na primeira vez.

---

## Parar / reiniciar

```bash
# Parar (mantém os dados do banco)
docker compose down

# Reiniciar sem rebuild
docker compose up

# Rebuild após mudança de código
docker compose up --build

# Apagar tudo incluindo banco (dados zerados)
docker compose down -v
```

---

## Estrutura do projeto

```
edu-percurso-completo/
├── edu-percurso-backend/      Java 17 + Spring Boot 3
│   ├── pom.xml
│   └── src/
├── edu-percurso-frontend/     React 18 + Vite
│   ├── package.json
│   └── src/
├── nginx/
│   └── nginx.conf             proxy /api → backend
├── Dockerfile.backend
├── Dockerfile.frontend
├── docker-compose.yml
├── .env                       senhas (não commitar)
└── .env.example
```
