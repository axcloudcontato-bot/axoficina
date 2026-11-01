#!/usr/bin/env bash
# Backup diário fora do servidor: gera o dump do banco e das fotos (backup.sh), confere os arquivos,
# criptografa com a chave pública age, envia ao armazenamento externo (rclone) e apaga o que passou do prazo.
# Configuração em /etc/ofix-backup.env (veja docs/backup-offsite.md). Rodado pelo timer ofix-backup.timer.
#   sudo bash deploy/debian/backup-offsite.sh
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CONFIG_FILE="${OFIX_BACKUP_CONFIG:-/etc/ofix-backup.env}"
LOCAL_DIR="$ROOT_DIR/backups"

[[ -f "$CONFIG_FILE" ]] || { echo "Configuração ausente: $CONFIG_FILE (veja docs/backup-offsite.md)"; exit 1; }
# shellcheck source=/dev/null
source "$CONFIG_FILE"
: "${RCLONE_REMOTE:?Defina RCLONE_REMOTE em $CONFIG_FILE (ex.: r2:ofix-backups)}"
: "${AGE_RECIPIENT:?Defina AGE_RECIPIENT em $CONFIG_FILE (a chave pública age1...)}"
KEEP_DAILY_DAYS="${KEEP_DAILY_DAYS:-14}"
KEEP_WEEKLY_DAYS="${KEEP_WEEKLY_DAYS:-35}"
KEEP_LOCAL_DAYS="${KEEP_LOCAL_DAYS:-3}"
HEALTHCHECK_URL="${HEALTHCHECK_URL:-}"
# An rclone config outside root's default (e.g. one already used by other backups) can be named in the env file.
[[ -z "${RCLONE_CONFIG:-}" ]] || export RCLONE_CONFIG

for command in age rclone docker curl; do
  command -v "$command" >/dev/null || { echo "Comando ausente: $command (veja docs/backup-offsite.md)"; exit 1; }
done

# The heartbeat service warns by e-mail when a run fails or when no run arrives in time.
ping() { [[ -z "$HEALTHCHECK_URL" ]] || curl -fsS -m 10 --retry 3 --data-raw "${2:-}" "$HEALTHCHECK_URL$1" >/dev/null || true; }
WORK="$(mktemp -d)"
cleanup() { rm -rf "$WORK"; }
fail() { ping /fail "Backup falhou na linha $1 de backup-offsite.sh"; }
trap cleanup EXIT
trap 'fail $LINENO' ERR
ping /start

BACKUP_DIR="$WORK" bash "$ROOT_DIR/deploy/debian/backup.sh"

# A broken or empty dump must fail here, not on the day it is needed. grep stops early, so pipefail is off for it.
contains() { (set +o pipefail; gunzip -c "$1" | grep -q -F "$2"); }
dump="$(ls "$WORK"/postgres-*.sql.gz)"
uploads="$(ls "$WORK"/uploads-*.tar.gz)"
gzip -t "$dump"
gzip -t "$uploads"
contains "$dump" 'CREATE TABLE public.tenants' || { echo "O dump não contém a tabela tenants."; false; }
contains "$dump" 'COPY public.service_orders' || { echo "O dump não contém os dados das ordens de serviço."; false; }

for file in "$dump" "$uploads"; do
  age -r "$AGE_RECIPIENT" -o "$file.age" "$file"
  rm -f "$file"
done

rclone copy "$WORK" "$RCLONE_REMOTE/daily" --include '*.age'
rclone check --one-way "$WORK" "$RCLONE_REMOTE/daily" --include '*.age'
# Sunday's copy is also kept as the weekly one.
if [[ "$(date -u +%u)" == "7" ]]; then
  rclone copy "$WORK" "$RCLONE_REMOTE/weekly" --include '*.age'
fi

# Nothing is kept past the deadline: an erased workshop leaves the backups too (see the privacy policy).
rclone delete --min-age "${KEEP_DAILY_DAYS}d" "$RCLONE_REMOTE/daily"
rclone delete --min-age "${KEEP_WEEKLY_DAYS}d" "$RCLONE_REMOTE/weekly"

# A few encrypted copies stay on the server for a quick restore; plain copies from manual runs expire too.
mkdir -p "$LOCAL_DIR"
mv "$WORK"/*.age "$LOCAL_DIR"/
find "$LOCAL_DIR" -maxdepth 1 -type f -name '*.age' -mtime +"$KEEP_LOCAL_DAYS" -delete
find "$LOCAL_DIR" -maxdepth 1 -type f \( -name 'postgres-*.sql.gz' -o -name 'uploads-*.tar.gz' \) -mtime +"$KEEP_WEEKLY_DAYS" -delete

summary="Backup enviado: $(basename "$dump").age e $(basename "$uploads").age para $RCLONE_REMOTE"
echo "$summary"
ping "" "$summary"
