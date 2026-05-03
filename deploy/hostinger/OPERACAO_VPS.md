# Operacao da VPS

Guia rapido para operar a stack de producao da `Percurso Aprovado` na VPS Hostinger com seguranca.

## Objetivo

Padronizar:
- deploy
- validacao
- limpeza de disco
- backups
- rollback

E evitar:
- acumulacao de backups gigantes
- crescimento descontrolado de cache do Docker
- deploy sem `env` correto
- limpeza perigosa de volumes

## Caminhos importantes na VPS

- projeto: `/opt/percursoaprovado`
- script principal de deploy: `/usr/local/sbin/percursoaprovado-deploy-prod.sh`
- logs:
  - `/var/log/percursoaprovado-deploy.log`
  - `/var/log/percursoaprovado-backup-retention.log`
  - `/var/log/percursoaprovado-docker-prune.log`
- retencao automatica:
  - `/usr/local/sbin/percursoaprovado-backup-retention.sh`
  - `/etc/cron.daily/percursoaprovado-backup-retention`
- limpeza automatica do Docker:
  - `/usr/local/sbin/percursoaprovado-docker-prune.sh`
  - `/etc/cron.weekly/percursoaprovado-docker-prune`
- logrotate:
  - `/etc/logrotate.d/percursoaprovado`

## Deploy oficial

Sempre prefira este comando:

```bash
percursoaprovado-deploy-prod.sh
```

Esse fluxo:
- usa `.env.hostinger`
- usa `docker-compose.hostinger.yml`
- faz backup rapido por padrao
- roda `docker compose up -d --build`
- executa limpeza leve do Docker no final
- valida o `health`

### Variantes uteis

Deploy com backup completo:

```bash
BACKUP_MODE=full percursoaprovado-deploy-prod.sh
```

Deploy sem backup:

```bash
BACKUP_MODE=none percursoaprovado-deploy-prod.sh
```

Deploy sem limpeza leve do Docker:

```bash
RUN_DOCKER_PRUNE=0 percursoaprovado-deploy-prod.sh
```

## Politica de backup

### Backup rapido

Padrao do deploy.

Guarda apenas os arquivos criticos:
- `.env.hostinger`
- `.env.hostinger.homolog`, se existir
- `docker-compose.hostinger.yml`
- `docker-compose.hostinger-homolog.yml`, se existir
- `deploy/hostinger`

### Backup completo

Use apenas quando houver mudanca de maior risco:
- rollback mais sensivel
- mudanca grande de infraestrutura
- alteracao manual importante no servidor

## Retencao automatica

Ja configurada na VPS.

Regras atuais:
- manter `1` backup geral
- manter `5` backups de frontend
- manter `3` backups de site
- manter backups explicitamente fixados em:
  - `/root/backup-retention-pinned.txt`

### Ver backups atuais

```bash
ls -lh /root/percursoaprovado*.tar.gz
```

### Fixar um backup importante

Adicione o caminho completo no arquivo:

```bash
echo '/root/percursoaprovado-site-backup-AAAAmmdd-HHMMSS.tar.gz' >> /root/backup-retention-pinned.txt
```

### Rodar a retencao manualmente

```bash
/usr/local/sbin/percursoaprovado-backup-retention.sh
```

## Limpeza do Docker

Ja configurada semanalmente, de forma conservadora.

Ela faz:
- `docker builder prune -af --filter 'until=168h'`
- `docker image prune -af --filter 'until=336h'`

Ela nao faz:
- remocao de volumes
- limpeza do banco
- remocao de containers ativos

### Rodar manualmente

```bash
/usr/local/sbin/percursoaprovado-docker-prune.sh
```

### Ver o consumo do Docker

```bash
docker system df
df -h /
du -xhd1 /var/lib
```

## Validacao rapida depois de deploy

### Health

```bash
curl -sS https://percursoaprovado.com.br/api/actuator/health
```

Esperado:

```json
{"status":"UP"}
```

### Rotas principais

```bash
curl -I https://percursoaprovado.com.br/
curl -I https://percursoaprovado.com.br/login
curl -I https://percursoaprovado.com.br/painel
curl -I https://percursoaprovado.com.br/admin
```

### Containers

```bash
docker ps
docker compose --env-file /opt/percursoaprovado/.env.hostinger -f /opt/percursoaprovado/docker-compose.hostinger.yml ps
```

## Logs uteis

### Deploy

```bash
tail -n 100 /var/log/percursoaprovado-deploy.log
```

### Retencao de backups

```bash
tail -n 100 /var/log/percursoaprovado-backup-retention.log
```

### Limpeza do Docker

```bash
tail -n 100 /var/log/percursoaprovado-docker-prune.log
```

### Backend

```bash
docker logs --tail 200 percursoaprovado_backend
```

### Frontend

```bash
docker logs --tail 200 percursoaprovado_frontend
```

## Rollback

### Quando usar

Use rollback quando:
- deploy quebrou a aplicacao
- health nao sobe
- houve regressao clara e urgente

### Regra

Antes de qualquer rollback:
- validar `health`
- olhar logs do backend
- confirmar se o problema e de deploy e nao de dados externos

### Passos basicos

1. listar backups:

```bash
ls -lh /root/percursoaprovado*.tar.gz
```

2. escolher o backup correto

3. restaurar somente se necessario, preservando:
- `.env.hostinger`
- `.env.hostinger.homolog`, se existir

4. subir novamente a stack

5. validar `health`

## O que nunca fazer sem decisao explicita

Nao rode:

```bash
docker system prune -a --volumes
docker volume prune -f
docker compose down -v
rm -rf /var/lib/docker
rm -rf /var/lib/containerd
```

Esses comandos podem apagar:
- banco
- arquivos persistidos
- volumes de outras stacks

## Checklist operacional

### Antes do deploy

- confirmar branch e codigo
- confirmar `.env.hostinger`
- confirmar se precisa `BACKUP_MODE=full` ou `quick`

### Durante o deploy

- usar `percursoaprovado-deploy-prod.sh`
- acompanhar `/var/log/percursoaprovado-deploy.log`

### Depois do deploy

- validar `health`
- validar pagina inicial
- validar painel/admin, se a mudanca tocar autenticacao
- checar `docker ps`

## Comandos de referencia

Uso de disco:

```bash
df -h /
du -xhd1 /root
du -xhd1 /var/lib
```

Backups atuais:

```bash
ls -lh /root/percursoaprovado*.tar.gz
```

Deploy oficial:

```bash
percursoaprovado-deploy-prod.sh
```

Health:

```bash
curl -sS https://percursoaprovado.com.br/api/actuator/health
```

## Resumo

Fluxo recomendado:

1. `percursoaprovado-deploy-prod.sh`
2. validar `health`
3. se precisar, olhar logs
4. deixar retencao e limpeza automatica fazerem o trabalho normal

Evite:
- backup completo em todo deploy
- prune agressivo
- limpeza manual de volume
- deploy fora do script padronizado
