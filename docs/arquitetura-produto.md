# Arquitetura de Produto - Evolucao da Plataforma

## Objetivo deste documento

Este documento registra a visao arquitetural e de produto para a evolucao da plataforma Percurso Aprovado.

O objetivo e evitar perda de contexto nas proximas conversas, mantendo em um so lugar:

- o que a plataforma e hoje
- quais problemas o modelo atual nao resolve mais
- qual arquitetura e recomendada para o proximo ciclo
- como separar experiencia do aluno, regra de acesso e estrutura comercial
- quais fases fazem sentido executar
- como preparar a base para expansao futura, incluindo Moto

Este documento nao e uma especificacao tecnica fechada. Ele funciona como base de alinhamento entre produto, UX, negocio e implementacao.

---

## Visao geral do produto

A plataforma e um produto de ensino para aprovacao em provas praticas do DETRAN, com foco em:

- percursos reais de locais de prova
- revisao orientada para aprovacao
- preparacao emocional e pratica do aluno
- conteudo geral e conteudo especifico por local

Hoje a plataforma ja possui:

- autenticacao e area logada do aluno
- painel do aluno
- biblioteca de conteudos
- player com pontos de atencao
- progresso de consumo
- simulados teoricos
- planos, pedidos, assinaturas e cancelamentos
- administracao de aulas, modulos, locais, planos e usuarios

O produto ja e bom como biblioteca organizada de conteudo, mas a proxima evolucao desejada e transforma-lo em uma jornada guiada ate a aprovacao.

---

## Visao de produto desejada

A plataforma deve atender dois comportamentos diferentes do aluno:

1. O aluno que quer seguir uma ordem clara e nao sabe por onde comecar
2. O aluno que quer encontrar rapidamente um tema especifico

Na pratica, a plataforma ideal deve oferecer ao mesmo tempo:

- uma trilha guiada, para quem quer comecar do zero ou seguir um caminho recomendado
- uma navegacao visual por modulos, para quem quer achar rapido o que precisa

O produto tambem precisa comecar a suportar dois perfis comerciais diferentes:

- aluno que esta comecando do zero
- aluno que ja passou pelo DETRAN e quer focar na reta final

E, no futuro, uma nova linha de produto:

- Moto

---

## Problema principal do modelo atual

Hoje a regra de acesso do produto esta muito amarrada ao local de prova.

### Como funciona hoje

- O plano esta vinculado a um local de prova
- A assinatura libera aquele local
- Conteudo geral entra para qualquer aluno com alguma assinatura ativa
- Conteudo especifico entra para quem tem assinatura ativa daquele local

Isso e suficiente para:

- vender acesso por local
- liberar conteudo geral
- liberar conteudo especifico por local

Mas isso nao e suficiente para:

- vender jornadas diferentes para tipos diferentes de aluno
- permitir plano do zero e plano direto para prova
- organizar o produto por etapas da jornada do aluno
- separar melhor regra de acesso de organizacao visual
- escalar para Moto sem remendar a base

Em outras palavras:

- hoje o local faz papel demais
- e o produto precisa de uma camada a mais de inteligencia

---

## Principio central da arquitetura recomendada

O crescimento da plataforma depende de separar claramente estas camadas:

### 1. Modulo visual

E a forma como o aluno enxerga e navega pelo conteudo.

Exemplos:

- Primeiros passos
- Documentos e taxas
- Curso teorico
- Aulas praticas
- Percursos
- Pegadinhas
- Revisao final
- Dia da prova

Funcao:

- organizacao visual
- descoberta de conteudo
- navegacao rapida

Modulo visual nao deve ser a regra de acesso.

### 2. Grupo de acesso

E a regra de negocio que define o que um plano libera.

Exemplos iniciais recomendados:

- `primeiros_passos`
- `documentos_taxas`
- `curso_teorico`
- `pratica_geral`
- `percursos_local`
- `pegadinhas_local`
- `revisao_final`
- `dia_da_prova`

Funcao:

- controlar acesso por plano
- permitir produtos diferentes para tipos diferentes de aluno
- preparar a base para expansao futura

Grupo de acesso nao deve ser o nome do card visto pelo aluno.

### 3. Trilha

E a ordem recomendada de estudo.

Funcao:

- orientar o aluno
- transformar conteudo em jornada
- apoiar o perfil "quero comecar do zero"

Trilha nao define sozinha o acesso. Ela organiza o que faz sentido ver primeiro.

### 4. Plano

E o produto comercial.

Funcao:

- definir preco, duracao e oferta
- liberar grupos de acesso
- apontar para uma trilha principal
- opcionalmente amarrar um local

### 5. Local

Continua importante, mas com papel mais especifico.

Funcao:

- contexto geografico e operacional do percurso
- filtro para conteudo especifico do local
- parte da oferta comercial quando o plano for vinculado a um local

O local nao deve continuar sendo a unica camada de liberacao do produto.

---

## Estado atual da plataforma

### O que ja esta bem resolvido

- autenticacao do aluno
- area administrativa madura
- conteudos gerais e por local
- biblioteca com modulos por categoria
- player com pontos de atencao
- compras, pedidos e assinaturas

### O que ainda falta para a visao futura

- uma camada propria de grupos de acesso
- trilhas de aprendizagem
- planos por perfil de aluno
- separacao clara entre o que o aluno ve e o que o plano libera
- preparacao para mais de uma modalidade

---

## Visao alvo da experiencia do aluno

O aluno nao deve sentir que esta apenas entrando em uma biblioteca.

Ele deve sentir que esta entrando em uma plataforma que:

- mostra onde ele esta
- indica o proximo passo
- deixa facil achar um tema rapido
- reduz ansiedade antes da prova

### Duas portas de entrada

A experiencia ideal deve oferecer duas entradas muito claras:

- "Seguir minha trilha"
- "Encontrar um modulo"

### Painel do aluno

O painel deve virar o centro de decisao do aluno.

Blocos sugeridos:

- Continue de onde parou
- Sua trilha
- Encontre rapido o que precisa
- Seu local de prova

### Biblioteca

A biblioteca deve assumir um papel mais pedagogico.

Blocos sugeridos:

- Sua trilha
- Modulos gerais
- Modulos do seu local
- Revisao rapida

### Tela da trilha

Deve existir uma tela propria para a jornada.

Ela mostraria:

- etapas
- progresso
- status da etapa atual
- CTA de continuidade

---

## Dois perfis de aluno inicialmente previstos

### Perfil 1 - Comecando do zero

Esse aluno precisa de orientacao desde antes da pratica.

Precisa ver:

- primeiros passos no DETRAN
- documentos e taxas
- curso teorico
- prova teorica
- inicio da pratica
- percurso
- revisao final
- dia da prova

### Perfil 2 - Ja passou pelo DETRAN

Esse aluno nao precisa da jornada completa.

Precisa focar em:

- pratica
- baliza e controle
- percurso do local
- pegadinhas
- revisao final
- dia da prova

Esses dois perfis justificam uma arquitetura de acesso mais flexivel.

---

## Trilhas iniciais recomendadas

### Trilha 1 - Comecando do zero

Etapas sugeridas:

1. Primeiros passos no DETRAN
2. Documentos e taxas
3. Curso teorico
4. Prova teorica
5. Aulas praticas
6. Baliza e controle do carro
7. Percursos do seu local
8. Pegadinhas do examinador
9. Revisao final
10. Dia da prova

### Trilha 2 - Ja passou pelo DETRAN

Etapas sugeridas:

1. Aulas praticas
2. Baliza e controle do carro
3. Percursos do seu local
4. Pegadinhas do examinador
5. Revisao final
6. Dia da prova

As trilhas devem organizar o mesmo ecossistema de conteudo, sem exigir duplicacao de videos.

---

## Modulos visuais iniciais recomendados

Para a navegacao rapida, os modulos iniciais podem ser:

- Primeiros passos
- Documentos e taxas
- Curso teorico
- Aulas praticas
- Baliza
- Controle de embreagem
- Percursos do seu local
- Pegadinhas
- Revisao final
- Dia da prova

Esses modulos podem aparecer como cards arredondados e visuais, com:

- titulo
- subtitulo curto
- quantidade de aulas
- progresso
- CTA de abertura

---

## Grupos de acesso iniciais recomendados

Os grupos abaixo cobrem bem a primeira versao da arquitetura:

- `primeiros_passos`
- `documentos_taxas`
- `curso_teorico`
- `pratica_geral`
- `percursos_local`
- `pegadinhas_local`
- `revisao_final`
- `dia_da_prova`

Esses grupos nao precisam ser publicos para o aluno. Eles podem funcionar como estrutura interna de acesso.

---

## Regra de acesso recomendada

### Conteudo geral

Quando o conteudo nao pertence a um local especifico:

- o acesso deve ser liberado por grupo de acesso

Exemplo:

- uma aula de documentos e taxas pode ser geral
- ela fica acessivel para qualquer plano que libere `documentos_taxas`

### Conteudo especifico de local

Quando o conteudo pertence a um local:

- o acesso deve ser liberado por grupo de acesso
- e validado tambem pelo local correto

Exemplo:

- uma aula do percurso do Cohatrac
- grupo: `percursos_local`
- local: Cohatrac

O aluno deve ter:

- grupo `percursos_local`
- e acesso ao local Cohatrac

### Principio

Conteudo local deve depender de:

- grupo + local

Conteudo geral deve depender de:

- grupo

---

## Exemplo de produtos comerciais futuros

### Plano do zero - Cohatrac

Pode ter:

- local: Cohatrac
- trilha principal: Comecando do zero
- grupos liberados:
  - primeiros_passos
  - documentos_taxas
  - curso_teorico
  - pratica_geral
  - percursos_local
  - pegadinhas_local
  - revisao_final
  - dia_da_prova

### Plano direto para prova - Cohatrac

Pode ter:

- local: Cohatrac
- trilha principal: Ja passou pelo DETRAN
- grupos liberados:
  - pratica_geral
  - percursos_local
  - pegadinhas_local
  - revisao_final
  - dia_da_prova

Esses dois produtos podem reaproveitar bastante conteudo sem duplicar a base inteira.

---

## Impacto no admin

O admin precisa controlar esse novo modelo sem ficar sobrecarregado.

A recomendacao e separar a administracao em blocos claros.

### 1. Modulos

Responsabilidade:

- nome visual
- descricao curta
- ordem de exibicao

Pergunta que responde:

- "Como isso aparece para o aluno?"

### 2. Grupos de acesso

Responsabilidade:

- regra de liberacao
- identificador tecnico
- descricao interna
- comportamento geral ou local

Pergunta que responde:

- "Quem pode acessar isso?"

### 3. Trilhas

Responsabilidade:

- ordem recomendada
- nome da jornada
- descricao
- etapas

Pergunta que responde:

- "Em que ordem o aluno deve estudar?"

### 4. Planos

Responsabilidade:

- oferta comercial
- preco
- duracao
- local
- trilha principal
- grupos liberados

Pergunta que responde:

- "O que estamos vendendo e liberando?"

### 5. Aulas

Responsabilidade:

- titulo e resumo
- modulo visual
- local
- grupo(s) de acesso
- ordem

Pergunta que responde:

- "Onde essa aula aparece e para quem ela vale?"

---

## O que nao deve acontecer

Para a arquitetura permanecer limpa, estas confusoes devem ser evitadas:

### Nao misturar modulo visual com regra de acesso

Modulo e UX.

Grupo de acesso e negocio.

Se essas duas camadas forem misturadas, o sistema fica dificil de evoluir.

### Nao prender tudo ao local

O local continua importante, mas nao deve ser a unica base de autorizacao.

### Nao hardcodar perfis no frontend

Os perfis "do zero" e "ja passou pelo DETRAN" devem nascer do plano, da trilha e dos grupos, nao de ifs espalhados na interface.

### Nao começar por Moto

Moto deve entrar depois que a arquitetura de acesso estiver pronta.

---

## Preparacao para Moto

Moto nao deve ser tratada como excecao.

Ela deve entrar como uma nova linha de produto.

### Camada recomendada

Adicionar no futuro uma nova dimensao:

- `modalidade`

Valores iniciais:

- `CARRO`
- `MOTO`

Essa modalidade pode passar a existir em:

- modulo
- grupo de acesso
- trilha
- plano
- conteudo

Assim, no futuro, a plataforma podera suportar:

- comecando do zero - carro
- direto para prova - carro
- comecando do zero - moto
- direto para prova - moto

Sem reescrever a base inteira.

---

## Fases recomendadas

### Fase 1 - Fundacao de acesso

Objetivo:

- criar a camada de grupos de acesso

Entradas:

- grupos de acesso
- plano libera grupos
- aula/conteudo pertence a grupos
- regra final de acesso:
  - conteudo geral por grupo
  - conteudo local por grupo + local

Essa e a fase mais importante tecnicamente.

### Fase 2 - Trilhas

Objetivo:

- modelar jornadas diferentes para tipos diferentes de aluno

Entradas:

- trilha Comecando do zero
- trilha Ja passou pelo DETRAN

### Fase 3 - Experiencia do aluno

Objetivo:

- deixar a plataforma mais orientada por jornada

Entradas:

- novo painel do aluno
- nova biblioteca
- tela de trilha

### Fase 4 - Adaptacao do admin

Objetivo:

- permitir que o time opere a nova arquitetura com clareza

Entradas:

- planos escolhem grupos e trilha
- aulas escolhem grupos
- trilhas ganham gestao propria

### Fase 5 - Expansao

Objetivo:

- abrir caminho para Moto

Entradas:

- modalidade
- novas trilhas
- novos planos

---

## Ordem de prioridade recomendada

### Ordem recomendada real

1. Grupos de acesso
2. Planos liberando grupos
3. Conteudos vinculados a grupos
4. Painel do aluno
5. Biblioteca
6. Trilhas
7. Admin de trilhas
8. Preparacao para modalidade
9. Moto

### Motivo dessa ordem

Primeiro:

- resolver "quem pode ver o que"

Depois:

- melhorar "como o aluno entende a jornada"

Depois:

- escalar para novas ofertas e modalidades

---

## Fase 1 minima viavel

Se for necessario comecar com uma versao enxuta, a recomendacao minima e:

- criar grupos de acesso
- permitir que planos liberem grupos
- permitir que aulas pertençam a grupos
- manter modulo visual como esta
- manter local como esta
- ajustar regra de acesso

Com isso, ja fica possivel vender:

- plano do zero
- plano direto para prova

Sem ainda reescrever toda a experiencia do aluno.

---

## Exemplo pratico de combinacao entre as camadas

### Aula 1

- titulo: Como pagar as taxas
- modulo visual: Documentos e taxas
- grupo de acesso: documentos_taxas
- local: nenhum

### Aula 2

- titulo: Percurso Cohatrac 01
- modulo visual: Percursos
- grupo de acesso: percursos_local
- local: Cohatrac

### Aula 3

- titulo: O que vestir no dia da prova
- modulo visual: Dia da prova
- grupo de acesso: dia_da_prova
- local: nenhum

### Plano A - Do zero

- libera:
  - documentos_taxas
  - curso_teorico
  - pratica_geral
  - percursos_local
  - pegadinhas_local
  - revisao_final
  - dia_da_prova

### Plano B - Direto para prova

- libera:
  - pratica_geral
  - percursos_local
  - pegadinhas_local
  - revisao_final
  - dia_da_prova

Assim:

- Aula 1 entra so no Plano A
- Aula 2 entra nos dois, desde que o local bata
- Aula 3 entra nos dois

---

## Principios de UX para a proxima fase

O aluno deve sentir que:

- sabe por onde comecar
- sabe o que revisar
- sabe o que vem depois
- consegue achar rapido um tema especifico

Os principios de experiencia recomendados sao:

- direcao antes de volume
- trilha e atalho convivendo juntos
- menos sensacao de "biblioteca solta"
- mais sensacao de "jornada para aprovacao"

---

## Conclusao

O produto esta no momento certo para sair de "biblioteca por local" e evoluir para "jornada guiada ate a aprovacao".

A recomendacao central deste documento e:

- criar grupos de acesso
- manter modulo como camada visual
- usar trilhas como organizacao da jornada
- usar planos como composicao comercial de grupos + trilha
- preservar o local como contexto, nao como unica regra

Se essa arquitetura for seguida, a plataforma ganha:

- clareza para o aluno
- flexibilidade comercial
- menos duplicacao de conteudo
- base preparada para modalidades futuras

Esse documento deve servir como memoria principal dessa direcao de produto.
