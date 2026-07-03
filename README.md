# Fitnaut-local

Fitness tracker running entirely on local hardware. SQLite + Next.js with a REST API for Telegram/Hermes agent integration.

## Setup

```bash
cp .env.example .env.local
# Edit .env.local — generate a secure FITNAUT_API_KEY with: openssl rand -hex 32
npm install
npm run db:push
npm run dev
```

## API

All endpoints at `/api/v1/*` require `Authorization: Bearer <FITNAUT_API_KEY>`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/exercises` | Log a set |
| `GET` | `/exercises` | Get history |
| `PUT` / `DELETE` | `/exercises/:id` | Update / delete |
| `POST` / `GET` | `/health-metrics` | Health tracking |
| `GET` | `/sessions` | Workout sessions |
| `GET` | `/exercise-library` | All 81 exercises |
| `POST` | `/recommend` | AI workout recommendations |
| `GET` / `PUT` | `/profile` | User profile |
| `GET` / `PUT` | `/preferences` | User preferences |

Full spec: `docs/openapi.yaml`

## Access from other devices

The dev server binds to `0.0.0.0`, so it's reachable at:

```
http://<mac-mini-ip>:3000
```

Find your IP with: `ipconfig getifaddr en0`
