# Arquitetura de Produto - Evolucao Futura da Plataforma

## Objetivo deste documento

Este documento registra, de forma detalhada, a direcao arquitetural e de produto para a evolucao do Percurso Aprovado.

Ele existe para evitar perda de contexto nas proximas conversas e para alinhar:

- produto
- UX
- conteudo
- comercial
- administracao
- implementacao tecnica

Este documento descreve:

- o que a plataforma e hoje
- qual problema o modelo atual nao resolve mais
- como a plataforma deve evoluir para atender perfis diferentes de aluno
- como suportar Carro, Moto e Combo Carro + Moto
- como separar modulo visual, grupo de acesso, trilha, plano e contexto de local
- como isso deve refletir no aluno e no admin
- quais fases fazem sentido executar

Este documento nao e uma especificacao tecnica fechada. Ele e uma base de arquitetura de produto.

---

## Visao geral do produto

O Percurso Aprovado e uma plataforma de ensino voltada para aprovacao em provas do DETRAN, com foco especial em:

- preparacao pratica
- revisao orientada para aprovacao
- percursos reais de prova
- reducao de ansiedade antes da prova
- conteudo geral e conteudo contextual

Hoje o produto ja possui:

- autenticacao e area logada
- painel do aluno
- biblioteca
- player com pontos de atencao
- simulados teoricos
- progresso
- planos
- pedidos
- assinaturas
- cancelamentos
- administracao de aulas, planos, modulos, locais e usuarios

Hoje ele funciona bem como biblioteca de conteudo organizada.

O proximo salto desejado e transformar essa biblioteca em uma plataforma completa de jornada ate a aprovacao.

---

## Visao de produto desejada

O produto precisa atender, ao mesmo tempo, dois grandes perfis de uso:

### 1. Aluno que quer comecar do zero

Esse aluno precisa de orientacao desde o inicio da jornada.

Ele nao quer apenas "ver um percurso". Ele quer entender:

- o que fazer primeiro
- quais documentos levar
- onde ir
- como funcionam as taxas
- como passar no teorico
- como se preparar para a pratica
- como revisar antes da prova

### 2. Aluno que ja iniciou e quer focar na pratica e na prova

Esse aluno quer ser mais objetivo.

Ele normalmente ja passou pelas etapas iniciais e quer:

- entender a pratica
- dominar o percurso
- revisar os erros mais comuns
- saber o que fazer no dia da prova

### Sintese da visao

A plataforma ideal deve oferecer ao mesmo tempo:

- uma jornada guiada, para quem quer seguir um caminho completo
- uma navegacao visual por modulos, para quem quer achar rapido o que precisa

Ela deve deixar de parecer apenas uma biblioteca de videos e passar a parecer:

- uma plataforma de preparacao completa
- uma orientadora da jornada do aluno
- uma ferramenta de revisao rapida na reta final

---

## Problema principal do modelo atual

Hoje o modelo de acesso do produto esta muito amarrado ao local de prova.

Na pratica, hoje:

- o plano fica ligado ao local
- a assinatura libera aquele local
- conteudo geral entra para qualquer assinatura ativa
- conteudo especifico entra por local

Esse modelo resolve bem:

- venda por local
- liberacao de percurso por local
- mistura de conteudo geral com local

Mas ele nao resolve bem:

- aluno do zero
- aluno em reta final
- linha de produto Moto
- produto Combo Carro + Moto
- jornadas diferentes
- ofertas comerciais diferentes usando a mesma base de conteudo

O problema central e este:

- o local hoje faz papel demais
- e a plataforma precisa de mais camadas para crescer sem virar remendo

---

## Principio central da arquitetura recomendada

Para a plataforma crescer bem, e preciso separar claramente cinco camadas:

### 1. Modulo visual

E a forma como o conteudo aparece para o aluno.

Exemplos:

- Primeiros passos
- Documentos e taxas
- Curso teorico
- Simulados
- Pratica base
- Percursos reais
- Pegadinhas
- Revisao final
- Dia da prova

Funcao:

- organizacao visual
- descoberta de conteudo
- navegacao rapida

Modulo visual responde a pergunta:

- "Como o aluno encontra isso na plataforma?"

Modulo visual nao deve ser a regra de acesso.

### 2. Grupo de acesso

E a camada de regra de negocio que define o que um plano libera.

Exemplos:

- `primeiros_passos`
- `documentos_taxas`
- `curso_teorico`
- `simulados_teoricos`
- `carro_pratica_base`
- `carro_percursos_local`
- `moto_pista_padrao`
- `moto_revisao_final`

Funcao:

- controlar o que cada plano libera
- separar perfis comerciais
- permitir produtos diferentes sem duplicar toda a base

Grupo de acesso responde a pergunta:

- "Quem pode ver isso?"

Grupo de acesso nao deve ser o nome do card mostrado ao aluno.

### 3. Trilha

E a ordem recomendada de estudo.

Funcao:

- transformar conteudo em jornada
- orientar o aluno
- reduzir a sensacao de "nao sei por onde comecar"

Trilha responde a pergunta:

- "Em que ordem faz sentido estudar?"

Trilha nao define sozinha o acesso. Ela organiza o que ja esta liberado.

### 4. Plano

E o produto comercial.

Funcao:

- definir preco
- definir duracao
- definir oferta
- liberar grupos de acesso
- apontar para uma trilha principal
- definir a modalidade e, quando fizer sentido, o contexto de local

Plano responde a pergunta:

- "O que estamos vendendo?"

### 5. Contexto de local

Continua importante, mas com papel mais especifico.

Funcao:

- representar o local da prova quando ele for relevante
- filtrar conteudo especifico de percurso
- participar da regra de acesso quando o conteudo for contextual

Local responde a pergunta:

- "Esse conteudo depende de um local especifico ou nao?"

O local nao deve continuar sendo a unica camada de autorizacao do produto.

---

## Nova dimensao obrigatoria: modalidade

Para o futuro do produto, e essencial tratar modalidade como uma camada propria.

Valores iniciais:

- `CARRO`
- `MOTO`

No futuro, essa modalidade pode existir em:

- plano
- trilha
- grupos de acesso
- modulos
- conteudos

Mas o papel dela nao e o mesmo do local.

### Diferenca entre modalidade e local

- Modalidade define a linha do produto
- Local define o contexto geografico ou operacional quando existir

Exemplo:

- Carro: modalidade com conteudo contextual por local
- Moto: modalidade com pista padrao fixa, sem local flexivel em Sao Luis

---

## Diferenca estrutural entre Carro e Moto

Esse ponto e fundamental.

### Carro

Para Carro, o produto depende de local de prova variavel.

O aluno precisa de:

- pratica base
- preparacao do veiculo
- local de prova
- percursos reais do local
- pegadinhas do local
- revisao final carro
- dia da prova carro

### Moto

Para Moto em Sao Luis, a logica e diferente.

A prova e feita em uma pista padrao do proprio DETRAN.

Isso significa que Moto:

- nao depende de um local flexivel como Carro
- nao precisa de "percursos por local"
- precisa de dominio da pista padrao
- precisa de erros mais comuns da pista
- precisa de revisao final moto
- precisa de dia da prova moto

### Consequencia arquitetural

Moto nao deve ser modelada como "Carro com outro nome".

A jornada inicial pode ser compartilhada, mas o ramo pratico precisa ser diferente.

---

## Modelo-alvo da plataforma

O modelo completo recomendado e este:

```text
PERCURSO APROVADO
│
├── JORNADA INICIAL COMPARTILHADA
│   ├── Primeiros passos
│   ├── Documentos e taxas
│   ├── Curso teorico
│   └── Simulados e preparacao teorica
│
├── RAMO CARRO
│   ├── Pratica base carro
│   ├── Preparacao do veiculo
│   ├── Percursos reais do local
│   ├── Pegadinhas do local
│   ├── Revisao final carro
│   └── Dia da prova carro
│
├── RAMO MOTO
│   ├── Pratica base moto
│   ├── Preparacao da moto
│   ├── Pista padrao do DETRAN
│   ├── Erros mais comuns da pista
│   ├── Revisao final moto
│   └── Dia da prova moto
│
└── MODO REVISAO RAPIDA
    ├── Revisao geral
    ├── Vespera da prova
    ├── Erros que mais reprovam
    └── Checklist final
```

---

## Arquitetura comercial futura

Os planos comerciais devem passar a ser pensados por:

- perfil da jornada
- modalidade
- profundidade da oferta

### Planos recomendados inicialmente

#### 1. Plano Completo Carro

Libera:

- jornada inicial compartilhada
- ramo completo de Carro

Contexto:

- exige local de prova do carro

#### 2. Plano Completo Moto

Libera:

- jornada inicial compartilhada
- ramo completo de Moto

Contexto:

- nao exige local flexivel
- usa a pista padrao da modalidade

#### 3. Plano Combo Carro + Moto

Libera:

- jornada inicial compartilhada
- ramo completo de Carro
- ramo completo de Moto

Contexto:

- para Carro, exige local de prova do carro
- para Moto, usa pista padrao

#### 4. Plano Reta Final Carro

Libera:

- pratica base carro
- percursos reais do local
- pegadinhas do local
- revisao final carro
- dia da prova carro

#### 5. Plano Reta Final Moto

Libera:

- pratica base moto
- pista padrao do DETRAN
- erros da pista
- revisao final moto
- dia da prova moto

---

## Desenho detalhado das jornadas

## Jornada inicial compartilhada

Esse bloco pode servir para:

- Carro
- Moto
- Combo Carro + Moto

### Modulo: Primeiros passos

Pode conter:

- o que fazer para comecar
- onde ir
- como funciona o processo
- quais etapas existem
- o que fazer depois de concluir a etapa atual

### Modulo: Documentos e taxas

Pode conter:

- documentos necessarios
- taxas principais
- onde resolver
- duvidas comuns
- erros de inicio da jornada

### Modulo: Curso teorico

Pode conter:

- por onde estudar
- organizacao da etapa teorica
- preparacao para aulas teoricas
- marcacao da prova
- o que fazer ao concluir a teoria

### Modulo: Simulados e preparacao teorica

Pode conter:

- questoes
- simulados completos
- topicos que mais caem
- rotina de revisao para teorica

---

## Jornada detalhada de Carro

### Modulo: Pratica base carro

Pode conter:

- embreagem
- saida
- parada
- observacao
- baliza
- vicios comuns
- erros de postura

### Modulo: Preparacao do veiculo

Pode conter:

- documentos do carro
- adesivacao
- ajustes antes da prova
- checklist do veiculo

### Modulo: Percursos reais do local

Pode conter:

- videos do percurso
- pontos de atencao
- trechos criticos
- onde o examinador observa mais

### Modulo: Pegadinhas do local

Pode conter:

- erros recorrentes
- vicios comuns do local
- reprovacoes mais comuns

### Modulo: Revisao final carro

Pode conter:

- compilado dos pontos mais importantes
- revisao curta
- erros fatais
- ultimos ajustes

### Modulo: Dia da prova carro

Pode conter:

- o que levar
- como ir
- como se vestir
- como se comportar
- o que nao esquecer

---

## Jornada detalhada de Moto

### Modulo: Pratica base moto

Pode conter:

- controle da moto
- equilibrio
- postura
- freio e aceleracao
- vicios comuns

### Modulo: Preparacao da moto

Pode conter:

- documentos
- ajustes basicos
- checklist da moto
- cuidados pre-prova

### Modulo: Pista padrao do DETRAN

Pode conter:

- estrutura da pista
- leitura da pista
- ordem das etapas
- demonstracao de execucao
- pontos de atencao

### Modulo: Erros mais comuns da pista

Pode conter:

- erros que mais reprovam
- erros por etapa
- o que observar com mais cuidado

### Modulo: Revisao final moto

Pode conter:

- compilado dos pontos mais importantes
- revisao curta
- erros fatais
- ultimos ajustes

### Modulo: Dia da prova moto

Pode conter:

- o que levar
- como ir
- como se vestir
- como se comportar
- o que nao esquecer

---

## Como o Combo Carro + Moto deve funcionar

O plano Combo Carro + Moto nao deve parecer um amontoado de tudo.

Ele deve ter uma logica clara:

### Parte 1. Nucleo compartilhado

O aluno ve primeiro a jornada inicial compartilhada:

- primeiros passos
- documentos e taxas
- curso teorico
- simulados

### Parte 2. Escolha de estudo por modalidade

No painel, o aluno deve conseguir alternar claramente entre:

- Estudar Carro
- Estudar Moto

### Parte 3. Progresso separado por modalidade

Mesmo no combo, o progresso deve ser separado entre:

- progresso carro
- progresso moto

### Parte 4. Regras diferentes por contexto

- Carro usa local de prova do carro
- Moto usa pista padrao fixa

### Consequencia de UX

No combo, o aluno nao deve enxergar as duas linhas misturadas.

Ele deve sentir que tem:

- uma jornada compartilhada
- e dois ramos claros para estudar

---

## Modelo recomendado de modulos visuais

Os modulos visuais devem ser a camada mais facil de entender para o aluno.

Eles podem ser apresentados como cards arredondados e visuais.

### Familias de modulos recomendadas

#### 1. Modulos de inicio de jornada

- Primeiros passos
- Documentos e taxas
- Curso teorico
- Simulados

#### 2. Modulos de pratica da modalidade

- Pratica base carro
- Pratica base moto
- Preparacao do veiculo
- Preparacao da moto

#### 3. Modulos contextuais

- Percursos reais do local
- Pegadinhas do local
- Pista padrao do DETRAN
- Erros da pista

#### 4. Modulos de fechamento

- Revisao final
- Dia da prova
- Revisao rapida

### Informacao recomendada dentro do card do modulo

- titulo
- subtitulo curto
- quantidade de aulas
- progresso
- CTA para abrir

---

## Modelo recomendado de grupos de acesso

Os grupos de acesso devem refletir a logica de liberacao e nao a navegacao visual.

### Grupos compartilhados

- `primeiros_passos`
- `documentos_taxas`
- `curso_teorico`
- `simulados_teoricos`

### Grupos de Carro

- `carro_pratica_base`
- `carro_preparacao_veiculo`
- `carro_percursos_local`
- `carro_pegadinhas_local`
- `carro_revisao_final`
- `carro_dia_prova`

### Grupos de Moto

- `moto_pratica_base`
- `moto_preparacao_moto`
- `moto_pista_padrao`
- `moto_erros_pista`
- `moto_revisao_final`
- `moto_dia_prova`

### Grupos de revisao transversal

- `revisao_rapida_geral`
- `revisao_rapida_carro`
- `revisao_rapida_moto`

---

## Regras de acesso recomendadas

## Regra geral

Conteudo geral deve depender de:

- grupo de acesso

Conteudo contextual deve depender de:

- grupo de acesso
- modalidade, quando relevante
- local, quando relevante

## Conteudo geral compartilhado

Exemplo:

- aula de documentos e taxas

Depende de:

- grupo `documentos_taxas`

Nao depende de local.

## Conteudo de Carro por local

Exemplo:

- aula do percurso do Cohatrac

Depende de:

- grupo `carro_percursos_local`
- modalidade `CARRO`
- local `Cohatrac`

## Conteudo de Moto em pista padrao

Exemplo:

- aula sobre a pista padrao do DETRAN

Depende de:

- grupo `moto_pista_padrao`
- modalidade `MOTO`

Nao depende de local flexivel.

---

## Estrutura recomendada de trilhas

As trilhas devem organizar a ordem recomendada do estudo.

### Trilhas minimas recomendadas

- `comecando_do_zero_carro`
- `comecando_do_zero_moto`
- `comecando_do_zero_combo`
- `reta_final_carro`
- `reta_final_moto`

### Exemplo: trilha comecando do zero - carro

1. Primeiros passos
2. Documentos e taxas
3. Curso teorico
4. Simulados
5. Pratica base carro
6. Preparacao do veiculo
7. Percursos reais do local
8. Pegadinhas do local
9. Revisao final carro
10. Dia da prova carro

### Exemplo: trilha reta final - carro

1. Pratica base carro
2. Percursos reais do local
3. Pegadinhas do local
4. Revisao final carro
5. Dia da prova carro

### Exemplo: trilha comecando do zero - moto

1. Primeiros passos
2. Documentos e taxas
3. Curso teorico
4. Simulados
5. Pratica base moto
6. Preparacao da moto
7. Pista padrao do DETRAN
8. Erros da pista
9. Revisao final moto
10. Dia da prova moto

### Exemplo: trilha reta final - moto

1. Pratica base moto
2. Pista padrao do DETRAN
3. Erros da pista
4. Revisao final moto
5. Dia da prova moto

### Exemplo: trilha comecando do zero - combo

1. Primeiros passos
2. Documentos e taxas
3. Curso teorico
4. Simulados
5. Escolha de ramificacao
6. Ramo Carro
7. Ramo Moto

No produto, isso deve ser apresentado de forma mais amigavel do que a estrutura tecnica acima.

---

## Como o aluno deve sentir essa arquitetura

O aluno nao deve perceber as camadas tecnicas.

Ele deve sentir apenas que a plataforma:

- entende o momento dele
- mostra o proximo passo
- facilita achar rapidamente um modulo
- orienta a revisao final

### Portas de entrada recomendadas

A experiencia do aluno deve sempre ter duas portas de entrada claras:

- Seguir minha trilha
- Encontrar um modulo

### Painel do aluno

O painel ideal deve mostrar:

- Continue de onde parou
- Sua jornada
- Modulos rapidos
- Revisao rapida
- Seu contexto atual

### Biblioteca

A biblioteca ideal deve mostrar:

- Sua trilha
- Modulos gerais
- Modulos da modalidade atual
- Modulos do local, quando houver
- Revisao rapida

### Combo Carro + Moto

No combo, o painel deve mostrar um seletor claro:

- Estudar Carro
- Estudar Moto

O aluno nao deve se perder vendo tudo ao mesmo tempo.

---

## Como o admin deve operar isso

Para a plataforma nao virar bagunca, o admin deve continuar separado por responsabilidades.

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
- codigo tecnico
- descricao interna
- ordem

Pergunta que responde:

- "Quem pode acessar isso?"

### 3. Trilhas

Responsabilidade:

- nome da trilha
- descricao
- ordem das etapas
- grupo principal de cada etapa

Pergunta que responde:

- "Qual e a jornada recomendada?"

### 4. Planos

Responsabilidade:

- preco
- duracao
- modalidade
- contexto de local, quando existir
- trilha principal
- grupos liberados

Pergunta que responde:

- "Qual produto estamos vendendo?"

### 5. Aulas

Responsabilidade:

- titulo
- resumo
- modulo visual
- modalidade
- local, quando fizer sentido
- grupos de acesso
- ordem

Pergunta que responde:

- "Onde essa aula aparece e para quem ela vale?"

---

## Coisas que nao devem acontecer

Para a arquitetura continuar limpa, estas confusoes devem ser evitadas:

### 1. Nao misturar modulo visual com grupo de acesso

Modulo e UX.

Grupo de acesso e regra de negocio.

### 2. Nao tratar Moto como copia de Carro

Moto tem jornada pratica diferente.

Em Sao Luis, Moto usa pista padrao, nao local flexivel.

### 3. Nao deixar o local mandar em tudo

Local continua importante para Carro, mas nao pode ser a unica base de autorizacao da plataforma.

### 4. Nao hardcodar tudo no frontend

Perfis de jornada devem nascer da combinacao de:

- plano
- trilha
- grupos de acesso
- modalidade

### 5. Nao deixar o combo virar bagunca

Combo precisa compartilhar o que faz sentido e separar o que precisa ser separado.

---

## Roadmap recomendado

### Fase 1. Fundacao de acesso

Objetivo:

- separar acesso de organizacao visual

Entradas:

- grupos de acesso
- plano libera grupos
- aula pertence a grupos
- regra de acesso por grupo

### Fase 2. Trilhas

Objetivo:

- formalizar jornadas diferentes

Entradas:

- trilhas de Carro
- trilhas de Moto
- trilha do Combo

### Fase 3. Experiencia do aluno

Objetivo:

- fazer a jornada aparecer de forma clara

Entradas:

- novo painel do aluno
- nova biblioteca
- tela propria da trilha

### Fase 4. Adaptacao do admin

Objetivo:

- permitir operar a nova arquitetura com clareza

Entradas:

- admin de grupos
- admin de trilhas
- planos com modalidade e trilha
- aulas com modalidade e grupos

### Fase 5. Expansao comercial

Objetivo:

- consolidar as novas ofertas

Entradas:

- plano completo carro
- plano completo moto
- combo carro + moto
- reta final carro
- reta final moto

---

## Ordem de prioridade recomendada

1. grupos de acesso
2. planos liberando grupos
3. conteudos classificados por grupos
4. modalidade como camada de produto
5. trilhas por modalidade
6. painel do aluno orientado por jornada
7. biblioteca orientada por jornada
8. combo carro + moto
9. refinamentos comerciais

### Motivo da ordem

Primeiro:

- resolver quem pode ver o que

Depois:

- resolver como o aluno entende a jornada

Depois:

- resolver como vender versoes diferentes do produto

---

## Conclusao

O Percurso Aprovado esta no momento certo para sair de "biblioteca de percursos por local" e evoluir para "plataforma completa de aprovacao".

Essa evolucao deve partir destes principios:

- jornada inicial compartilhada
- ramificacao clara entre Carro e Moto
- Moto tratada como modalidade com pista padrao
- Carro tratado como modalidade com local flexivel
- Combo Carro + Moto tratado como produto proprio
- modulo visual separado de grupo de acesso
- trilha separada de plano
- plano separado de contexto local

Se essa arquitetura for seguida, a plataforma ganha:

- clareza para o aluno
- clareza para o admin
- flexibilidade comercial
- menos duplicacao de conteudo
- base pronta para crescimento futuro

Este documento deve servir como memoria principal dessa visao de produto.
