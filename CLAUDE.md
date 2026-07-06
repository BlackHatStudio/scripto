# Scripto — CLAUDE.md

## Project
Scripto App Desktop — dictation capture with local-first storage and
Postgres sync.

Stack: Next.js + Electron + Prisma
Status: Active (uncommitted) · 35% complete · last activity 2026-05-03 + heavy uncommitted work

## Current priorities
- [ ] Commit the 86 pending files — substantial work sits uncommitted since the May 3 initial commit
- [ ] Finish the Prisma schema and Express backend API
- [ ] Implement local-first to PostgreSQL sync
- [ ] Build out the WebView2 desktop host path

## Working here
This project already has an `AGENTS.md` with the same content this file
used to need duplicated. Once Codex's `project_doc_fallback_filenames` is
set (see GLOBAL_SETUP.md in `.projectdocs`), AGENTS.md can be retired and
this file becomes the single source for both tools — check before deleting
anything in case it's diverged.

Global conventions, stack defaults, and security rules are inherited
automatically from global memory (~/.claude/CLAUDE.md and ~/.codex/AGENTS.md).

## Project-specific notes
<!-- Add architecture decisions, gotchas, and conventions unique to this
     project as they come up. -->
