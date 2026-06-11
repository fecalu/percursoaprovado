# Apostila-Guia da VPS

## Objetivo deste documento

Este material foi escrito para te ajudar a entender, com calma, a VPS que hoje hospeda:

- `figurinhas.tech`
- `percursoaprovado.com.br`

Ele foi montado com base no estado real atual do servidor em `2026-06-05`.

Nao e uma apostila generica de infraestrutura. A ideia aqui e te ensinar usando o seu caso real:

- onde cada coisa mora
- quais containers existem
- como o Nginx encaminha as requisicoes
- onde ficam os dados
- o que e banco
- o que e storage
- como um deploy acontece
- por que as vezes aparece `502 Bad Gateway`

---

## Leitura rapida: o que existe hoje

Hoje a VPS esta organizada em tres camadas:

1. `Nginx` no host
2. `Docker` com containers dos apps
3. arquivos e bancos persistidos em disco

Em outras palavras:

- o usuario acessa um dominio
- o `Nginx` recebe a requisicao
- ele encaminha para uma porta local
- essa porta pertence a um container
- o container responde
- os dados ficam guardados em pasta ou volume

---

## Snapshot atual da VPS

### Servidor

- hostname: `srv1632488`
- sistema operacional: `Ubuntu 24.04.4 LTS`
- virtualizacao: `KVM`

### Disco

- total: `48 GB`
- usado: `12 GB`
- livre: `36 GB`

### Containers ativos

Hoje, os containers em execucao sao:

- `figurinhas_frontend`
- `figurinhas_backend`
- `edu_db`

Isso significa que:

- a stack do `Figurinhas` esta ativa
- existe um banco Postgres legado/raiz chamado `edu_db`
- a stack completa do `percursoaprovado` nao apareceu ativa no `docker ps` no momento da analise

---

## O conceito mais importante: dominio, Nginx, porta e container

Para entender esse servidor, voce precisa memorizar esta ideia:

### Dominio

Exemplos:

- `figurinhas.tech`
- `percursoaprovado.com.br`

E o endereco publico que o usuario digita no navegador.

### Nginx

O `Nginx` e o "porteiro" da VPS.

Ele recebe o acesso do usuario e decide:

- se aquilo vai para o frontend
- se vai para a API
- qual porta local deve receber

### Porta

Porta e a "porta interna" onde um servico escuta.

Exemplos do seu ambiente:

- `4310`
- `8091`
- `4300`
- `8081`

### Container

Container e o processo isolado que roda o app.

Exemplos:

- `figurinhas_frontend`
- `figurinhas_backend`

---

## Mapa do Figurinhas

### Dominio

- `figurinhas.tech`

### Arquivo de configuracao Nginx

- `/etc/nginx/sites-available/figurinhas.tech`

### Regra atual

Quando alguem acessa:

- `https://figurinhas.tech/api/...`
  - o Nginx envia para `127.0.0.1:8091`

- `https://figurinhas.tech/...`
  - o Nginx envia para `127.0.0.1:4310`

Traduzindo:

- `8091` = backend do Figurinhas
- `4310` = frontend do Figurinhas

### Containers do Figurinhas

- `figurinhas_backend`
- `figurinhas_frontend`

### Compose do Figurinhas

- `/opt/percursoaprovado/apps/figurinhas/docker-compose.figurinhas.yml`

### Pasta principal do Figurinhas

- `/opt/percursoaprovado/apps/figurinhas`

### Estrutura dessa pasta

- `backend`
- `frontend`
- `storage`
- `.env`
- `docker-compose.figurinhas.yml`

### Como pensar o fluxo do Figurinhas

```text
Usuario
  -> figurinhas.tech
  -> Nginx da VPS
  -> frontend em 4310
  -> navegador chama /api
  -> Nginx manda /api para 8091
  -> backend responde
  -> backend usa SQLite + storage
```

---

## Mapa do Percurso Aprovado

### Dominio

- `percursoaprovado.com.br`

### Arquivo de configuracao Nginx

- `/etc/nginx/sites-available/percursoaprovado`

### Regra atual

Quando alguem acessa:

- `https://percursoaprovado.com.br/api/...`
  - o Nginx envia para `127.0.0.1:8081`

- `https://percursoaprovado.com.br/...`
  - o Nginx envia para `127.0.0.1:4300`

### Observacao importante

No arquivo do Nginx existe este include:

- `/opt/percursoaprovado/deploy/hostinger/percursoaprovado-figurinhas.snippet.conf`

Esse snippet faz:

- `/figurinhas`
  - redireciona para `https://figurinhas.tech/`

Ou seja:

- o Figurinhas tem dominio proprio
- o site principal so redireciona o caminho `/figurinhas`

### Compose do sistema principal

Na raiz do projeto existem estes arquivos:

- `/opt/percursoaprovado/docker-compose.yml`
- `/opt/percursoaprovado/docker-compose.hostinger.yml`
- `/opt/percursoaprovado/docker-compose.hostinger-homolog.yml`

Eles descrevem a stack do sistema principal, baseada em:

- frontend React
- backend Spring Boot
- Postgres

---

## Onde cada site esta fisicamente

### Raiz do projeto

- `/opt/percursoaprovado`

Ali ficam:

- os compose da raiz
- o codigo do sistema principal
- a pasta `apps`
- `backups`
- `tools`
- `deploy`

### Pasta `apps`

Hoje ela tem:

- `/opt/percursoaprovado/apps/figurinhas`

O `Figurinhas` foi separado como app proprio dentro de `apps`.

---

## Diferenca entre backend, frontend, banco e storage

Esse e um dos pontos mais importantes para voce dominar.

### Frontend

E a interface que o usuario enxerga no navegador.

No Figurinhas:

- container: `figurinhas_frontend`
- porta local: `4310`

### Backend

E a API e a logica do sistema.

No Figurinhas:

- container: `figurinhas_backend`
- porta local: `8091`

### Banco

E onde ficam os registros estruturados:

- usuarios
- colecoes
- stickers
- jobs
- pagamentos

No Figurinhas, hoje o banco e:

- `SQLite`
- arquivo:
  - `/opt/percursoaprovado/apps/figurinhas/storage/figurinhas.sqlite3`

No sistema principal, o banco e:

- `Postgres`
- container:
  - `edu_db`

### Storage

Storage e a pasta de arquivos do sistema.

No Figurinhas, hoje ela fica em:

- `/opt/percursoaprovado/apps/figurinhas/storage`

Ali nao ficam "registros de banco", e sim arquivos:

- PDFs
- imagens
- recortes
- uploads
- previews
- documentos fonte

---

## O banco do Figurinhas: por que ele e diferente

Hoje o Figurinhas usa `SQLite`, nao `Postgres`.

### O que isso significa

Em vez de um container separado so para banco, o banco do Figurinhas e um arquivo:

- `figurinhas.sqlite3`

Isso simplifica:

- deploy
- backup do app
- leitura rapida

Mas tambem exige cuidado com:

- crescimento do arquivo
- acesso concorrente
- backup consistente

### Arquivos relacionados ao SQLite

Hoje voce tambem vai ver:

- `figurinhas.sqlite3`
- `figurinhas.sqlite3-wal`
- `figurinhas.sqlite3-shm`

Em resumo:

- `sqlite3` = banco principal
- `wal` = write-ahead log
- `shm` = memoria compartilhada de apoio

---

## Storage do Figurinhas: o que e cada pasta

Estado observado em `2026-06-05`:

- `source_document_pages` -> `864 MB`
- `source_detected` -> `542 MB`
- `crops` -> `542 MB`
- `source_documents` -> `274 MB`
- `custom_uploads` -> `151 MB`
- `custom_cutouts` -> `137 MB`
- `custom_portraits` -> `117 MB`
- `custom_stickers` -> `74 MB`
- `public_previews` -> `21 MB`
- `exports` -> `19 MB`
- `pages` -> `13 MB`
- `originals` -> `12 MB`
- `custom_template_layers` -> `4.5 MB`
- `custom_bases` -> `1.4 MB`

### Interpretacao rapida

#### `source_documents`

Arquivos PDF fonte usados para criar colecoes.

#### `source_document_pages`

Paginas renderizadas desses documentos fonte.

#### `source_detected`

Artefatos ligados a deteccao das figurinhas nesses documentos.

#### `crops`

Recortes de figurinhas.

#### `custom_uploads`

Uploads enviados pelo usuario para `Minha Figurinha`.

#### `custom_cutouts`

Recortes gerados a partir das fotos do usuario.

#### `custom_portraits`

Retratos processados do fluxo personalizado.

#### `custom_stickers`

Figurinhas personalizadas ja geradas.

#### `public_previews`

Thumbs leves para o site publico.

#### `exports`

PDFs gerados para download.

Hoje esta pequeno porque voce decidiu parar de guardar o "ultimo PDF" da conta.

---

## Como o Docker entra nisso

### O que o Docker faz

O Docker roda os apps em containers isolados.

No Figurinhas isso ajuda a:

- padronizar o ambiente
- subir frontend e backend separados
- reconstruir com `docker compose up -d --build`

### O que e `docker compose`

E a forma de descrever um conjunto de containers.

No seu caso:

- frontend
- backend
- volumes
- portas
- variaveis de ambiente

Tudo isso fica no `docker-compose.figurinhas.yml`.

### Exemplo real do Figurinhas

No compose atual:

- backend exposto em:
  - `127.0.0.1:8091:8091`
- frontend exposto em:
  - `127.0.0.1:4310:80`

Isso quer dizer:

- o container backend escuta em `8091`
- o host local tambem publica `8091`
- o container frontend escuta em `80`
- o host local publica isso em `4310`

---

## O que e um bind mount

O `figurinhas_backend` tem este mount:

- `/opt/percursoaprovado/apps/figurinhas/storage`
  - montado como
  - `/app/storage`

Isso significa:

- o container enxerga `/app/storage`
- mas os arquivos de verdade ficam no host

Vantagem:

- se o container morrer ou for recriado, os arquivos continuam no disco

Esse conceito e essencial para entender por que:

- PDF nao some no rebuild
- banco SQLite continua existindo
- previews e uploads continuam la

---

## O que sao volumes Docker

No sistema principal aparecem volumes como:

- `percursoaprovado_pgdata`
- `percursoaprovado_edu_media`

Diferenca:

- `bind mount` aponta para uma pasta explicita do host
- `volume Docker` e gerenciado pelo proprio Docker

No Figurinhas, hoje o mais importante e o `bind mount` da pasta `storage`.

---

## Como um deploy do Figurinhas funciona

Fluxo tipico:

1. voce altera codigo
2. vai para:
   - `/opt/percursoaprovado/apps/figurinhas`
3. roda:
   - `docker compose --env-file .env -f docker-compose.figurinhas.yml up -d --build`
4. Docker reconstrui imagem
5. container antigo e recriado
6. Nginx continua apontando para as mesmas portas

Depois disso, costuma-se validar:

- `curl http://127.0.0.1:8091/health`
- `curl https://figurinhas.tech/api/health`

---

## Por que as vezes aparece 502 Bad Gateway

Esse e um comportamento importante para voce entender.

O `502` aparece quando:

- o Nginx esta tentando falar com o backend
- mas o backend ainda nao esta pronto

No seu ambiente isso acontece principalmente:

- durante `rebuild`
- durante `restart`

Fluxo real:

1. o Nginx recebe `/api/...`
2. tenta chamar `127.0.0.1:8091`
3. o backend ainda esta subindo
4. o Nginx responde `502 Bad Gateway`

Depois que o backend sobe, volta ao normal.

---

## Variaveis de ambiente: para que servem

No Figurinhas, a configuracao viva fica em:

- `/opt/percursoaprovado/apps/figurinhas/.env`

Esse arquivo controla coisas como:

- token admin
- chaves OpenAI
- acesso pago
- preco
- SMTP
- token Mercado Pago

O compose le esse `.env` e injeta as variaveis no container.

Exemplos reais do Figurinhas:

- `FIGURINHAS_PUBLIC_ACCESS_ENABLED`
- `FIGURINHAS_PUBLIC_ACCESS_PRICE_CENTS`
- `FIGURINHAS_OPENAI_API_KEY`
- `FIGURINHAS_PUBLIC_SMTP_HOST`
- `FIGURINHAS_MP_ACCESS_TOKEN`

---

## O que esta ativo hoje e o que e legado

### Ativo hoje

- `figurinhas.tech`
- `figurinhas_backend`
- `figurinhas_frontend`
- banco SQLite do Figurinhas
- Nginx com roteamento do Figurinhas

### Existe no projeto, mas nao apareceu ativo no `docker ps`

- `percursoaprovado_backend`
- `percursoaprovado_frontend`
- `percursoaprovado_db`
- `percursoaprovado_hml_*`

Isso significa que:

- a configuracao existe
- mas nao necessariamente esta rodando agora

---

## Comandos que voce precisa aprender primeiro

### Linux e arquivos

- `pwd`
- `ls -la`
- `cd`
- `cat`
- `cp`
- `mv`
- `rm`
- `find`
- `du -sh`
- `df -h`

### Docker

- `docker ps`
- `docker logs NOME_DO_CONTAINER`
- `docker restart NOME_DO_CONTAINER`
- `docker exec -it NOME_DO_CONTAINER sh`
- `docker compose up -d --build`

### Rede e debug

- `curl`
- `ss -lntp`
- `grep`

### Nginx

- `nginx -t`
- `systemctl reload nginx`

---

## Mapa mental que voce precisa gravar

Se voce memorizar este diagrama, muita coisa fica facil:

```text
Dominio publico
  -> Nginx
  -> porta local
  -> container
  -> app
  -> banco + storage
```

Aplicando ao Figurinhas:

```text
figurinhas.tech
  -> Nginx
  -> 4310 frontend / 8091 api
  -> figurinhas_frontend / figurinhas_backend
  -> React / FastAPI
  -> SQLite + /storage
```

---

## Como estudar isso sem se perder

Eu recomendo esta ordem:

### Modulo 1: Linux basico

Entender:

- o que e pasta
- o que e arquivo
- o que e caminho absoluto
- o que e permissao

### Modulo 2: Web basica

Entender:

- dominio
- IP
- porta
- HTTP
- HTTPS
- requisicao
- resposta

### Modulo 3: Nginx

Entender:

- `server_name`
- `location`
- `proxy_pass`
- SSL
- redirect

### Modulo 4: Docker

Entender:

- imagem
- container
- volume
- bind mount
- rede
- compose

### Modulo 5: Banco

Entender:

- tabela
- registro
- SQL basico
- SQLite
- Postgres

### Modulo 6: Arquitetura do seu caso

Voltar nesta apostila e cruzar:

- dominio
- Nginx
- container
- porta
- banco
- storage

---

## Exercicio pratico 1

Objetivo:

- descobrir como o Figurinhas chega no backend

Passos:

1. abrir:
   - `/etc/nginx/sites-available/figurinhas.tech`
2. localizar `location /api/`
3. identificar o `proxy_pass`
4. responder:
   - para qual porta vai a API?

Resposta esperada:

- `127.0.0.1:8091`

---

## Exercicio pratico 2

Objetivo:

- entender onde fica o banco do Figurinhas

Passos:

1. abrir o compose:
   - `/opt/percursoaprovado/apps/figurinhas/docker-compose.figurinhas.yml`
2. localizar:
   - `FIGURINHAS_DATABASE_URL`
3. ver o caminho
4. conferir se existe no disco

Resposta esperada:

- o banco e o arquivo SQLite em `storage/figurinhas.sqlite3`

---

## Exercicio pratico 3

Objetivo:

- entender por que os arquivos sobrevivem a rebuild

Passos:

1. rodar:
   - `docker inspect figurinhas_backend`
2. procurar `Mounts`
3. identificar o bind mount do `storage`

Conclusao esperada:

- os dados estao fora do container
- por isso continuam existindo quando o container e recriado

---

## Exercicio pratico 4

Objetivo:

- enxergar a divisao entre frontend e backend

Passos:

1. rodar:
   - `docker ps`
2. identificar:
   - `figurinhas_frontend`
   - `figurinhas_backend`
3. olhar as portas

Conclusao esperada:

- o frontend e um servico
- o backend e outro
- eles nao sao o mesmo processo

---

## Perguntas que voce deve conseguir responder depois de estudar isto

1. O que e Nginx e qual o papel dele na VPS?
2. Qual a diferenca entre frontend e backend?
3. O que e um container?
4. O que e uma porta?
5. Onde o Figurinhas guarda os dados?
6. Por que o banco do Figurinhas e diferente do banco do Percurso Aprovado?
7. O que acontece quando rodamos `docker compose up -d --build`?
8. Por que aparece `502 Bad Gateway` em alguns deploys?
9. O que e `storage`?
10. O que e um bind mount?

Se voce conseguir responder essas 10, ja vai ler a maior parte dessa VPS com muito mais seguranca.

---

## Proximo material recomendado

Depois desta apostila, eu montaria mais tres guias:

1. `Guia de Linux para sua VPS`
2. `Guia de Docker e Docker Compose no seu ambiente`
3. `Guia de Nginx com os dominios reais do projeto`

Esses tres fecham quase todo o entendimento pratico do servidor.

