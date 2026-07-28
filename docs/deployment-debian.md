# Instalação no Debian (portas 3005 e 3006)

Este guia instala a Oficina Mecânica com Docker Compose:

- frontend Next.js em `http://IP_DO_SERVIDOR:3005`;
- backend NestJS em `http://IP_DO_SERVIDOR:3006`;
- PostgreSQL e Redis acessíveis somente pela rede interna do Docker;
- migrações Prisma e seed executados automaticamente;
- dados do banco e fotos armazenados em volumes persistentes.

## 1. Requisitos

Use Debian 12 ou mais recente, com no mínimo 2 GB de RAM e 20 GB livres.
Entre no servidor por SSH com um usuário que tenha `sudo`.

## 2. Instalar Git e Docker

```bash
sudo apt update
sudo apt install -y ca-certificates curl git openssl
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"
newgrp docker
docker --version
docker compose version
```

## 3. Baixar o sistema

```bash
sudo mkdir -p /opt/oficina-mecanica
sudo chown "$USER":"$USER" /opt/oficina-mecanica
git clone https://github.com/sergiooliveiracabonnet/gestao-mecanica.git \
  /opt/oficina-mecanica
cd /opt/oficina-mecanica
```

Se o código for transferido por outro meio, copie-o para
`/opt/oficina-mecanica` e execute os próximos comandos nesse diretório.

## 4. Criar a configuração de produção

Copie o modelo e proteja o arquivo:

```bash
cp deploy/debian/.env.production.example deploy/debian/.env.production
chmod 600 deploy/debian/.env.production
hostname -I
nano deploy/debian/.env.production
```

Substitua `192.168.0.250` pelo IP ou nome DNS do servidor. Use esta base:

```dotenv
SERVER_HOST=192.168.0.250
FRONTEND_HOST_PORT=3005
BACKEND_HOST_PORT=3006
PUBLIC_FRONTEND_URL=http://192.168.0.250:3005
PUBLIC_BACKEND_URL=http://192.168.0.250:3006

POSTGRES_USER=axcloud
POSTGRES_PASSWORD=COLE_A_SENHA_INFORMADA
POSTGRES_DB=axcloudmecanica
DATABASE_URL=postgresql://axcloud:SENHA_CODIFICADA@postgres:5432/axcloudmecanica?schema=public

JWT_SECRET=COLE_UM_SEGREDO_AQUI
SETTINGS_ENCRYPTION_KEY=COLE_OUTRO_SEGREDO_AQUI
JWT_ACCESS_TOKEN_TTL_SECONDS=900
REFRESH_TOKEN_TTL_SECONDS=604800
INVITE_TOKEN_TTL_SECONDS=604800
THROTTLE_TTL=60000
THROTTLE_LIMIT=100
```

Gere os dois segredos, um por vez, e cole os resultados no arquivo:

```bash
openssl rand -base64 48
openssl rand -base64 32
```

Em `POSTGRES_PASSWORD`, use a senha informada sem alterações. Na
`DATABASE_URL`, codifique os caracteres reservados da senha. Para a senha
informada, `@` vira `%40` e `#` vira `%23`. A credencial real deve permanecer
somente em `.env.production`, que é ignorado pelo Git.

## 5. Liberar as portas no firewall

Confirme primeiro qual porta o SSH utiliza. Depois:

```bash
sudo apt install -y ufw
sudo ufw allow OpenSSH
sudo ufw allow 3005/tcp
sudo ufw allow 3006/tcp
sudo ufw enable
sudo ufw status
```

Não libere `5432` nem `6379`: PostgreSQL e Redis não devem ficar expostos.

## 6. Construir e iniciar

```bash
chmod +x deploy/debian/deploy.sh deploy/debian/backup.sh
./deploy/debian/deploy.sh
```

O primeiro build pode levar alguns minutos. O serviço `migrate` aplica todas
as migrações e executa o seed antes de iniciar a API.

## 7. Verificar

```bash
docker compose --env-file deploy/debian/.env.production \
  -f deploy/debian/compose.production.yml ps

curl -fsS http://localhost:3006/health
curl -I http://localhost:3005/login
```

Acesse de outro computador:

- sistema: `http://IP_DO_SERVIDOR:3005`;
- saúde da API: `http://IP_DO_SERVIDOR:3006/health`.

Se a tela abrir mas não acessar a API, confirme que
`PUBLIC_BACKEND_URL` contém o IP do Debian, não `localhost`, e refaça o build.
Essa variável é incorporada ao frontend durante a compilação.

## 8. Logs e diagnóstico

```bash
docker compose --env-file deploy/debian/.env.production \
  -f deploy/debian/compose.production.yml logs -f --tail=200
```

Para um serviço específico, acrescente `backend`, `frontend`, `postgres` ou
`migrate` ao final do comando.

## 9. Atualizar

```bash
cd /opt/oficina-mecanica
git pull --ff-only
./deploy/debian/deploy.sh
```

## 10. Backup

```bash
cd /opt/oficina-mecanica
./deploy/debian/backup.sh
ls -lh backups/
```

Copie regularmente a pasta `backups/` para outro equipamento.

Para restaurar um backup do banco:

```bash
gunzip -c backups/postgres-AAAAmmdd-HHMMSS.sql.gz |
  docker compose --env-file deploy/debian/.env.production \
    -f deploy/debian/compose.production.yml exec -T postgres \
    psql -U axcloud -d axcloudmecanica
```

## HTTPS opcional

As portas 3005/3006 servem por HTTP. Para exposição na internet, prefira um
domínio com HTTPS. Preencha `DOMAIN` e `ACME_EMAIL`, libere 80/443 e inicie o
perfil Caddy:

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
docker compose --profile https \
  --env-file deploy/debian/.env.production \
  -f deploy/debian/compose.production.yml up -d
```

Antes disso, ajuste `PUBLIC_FRONTEND_URL=https://seu-dominio` e
`PUBLIC_BACKEND_URL=https://seu-dominio`, depois execute novamente
`./deploy/debian/deploy.sh` para recompilar o frontend.
