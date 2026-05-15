# Figurinhas

Miniapp separado para publicar colecoes de figurinhas em `percursoaprovado.com.br/figurinhas`.

## Stack

- Frontend: React + Vite
- Backend: FastAPI + SQLite
- Processamento de PDF: PyMuPDF + Pillow
- Exportacao: ReportLab

## Estrutura

```text
apps/figurinhas/
  backend/
  frontend/
  storage/
  docker-compose.figurinhas.yml
```

## Fluxo

1. O admin cria uma colecao.
2. Faz upload do PDF original.
3. O backend renderiza as paginas em PNG.
4. O admin desenha os recortes de cada figurinha.
5. O sistema gera os crops.
6. A colecao e publicada.
7. O usuario seleciona jogadores e gera um PDF final.

## Ambiente local

Backend:

```bash
cd apps/figurinhas/backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8091
```

Frontend:

```bash
cd apps/figurinhas/frontend
npm install
npm run dev
```

## Docker local

```bash
cd apps/figurinhas
cp .env.example .env
docker compose --env-file .env -f docker-compose.figurinhas.yml up -d --build
```

## Rotas previstas na VPS

- `https://percursoaprovado.com.br/figurinhas`
- `https://percursoaprovado.com.br/figurinhas/api/...`

O snippet de Nginx para encaixar isso no dominio principal esta em:

- `deploy/hostinger/percursoaprovado-figurinhas.snippet.conf`

