# Backup fora do servidor

Todo dia às 03:00 (horário de Brasília) o servidor gera o backup do banco e das fotos, confere os arquivos,
criptografa e envia para um armazenamento externo (Cloudflare R2 ou outro compatível com S3). Se o backup
falhar ou não rodar, chega um e-mail.

| Peça | Arquivo |
|---|---|
| Geração do dump (banco + fotos) | `deploy/debian/backup.sh` |
| Conferência, criptografia, envio e retenção | `deploy/debian/backup-offsite.sh` |
| Agendamento | `deploy/debian/systemd/ofix-backup.service` e `ofix-backup.timer` |
| Prova de restauração | `deploy/debian/restore-test.sh` |
| Configuração (só no servidor, nunca no Git) | `/etc/ofix-backup.env` |

## Como os dados ficam protegidos

- **Criptografia com chave pública (age).** O servidor só tem a chave pública: ele consegue criptografar,
  mas não descriptografar. A chave privada fica com o responsável, num gerenciador de senhas. Quem invadir o
  servidor ou o armazenamento não lê os backups. **Sem a chave privada os backups não servem para nada,
  inclusive para você:** guarde-a em dois lugares.
- **Conferência antes do envio.** Um dump corrompido ou sem as tabelas principais faz o backup falhar na hora
  (e chega o e-mail), em vez de ser descoberto no dia da restauração.
- **Prazo de guarda.** Backups diários por 14 dias, o de domingo por 35 dias, e cópias criptografadas no
  próprio servidor por 3 dias. Nada fica guardado por mais de 35 dias. Cópias sem criptografia deixadas por
  execuções manuais antigas do `backup.sh` em `backups/` são apagadas depois de 35 dias.

### Prazo de guarda e LGPD

Uma oficina encerrada fica 30 dias aguardando restauração e então é apagada do banco. Os dados dela somem
dos backups em até 35 dias depois disso, quando o último backup que ainda os contém expira. Portanto, os
dados de uma oficina encerrada deixam de existir em qualquer cópia em até **65 dias** após o encerramento.
Se um backup antigo for restaurado, reaplique os apagamentos feitos depois dele (a tabela
`account_closures` lista as oficinas apagadas e quando).

## Instalação (uma vez)

### 1. Programas no servidor

```bash
sudo apt install -y age rclone   # se o rclone já estiver instalado, basta o age
```

### 2. Par de chaves de criptografia (no seu computador, não no servidor)

No Windows: `winget install FiloSottile.age`. Depois:

```bash
age-keygen -o ofix-backup-key.txt
```

O arquivo tem duas partes: a linha `# public key: age1...` é a **chave pública** (vai para o servidor) e a
linha `AGE-SECRET-KEY-...` é a **chave privada**. Guarde o arquivo inteiro no gerenciador de senhas (e numa
segunda cópia segura) e apague-o do computador.

### 3. Armazenamento (Cloudflare R2)

1. No painel da Cloudflare, **R2 → Create bucket**, nome `ofix-backups`, sem acesso público.
2. **R2 → Manage API tokens → Create API token**, permissão **Object Read & Write**, restrita ao bucket
   `ofix-backups`. Anote o Access Key ID, o Secret Access Key e o endpoint
   (`https://<id-da-conta>.r2.cloudflarestorage.com`).
3. No servidor, configure o rclone de forma interativa (as chaves não ficam no histórico do terminal):

   ```bash
   sudo rclone config
   ```

   Escolha `n` (novo), nome `r2`, tipo `s3`, provedor `Cloudflare`, cole o Access Key ID e o Secret, e
   informe o endpoint. Deixe o resto no padrão. Teste com `sudo rclone lsd r2:` (deve listar `ofix-backups`).

#### Se o servidor já usa o rclone para outros backups (Zabbix, Grafana...)

Dá para reaproveitar o remote que já existe, em vez de criar um novo:

1. Descubra qual configuração o backup atual usa e quais remotes ela tem. O timer roda como root, então o que
   vale é o que o root enxerga:

   ```bash
   sudo rclone config file
   sudo rclone listremotes
   ```

   Se o remote dos outros backups não aparecer (porque a configuração é de outro usuário), informe o caminho
   dela em `RCLONE_CONFIG` no passo 5.
2. Use uma **pasta só do Ofix** dentro desse remote, por exemplo `RCLONE_REMOTE=meuremote:backups/ofix`.
   Nunca aponte para a raiz ou para uma pasta que os outros backups usam: o script apaga, dentro de
   `$RCLONE_REMOTE/daily` e `$RCLONE_REMOTE/weekly`, tudo o que passou do prazo de guarda.
3. Teste: `sudo rclone mkdir meuremote:backups/ofix` e `sudo rclone lsd meuremote:backups`.

Mesmo que o remote já seja criptografado (tipo `crypt`), mantenha o age: com ele a chave que abre os backups
não fica no servidor.

### 4. Aviso de falha (Healthchecks.io)

1. Crie uma conta grátis em healthchecks.io e um check chamado `Ofix backup`.
2. Período: **1 dia**. Tolerância (grace): **2 horas**. Notificação: seu e-mail.
3. Copie a URL de ping (`https://hc-ping.com/...`).

### 5. Configuração do backup

```bash
sudo install -m 600 /dev/null /etc/ofix-backup.env
sudo nano /etc/ofix-backup.env
```

Conteúdo:

```bash
RCLONE_REMOTE=r2:ofix-backups      # ou a pasta do Ofix no remote que já existe
AGE_RECIPIENT=age1...              # a chave pública do passo 2
HEALTHCHECK_URL=https://hc-ping.com/...
# RCLONE_CONFIG=/caminho/rclone.conf   # só se a configuração não for a padrão do root
# Opcionais (padrões): KEEP_DAILY_DAYS=14 KEEP_WEEKLY_DAYS=35 KEEP_LOCAL_DAYS=3
```

### 6. Primeiro backup, à mão

```bash
cd /opt/oficina-mecanica
sudo bash deploy/debian/backup-offsite.sh
sudo rclone ls r2:ofix-backups/daily
```

Devem aparecer `postgres-....sql.gz.age` e `uploads-....tar.gz.age`, e o check no Healthchecks.io fica verde.

### 7. Agendamento diário

```bash
sudo cp deploy/debian/systemd/ofix-backup.service deploy/debian/systemd/ofix-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now ofix-backup.timer
systemctl list-timers ofix-backup.timer
```

Para ver a última execução: `journalctl -u ofix-backup.service -n 50`.

## Teste de restauração (uma vez por mês)

Prova de que o backup volta, sem tocar na produção: baixa o backup mais recente, descriptografa, restaura num
Postgres descartável (sem rede) e mostra as contagens.

```bash
# Cole o conteúdo do arquivo da chave privada numa memória temporária (não vai para o disco):
sudo nano /dev/shm/ofix-backup-key.txt
sudo bash deploy/debian/restore-test.sh /dev/shm/ofix-backup-key.txt
sudo shred -u /dev/shm/ofix-backup-key.txt
```

Compare as contagens com a produção. Se algo falhar, o backup não está bom: investigue antes de qualquer
outra coisa.

## Restauração de verdade (servidor novo)

O banco precisa ser restaurado **vazio**, antes das migrações rodarem; por isso o `deploy.sh` vem por último.

1. Instale o Docker, clone o repositório em `/opt/oficina-mecanica` e recrie o
   `deploy/debian/.env.production` (guarde uma cópia dele no gerenciador de senhas; sem ele, refazer as
   senhas e chaves dá muito trabalho). Veja `docs/deployment-debian.md`.
2. Instale o `age` e o `rclone`, configure o remote `r2` (passo 3 da instalação), cole a chave privada em
   `/dev/shm/ofix-backup-key.txt` e baixe o backup:

   ```bash
   sudo rclone copy r2:ofix-backups/daily/postgres-AAAAmmdd-HHMMSS.sql.gz.age .
   sudo rclone copy r2:ofix-backups/daily/uploads-AAAAmmdd-HHMMSS.tar.gz.age .
   age -d -i /dev/shm/ofix-backup-key.txt -o dump.sql.gz postgres-AAAAmmdd-HHMMSS.sql.gz.age
   age -d -i /dev/shm/ofix-backup-key.txt -o uploads.tar.gz uploads-AAAAmmdd-HHMMSS.tar.gz.age
   ```

3. Suba só o banco, restaure-o e devolva as fotos ao volume:

   ```bash
   compose() { docker compose --env-file deploy/debian/.env.production -f deploy/debian/compose.production.yml "$@"; }
   compose up -d postgres
   gunzip -c dump.sql.gz | compose exec -T postgres sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
   docker volume create oficina-production_service_order_uploads
   docker run --rm -v oficina-production_service_order_uploads:/target -v "$PWD:/backup:ro" alpine:3.22      tar -xzf /backup/uploads.tar.gz -C /target
   ```

4. Rode `bash deploy/debian/deploy.sh`. As migrações já registradas no backup são puladas e só as mais novas
   são aplicadas.
5. Confira `curl http://127.0.0.1:3006/health` e entre no sistema. Apague `dump.sql.gz`, `uploads.tar.gz` e
   a chave: `shred -u /dev/shm/ofix-backup-key.txt`.
