# Plano de Evolucao - Produto por Local de Prova

## Objetivo

Transformar a plataforma atual em um produto com acesso por `local de prova`, onde o aluno:

- escolhe o local onde fara a prova pratica
- compra um plano com duracao limitada
- acessa somente os conteudos daquele local
- recebe tambem os modulos gerais de apoio enquanto tiver uma assinatura ativa

Exemplos de locais:

- Vila Palmeira
- Cohatrac
- Maiobao
- Sao Jose de Ribamar
- Raposa

## Como isso encaixa no projeto atual

Hoje o projeto ja tem uma base boa:

- `usuarios`
- `categorias`
- `percursos`
- `progresso_aluno`
- area do aluno
- area admin

A melhor evolucao incremental e:

- manter `percursos` como tabela principal de conteudo em video
- adicionar `local_prova_id` para vincular conteudos especificos a um local
- criar `locais_prova`, `planos` e `assinaturas`
- filtrar o acesso pelo plano ativo do aluno

Arquivos atuais que serao o ponto de partida:

- [Percurso.java](/c:/temp/edu-percurso-completo/edu-percurso-backend/src/main/java/com/edupercurso/entity/Percurso.java)
- [PercursoService.java](/c:/temp/edu-percurso-completo/edu-percurso-backend/src/main/java/com/edupercurso/service/PercursoService.java)
- [PercursoController.java](/c:/temp/edu-percurso-completo/edu-percurso-backend/src/main/java/com/edupercurso/controller/PercursoController.java)
- [Percursos.jsx](/c:/temp/edu-percurso-completo/edu-percurso-frontend/src/pages/Percursos.jsx)
- [AdminDashboard.jsx](/c:/temp/edu-percurso-completo/edu-percurso-frontend/src/pages/AdminDashboard.jsx)

## Modelo de negocio

Cada compra pertence a um local de prova.

Exemplo:

- `Cohatrac - 1 mes`
- `Cohatrac - 3 meses`
- `Raposa - 6 meses`
- `Vila Palmeira - 1 ano`

Regras:

- o aluno so acessa os conteudos do local comprado
- o acesso expira pela data final da assinatura
- o aluno pode comprar mais de um local ao longo do tempo
- conteudos gerais ficam liberados apenas para quem tiver pelo menos uma assinatura ativa

## Estrutura de dados recomendada

### 1. Nova tabela `locais_prova`

Representa o local oficial do DETRAN onde a prova e aplicada.

Campos sugeridos:

- `id`
- `nome`
- `slug`
- `descricao`
- `cidade`
- `ativo`
- `ordem_exibicao`
- `criado_em`

### 2. Nova tabela `planos`

Representa os planos comercializados para cada local.

Campos sugeridos:

- `id`
- `local_prova_id`
- `nome`
- `duracao_dias`
- `preco_centavos`
- `ativo`
- `criado_em`

Sugestao de nomes:

- `Plano 1 mes`
- `Plano 3 meses`
- `Plano 6 meses`
- `Plano 1 ano`

### 3. Nova tabela `assinaturas`

Representa o que o aluno comprou e ate quando ele tem acesso.

Campos sugeridos:

- `id`
- `usuario_id`
- `plano_id`
- `local_prova_id`
- `inicio_em`
- `fim_em`
- `status`
- `payment_status`
- `criado_em`

Valores sugeridos:

- `status`: `ATIVA`, `EXPIRADA`, `CANCELADA`
- `payment_status`: `PENDENTE`, `PAGO`, `FALHOU`, `REEMBOLSADO`

### 4. Evolucao da tabela `percursos`

Ela pode continuar existindo, mas passa a representar conteudo em geral.

Novos campos sugeridos:

- `local_prova_id` nullable
- `tipo_conteudo`
- `resumo`
- `thumbnail_url`
- `ordem_exibicao`
- `destaque`

Uso:

- `local_prova_id != null`: conteudo especifico daquele local
- `local_prova_id = null`: conteudo geral

Valores sugeridos para `tipo_conteudo`:

- `PERCURSO_REAL`
- `SIMULACAO_COMPLETA`
- `ERROS_REPROVACAO`
- `BALIZA`
- `CONTROLE_EMBREAGEM`
- `EXAMINADOR`

## SQL sugerido para a primeira migracao funcional

```sql
CREATE TABLE locais_prova (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(120) NOT NULL UNIQUE,
    slug VARCHAR(140) NOT NULL UNIQUE,
    descricao TEXT,
    cidade VARCHAR(120) NOT NULL DEFAULT 'Sao Luis',
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    ordem_exibicao INTEGER NOT NULL DEFAULT 0,
    criado_em TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE planos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    local_prova_id UUID NOT NULL REFERENCES locais_prova(id) ON DELETE CASCADE,
    nome VARCHAR(120) NOT NULL,
    duracao_dias INTEGER NOT NULL,
    preco_centavos INTEGER NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE assinaturas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    plano_id UUID NOT NULL REFERENCES planos(id) ON DELETE RESTRICT,
    local_prova_id UUID NOT NULL REFERENCES locais_prova(id) ON DELETE RESTRICT,
    inicio_em TIMESTAMP NOT NULL,
    fim_em TIMESTAMP NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('ATIVA', 'EXPIRADA', 'CANCELADA')),
    payment_status VARCHAR(20) NOT NULL CHECK (payment_status IN ('PENDENTE', 'PAGO', 'FALHOU', 'REEMBOLSADO')),
    criado_em TIMESTAMP NOT NULL DEFAULT now()
);

ALTER TABLE percursos
    ADD COLUMN local_prova_id UUID REFERENCES locais_prova(id) ON DELETE SET NULL,
    ADD COLUMN tipo_conteudo VARCHAR(40) NOT NULL DEFAULT 'PERCURSO_REAL',
    ADD COLUMN resumo TEXT,
    ADD COLUMN thumbnail_url VARCHAR(500),
    ADD COLUMN ordem_exibicao INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN destaque BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX idx_percursos_local_prova ON percursos(local_prova_id);
CREATE INDEX idx_planos_local_prova ON planos(local_prova_id);
CREATE INDEX idx_assinaturas_usuario ON assinaturas(usuario_id);
CREATE INDEX idx_assinaturas_local_prova ON assinaturas(local_prova_id);
```

## Seed inicial recomendado

Sugestao de dados iniciais:

- locais:
  - Vila Palmeira
  - Cohatrac
  - Maiobao
  - Sao Jose de Ribamar
  - Raposa
- planos para cada local:
  - 30 dias
  - 90 dias
  - 180 dias
  - 365 dias

Conteudos gerais:

- Como fazer baliza
- Como controlar a embreagem
- O que o examinador observa
- Erros que mais reprovam

Conteudos por local:

- percurso real do local
- simulacao completa da prova
- erros comuns naquele trajeto

## Regras de acesso no backend

### Admin

- acessa tudo

### Aluno

- pode acessar conteudo de um local apenas se tiver assinatura ativa para aquele local
- pode acessar conteudo geral apenas se tiver pelo menos uma assinatura ativa

### Logica recomendada

Adicionar um servico dedicado, por exemplo:

- `AssinaturaService`
- `AcessoConteudoService`

Metodos esperados:

- `boolean possuiAssinaturaAtiva(UUID usuarioId, UUID localProvaId)`
- `boolean possuiQualquerAssinaturaAtiva(UUID usuarioId)`
- `void validarAcessoAoConteudo(UUID usuarioId, Percurso percurso)`

## Evolucao dos endpoints

### Manter e adaptar

#### `GET /percursos`

Hoje lista todos os conteudos ativos para o aluno.

Sugestao de evolucao:

- aceitar filtros como `localSlug`, `tipo`, `geral`
- retornar apenas o que o aluno tem direito de ver

Exemplos:

- `GET /percursos?localSlug=cohatrac`
- `GET /percursos?tipo=SIMULACAO_COMPLETA`
- `GET /percursos?geral=true`

#### `GET /percursos/{id}`

- validar se o usuario logado tem acesso ao conteudo antes de retornar

#### `POST /percursos`

- admin cria conteudo e escolhe:
  - categoria
  - tipo de conteudo
  - local de prova opcional
  - ordem de exibicao

### Novos endpoints recomendados

#### Locais de prova

- `GET /locais-prova`
- `GET /locais-prova/{slug}`
- `POST /locais-prova`
- `PUT /locais-prova/{id}`
- `DELETE /locais-prova/{id}`

#### Planos

- `GET /planos?localSlug=cohatrac`
- `POST /planos`
- `PUT /planos/{id}`
- `DELETE /planos/{id}`

#### Assinaturas

- `GET /assinaturas/minhas`
- `POST /assinaturas`
- `POST /assinaturas/{id}/ativar`
- `POST /assinaturas/{id}/cancelar`

Obs.: no comeco, `POST /assinaturas` pode ser manual, sem gateway. Depois pode ser integrado com checkout.

## DTOs e entidades novas

No backend, a primeira leva de classes novas deve ser:

- `LocalProva`
- `Plano`
- `Assinatura`
- `LocalProvaRepository`
- `PlanoRepository`
- `AssinaturaRepository`
- `LocalProvaController`
- `PlanoController`
- `AssinaturaController`
- `AssinaturaService`

Evolucoes nos DTOs atuais:

- `PercursoDTO.Request`
- `PercursoDTO.Response`

Novos campos no `PercursoDTO`:

- `localProvaId`
- `localProvaNome`
- `tipoConteudo`
- `resumo`
- `thumbnailUrl`
- `ordemExibicao`
- `destaque`

## Navegacao recomendada no frontend

### Publico

- `/`
  - landing page
  - explicacao do produto
  - escolha do local de prova
- `/locais`
  - lista dos locais
- `/locais/:slug`
  - detalhes do local
  - o que esta incluido
  - planos disponiveis

### Aluno autenticado

- `/meus-acessos`
  - locais ativos
  - data de expiracao
- `/biblioteca`
  - resumo da conta
  - atalhos para locais comprados
  - modulos gerais
- `/biblioteca/:localSlug`
  - conteudos do local especifico
- `/conteudos/:id`
  - player do video
  - pontos de atencao
  - erros comuns
  - progresso

### Admin

- `/admin`
  - indicadores gerais
- `/admin/locais`
  - CRUD dos locais
- `/admin/planos`
  - CRUD dos planos
- `/admin/conteudos`
  - CRUD dos conteudos
- `/admin/assinaturas`
  - ativacao manual
  - consulta de acessos

## Como reaproveitar as telas atuais

### [Percursos.jsx](/c:/temp/edu-percurso-completo/edu-percurso-frontend/src/pages/Percursos.jsx)

Pode virar `Biblioteca.jsx` e passar a exibir:

- modulos gerais
- cards por local comprado
- filtros por tipo de conteudo

### Player atual

Pode continuar existindo, mas deve exibir:

- nome do local
- tipo de conteudo
- prazo do acesso
- resumo do que observar

### [AdminDashboard.jsx](/c:/temp/edu-percurso-completo/edu-percurso-frontend/src/pages/AdminDashboard.jsx)

Pode ganhar novos indicadores:

- total de locais ativos
- total de planos
- assinaturas ativas
- conteudos por local

## Ordem recomendada de implementacao

### Fase 1 - Base de dados e backend

- criar `locais_prova`
- criar `planos`
- criar `assinaturas`
- evoluir `percursos`
- criar seed inicial
- proteger `GET /percursos` e `GET /percursos/{id}` por assinatura

### Fase 2 - Admin

- CRUD de locais
- CRUD de planos
- atualizar formulario de conteudo para escolher local e tipo

### Fase 3 - Aluno

- tela de escolha de local
- tela do local
- tela de meus acessos
- biblioteca separada por local e geral

### Fase 4 - Comercial

- checkout real
- cupom
- renovacao
- lembrete de expiracao

## Decisoes que valem a pena manter simples no inicio

- pagamento pode ser manual na primeira versao
- assinatura pode ser ativada pelo admin enquanto o checkout nao existe
- manter o nome tecnico `percursos` no backend por enquanto para reduzir refatoracao
- no frontend, o termo exibido para o usuario deve ser `conteudos` ou `modulos`

## Proximo passo recomendado

Se a implementacao comecar agora, a ordem mais segura e:

1. criar a migracao Flyway com `locais_prova`, `planos`, `assinaturas` e novos campos em `percursos`
2. criar entidades e repositories novos no backend
3. adaptar `PercursoService` para filtrar por assinatura ativa
4. criar a primeira tela publica de `locais de prova`
5. criar a tela `Meus acessos`

Esse caminho preserva o sistema atual e transforma o produto para o modelo comercial certo sem reescrever tudo.
