# Finance API

API REST para gerenciamento de finan&#231;as pessoais, constru&#237;da com NestJS, Prisma e PostgreSQL (Supabase).

## Funcionalidades

- **Autentica&#231;&#227;o** - Login com email/username, JWT com refresh token
- **Usu&#225;rios** - Cadastro, perfil, upload de imagem (Supabase Storage)
- **Bancos** - CRUD de contas banc&#225;rias com cor de identifica&#231;&#227;o
- **Sal&#225;rios** - Sal&#225;rio principal e rendas extras com hist&#243;rico por per&#237;odo
- **Gastos** - Registro de despesas com categorias, tipo de pagamento e split entre pessoas
- **Parcelamento** - Gastos parcelados com controle individual por parcela
- **Gastos Recorrentes** - Templates que geram entries automaticamente a cada m&#234;s
- **Financiamentos** - Simula&#231;&#227;o SAC e Price com tabela de amortiza&#231;&#227;o, taxas e corre&#231;&#227;o monet&#225;ria
- **Balan&#231;o** - Resumo mensal de receitas vs despesas com breakdown por categoria e tipo de pagamento

## Tech Stack

- **Runtime:** Node.js 20+
- **Framework:** NestJS 11
- **ORM:** Prisma 6 (PostgreSQL)
- **Banco:** Supabase (PostgreSQL + Storage)
- **Auth:** Passport JWT + bcrypt
- **Seguran&#231;a:** Helmet, Throttler (rate limiting), criptografia AES-256
- **Docs:** Swagger/OpenAPI
- **Testes:** Jest (114 testes unit&#225;rios)

## Pr&#233;-requisitos

- Node.js >= 20
- PostgreSQL (ou conta no Supabase)

## Setup

```bash
npm install
```

Copie o `.env.example` para `.env` e preencha as vari&#225;veis:

```bash
cp .env.example .env
```

### Vari&#225;veis de ambiente

| Vari&#225;vel | Descri&#231;&#227;o |
|---|---|
| `DATABASE_URL` | Connection string PostgreSQL (com pgbouncer) |
| `DIRECT_URL` | Connection string direta (para migrations) |
| `JWT_SECRET` | Chave secreta para access tokens |
| `JWT_REFRESH_SECRET` | Chave secreta para refresh tokens |
| `ENCRYPTION_KEY` | Chave AES-256 (64 chars hex) para criptografia de dados sens&#237;veis |
| `ADMIN_PASSWORD` | Senha do usu&#225;rio administrador |
| `SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_SERVICE_KEY` | Service role key do Supabase |
| `CORS_ORIGIN` | Origens permitidas (separadas por v&#237;rgula, default: `*`) |
| `PORT` | Porta da API (default: `3000`) |

### Banco de dados

```bash
npx prisma migrate dev
```

## Execu&#231;&#227;o

```bash
# desenvolvimento
npm run start:dev

# produ&#231;&#227;o
npm run build && npm run start:prod
```

## Testes

```bash
npm test
```

## API Docs

Com o servidor rodando, acesse:

```
http://localhost:3000/api/docs
```

## Endpoints

### Auth
| M&#233;todo | Rota | Descri&#231;&#227;o |
|---|---|---|
| POST | `/auth/login` | Login |
| POST | `/auth/refresh` | Renovar token |

### Users
| M&#233;todo | Rota | Descri&#231;&#227;o |
|---|---|---|
| POST | `/users` | Criar usu&#225;rio |
| GET | `/users/me` | Usu&#225;rio autenticado |
| GET | `/users/:id` | Buscar por ID |
| PUT | `/users/:id` | Atualizar dados |
| PUT | `/users/:id/profile-image` | Upload de imagem |
| DELETE | `/users/:id` | Remover (soft delete) |

### Banks
| M&#233;todo | Rota | Descri&#231;&#227;o |
|---|---|---|
| POST | `/banks/:userId` | Criar banco |
| GET | `/banks/user/:userId` | Listar bancos |
| GET | `/banks/:id/user/:userId` | Buscar por ID |
| PUT | `/banks/:id/user/:userId` | Atualizar |
| DELETE | `/banks/:id/user/:userId` | Remover |

### Salaries
| M&#233;todo | Rota | Descri&#231;&#227;o |
|---|---|---|
| POST | `/salaries/:userId` | Criar sal&#225;rio |
| GET | `/salaries/user/:userId` | Listar (filtro por m&#234;s/ano) |
| GET | `/salaries/:id/user/:userId` | Buscar por ID |
| PUT | `/salaries/:id/user/:userId` | Atualizar |
| DELETE | `/salaries/:id/user/:userId` | Remover |

### Expense Entries
| M&#233;todo | Rota | Descri&#231;&#227;o |
|---|---|---|
| POST | `/expense-entries/:userId` | Criar gasto |
| GET | `/expense-entries/user/:userId` | Listar (filtro por m&#234;s/ano) |
| GET | `/expense-entries/:id/user/:userId` | Buscar por ID |
| PUT | `/expense-entries/:id/user/:userId` | Atualizar |
| DELETE | `/expense-entries/:id/user/:userId` | Remover |
| POST | `/expense-entries/:id/user/:userId/settle` | Quitar parcelas |

### Recurring Expenses
| M&#233;todo | Rota | Descri&#231;&#227;o |
|---|---|---|
| POST | `/recurring-expenses/:userId` | Criar recorrente |
| GET | `/recurring-expenses/user/:userId` | Listar |
| GET | `/recurring-expenses/:id/user/:userId` | Buscar por ID |
| PUT | `/recurring-expenses/:id/user/:userId` | Atualizar |
| DELETE | `/recurring-expenses/:id/user/:userId` | Remover (filtro por m&#234;s/ano) |
| POST | `/recurring-expenses/generate/:userId` | Gerar gastos do m&#234;s |

### Financings
| M&#233;todo | Rota | Descri&#231;&#227;o |
|---|---|---|
| POST | `/financings/:userId` | Criar financiamento |
| GET | `/financings/user/:userId` | Listar |
| GET | `/financings/:id/user/:userId` | Buscar por ID |
| GET | `/financings/:id/user/:userId/installments` | Listar parcelas |
| GET | `/financings/:id/user/:userId/schedule` | Tabela de amortiza&#231;&#227;o |
| PUT | `/financings/:id/user/:userId` | Atualizar |
| DELETE | `/financings/:id/user/:userId` | Cancelar parcelas futuras |
| DELETE | `/financings/:id/user/:userId/all` | Cancelar todas as parcelas |

### Balance
| M&#233;todo | Rota | Descri&#231;&#227;o |
|---|---|---|
| GET | `/balance/user/:userId` | Balan&#231;o do per&#237;odo (m&#234;s/ano) |

## Deploy (Render)

O projeto inclui `Dockerfile` e `render.yaml` prontos para deploy no Render:

1. Conecte o reposit&#243;rio no Render
2. Selecione **Docker** como environment
3. Configure as vari&#225;veis de ambiente
4. Deploy

## Seguran&#231;a

- JWT com expira&#231;&#227;o de 15min (access) e 7 dias (refresh)
- Criptografia AES-256 para CPF e documentos banc&#225;rios
- Bcrypt (cost 12) para senhas
- Helmet (headers de seguran&#231;a HTTP)
- Rate limiting (Throttler) em todas as rotas
- Ownership guard (usu&#225;rio s&#243; acessa seus pr&#243;prios dados)
- Soft delete (dados nunca s&#227;o apagados fisicamente)
- Valida&#231;&#227;o de input com class-validator
