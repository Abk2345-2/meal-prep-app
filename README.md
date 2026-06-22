# PantryToPlate

> *Turn what you already have into delicious meals — quickly and without waste.*

A meal-prep app: voice/type your groceries, get recipe suggestions matched to your pantry + available time, track calories, and stay motivated with streaks and rewards.

---

## Architecture

```
meal-prep-app/
├── backend/          Go microservices (Postgres)
│   ├── cmd/gateway/      Public entry-point, reverse-proxy + CORS
│   ├── cmd/pantry/       Grocery inventory service (port 8081)
│   ├── cmd/recipe/       Recipe suggestions via TheMealDB (port 8082)
│   ├── cmd/nutrition/    Calorie & macro tracking (port 8083)
│   └── cmd/gamification/ Streaks, points, rewards, share story (port 8084)
├── web/              Next.js 15 web app (port 3000)
├── mobile/           Expo (React Native) iOS/Android app
└── packages/shared/  Shared TS types + API client + grocery parser
```

All frontend traffic goes through the **gateway on :8080**. Services talk directly to Postgres; the recipe service uses TheMealDB (no key required).

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Go | ≥ 1.22 | [go.dev](https://go.dev/dl/) |
| Node.js | ≥ 20 | [nodejs.org](https://nodejs.org/) |
| Docker | any | [docker.com](https://www.docker.com/) |
| Expo CLI | latest | `npm i -g expo-cli` |
| (iOS) Xcode | ≥ 15 | Mac App Store |

---

## Quick Start

### 1. Clone and configure

```bash
cd meal-prep-app
cp .env.example .env
# .env works as-is for local development — no changes needed
```

### 2. Start Postgres

```bash
docker compose up -d postgres
```

Postgres runs on `localhost:5432`. All tables are created automatically on first service boot.

### 3. Start the Go backend

```bash
cd backend
make run-all          # starts all 5 services in background, logs in backend/.run/
```

Verify the gateway is up:

```bash
curl http://localhost:8080/healthz
# {"service":"gateway","ok":true}
```

To stop:

```bash
make stop
```

### 4. Start the web app

```bash
cd web
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Start the mobile app (iOS Simulator)

```bash
cd mobile
npm install
npm run ios          # or: npx expo start --ios
```

On a **physical device**, set your machine's LAN IP in `.env`:

```
EXPO_PUBLIC_API_BASE_URL=http://192.168.x.x:8080
```

---

## Running the full stack with Docker (optional)

```bash
docker compose up --build
```

This builds all Go services into containers and starts everything together. The web and mobile apps still run on the host.

---

## Environment Variables

All in `.env.example` — copy to `.env` and adjust.

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgres://pantry:pantry@localhost:5432/pantrytoplate` | Postgres connection string |
| `GATEWAY_ADDR` | `:8080` | Gateway listen address |
| `PANTRY_ADDR` | `:8081` | Pantry service |
| `RECIPE_ADDR` | `:8082` | Recipe service |
| `NUTRITION_ADDR` | `:8083` | Nutrition service |
| `GAMIFICATION_ADDR` | `:8084` | Gamification service |
| `RECIPE_PROVIDER` | `themealdb` | Recipe provider (`themealdb` only for now) |
| `CORS_ALLOWED_ORIGINS` | `*` | Comma-separated CORS origins |
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:8080` | Web → gateway URL |
| `EXPO_PUBLIC_API_BASE_URL` | `http://localhost:8080` | Mobile → gateway URL |

---

## Service API Reference

### Pantry  `localhost:8081`

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/parse` | Preview-parse free text (no save) |
| `GET`  | `/items` | List pantry items (`?status=expiring`) |
| `POST` | `/items` | Add items (raw text or pre-parsed) |
| `PATCH`| `/items/:id` | Update quantity/unit |
| `DELETE`| `/items/:id` | Remove item |

### Recipes  `localhost:8082`

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/suggest` | Suggest recipes (`ingredients[]`, `max_time`, `min_match`, `limit`) |
| `GET`  | `/:id` | Get full recipe by ID |

### Nutrition  `localhost:8083`

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/goal` | Get calorie/macro goal |
| `PUT`  | `/goal` | Set goal |
| `POST` | `/log` | Log a meal |
| `GET`  | `/today` | Today's totals + meal list |

### Gamification  `localhost:8084`

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/summary` | Streak + points + next reward |
| `POST` | `/event` | Award points (`action`: log_pantry, cook_meal, hit_goal, avoid_waste, share, refer) |
| `GET`  | `/rewards` | Full reward catalog with unlock status |
| `GET`  | `/story` | Shareable weekly summary text |

---

## Point System

| Action | Points |
|--------|--------|
| Log pantry | +10 |
| Cook a meal | +15 |
| Hit calorie goal | +20 |
| Avoid food waste | +25 |
| Share story | +10 |
| Refer a friend | +50 |

**Rewards**: Beginner (100) → Building Momentum (280) → Consistent (520) → Resilient (850) → Food-Saving Champion (1500)

---

## Development

```bash
# Backend tests
cd backend && go test ./...

# Backend build check
cd backend && go build ./...

# Shared package (types + client + parser)
cd packages/shared && npm run build    # if a build step exists

# Web lint
cd web && npm run lint
```

### Migrations

Each service auto-applies migrations from `backend/internal/db/migrations/` on boot. They're idempotent (`IF NOT EXISTS` / `ON CONFLICT DO NOTHING`).

### Adding a Recipe Provider

Implement the `recipeprovider.Provider` interface in `backend/internal/recipeprovider/` and wire it in `backend/cmd/recipe/main.go`.

---

## Mobile Screens

| Tab | Screen | Key features |
|-----|--------|-------------|
| 🍽️ Cook | `index.tsx` | Type groceries, live parse chips, time-filtered recipe cards, one-tap "Cook now" |
| 🥦 Pantry | `pantry.tsx` | Color-coded expiry bands (green/yellow/red), swipe-to-delete |
| 📊 Track | `track.tsx` | Calorie ring, macro bars, quick meal log |
| 🔥 You | `you.tsx` | 7-day streak visual, points + reward progress, share story |

---

## Troubleshooting

**Gateway returns 502**  
One of the backend services hasn't started yet. Check `backend/.run/*.log` for errors.

**Postgres connection refused**  
Run `docker compose up -d postgres` and wait for the health check to pass (5–10 s).

**iOS simulator can't reach backend**  
Simulator uses `localhost` which maps to your Mac — default config works. For physical devices, set `EXPO_PUBLIC_API_BASE_URL` to your machine's LAN IP.

**Recipes always empty**  
TheMealDB is free but rate-limited. Check your internet connection and the recipe service log at `backend/.run/recipe.log`.
