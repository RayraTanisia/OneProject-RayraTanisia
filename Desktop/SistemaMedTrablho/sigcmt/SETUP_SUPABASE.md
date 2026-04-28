# SIGCMT — Setup Supabase (3 passos)

## 1. Criar projeto no Supabase

1. Acesse https://supabase.com e crie uma conta
2. Clique em **New project**
3. Escolha nome: `sigcmt`, região: **South America (São Paulo)**
4. Defina uma senha forte para o banco e salve

## 2. Pegar as credenciais

No painel do Supabase, vá em **Project Settings > API**:

| Variável | Onde encontrar |
|---|---|
| `SUPABASE_URL` | Project URL |
| `SUPABASE_ANON_KEY` | anon public |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role secret |

Em **Project Settings > Database > Connection string > URI (Transaction pooler)**:
- Copie a string que começa com `postgresql://postgres.[ref]:...` (porta 6543)
- Essa é a `DATABASE_URL` (com pooler, para runtime)

Em **Connection string > URI (Session pooler)** ou **Direct**:
- Copie a string com porta 5432
- Essa é a `DATABASE_DIRECT_URL` (para migrations)

## 3. Configurar arquivos .env

### apps/api/.env
```env
DATABASE_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connect_timeout=15"
DATABASE_DIRECT_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-sa-east-1.pooler.supabase.com:5432/postgres"
JWT_SECRET="gere-com: node -e \"console.log(require('crypto').randomBytes(64).toString('hex'))\""
JWT_EXPIRES_IN="15m"
PORT=3001
HOST=0.0.0.0
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
SUPABASE_URL="https://[PROJECT-REF].supabase.co"
SUPABASE_SERVICE_ROLE_KEY="eyJ..."
```

### apps/web/.env
```env
VITE_SUPABASE_URL="https://[PROJECT-REF].supabase.co"
VITE_SUPABASE_ANON_KEY="eyJ..."
```

### packages/database/.env
```env
DATABASE_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DATABASE_DIRECT_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-sa-east-1.pooler.supabase.com:5432/postgres"
```

## 4. Criar as tabelas e popular

```bash
cd packages/database
npx prisma generate
npx prisma db push
npm run db:seed
```

## 5. Rodar o projeto

Terminal 1 — API:
```bash
cd apps/api
npm run dev
```

Terminal 2 — Frontend:
```bash
cd apps/web
npm run dev
```

Acesse http://localhost:5173

### Credenciais demo
| Perfil | E-mail | Senha |
|---|---|---|
| Admin | admin@sigcmt.com | Admin@2025! |
| Médico | dr.silva@sigcmt.com | Medico@2025! |
| Recepção | recepcao@sigcmt.com | Recepcao@2025! |
