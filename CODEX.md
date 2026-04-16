# CODEX.md

This file provides project context and execution rules for AI-assisted development in this repository.

## 1) Project Context

- Project: **Osmany Hall Management System**
- Institution: **MIST (Military Institute of Science and Technology)**
- Frontend: React (already implemented)
- Planned backend: ASP.NET Web API + PostgreSQL

## 2) Architecture Goals

- Industry-level code quality
- Clear module boundaries
- Strong role-based access model
- Easy backend integration (replace mock data without rewriting page structure)
- Professional UX/UI consistency using MIST-aligned branding

## 3) Critical Product Rules

- Student login only at `/login`
- Admin login only at `/halladmin`
- No role selector in the student login UI
- Admin pages must remain under `/admin/*`
- Student pages must remain under `/student/*`

## 4) Frontend Implementation Rules

- Keep components small and reusable.
- Prefer centralized configs/constants over hardcoded values.
- Keep auth and routing logic in `context/` and `routes/` layers.
- Preserve responsive behavior across desktop/tablet/mobile.
- Maintain accessibility basics (labels, keyboard focus states, semantic elements).

## 5) Styling Rules

- Keep a single styling approach (global system in `src/styles/global.css`).
- Keep MIST-oriented color language consistent.
- Avoid random one-off inline style hacks.

## 6) Backend Readiness Rules

When adding API integration:
- Introduce a service layer (e.g., `src/services/`).
- Keep response mapping isolated from UI components.
- Avoid calling fetch/axios directly from deeply nested presentational components.
- Use role-aware guards and API-level authorization assumptions.

## 7) Quality Gates

Run before finalizing changes:

```bash
npm run lint
npm run build
```

Both should pass.

## 8) Git and Repo Hygiene

- Never commit secrets or environment credentials.
- Keep `.gitignore` aligned with Node + .NET + IDE artifacts.
- Prefer focused commits (small, scoped, traceable).

## 9) High-Value Next Steps

1. Add ASP.NET API project structure and auth module.
2. Add PostgreSQL schema and migrations.
3. Replace mock auth with real token-based flow.
4. Replace mock dashboard tables and charts with API data.
5. Add CI workflow for lint/build/test checks.