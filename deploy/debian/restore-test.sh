#!/usr/bin/env bash
# Prova de que o backup volta: baixa o backup mais recente do armazenamento externo, descriptografa (se estiver
# criptografado), restaura num Postgres descartável e mostra as contagens. Não toca na produção.
#   sudo bash deploy/debian/restore-test.sh                                # backups sem criptografia
#   sudo bash deploy/debian/restore-test.sh /dev/shm/ofix-backup-key.txt   # backups criptografados com age
# A chave privada nunca fica no servidor: copie-a só para rodar o teste e apague em seguida.
set -Eeuo pipefail

IDENTITY="${1:-}"
CONFIG_FILE="${OFIX_BACKUP_CONFIG:-/etc/ofix-backup.env}"
[[ -z "$IDENTITY" || -f "$IDENTITY" ]] || { echo "Chave não encontrada: $IDENTITY"; exit 1; }
[[ -f "$CONFIG_FILE" ]] || { echo "Configuração ausente: $CONFIG_FILE"; exit 1; }
# shellcheck source=/dev/null
source "$CONFIG_FILE"
: "${RCLONE_REMOTE:?Defina RCLONE_REMOTE em $CONFIG_FILE}"
[[ -z "${RCLONE_CONFIG:-}" ]] || export RCLONE_CONFIG
POSTGRES_IMAGE="${POSTGRES_IMAGE:-docker.io/library/postgres:16-alpine}"

WORK="$(mktemp -d)"
CONTAINER="ofix-restore-test-$$"
cleanup() { docker rm -f "$CONTAINER" >/dev/null 2>&1 || true; rm -rf "$WORK"; }
trap cleanup EXIT

latest() { rclone lsf "$RCLONE_REMOTE/daily" --include "$1" | sort | tail -n 1; }
dump="$(latest 'postgres-*')"
uploads="$(latest 'uploads-*')"
[[ -n "$dump" && -n "$uploads" ]] || { echo "Nenhum backup encontrado em $RCLONE_REMOTE/daily."; exit 1; }
echo "Testando $dump e $uploads"

# Encrypted files (.age) need the private key; plain ones are used as they come.
fetch() {
  rclone copy "$RCLONE_REMOTE/daily/$1" "$WORK"
  if [[ "$1" == *.age ]]; then
    [[ -n "$IDENTITY" ]] || { echo "O backup é criptografado: informe o arquivo da chave privada age."; exit 1; }
    age -d -i "$IDENTITY" -o "$WORK/$2" "$WORK/$1"
  else
    mv "$WORK/$1" "$WORK/$2"
  fi
}
fetch "$dump" dump.sql.gz
fetch "$uploads" uploads.tar.gz

docker run -d --rm --name "$CONTAINER" --network none -e POSTGRES_PASSWORD=restore-test "$POSTGRES_IMAGE" >/dev/null
for _ in $(seq 1 60); do
  docker exec "$CONTAINER" pg_isready -U postgres -q && break
  sleep 1
done
docker exec "$CONTAINER" pg_isready -U postgres -q || { echo "O Postgres de teste não subiu."; exit 1; }

# The dump assigns its tables to the production role; it must exist for the restore to run clean.
owner="$(set +o pipefail; gunzip -c "$WORK/dump.sql.gz" | grep -m 1 -oE 'OWNER TO [a-zA-Z0-9_]+' | awk '{print $3}')"
[[ -z "$owner" ]] || docker exec "$CONTAINER" psql -q -U postgres -c "CREATE ROLE \"$owner\";"
gunzip -c "$WORK/dump.sql.gz" | docker exec -i "$CONTAINER" psql -q -v ON_ERROR_STOP=1 -U postgres -d postgres >/dev/null

count() { docker exec "$CONTAINER" psql -tA -U postgres -d postgres -c "$1"; }
echo "Restauração concluída. Conteúdo do backup:"
echo "  Oficinas ativas:     $(count 'SELECT count(*) FROM tenants WHERE deleted_at IS NULL')"
echo "  Usuários:            $(count 'SELECT count(*) FROM users')"
echo "  Clientes:            $(count 'SELECT count(*) FROM customers')"
echo "  Ordens de serviço:   $(count 'SELECT count(*) FROM service_orders')"
echo "  Última OS criada em: $(count 'SELECT max(created_at) FROM service_orders')"
echo "  Arquivos de fotos:   $(tar -tzf "$WORK/uploads.tar.gz" | grep -vc '/$' || true)"
echo "Compare com a produção: os números devem bater com o dia do backup."
