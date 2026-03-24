# Importacao de questoes teoricas

Fluxo sugerido:

1. Extrair as questoes do build atual da origem
2. Opcionalmente consolidar varias rotas do mesmo site
3. Criar snapshots e catalogo unico ao longo do tempo
4. Espelhar as imagens para o storage da plataforma
5. Rodar a importacao em lote em `dry-run`
6. Rodar a importacao real

## 1. Extrair

```bash
node tools/simulado/extract-aprovadetran.mjs
```

Saida padrao:

```text
tools/simulado/output/aprovadetran-questoes.json
```

## 2. Espelhar imagens

## Extra: consolidar varias rotas

```bash
node tools/simulado/extract-aprovadetran-batch.mjs
```

Saida padrao:

```text
tools/simulado/output/aprovadetran-batch.json
```

Esse arquivo tenta varrer a rota gratuita, a rota principal de simulado e as rotas estaduais, deduplicando por fingerprint.

## Extra: criar snapshots ao longo do tempo

```bash
node tools/simulado/capture-aprovadetran-snapshot.mjs
```

Saidas:

```text
tools/simulado/archive/aprovadetran-YYYYMMDD-HHMMSS.json
tools/simulado/output/aprovadetran-catalog.json
```

Use esse script para rodar periodicamente. Ele arquiva cada coleta e atualiza um catalogo unico sem duplicatas.

## 4. Espelhar imagens

```bash
node tools/simulado/mirror-questao-images.mjs --base-url http://localhost:8080 --email admin@exemplo.com --senha SUA_SENHA
```

Saida padrao:

```text
tools/simulado/output/aprovadetran-questoes-mirrored.json
```

## 5. Validar importacao

```bash
node tools/simulado/import-questoes-lote.mjs --input tools/simulado/output/aprovadetran-questoes-mirrored.json --base-url http://localhost:8080 --email admin@exemplo.com --senha SUA_SENHA --dry-run
```

## 6. Importar

```bash
node tools/simulado/import-questoes-lote.mjs --input tools/simulado/output/aprovadetran-questoes-mirrored.json --base-url http://localhost:8080 --email admin@exemplo.com --senha SUA_SENHA
```

## Observacoes

- O importador grava tudo como `RASCUNHO`, a menos que o JSON diga o contrario.
- A deduplicacao usa:
  - `origem + origemQuestaoId`
  - `fingerprint`
- Use `--atualizar` se quiser sobrescrever questoes que ja existam.

## Base propria oficial

Para montar uma base propria de questoes teoricas a partir de material oficial, use:

- [matriz-editorial-300-questoes.csv](./matriz-editorial-300-questoes.csv)

Esse CSV ja vem com:

- distribuicao fechada de `300` questoes
- lotes por `tema` e `subtema`
- divisao por `facil`, `media` e `dificil`
- `tipo_principal` e `tipo_secundario`
- `referencia_oficial` e `link_fonte`
- colunas operacionais para preenchimento editorial:
  - `status_lote`
  - `responsavel`
  - `fonte_exata`
  - `revisado`
  - `publicado`

Fluxo editorial sugerido:

1. Preencher `responsavel`, `fonte_exata` e `status_lote`
2. Produzir as questoes de cada linha como lote
3. Revisar ambiguidade, gabarito e distratores
4. Importar tudo como `RASCUNHO`
5. Publicar por tema ou subtema

### Gerar template de lote

```bash
node tools/simulado/generate-lote-template.mjs --tema PLACAS --subtema "Hierarquia da sinalizacao e prevalencia entre sinais"
```

Saida:

```text
tools/simulado/lotes/placas-hierarquia-da-sinalizacao-e-prevalencia-entre-sinais-template.json
```

### Primeiro lote autoral

Ja deixei um primeiro lote escrito em:

- [lote-001-placas-hierarquia-sinalizacao.json](./lotes/lote-001-placas-hierarquia-sinalizacao.json)

Ele segue o formato do importador em lote e pode ser usado como modelo para os proximos lotes.

### Consolidar todos os lotes autorais em um arquivo unico

```bash
node tools/simulado/build-import-from-lotes.mjs
```

Saida padrao:

```text
tools/simulado/output/base-propria-oficial-300-questoes.json
```

Esse arquivo ja sai no formato aceito pelo importador em lote, com:

- `meta` de consolidacao
- `questoes` achatadas em um unico array
- validacao de:
  - quantidade por lote
  - campos obrigatorios
  - 4 alternativas por questao
  - apenas 1 alternativa correta
  - `origemQuestaoId` unico
  - `fingerprint` unico
