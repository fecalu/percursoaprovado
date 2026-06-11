# Duvidas por Trecho

## Objetivo

Definir a funcionalidade de `duvidas por trecho` para o player de percursos, com foco em:

- ajudar o aluno a perguntar no ponto exato em que travou
- reduzir repeticao de duvidas
- permitir resposta publica e reutilizavel
- transformar duvidas recorrentes em melhoria de conteudo

Este documento e uma especificacao funcional de produto. Nao e uma especificacao tecnica fechada.

---

## Problema que queremos resolver

Hoje o sistema possui:

- player com video como protagonista
- tempo atual do video
- timeline com marcadores
- pontos de atencao oficiais do percurso
- progresso por segundos assistidos

Mas hoje nao existe um canal contextual para o aluno perguntar:

- "nesse ponto eu devo virar o volante assim?"
- "nesse minuto ele reduz para primeira ou segunda?"
- "aqui isso reprova mesmo?"

Quando a duvida aparece, ela tende a ficar:

- dispersa fora da plataforma
- repetida por varios alunos
- sem memoria publica reaproveitavel

---

## Nome da funcionalidade

Nome recomendado no produto:

- `Duvidas por trecho`

Evitar:

- comentarios
- forum
- comunidade

Motivo:

- o foco deve continuar sendo aprendizado contextual
- o aluno precisa sentir que esta perguntando sobre um trecho do percurso, nao abrindo conversa generica

---

## Visao de produto

Cada duvida pertence a:

- um `percurso`
- um `trecho do video`
- um `autor`
- um estado de moderacao

Cada duvida pode receber:

- apoios de outros alunos (`tambem tive essa duvida`)
- resposta oficial do admin/professor
- acao de moderacao

O resultado esperado e:

- alunos encontram duvidas existentes antes de criar novas
- o professor responde uma vez e ajuda muitos
- o acervo de duvidas vira base de conhecimento do percurso

---

## Principios da funcionalidade

### 1. O video continua no centro

As duvidas devem apoiar o player, nao competir com ele.

### 2. Contexto importa mais que volume

A funcionalidade deve girar em torno de:

- onde no video a duvida aconteceu
- qual era a duvida
- qual e a resposta oficial

### 3. Reaproveitamento e mais importante que conversa livre

O objetivo nao e criar rede social.

O objetivo e criar:

- memoria de duvidas
- respostas reaproveitaveis
- reducao de atrito para proximos alunos

### 4. Moderacao e obrigatoria

Perguntas nao devem virar publicas sem algum controle.

### 5. Recorrencia deve melhorar o produto

Uma duvida muito frequente pode virar:

- resposta destacada
- FAQ do percurso
- novo ponto de atencao oficial

---

## Onde a funcionalidade vive

Lugar principal:

- dentro do `Player`

Posicionamento recomendado:

- uma aba ou painel lateral ao lado de `Pontos de atencao`

Estrutura sugerida:

- `Pontos de atencao`
- `Duvidas`

Motivo:

- o aluno ja esta consumindo conteudo contextual ali
- o tempo do video ja esta disponivel
- a relacao entre trecho e duvida fica clara

---

## Experiencia do aluno

## Fluxo principal

1. O aluno esta assistindo um percurso.
2. Ele pausa em um ponto especifico do video.
3. Clica em `Tive uma duvida aqui`.
4. O sistema captura o tempo atual automaticamente.
5. O sistema mostra duvidas proximas daquele trecho.
6. O aluno escolhe:
   - abrir uma duvida existente
   - marcar `tambem tive essa duvida`
   - criar nova duvida

## Informacoes mostradas ao criar

- trecho do video em `mm:ss`
- titulo curto da duvida
- descricao opcional
- aviso sobre publicacao e moderacao

## Exemplo de interface

- Botao: `Tive uma duvida aqui`
- Texto de contexto: `Trecho selecionado: 02:14`
- Bloco: `Ja existem duvidas neste trecho`
- Acoes:
  - `Ver duvidas`
  - `Tambem tive essa duvida`
  - `Criar nova`

---

## Como a lista de duvidas deve aparecer

Nao usar uma lista cronologica solta no estilo rede social.

Forma recomendada:

- agrupamento por trecho do video
- prioridade para duvidas com mais apoio
- destaque visual para resposta oficial

Cada item de duvida deve mostrar:

- tempo do video
- titulo da duvida
- resumo da pergunta
- quantidade de alunos com a mesma duvida
- status da resposta

Quando expandir:

- pergunta completa
- resposta oficial, se existir
- data
- autor abreviado

---

## Regras de visibilidade

## Para criar

O aluno so pode criar duvida se:

- estiver logado
- tiver acesso ativo ao conteudo
- estiver dentro de um percurso liberado

## Para visualizar

O aluno pode ver:

- duvidas publicadas daquele percurso
- respostas oficiais publicadas

O aluno nao ve:

- duvidas ocultas
- conteudo pendente de moderacao de outros usuarios

---

## Papel do admin/professor

No estado atual do produto, a operacao deve usar o papel de `ADMIN`.

No futuro, se existir papel proprio de professor, a experiencia pode ser separada.

Acoes do admin:

- responder duvida
- publicar
- ocultar
- editar resposta
- marcar como resolvida
- fundir duvidas parecidas
- transformar em ponto de atencao oficial

---

## Moderacao

Moderacao recomendada para MVP:

- toda nova duvida entra como `pendente`
- o admin revisa antes de deixar publica

Isso ajuda a evitar:

- spam
- pergunta repetida mal escrita
- ofensividade
- conteudo fora de contexto
- poluicao visual no percurso

Se no futuro o volume justificar, pode existir:

- publicacao automatica com revisao posterior

Mas isso nao e recomendado para a primeira versao.

---

## Status sugeridos

- `PENDENTE_MODERACAO`
- `PUBLICADA`
- `RESPONDIDA`
- `RESOLVIDA`
- `OCULTA`
- `FUNDIDA`

### Significado dos status

`PENDENTE_MODERACAO`

- enviada por aluno
- ainda nao publica

`PUBLICADA`

- visivel para todos com acesso ao percurso
- ainda sem resposta oficial

`RESPONDIDA`

- visivel
- com resposta oficial

`RESOLVIDA`

- resposta consolidada
- util como referencia futura

`OCULTA`

- removida da visibilidade publica

`FUNDIDA`

- absorvida por outra duvida principal

---

## Apoio de outros alunos

Em vez de abrir discussao infinita, o melhor sinal de relevancia inicial e:

- `Tambem tive essa duvida`

Isso e melhor que:

- likes genericos
- respostas aninhadas sem fim

Uso pratico:

- ajuda o admin a priorizar
- ajuda a detectar trechos confusos
- ajuda a decidir se vale virar ponto oficial

---

## Agrupamento por trecho

Essa regra e muito importante.

Se varios alunos perguntarem em tempos muito proximos, o sistema deve tratar como proximidade de contexto.

Regra recomendada:

- considerar uma janela de `10 a 15 segundos`

Exemplo:

- 02:13
- 02:14
- 02:18

Essas duvidas podem aparecer como relacionadas ao mesmo trecho.

O objetivo nao e prender a duvida a um segundo exato, e sim ao momento do percurso.

---

## Timeline do player

Nao mostrar marcador para toda duvida individual.

Isso poluiria a timeline e atrapalharia a leitura dos `pontos de atencao`.

Direcao recomendada:

- `pontos de atencao oficiais` continuam com protagonismo visual
- `duvidas por trecho` podem aparecer de forma discreta
- idealmente apenas quando o trecho tiver relevancia real

Exemplos de criterio para aparecer na timeline:

- duvida publicada e respondida
- trecho com alta recorrencia
- trecho marcado pelo admin como importante

---

## Relacao com pontos de atencao

Essa funcionalidade nao substitui pontos de atencao.

Os dois conceitos sao diferentes:

`Ponto de atencao`

- criado pelo time
- conteudo oficial
- orientacao planejada

`Duvida por trecho`

- nasce do aluno
- reflete atrito real
- pode ou nao virar conteudo oficial

Melhor conexao entre os dois:

- admin deve poder transformar duvida recorrente em novo ponto de atencao

Isso cria um ciclo de melhoria continua do percurso.

---

## Regras para manter utilidade

### O que deve existir

- pergunta contextual
- resposta oficial
- apoio de outros alunos
- moderacao
- agrupamento por trecho

### O que nao deve existir no MVP

- chat em tempo real
- comentarios em arvore profunda
- discussao infinita aluno x aluno
- timeline lotada de marcadores
- mural aberto sem controle

---

## MVP recomendado

Escopo da primeira versao:

- criar duvida a partir do tempo atual do player
- salvar duvida vinculada ao percurso e ao timestamp
- listar duvidas publicadas por percurso
- mostrar resposta oficial
- permitir `tambem tive essa duvida`
- moderar no admin
- agrupar por trecho aproximado

Isso ja entrega valor real sem inflar o escopo.

---

## Fase 2 sugerida

Depois do MVP, evolucoes naturais:

- notificacao para o aluno quando a duvida for respondida
- busca por duvida dentro do percurso
- filtro por `sem resposta`, `respondidas`, `mais recorrentes`
- acao de `transformar em ponto de atencao`
- painel com analytics de trechos mais confusos
- FAQ automatica do percurso

---

## Estrutura funcional sugerida

## Entidade principal: duvida

Campos de negocio sugeridos:

- `id`
- `percursoId`
- `usuarioId`
- `timestampSegundos`
- `titulo`
- `descricao`
- `status`
- `quantidadeApoios`
- `duvidaPrincipalId` quando houver fusao
- `publicadaEm`
- `criadaEm`
- `atualizadaEm`

## Resposta oficial

Campos sugeridos:

- `id`
- `duvidaId`
- `autorAdminId`
- `texto`
- `criadaEm`
- `atualizadaEm`

## Apoio

Campos sugeridos:

- `id`
- `duvidaId`
- `usuarioId`
- `criadoEm`

---

## Telas envolvidas

## Aluno

- Player: aba `Duvidas`
- Modal ou painel de criacao da duvida
- Lista de duvidas do percurso
- Estado vazio: `ainda nao ha duvidas neste trecho`

## Admin

- Lista de duvidas por percurso
- Filtro por status
- Filtro por local
- Filtro por percurso
- Tela de resposta e moderacao
- Acao de fundir
- Acao de transformar em ponto de atencao

---

## Criterios de sucesso

A funcionalidade sera util se gerar:

- menos repeticao de perguntas fora da plataforma
- mais clareza para o aluno em trechos confusos
- respostas reaproveitadas por mais alunos
- feedback claro sobre quais trechos geram duvida

Indicadores iniciais bons:

- quantidade de duvidas respondidas
- quantidade de apoios por duvida
- tempo medio de resposta
- trechos com maior recorrencia
- quantidade de duvidas transformadas em ponto oficial

---

## Decisao recomendada

Direcao recomendada para seguir:

- nome do recurso: `Duvidas por trecho`
- lugar principal: `Player`
- moderacao obrigatoria no MVP
- resposta oficial como elemento central
- agrupamento por proximidade de tempo
- relacao futura com `pontos de atencao`

Essa e a versao mais coerente com o produto atual e a mais util para os alunos.
