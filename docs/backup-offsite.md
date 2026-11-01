# Backup fora do servidor

Todo dia às 03:00 (horário de Brasília) o servidor gera o backup do banco e das fotos, confere os arquivos e
envia para um armazenamento externo via rclone (Google Drive, Cloudflare R2 ou qualquer outro que o rclone
aceite). Opcionalmente, criptografa antes de enviar e avisa por e-mail se falhar.

| Peça | Arquivo |
|---|---|
| Geração do dump (banco + fotos) | `deploy/debian/backup.sh` |
| Conferência, criptografia, envio e retenção | `deploy/debian/backup-offsite.sh` |
| Agendamento | `deploy/debian/systemd/ofix-backup.service` e `ofix-backup.timer` |
| Prova de restauração | `deploy/debian/restore-test.sh` |
| Configuração (só no servidor, nunca no Git) | `/etc/ofix-backup.env` |

## Instalação rápida (servidor que já usa o rclone)

Pré-requisito: um remote do rclone funcionando para o root (`rclone listremotes` mostra o nome dele). Troque
`nexus-gdrive` pelo nome do seu remote. Cole tudo de uma vez, como root, em `/opt/oficina-mecanica`:

```bash
rclone mkdir nexus-gdrive:ofix-backups
cat > /etc/ofix-backup.env <<'EOF'
RCLONE_REMOTE=nexus-gdrive:ofix-backups
export RCLONE_DRIVE_USE_TRASH=false
EOF
chmod 600 /etc/ofix-backup.env
bash deploy/debian/backup-offsite.sh
rclone ls nexus-gdrive:ofix-backups/daily
cp deploy/debian/systemd/ofix-backup.service deploy/debian/systemd/ofix-backup.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now ofix-backup.timer
systemctl list-timers ofix-backup.timer
```

Pronto: o backup roda todo dia às 03:00. Para ver a última execução: `journalctl -u ofix-backup.service -n 50`.

- **Use uma pasta só do Ofix.** O script apaga, dentro de `$RCLONE_REMOTE/daily` e `$RCLONE_REMOTE/weekly`,
  tudo o que passou do prazo de guarda; nunca aponte para a raiz ou para a pasta de outros backups.
- **`RCLONE_DRIVE_USE_TRASH=false`** faz o Google Drive apagar de verdade os backups vencidos, em vez de
  deixá-los mais 30 dias na lixeira. Em outros armazenamentos a linha não tem efeito.
- Se a configuração do rclone não for a padrão do root, acrescente `RCLONE_CONFIG=/caminho/rclone.conf`.

## Extras opcionais

Cada um é uma linha a mais em `/etc/ofix-backup.env`; o backup funciona sem eles.

### Aviso por e-mail quando falhar (`HEALTHCHECK_URL`)

Sem isso, um backup que parou de funcionar passa despercebido. Crie uma conta grátis em healthchecks.io, um
check `Ofix backup` com período **1 dia** e tolerância **2 horas**, e copie a URL de ping:

```bash
HEALTHCHECK_URL=https://hc-ping.com/seu-codigo
```

### Criptografia (`AGE_RECIPIENT`)

Sem criptografia, quem tiver acesso à conta do armazenamento consegue ler os dados das oficinas. Com ela, o
servidor só tem a chave pública (tranca, mas não abre); a chave privada fica com você. **Sem a chave privada
os backups não servem para nada, inclusive para você:** guarde-a em dois lugares.

No servidor, `apt install -y age`. No seu computador (Windows: `winget install FiloSottile.age`):

```bash
age-keygen -o ofix-backup-key.txt
```

A linha `# public key: age1...` é a chave pública; a linha `AGE-SECRET-KEY-...` é a privada. Guarde o arquivo
inteiro no gerenciador de senhas e acrescente a pública na configuração:

```bash
AGE_RECIPIENT=age1...
```

### Outros ajustes

`KEEP_DAILY_DAYS=14`, `KEEP_WEEKLY_DAYS=35` e `KEEP_LOCAL_DAYS=3` são os padrões do prazo de guarda.

## Prazo de guarda e LGPD

Backups diários ficam 14 dias, o de domingo 35 dias, e as cópias no próprio servidor (em `backups/`, incluindo
as de execuções manuais do `backup.sh`) 3 dias. Um dump corrompido ou sem as tabelas principais faz o backup
falhar na hora, em vez de ser descoberto no dia da restauração.

Uma oficina encerrada fica 30 dias aguardando restauração e então é apagada do banco. Os dados dela somem
dos backups em até 35 dias depois disso, quando o último backup que ainda os contém expira. Portanto, os
dados de uma oficina encerrada deixam de existir em qualquer cópia em até **65 dias** após o encerramento.
Se um backup antigo for restaurado, reaplique os apagamentos feitos depois dele (a tabela
`account_closures` lista as oficinas apagadas e quando).

## Teste de restauração (uma vez por mês)

Prova de que o backup volta, sem tocar na produção: baixa o backup mais recente, restaura num Postgres
descartável (sem rede) e mostra as contagens.

```bash
bash deploy/debian/restore-test.sh
```

Se os backups forem criptografados, passe a chave privada por uma memória temporária (não vai para o disco):

```bash
nano /dev/shm/ofix-backup-key.txt
bash deploy/debian/restore-test.sh /dev/shm/ofix-backup-key.txt
shred -u /dev/shm/ofix-backup-key.txt
```

Compare as contagens com a produção. Se algo falhar, o backup não está bom: investigue antes de qualquer
outra coisa.

## Restauração de verdade (servidor novo)

O banco precisa ser restaurado **vazio**, antes das migrações rodarem; por isso o `deploy.sh` vem por último.

1. Instale o Docker, clone o repositório em `/opt/oficina-mecanica` e recrie o
   `deploy/debian/.env.production` (guarde uma cópia dele no gerenciador de senhas; sem ele, refazer as
   senhas e chaves dá muito trabalho). Veja `docs/deployment-debian.md`.
2. Instale o `rclone`, configure o mesmo remote e baixe o backup (troque o remote e a data):

   ```bash
   rclone copy nexus-gdrive:ofix-backups/daily/postgres-AAAAmmdd-HHMMSS.sql.gz .
   rclone copy nexus-gdrive:ofix-backups/daily/uploads-AAAAmmdd-HHMMSS.tar.gz .
   mv postgres-AAAAmmdd-HHMMSS.sql.gz dump.sql.gz
   mv uploads-AAAAmmdd-HHMMSS.tar.gz uploads.tar.gz
   ```

   Se forem criptografados (terminam em `.age`), baixe-os, cole a chave privada em
   `/dev/shm/ofix-backup-key.txt` e descriptografe:

   ```bash
   age -d -i /dev/shm/ofix-backup-key.txt -o dump.sql.gz postgres-AAAAmmdd-HHMMSS.sql.gz.age
   age -d -i /dev/shm/ofix-backup-key.txt -o uploads.tar.gz uploads-AAAAmmdd-HHMMSS.tar.gz.age
   ```

3. Suba só o banco, restaure-o e devolva as fotos ao volume:

   ```bash
   compose() { docker compose --env-file deploy/debian/.env.production -f deploy/debian/compose.production.yml "$@"; }
   compose up -d postgres
   gunzip -c dump.sql.gz | compose exec -T postgres sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
   docker volume create oficina-production_service_order_uploads
   docker run --rm -v oficina-production_service_order_uploads:/target -v "$PWD:/backup:ro" alpine:3.22 tar -xzf /backup/uploads.tar.gz -C /target
   ```

4. Rode `bash deploy/debian/deploy.sh`. As migrações já registradas no backup são puladas e só as mais novas
   são aplicadas.
5. Confira `curl http://127.0.0.1:3006/health` e entre no sistema. Apague `dump.sql.gz` e `uploads.tar.gz`
   (e a chave, se usou: `shred -u /dev/shm/ofix-backup-key.txt`).
