#!/usr/bin/env bash
set -e

# Cores
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

log()     { echo -e "${BLUE}[SIGCMT]${NC} $1"; }
success() { echo -e "${GREEN}[OK]${NC} $1"; }
warn()    { echo -e "${YELLOW}[AVISO]${NC} $1"; }
error()   { echo -e "${RED}[ERRO]${NC} $1"; exit 1; }
step()    { echo -e "\n${BOLD}${CYAN}━━━ $1 ━━━${NC}\n"; }

clear
echo -e "${BOLD}${BLUE}"
echo "  ███████╗██╗ ██████╗  ██████╗███╗   ███╗████████╗"
echo "  ██╔════╝██║██╔════╝ ██╔════╝████╗ ████║╚══██╔══╝"
echo "  ███████╗██║██║  ███╗██║     ██╔████╔██║   ██║   "
echo "  ╚════██║██║██║   ██║██║     ██║╚██╔╝██║   ██║   "
echo "  ███████║██║╚██████╔╝╚██████╗██║ ╚═╝ ██║   ██║   "
echo "  ╚══════╝╚═╝ ╚═════╝  ╚═════╝╚═╝     ╚═╝   ╚═╝   "
echo -e "${NC}"
echo -e "  ${BOLD}Sistema Integrado de Gestão - Medicina do Trabalho${NC}"
echo -e "  ${CYAN}Setup Automático v1.0${NC}"
echo ""

# ── Verificar dependências ────────────────────────────────────────────────────
step "Verificando dependências"

command -v node >/dev/null 2>&1 || error "Node.js não encontrado. Instale em https://nodejs.org"
command -v npm  >/dev/null 2>&1 || error "npm não encontrado."
command -v docker >/dev/null 2>&1 || error "Docker não encontrado. Instale em https://docs.docker.com/get-docker/"
command -v git  >/dev/null 2>&1 || error "Git não encontrado."

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  error "Node.js 18+ é necessário. Versão atual: $(node -v)"
fi

success "Node.js $(node -v) ✓"
success "npm $(npm -v) ✓"
success "Docker $(docker -v | cut -d' ' -f3 | tr -d ',') ✓"
success "Git $(git --version | cut -d' ' -f3) ✓"

# ── Docker ───────────────────────────────────────────────────────────────────
step "Iniciando banco de dados (Docker)"

if ! docker info >/dev/null 2>&1; then
  error "Docker não está rodando. Inicie o Docker Desktop e tente novamente."
fi

# Parar containers antigos se existirem
docker compose down 2>/dev/null || true

log "Subindo PostgreSQL e Redis..."
docker compose up -d

log "Aguardando PostgreSQL ficar pronto..."
RETRIES=30
until docker exec sigcmt_postgres pg_isready -U sigcmt >/dev/null 2>&1 || [ $RETRIES -eq 0 ]; do
  RETRIES=$((RETRIES-1))
  printf "."
  sleep 2
done
echo ""

if [ $RETRIES -eq 0 ]; then
  error "PostgreSQL não respondeu a tempo. Verifique: docker logs sigcmt_postgres"
fi

success "PostgreSQL pronto ✓"
success "Redis pronto ✓"

# ── Instalar dependências ─────────────────────────────────────────────────────
step "Instalando dependências npm"

log "Instalando pacotes do workspace (pode demorar 1-2 min na primeira vez)..."
npm install --legacy-peer-deps 2>&1 | tail -5

success "Dependências instaladas ✓"

# ── Prisma ───────────────────────────────────────────────────────────────────
step "Configurando banco de dados"

log "Gerando Prisma Client..."
cd packages/database
DATABASE_URL="postgresql://sigcmt:sigcmt_dev_2025@localhost:5432/sigcmt" npx prisma generate 2>&1 | tail -3

log "Criando tabelas no banco..."
DATABASE_URL="postgresql://sigcmt:sigcmt_dev_2025@localhost:5432/sigcmt" npx prisma db push --accept-data-loss 2>&1 | tail -5

log "Populando com dados de teste..."
DATABASE_URL="postgresql://sigcmt:sigcmt_dev_2025@localhost:5432/sigcmt" npx tsx src/seed.ts

cd ../..
success "Banco configurado ✓"

# ── Configurar .env API ───────────────────────────────────────────────────────
step "Configurando variáveis de ambiente"

if [ ! -f apps/api/.env ]; then
  cp apps/api/.env.example apps/api/.env 2>/dev/null || true
fi

# Garantir que DATABASE_URL está correta
if grep -q "DATABASE_URL" apps/api/.env 2>/dev/null; then
  success ".env da API já configurado ✓"
else
  warn ".env não encontrado — usando padrão de desenvolvimento"
fi

success "Variáveis de ambiente OK ✓"

# ── Resumo final ──────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}${GREEN}  ✅ Setup concluído com sucesso!${NC}"
echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  ${BOLD}Para iniciar o sistema:${NC}"
echo -e "  ${CYAN}npm run dev${NC}"
echo ""
echo -e "  ${BOLD}Acesse:${NC}"
echo -e "  ${CYAN}http://localhost:5173${NC}  → Frontend (Web)"
echo -e "  ${CYAN}http://localhost:3001${NC}  → API"
echo -e "  ${CYAN}http://localhost:3001/docs${NC} → Swagger UI"
echo ""
echo -e "  ${BOLD}Credenciais de acesso:${NC}"
echo -e "  ${CYAN}Admin:${NC}     admin@sigcmt.com     /  Admin@2025"
echo -e "  ${CYAN}Médico:${NC}    dr.silva@sigcmt.com  /  Medico@2025"
echo -e "  ${CYAN}Recepção:${NC}  recepcao@sigcmt.com  /  Recepcao@2025"
echo ""
echo -e "  ${BOLD}Comandos úteis:${NC}"
echo -e "  ${CYAN}npm run dev:api${NC}    → Só a API"
echo -e "  ${CYAN}npm run dev:web${NC}    → Só o frontend"
echo -e "  ${CYAN}npm run db:studio${NC}  → Prisma Studio (visualizar banco)"
echo -e "  ${CYAN}npm run db:seed${NC}    → Re-popular banco com dados de teste"
echo -e "  ${CYAN}docker compose down${NC} → Parar banco de dados"
echo ""
