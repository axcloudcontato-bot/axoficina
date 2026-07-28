#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="$ROOT_DIR/deploy/debian/.env.production"
COMPOSE_FILE="$ROOT_DIR/deploy/debian/compose.production.yml"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Arquivo ausente: $ENV_FILE"
  echo "Copie .env.production.example e preencha os segredos."
  exit 1
fi

for command in docker openssl; do
  command -v "$command" >/dev/null || { echo "Comando obrigatório ausente: $command"; exit 1; }
done

if grep -Eq '=(gere_|COLE_)' "$ENV_FILE"; then
  echo "Substitua os segredos de exemplo em $ENV_FILE antes de implantar."
  exit 1
fi

docker compose version >/dev/null
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" config --quiet
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" build --pull
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --remove-orphans
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps

echo "Implantação concluída. O certificado pode levar alguns instantes para ser emitido."
