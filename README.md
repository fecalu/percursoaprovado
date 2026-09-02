# Percurso Aprovado

Monorepo com duas aplicações:

- `edu-percurso`: plataforma de estudos para preparação da prova prática de habilitação.
- `figurinhas`: ferramenta web para montar seleções de figurinhas e gerar PDFs de impressão.

## Stack

- Backend principal: Java 17 + Spring Boot 3
- Frontend principal: React + Vite
- Banco principal: PostgreSQL 16
- App Figurinhas: FastAPI + SQLite + React + Vite
- Infra local: Docker e Docker Compose

## Como Rodar Localmente

Pré-requisito: Docker Desktop instalado e aberto.

```bash
docker compose up --build
```

Depois do build, acesse:

```text
http://localhost
```

## Configuração

Este projeto usa variáveis de ambiente. Arquivos reais como `.env`, `.env.hostinger` e bancos locais não devem ser commitados.

Use os arquivos de exemplo como base:

```text
.env.example
.env.hostinger.example
.env.hostinger.homolog.example
apps/figurinhas/.env.example
```

Nunca publique senhas, tokens, chaves de API, dumps de banco, backups ou arquivos gerados em produção.

## Estrutura

```text
.
├── edu-percurso-backend/
├── edu-percurso-frontend/
├── apps/
│   └── figurinhas/
├── deploy/
├── docs/
├── docker-compose.yml
└── README.md
```

## Observação Sobre Conteúdo

O código deste repositório é voltado à implementação técnica da plataforma. Arquivos gerados por usuários, bancos locais, PDFs, imagens de coleções e backups devem permanecer fora do Git.
