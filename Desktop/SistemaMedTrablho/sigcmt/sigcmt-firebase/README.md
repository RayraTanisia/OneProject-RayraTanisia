# SIGCMT Firebase — MVP de Validação

Sistema de Gestão de Clínica de Medicina do Trabalho com Firebase.
Sem Docker. Sem servidor. Roda em 3 comandos.

---

## 🚀 Início rápido

```bash
npm install
npm run dev
```

Acesse: **http://localhost:5173**

---

## ⚙️ Configuração do Firebase (única vez)

### 1. Ativar Autenticação
No [Firebase Console](https://console.firebase.google.com/project/sistemamedtrablho):

**Authentication → Sign-in method → Email/Password → Ativar**

### 2. Criar usuários de demo
**Authentication → Users → Add user**

| E-mail | Senha |
|--------|-------|
| admin@sigcmt.com | Admin@2025 |
| dr.silva@sigcmt.com | Medico@2025 |
| recepcao@sigcmt.com | Recepcao@2025 |

⚠️ Após criar cada usuário, **copie o UID** mostrado na lista.

### 3. Criar banco Firestore
**Firestore Database → Create database → Production mode → Selecione a região**

### 4. Configurar regras do Firestore
**Firestore → Rules → Substituir por:**

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```
Clique em **Publish**.

### 5. Popular dados iniciais (seed)
Abra o app no browser, faça login com qualquer usuário.
Abra o Console do DevTools (F12) e cole:

```javascript
const { runSeed } = await import('/src/lib/seed.ts')
await runSeed()
```

Aguarde a mensagem ✅ Seed concluído!

### 6. Corrigir UIDs dos usuários no Firestore
No Firestore Console, abra a coleção `users`.
Para cada usuário, renomeie o documento para o UID correto do Firebase Auth:
- `admin-demo-001` → UID do admin@sigcmt.com
- `doctor-demo-001` → UID do dr.silva@sigcmt.com  
- `recepcao-demo-001` → UID do recepcao@sigcmt.com

> **Dica:** No Firestore, clique no documento → More options → Delete, depois crie novo com o UID correto e os mesmos dados.

---

## 📦 Estrutura

```
src/
├── lib/
│   ├── firebase.ts      # Config Firebase
│   ├── auth.ts          # Firebase Auth
│   ├── patients.ts      # CRUD Firestore
│   ├── appointments.ts  # CRUD + slots
│   └── seed.ts          # Dados de teste
├── pages/
│   ├── auth/            # Login
│   ├── dashboard/       # Dashboard
│   ├── patients/        # Lista, detalhe, form
│   └── appointments/    # Lista, form, calendário
├── store/auth.ts        # Zustand (estado global)
└── types/index.ts       # TypeScript types
```

## ✅ Funciona agora

- Login com Firebase Auth
- Dashboard com métricas do dia
- Pacientes: cadastro, edição, busca, histórico
- Agendamentos: criar com seleção de slot, confirmar, cancelar
- Calendário mensal visual

## 🔜 Próximos passos

1. Prontuário eletrônico
2. Firebase Storage para documentos
3. Faturamento básico
4. Notificações (Firebase Cloud Messaging)
