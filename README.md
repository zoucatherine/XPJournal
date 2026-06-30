# XPJournal

A cross-platform journaling app built with a nostalgic **Windows XP-inspired desktop UI**. Write daily entries, pin sticky notes to your desktop, lock your journal with a PIN, and customize your workspace with themes and wallpapers — all from a faithful recreation of the classic XP environment.

----

## Features

- **XP Desktop UI** — Draggable windows, a Start Menu, taskbar, and edge-snapping, all styled after Windows XP.
- **Calendar Journaling** — Browse a monthly calendar and create or edit entries for any date, including a title, diary body, and mood.
- **Sticky Notes** — Draggable, resizable sticky notes in four colors (Yellow, Pink, Blue, Green) that remember their position and content.
- **PIN Lock** — Secure your journal with a 4-digit PIN (bcrypt-hashed and stored server-side).
- **Themes** — Choose from XP Blue, Win98 Classic, Luna Green, Zune Dark, or Kawaii Pink.
- **Wallpapers** — Pick from presets (Bliss, Azul, Clouds) or upload a custom wallpaper.
- **Search** — Full-text search across all journal entries.
- **Mobile App** — Companion Expo/React Native app for journaling and PIN security on iOS and Android.

---

## Project Structure

This is a **pnpm workspace** monorepo.

```
artifacts/
  api-server/          — Express + PostgreSQL backend (@workspace/api-server)
  calendar-journal/    — XP desktop web app, React + Vite (@workspace/calendar-journal)
  journal-mobile/      — Expo React Native mobile app (@workspace/journal-mobile)
  mockup-sandbox/      — UI component sandbox for development (@workspace/mockup-sandbox)

lib/
  db/                  — PostgreSQL schema, Drizzle ORM config (@workspace/db)
  api-spec/            — OpenAPI 3.0 specification (@workspace/api-spec)
  api-client-react/    — Generated TanStack Query hooks via Orval (@workspace/api-client-react)
  api-zod/             — Generated Zod validation schemas via Orval (@workspace/api-zod)
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Web frontend | React 19, Vite, Tailwind CSS v4, Wouter, TanStack Query v5 |
| Mobile frontend | Expo 54, React Native, Expo Router, Reanimated |
| Backend | Node.js 24, Express 5, Pino |
| Database | PostgreSQL, Drizzle ORM, drizzle-zod |
| API contract | OpenAPI 3.0, Orval (client codegen) |
| Validation | Zod (v4) |
| Security | bcryptjs (PIN hashing), CORS, cookie-parser |
| Tooling | pnpm workspaces, TypeScript 5.9, esbuild |

---

## Local Development

### Prerequisites

- Node.js 24+
- pnpm
- A PostgreSQL database (set `DATABASE_URL` in your environment)

### Install dependencies

```bash
pnpm install
```

### Start services

```bash
# API server (port 5000)
pnpm --filter @workspace/api-server run dev

# Web app
pnpm --filter @workspace/calendar-journal run dev

# Mobile app (Expo)
pnpm --filter @workspace/journal-mobile run dev
```

### Database

```bash
# Push schema changes to the database (dev only)
pnpm --filter @workspace/db run push
```

### API codegen

Run this after editing `lib/api-spec` to regenerate client hooks and Zod schemas:

```bash
pnpm --filter @workspace/api-spec run codegen
```

### Typecheck & build

```bash
pnpm run typecheck   # typecheck all packages
pnpm run build       # typecheck + build all packages
```

---

## Required Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
