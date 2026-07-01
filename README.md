# Sophia

Sophia is an AI-powered philosophy reading companion.

## Sprint 1 Foundation

The project foundation is split into:

- `frontend/`: React + TypeScript + Vite + Tailwind app shell
- `backend/`: Express + TypeScript API
- `backend/prisma/`: PostgreSQL schema, migration, and Prisma config
- `docs/context/`: product, architecture, and verification source of truth

Environment examples:

- `frontend/.env.example`
- `backend/.env.example`

## Verification Commands

Frontend:

```bash
cd frontend
npm run lint
npm run build
```

Backend:

```bash
cd backend
npm run typecheck
npm run build
npm run db:validate
npm run db:status
```

Health checks after building and starting the backend:

```bash
cd backend
npm run build
npm start
curl http://127.0.0.1:3000/health
curl http://127.0.0.1:3000/health/db
```

`/health` verifies the Express app. `/health/db` verifies the configured PostgreSQL connection.
