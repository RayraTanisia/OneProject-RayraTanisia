# SIGCMT — Sistema Integrado de Gestão de Clínica de Medicina do Trabalho

MVP funcional com Auth + Pacientes + Agendamento.

## Início rápido

**Pré-requisitos:** Node.js 18+, Docker, Git

```bash
# 1. Clonar / entrar na pasta
cd sigcmt

# 2. Setup automático (instala tudo, sobe banco, popula dados)
./setup.sh

# 3. Iniciar o sistema
npm run dev
```

Acesse: **http://localhost:5173**

## Credenciais de demo

| Perfil      | E-mail                    | Senha         |
|-------------|---------------------------|---------------|
| Admin       | admin@sigcmt.com          | Admin@2025    |
| Médico      | dr.silva@sigcmt.com       | Medico@2025   |
| Recepção    | recepcao@sigcmt.com       | Recepcao@2025 |

## Estrutura

```
sigcmt/
├── apps/
│   ├── api/          # Fastify + Prisma (porta 3001)
│   └── web/          # React + Vite (porta 5173)
├── packages/
│   └── database/     # Schema Prisma + seed
├── docker-compose.yml
└── setup.sh
```

## Módulos do MVP (Sprint 1-6)

| Módulo | Status |
|--------|--------|
| Auth (login, JWT, RBAC) | ✅ |
| Gestão de Pacientes (CRUD + busca) | ✅ |
| Agendamento (calendário + slots) | ✅ |
| Dashboard com métricas do dia | ✅ |
| Swagger UI (`/docs`) | ✅ |

## Comandos

```bash
npm run dev           # Iniciar tudo (API + Web)
npm run dev:api       # Só a API
npm run dev:web       # Só o frontend
npm run db:studio     # Prisma Studio
npm run db:seed       # Re-popular banco
docker compose down   # Parar banco
```

## Próximos sprints

- **Sprint 7:** Faturamento + NF-e + gateway de pagamento
- **Sprint 8:** Integração WhatsApp Business API
- **Sprint 9:** Prontuário eletrônico + assinatura digital
- **Sprint 10:** Relatórios e dashboards avançados
