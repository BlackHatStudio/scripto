# Scripto App Desktop

Scripto App Desktop is the local Windows desktop application for dictation capture, speech correction, local dictionary behavior, and cloud PostgreSQL sync.

It is designed to run first from local memory and local storage, then sync durable records to PostgreSQL when available. The desktop app also supports tray-based operation, optional Windows auto-start, and ZIP-delivered installer or updater packaging.

## Current Layout

- [src/](C:\DevSolutions\scripto\src) - Next.js UI, shared client helpers, and renderer-facing components
- [backend/](C:\DevSolutions\scripto\backend) - Express API, in-memory/local persistence boundaries, and Prisma schema
- [desktop/](C:\DevSolutions\scripto\desktop) - Electron desktop shell
- [desktop-webview2/](C:\DevSolutions\scripto\desktop-webview2) - Windows WebView2 desktop host path
- [scripts/](C:\DevSolutions\scripto\scripts) - Local startup and orchestration scripts
- [AGENTS.md](C:\DevSolutions\scripto\AGENTS.md) - Desktop app guidance for future Codex work

## Setup

1. Install dependencies

```bash
npm install
```

2. Copy environment files

```bash
copy .env.example .env
copy backend\.env.example backend\.env
```

3. Configure the backend environment

- `DATABASE_URL` for local PostgreSQL or a cloud Postgres target
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `CORS_ORIGINS`
- `TRANSCRIPTION_PROVIDER=mock` for local testing

Do not commit secrets or environment-specific values.

## Local Runtime

The current local stack is:

- Frontend: `http://localhost:4444`
- Backend API: `http://localhost:4445`
- Desktop shell: Electron launches the same local app and connects to the API

Start the pieces individually:

```bash
npm run dev:web
npm run dev:api
npm run desktop
```

Or start the combined local flow:

```bash
npm run dev
```

## Architecture Notes

- Keep desktop-specific behavior in the desktop shell layer.
- Keep correction and dictionary logic deterministic and testable.
- Keep all durable database access behind backend service boundaries.
- Prefer local memory and local persistent storage first for correction behavior.
- Sync durable records to PostgreSQL with explicit conflict handling.
- Preserve `.env` and local storage artifacts during installer or updater operations.

## Environment Files

Root:

- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_APP_NAME`

Backend:

- `PORT`
- `DATABASE_URL`
- `CORS_ORIGINS`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `DEV_EMAIL_VERIFICATION_BYPASS`
- `TRANSCRIPTION_PROVIDER`

## Validation

Run these after changes:

```bash
npm run lint
npm run typecheck
npm run build
```

## Desktop Behavior

- Closing the main window should minimize to tray unless the user explicitly quits.
- The app should support Windows startup registration from settings.
- Local dictionary data should remain available offline.
- Sync jobs should be retryable and auditable.

## Notes

- The backend currently uses local in-memory and file-backed persistence paths for development.
- Cloud PostgreSQL sync is expected to be introduced behind backend service boundaries, not directly from renderer code.
- Installer and upgrade packaging should preserve user settings, local storage, and environment files.
