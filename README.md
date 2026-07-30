# TradingJournal-Pro

Production SaaS for traders who improve strategy with data — not just log trades.

No broker connections. No auto-import. No chart replay. Everything is manually entered.

---

## Architecture

```
journal/
├── frontend/          # React + Vite + Tailwind + shadcn/ui
├── backend/           # Express + MongoDB + JWT
├── vercel.json        # Vercel Services (web + API)
└── README.md
```

### Backend (Clean Architecture)

| Layer | Path | Responsibility |
|-------|------|----------------|
| Interface | `routes/`, `controllers/` | HTTP adapters |
| Application | `services/` | Use-cases / business logic |
| Domain | `models/`, `validators/` | Schemas & domain rules |
| Infrastructure | `config/`, middleware, Cloudinary | External systems |

### Frontend (Feature-based)

```
src/
├── app/                 # Router, providers, shell layout
├── features/
│   ├── auth/
│   ├── dashboard/
│   ├── journal/
│   ├── strategies/
│   ├── day-review/
│   ├── analytics/
│   └── reports/
├── components/ui/       # shadcn primitives
├── components/shared/   # App-wide composites
├── lib/                 # API client, utils, analytics calc
└── types/               # Shared TypeScript types
```

Business logic for metrics (win rate, expectancy, checklist impact) lives in shared calculators — never duplicated in components.

---

## Domain models

- **User** — account, prefs, JWT subject
- **Account** — trading accounts (prop firm, live, demo)
- **Strategy** — rules + dynamic checklist categories/items + version lineage
- **Trade** — journal entry with strategy snapshot checklist responses
- **DayReview** — setups found vs taken after chart review
- **Report** — generated weekly/monthly summaries (later)

---

## Foundation scope (this phase)

1. Project scaffold (FE + BE)
2. JWT auth
3. App shell (nav, command palette, dark theme)
4. Core models + REST APIs
5. Strategy Builder (CRUD + checklists)
6. Trading Journal with dynamic checklist load

Dashboard deep analytics, Day Review, Reports follow next.

---

## Getting started

### 1. MongoDB

Start MongoDB locally (or Docker Desktop + `docker run -d --name tj-mongo -p 27017:27017 mongo:7`).

### 2. Backend

```bash
cd backend
cp .env.example .env   # set MONGODB_URI + JWT_SECRET
npm install
npm run dev
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

API: `http://localhost:5000` · App: `http://localhost:5173`

---

## Deploy on Vercel (Services)

One project serves the Vite app and Express API together. Root `vercel.json` routes `/api` → backend and everything else → frontend.

1. Push this repo and [import the project](https://vercel.com/new) (root directory = repo root).
2. Set **Environment Variables** on the project:

| Variable | Value |
|----------|--------|
| `VITE_API_URL` | `/api` |
| `MONGODB_URI` | Atlas (or other) connection string |
| `JWT_SECRET` | long random secret |
| `CLIENT_URL` | `https://your-deployment.vercel.app` |
| `NODE_ENV` | `production` |
| `CLOUDINARY_*` | cloud name, API key, secret |

3. Deploy. Frontend build-time reads `VITE_API_URL`; the API runs as the Express service.

Local `frontend/.env` can stay `VITE_API_URL=http://localhost:5000/api`.

### Core API surface

| Area | Endpoints |
|------|-----------|
| Auth | `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me` |
| Accounts | `GET/POST /api/accounts`, `PATCH/DELETE /api/accounts/:id` |
| Strategies | `CRUD + /archive + /duplicate + /versions` |
| Trades | `GET/POST /api/trades`, `PUT/DELETE /api/trades/:id` |
| Day reviews | `GET/PUT /api/day-reviews`, `GET/DELETE /api/day-reviews/:date` |
| Analytics | `GET /api/analytics/dashboard` |
