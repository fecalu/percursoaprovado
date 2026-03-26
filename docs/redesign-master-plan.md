# Redesign Master Plan

## Objetivo
Criar um fluxo de trabalho consistente para evoluir a `Percurso Aprovado` por etapas, sem perder contexto entre conversas, sessões ou deploys.

Este documento existe para responder sempre estas perguntas:
- Em que etapa estamos?
- O que entra agora?
- O que fica fora?
- Como sabemos que terminou?
- Qual é o último estado confiável do projeto?

## Visão do Produto
`Percurso Aprovado` é uma plataforma de preparação para a prova prática de direção, com foco em revisão por `local de prova`.

Ela não deve parecer:
- marketplace
- autoescola
- curso online genérico
- dashboard corporativo

Ela deve parecer:
- produto especializado
- confiável
- objetivo
- moderno
- premium
- claro
- útil para revisão prática

## Princípios de Execução
1. Trabalhar por etapas fechadas.
2. Não misturar redesign de várias áreas na mesma entrega.
3. Fechar decisões antes de expandir escopo.
4. Publicar somente o que estiver validado.
5. Fazer commit ao final de cada etapa aprovada.
6. Registrar sempre o estado da etapa antes de mudar de assunto.

## Regra de Ouro
Cada etapa só começa quando estas 3 coisas estiverem definidas:
- `O que entra`
- `O que não entra`
- `Critério de pronto`

## Estado Atual do Produto
Base funcional já existente:
- home pública
- página de local
- vitrine de planos
- checkout
- painel do aluno em `/painel`
- biblioteca
- player de percurso
- perfil em `/perfil`
- administrativo

Observação:
O produto já tem diversas melhorias implementadas, mas o redesign ainda precisa ser consolidado com mais clareza visual e menos poluição de informação.

## Etapas do Redesign

### Etapa 0. Fundação Visual
Objetivo:
- definir a linguagem visual oficial do produto

Entra:
- tipografia
- escala de títulos
- tokens de espaçamento
- estilo de cards
- estilo de botões
- linguagem de ícones
- regras de tema claro e escuro

Não entra:
- reestruturação de fluxo
- mudanças grandes de produto

Critério de pronto:
- base visual alinhada
- componentes recorrentes com padrão claro

### Etapa 1. Home Pública
Objetivo:
- comunicar valor rápido
- reduzir poluição visual
- levar o usuário a escolher o local

Entra:
- hero
- seleção de local
- seção curta do que existe no acesso
- como funciona
- FAQ
- CTA final

Não entra:
- redesign de checkout
- redesign de player
- lógica comercial nova

Critério de pronto:
- home clara no desktop e mobile
- ação principal bem evidente
- menos concorrência visual entre blocos

### Etapa 2. Página do Local e Vitrine de Planos
Objetivo:
- facilitar compreensão do local e escolha do plano

Entra:
- hero do local
- vitrine de planos
- comparação
- destaques comerciais
- organização da compra

Não entra:
- checkout completo
- painel do aluno

Critério de pronto:
- planos comparáveis
- local valorizado
- CTA de compra claro

### Etapa 3. Checkout
Objetivo:
- deixar a compra mais clara e mais confiável

Entra:
- revisão antes de pagar
- resumo da compra
- benefícios do plano
- segurança e confiança

Não entra:
- mudança na lógica de pagamento
- redesign do painel

Critério de pronto:
- resumo limpo
- sensação de segurança
- entendimento claro do que está sendo comprado

### Etapa 4. Painel do Aluno
Objetivo:
- criar uma tela inicial útil e objetiva

Entra:
- continuar estudando
- biblioteca
- meus acessos
- meus pagamentos
- estados principais da conta

Não entra:
- gamificação
- agenda
- métricas genéricas

Critério de pronto:
- painel útil como ponto de entrada
- fluxo claro para estudo e conta

### Etapa 5. Biblioteca
Objetivo:
- organizar o estudo de forma leve e escaneável

Entra:
- filtros
- categorias
- cards de conteúdo
- navegação mobile

Não entra:
- redesign do player

Critério de pronto:
- biblioteca clara
- conteúdo fácil de encontrar
- boa leitura em mobile

### Etapa 6. Player
Objetivo:
- transformar o player no centro mais forte do produto

Entra:
- hierarquia do vídeo
- timeline
- pontos de atenção
- explicações em texto, áudio e vídeo
- lista de aulas

Não entra:
- reestruturação comercial

Critério de pronto:
- vídeo protagonista
- pontos de atenção intuitivos
- experiência consistente desktop/mobile

### Etapa 7. Perfil do Aluno
Objetivo:
- central de conta simples e elegante

Entra:
- dados da conta
- segurança
- suporte
- atalhos úteis

Não entra:
- histórico extenso
- configurações complexas

Critério de pronto:
- tela enxuta
- conta e suporte bem resolvidos

### Etapa 8. Administrativo
Objetivo:
- tornar as telas operacionais mais claras e produtivas

Entra:
- admin de planos
- admin de percursos
- admin de pontos de atenção
- admins com maior uso diário

Não entra:
- dashboard analítico genérico sem valor operacional

Critério de pronto:
- uso forte em desktop
- menos fadiga visual
- formulários e fluxos mais previsíveis

## Ordem Recomendada
1. Fundação visual
2. Home
3. Local e planos
4. Checkout
5. Painel do aluno
6. Biblioteca
7. Player
8. Perfil
9. Admin

## Regras de Escopo por Etapa
Durante uma etapa:
- não abrir novas frentes sem necessidade
- não refazer telas fora do escopo
- não misturar redesign visual com refatoração profunda sem alinhamento

Se surgir uma ideia fora da etapa:
- registrar em backlog
- não executar na mesma rodada

## Backlog de Ideias
Usar esta seção para guardar ideias sem quebrar foco.

Formato:
- ideia
- tela afetada
- prioridade
- observação

## Critério de Encerramento de Etapa
Uma etapa só é considerada concluída quando:
- escopo da etapa foi implementado
- build passou
- validação mínima foi feita
- deploy foi concluído, se aplicável
- commit foi criado
- resumo da etapa foi registrado

## Template de Resumo de Etapa
Usar este formato ao encerrar qualquer etapa:

```md
### Etapa X - Nome
- Status: concluída
- Objetivo: ...
- Entrou: ...
- Não entrou: ...
- Arquivos principais: ...
- Validação: ...
- Deploy: sim/nao
- Commit: ...
- Pendências: ...
```

## Template de Retomada em Nova Conversa
Quando retomarmos o projeto em outro chat, usar algo assim:

```md
Estamos na etapa X: Nome da etapa.

Ultimo commit confiavel:
- abc123

Objetivo agora:
- ...

Nao mexer em:
- ...

Arquivos principais desta etapa:
- ...

Pendencias abertas:
- ...
```

## Decisões Já Fechadas
Ver também:
- [redesign-decisions.md](/c:/temp/edu-percurso-completo/docs/redesign-decisions.md)

## Observação Final
Este documento deve ser tratado como a referência principal do redesign.

Se uma decisão mudar, atualizar primeiro a documentação e só depois executar a implementação.
