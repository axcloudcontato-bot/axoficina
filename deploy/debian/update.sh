#!/usr/bin/env bash
# Atualização rápida: baixa o código e reconstrói só o que mudou.
# Use deploy.sh para uma implantação completa (primeira vez ou após mudar o ambiente).
#   bash deploy/debian/update.sh            # só o que mudou desde o último pull
#   bash deploy/debian/update.sh --force    # reconstrói backend e frontend mesmo sem mudanças
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="$ROOT_DIR/deploy/debian/.env.production"
COMPOSE_FILE="$ROOT_DIR/deploy/debian/compose.production.yml"
FORCE="${1:-}"

[[ -f "$ENV_FILE" ]] || { echo "Arquivo ausente: $ENV_FILE"; exit 1; }
compose() { docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"; }

cd "$ROOT_DIR"
OLD="$(git rev-parse HEAD)"
git pull --ff-only
NEW="$(git rev-parse HEAD)"

if [[ "$OLD" == "$NEW" && "$FORCE" != "--force" ]]; then
  echo "Nada novo para implantar ($NEW)."
  exit 0
fi

backend=0; frontend=0; caddy=0
if [[ "$FORCE" == "--force" ]]; then
  backend=1; frontend=1
else
  while IFS= read -r file; do
    case "$file" in
      frontend/*) frontend=1 ;;
      backend/*|database/*) backend=1 ;;
      packages/contracts/*) backend=1; frontend=1 ;;
      package.json|pnpm-lock.yaml|pnpm-workspace.yaml|tsconfig*.json) backend=1; frontend=1 ;;
      deploy/debian/compose.production.yml) backend=1; frontend=1; caddy=1 ;;
      deploy/debian/Caddyfile) caddy=1 ;;
    esac
  done < <(git diff --name-only "$OLD" "$NEW")
fi

if (( ! backend && ! frontend && ! caddy )); then
  echo "As mudanças ($OLD..$NEW) não afetam a aplicação em produção (docs, testes ou arquivos de apoio)."
  exit 0
fi

compose config --quiet

# O migrate usa a mesma imagem do backend (etapa de build); reconstruí-lo é barato.
services=()
(( backend )) && services+=(migrate backend)
(( frontend )) && services+=(frontend)

if (( ${#services[@]} )); then
  echo "Reconstruindo: ${services[*]}"
  compose build "${services[@]}"
fi

# Ordem importa: o frontend só sobe com o backend saudável (depends_on).
(( backend )) && compose up -d backend
(( frontend )) && compose up -d --no-deps frontend
(( caddy )) && compose up -d caddy && compose restart caddy

docker image prune -f >/dev/null
compose ps
echo "Atualização concluída: $(git rev-parse --short HEAD) (backend=$backend frontend=$frontend caddy=$caddy)."
