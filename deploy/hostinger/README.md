Deploy sugerido para a VPS Hostinger

Pre-requisitos
- Rotacione as credenciais do Mercado Pago antes de usar em producao.
- Aponte os registros `A` de `percursoaprovado.com.br` e `www.percursoaprovado.com.br` para a IP da VPS.
- Garanta Docker, Docker Compose, Nginx e Certbot instalados na VPS.

1. Copie o projeto para a VPS
```bash
mkdir -p /opt/percursoaprovado
cd /opt/percursoaprovado
```

2. Crie o arquivo de ambiente
```bash
cp .env.hostinger.example .env.hostinger
nano .env.hostinger
```

3. Preencha o `.env.hostinger`
- `DB_USER`, `DB_PASS` e `JWT_SECRET` com valores fortes
- `APP_BASE_URL=https://percursoaprovado.com.br`
- `GOOGLE_WEB_CLIENT_ID`, `GOOGLE_WEB_CLIENT_SECRET` e `VITE_GOOGLE_CLIENT_ID` com as credenciais Web do Google
- `MP_PUBLIC_KEY`, `MP_ACCESS_TOKEN` e `MP_WEBHOOK_SECRET` com as credenciais novas

4. Suba a stack isolada
```bash
docker compose --env-file .env.hostinger -f docker-compose.hostinger.yml up -d --build
docker compose --env-file .env.hostinger -f docker-compose.hostinger.yml ps
```

Ou use o script de deploy com politica de backup:
```bash
./deploy/hostinger/deploy.sh
```

Politica de backup do script:
- `BACKUP_MODE=quick` por padrao: salva so arquivos criticos de deploy
- `BACKUP_MODE=full`: gera um backup completo do projeto antes do deploy
- `BACKUP_MODE=none`: nao gera backup

Exemplos:
```bash
./deploy/hostinger/deploy.sh
BACKUP_MODE=full ./deploy/hostinger/deploy.sh
BACKUP_MODE=none ./deploy/hostinger/deploy.sh
```

Variaveis opcionais:
- `BACKUP_DIR` para mudar o destino dos arquivos
- `ENV_FILE` para escolher outro arquivo de ambiente
- `COMPOSE_FILE_PATH` para trocar o compose alvo

Deploy padronizado de producao:
```bash
./deploy/hostinger/deploy-prod.sh
```

Esse comando:
- usa `.env.hostinger`
- usa `docker-compose.hostinger.yml`
- faz `BACKUP_MODE=quick` por padrao
- grava log em `/var/log/percursoaprovado-deploy.log`
- executa limpeza leve do Docker ao final
- valida o health da aplicacao

Variaveis uteis do `deploy-prod.sh`:
- `BACKUP_MODE=full` para um backup completo antes do deploy
- `BACKUP_MODE=none` para pular backup
- `RUN_DOCKER_PRUNE=0` para nao rodar a limpeza leve apos o deploy
- `LOG_FILE=/caminho/arquivo.log` para trocar o destino do log

Rotacao dos logs operacionais:
- use `deploy/hostinger/percursoaprovado.logrotate.conf` em `/etc/logrotate.d/percursoaprovado`
- cobre:
  - `/var/log/percursoaprovado-deploy.log`
  - `/var/log/percursoaprovado-backup-retention.log`
  - `/var/log/percursoaprovado-docker-prune.log`

Operacao diaria da VPS:
- veja `deploy/hostinger/OPERACAO_VPS.md`

5. Instale o site no Nginx do host
```bash
cp deploy/hostinger/percursoaprovado.nginx.conf /etc/nginx/sites-available/percursoaprovado
ln -s /etc/nginx/sites-available/percursoaprovado /etc/nginx/sites-enabled/percursoaprovado
nginx -t
systemctl reload nginx
```

6. Gere o certificado HTTPS
```bash
certbot --nginx -d percursoaprovado.com.br -d www.percursoaprovado.com.br
```

7. Configure o Mercado Pago
- Webhook: `https://percursoaprovado.com.br/api/mercadopago/webhook`
- Sucesso: `https://percursoaprovado.com.br/checkout/sucesso`
- Pendente: `https://percursoaprovado.com.br/checkout/pendente`
- Falha: `https://percursoaprovado.com.br/checkout/falha`
- `auto_return`: `approved`
- Meios de pagamento: `Pix + cartao de credito`

8. Testes rapidos
```bash
curl -I http://127.0.0.1:4300
curl -I http://127.0.0.1:8081/actuator/health
curl -I https://percursoaprovado.com.br
curl -I https://percursoaprovado.com.br/api/locais-prova
```

Observacoes
- Esta stack usa portas locais novas: frontend `127.0.0.1:4300` e backend `127.0.0.1:8081`.
- O banco do projeto nao e publicado externamente.
- O Certbot vai complementar o arquivo do Nginx com os blocos HTTPS na primeira emissao.

Homologacao Mercado Pago
- Recomendo subir a homologacao em `homolog.percursoaprovado.com.br`, com credenciais de teste e banco separado.
- Crie um registro `A` para `homolog.percursoaprovado.com.br` apontando para a mesma VPS.

1. Crie o arquivo de ambiente da homologacao
```bash
cp .env.hostinger.homolog.example .env.hostinger.homolog
nano .env.hostinger.homolog
```

2. Preencha a homologacao
- `DB_USER`, `DB_PASS` e `JWT_SECRET` com valores fortes
- `APP_BASE_URL=https://homolog.percursoaprovado.com.br`
- `GOOGLE_WEB_CLIENT_ID`, `GOOGLE_WEB_CLIENT_SECRET` e `VITE_GOOGLE_CLIENT_ID` com as credenciais Web do Google
- `MP_PUBLIC_KEY`, `MP_ACCESS_TOKEN` e `MP_WEBHOOK_SECRET` com as credenciais de teste

3. Suba a stack isolada da homologacao
```bash
ENV_FILE=/opt/percursoaprovado/.env.hostinger.homolog \
COMPOSE_FILE_PATH=/opt/percursoaprovado/docker-compose.hostinger-homolog.yml \
./deploy/hostinger/deploy.sh
```

4. Instale o vhost da homologacao no Nginx
```bash
SITE_NAME=percursoaprovado-homolog \
NGINX_CONF_SOURCE=/opt/percursoaprovado/deploy/hostinger/percursoaprovado-homolog.nginx.conf \
./deploy/hostinger/install-nginx.sh
```

5. Gere o HTTPS da homologacao
```bash
certbot --nginx -d homolog.percursoaprovado.com.br
```

6. URLs usadas na homologacao
- Webhook: `https://homolog.percursoaprovado.com.br/api/mercadopago/webhook`
- Sucesso: `https://homolog.percursoaprovado.com.br/checkout/sucesso`
- Pendente: `https://homolog.percursoaprovado.com.br/checkout/pendente`
- Falha: `https://homolog.percursoaprovado.com.br/checkout/falha`

7. Testes oficiais do Mercado Pago
- Use as credenciais de teste da aplicacao.
- Crie uma conta teste compradora no painel do Mercado Pago Developers.
- Abra o checkout em janela anonima para evitar conflito entre a conta vendedora e a conta compradora de teste.
- Para cartao, use os cartoes e nomes de teste do Checkout Pro.
- Para Pix, valide o fluxo offline e espere o status permanecer como `pending` durante o teste.
