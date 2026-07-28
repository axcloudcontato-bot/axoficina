#!/bin/bash
set -e

echo "======================================"
echo "INSTALAÇÃO - GESTÃO MECÂNICA"
echo "Servidor: 192.168.0.250"
echo "======================================"
echo ""

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# ============================================
# 1. VERIFICAR E INSTALAR NODE.JS
# ============================================
echo -e "${YELLOW}[1/6] Verificando Node.js...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}Node.js não encontrado. Instalando...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
else
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✓ Node.js já instalado: $NODE_VERSION${NC}"
fi

NPM_VERSION=$(npm --version)
echo -e "${GREEN}✓ npm versão: $NPM_VERSION${NC}"
echo ""

# ============================================
# 2. CRIAR DIRETÓRIO E CLONAR REPOSITÓRIO
# ============================================
echo -e "${YELLOW}[2/6] Clonando repositório...${NC}"
PROJECT_DIR="/opt/gestao-mecanica"

if [ -d "$PROJECT_DIR" ]; then
    echo -e "${YELLOW}Diretório já existe. Atualizando...${NC}"
    cd "$PROJECT_DIR"
    git pull origin main || git pull origin master
else
    mkdir -p /opt
    cd /opt
    git clone https://github.com/sergiooliveiracabonnet/gestao-mecanica.git
    cd "$PROJECT_DIR"
fi

echo -e "${GREEN}✓ Repositório pronto em: $PROJECT_DIR${NC}"
echo ""

# ============================================
# 3. LISTAR ESTRUTURA DO PROJETO
# ============================================
echo -e "${YELLOW}[3/6] Analisando estrutura do projeto...${NC}"
echo "Conteúdo do diretório:"
ls -la
echo ""

# ============================================
# 4. INSTALAR DEPENDÊNCIAS
# ============================================
echo -e "${YELLOW}[4/6] Instalando dependências...${NC}"

# Verificar se é monorepo (existe pasta backend e frontend)
if [ -d "backend" ] && [ -d "frontend" ]; then
    echo "Monorepo detectado (backend + frontend)"

    # Instalar backend
    echo "Instalando dependências do backend..."
    cd "$PROJECT_DIR/backend"
    npm install

    # Instalar frontend
    echo "Instalando dependências do frontend..."
    cd "$PROJECT_DIR/frontend"
    npm install

    cd "$PROJECT_DIR"
elif [ -f "package.json" ]; then
    echo "Projeto single instalando dependências..."
    npm install
else
    echo -e "${RED}✗ Não foi encontrado package.json ou estrutura de monorepo${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Dependências instaladas${NC}"
echo ""

# ============================================
# 5. CRIAR BANCO DE DADOS MYSQL
# ============================================
echo -e "${YELLOW}[5/6] Configurando banco de dados MySQL...${NC}"

DB_NAME="gestao_mecanica"
DB_USER="gestor_mecanica"
DB_PASS="$(openssl rand -base64 12)"

echo "Criando banco de dados: $DB_NAME"
echo "Usuário: $DB_USER"
echo "Senha: $DB_PASS"
echo ""

# Criar banco de dados e usuário
mysql -u root << EOSQL
CREATE DATABASE IF NOT EXISTS \`$DB_NAME\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASS';
GRANT ALL PRIVILEGES ON \`$DB_NAME\`.* TO '$DB_USER'@'localhost';
FLUSH PRIVILEGES;
EOSQL

echo -e "${GREEN}✓ Banco de dados criado${NC}"
echo ""

# ============================================
# 6. CRIAR ARQUIVOS .ENV
# ============================================
echo -e "${YELLOW}[6/6] Criando arquivos de configuração (.env)...${NC}"

# .env para backend
if [ -d "backend" ]; then
    cat > "$PROJECT_DIR/backend/.env" << EOFENV
# Database
DB_HOST=localhost
DB_PORT=3306
DB_USER=$DB_USER
DB_PASS=$DB_PASS
DB_NAME=$DB_NAME

# Server
NODE_ENV=production
PORT=3006
APP_URL=http://localhost:3006

# Frontend
FRONTEND_URL=http://localhost:3005
EOFENV
    echo -e "${GREEN}✓ backend/.env criado${NC}"
fi

# .env para frontend
if [ -d "frontend" ]; then
    cat > "$PROJECT_DIR/frontend/.env" << EOFENV
# Frontend
REACT_APP_API_URL=http://localhost:3006
REACT_APP_PORT=3005
NODE_ENV=production
EOFENV
    echo -e "${GREEN}✓ frontend/.env criado${NC}"
fi

# .env na raiz se for single
if [ -f "$PROJECT_DIR/package.json" ] && [ ! -d "backend" ]; then
    cat > "$PROJECT_DIR/.env" << EOFENV
# Database
DB_HOST=localhost
DB_PORT=3306
DB_USER=$DB_USER
DB_PASS=$DB_PASS
DB_NAME=$DB_NAME

# Server
NODE_ENV=production
PORT=3006
APP_URL=http://localhost:3006
FRONTEND_URL=http://localhost:3005
REACT_APP_API_URL=http://localhost:3006
EOFENV
    echo -e "${GREEN}✓ .env criado na raiz${NC}"
fi

echo ""
echo "======================================"
echo -e "${GREEN}✓ INSTALAÇÃO CONCLUÍDA COM SUCESSO!${NC}"
echo "======================================"
echo ""
echo "Próximos passos:"
echo ""
echo "1. Executar migrations do banco (se necessário):"
echo "   cd $PROJECT_DIR/backend"
echo "   npm run migrate"
echo ""
echo "2. Para iniciar em desenvolvimento:"
echo "   cd $PROJECT_DIR/backend && npm start &"
echo "   cd $PROJECT_DIR/frontend && npm start &"
echo ""
echo "3. Para iniciar em produção (recomendado com PM2):"
echo "   npm install -g pm2"
echo "   cd $PROJECT_DIR/backend && pm2 start 'npm start' --name 'gestao-mecanica-backend'"
echo "   cd $PROJECT_DIR/frontend && pm2 start 'npm start' --name 'gestao-mecanica-frontend'"
echo ""
echo "4. URLs de acesso:"
echo "   Frontend: http://192.168.0.250:3005"
echo "   Backend:  http://192.168.0.250:3006"
echo ""
echo "Credenciais do banco de dados:"
echo "  Host: localhost"
echo "  User: $DB_USER"
echo "  Password: $DB_PASS"
echo "  Database: $DB_NAME"
echo ""
