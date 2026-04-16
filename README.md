# Osmany Hall Management System

Industry-grade hall operations platform for **Osmany Hall, MIST (Military Institute of Science and Technology)**.

This repository currently contains the production-ready React frontend. The backend will be implemented with **ASP.NET** and **PostgreSQL**.

## Project Vision

Build a scalable, secure, and maintainable full-stack system for:
- student meal management
- billing and payment tracking
- admin verification and operations
- inventory, reports, and analytics

## Tech Stack

### Frontend (Current)
- React 18
- React Router DOM 6
- Context API (auth + app shell)
- Recharts
- Lucide React
- Vite
- ESLint

### Backend (Planned)
- ASP.NET (Web API)
- PostgreSQL
- JWT-based authentication and role-based authorization

## Authentication and Access Model

- ` /login `: **student login only**
- ` /halladmin `: **admin login only**
- Role-protected routes:
  - student routes under ` /student/* `
  - admin routes under ` /admin/* `

## Route Map

### Public
- `/`
- `/login`
- `/halladmin`

### Student
- `/student/dashboard`
- `/student/meals`
- `/student/billing`
- `/student/payments`
- `/student/profile`
- `/student/notifications`

### Admin
- `/admin/dashboard`
- `/admin/students`
- `/admin/meals`
- `/admin/billing`
- `/admin/payments`
- `/admin/inventory`
- `/admin/reports`
- `/admin/audit-logs`
- `/admin/analytics`
- `/admin/settings`

## Repository Structure

```text
src/
  assets/
  components/
    common/
    layout/
    ui/
  constants/
  context/
  data/
    mock/
  hooks/
  pages/
    admin/
    auth/
    student/
    system/
  routes/
  styles/
  utils/
  App.jsx
  main.jsx
```

## Local Development

### Prerequisites
- Node.js 20+
- npm 10+

### Run Frontend

```bash
npm install
npm run dev
```

### Quality and Build

```bash
npm run lint
npm run build
npm run preview
```

## Environment Variables (Frontend)

Create `.env` when backend is ready:

```bash
VITE_API_BASE_URL=https://localhost:5001/api
```

## Backend Integration Plan (ASP.NET + PostgreSQL)

Recommended API modules:
- `Auth`
- `Students`
- `Meals`
- `Billing`
- `Payments`
- `Inventory`
- `Reports`
- `AuditLogs`

Recommended standards:
- DTO-driven contracts
- centralized validation
- structured logging
- migration-first PostgreSQL schema management
- role-based endpoint protection (`Student`, `Admin`)

## Production Notes

- Do not commit secrets.
- Use environment-based configuration.
- Enforce HTTPS, secure cookies/JWT handling, and CORS policy.
- Add CI pipelines for lint, build, and backend tests before release.

## Current Status

- Frontend architecture and UI are ready for backend integration.
- Mock data is isolated and can be replaced incrementally with real APIs.