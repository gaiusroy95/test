# ESMOS — ESG Management & Oversight System (Frontend)

React 18 + TypeScript + Vite + Tailwind CSS frontend for the ESMOS sustainability platform.

## Quick Start

```bash
npm install
npm run dev          # → http://localhost:5173
```

Backend must be running at `http://localhost:8000` — Vite proxies `/api` automatically.

## Architecture

### Two Portals

| Portal | URL Prefix | Layout | Users |
|--------|-----------|--------|-------|
| Platform Admin | `/platform/*` | `PlatformLayout` | PLATFORM_OWNER, PLATFORM_ADMIN |
| Tenant (Company) | `/app/*` | `TenantLayout` | COMPANY_ADMIN, REVIEWER, LOCATION_USER, AUDITOR |

### Login Flow

Tabbed login page at `/login`:
- **Company Login** tab → `POST /api/v1/auth/login` → redirects to `/app`
- **Platform Admin** tab → `POST /api/v1/platform/auth/login` → redirects to `/platform`

### Project Structure

```
src/
├── api/client.ts              # Axios + all 88 API endpoints + auto-refresh
├── store/auth.ts              # Zustand auth store (login/logout/tokens)
├── types/index.ts             # TypeScript interfaces (all 22 tables)
├── lib/
│   ├── constants.ts           # APP_NAME, modules, nav, status colors
│   └── utils.ts               # cn() utility
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx        # Full layout shell: nav, collapse, user popup, notifications
│   │   └── Layouts.tsx        # PlatformLayout + TenantLayout (no topbar)
│   └── shared/
│       ├── RequireAuth.tsx    # Route guards (RequirePlatform/RequireTenant)
│       ├── StatusBadge.tsx    # Status + Role badges
│       └── PageComponents.tsx # PageHeader, StatCard, EmptyState, LoadingSkeleton
├── pages/
│   ├── auth/LoginPage.tsx     # Tabbed login
│   ├── platform/              # Platform admin pages
│   ├── app/                   # Tenant pages
│   └── PlaceholderPage.tsx    # Stub for upcoming pages
├── App.tsx                    # All route definitions
└── main.tsx                   # Entry point + Toaster
```

### Rebranding

Edit two lines in `src/lib/constants.ts`:
```ts
export const APP_NAME = "Your Brand";
export const APP_TAGLINE = "Your Tagline";
```

### Adding a New Page

1. Create file in `src/pages/platform/` or `src/pages/app/`
2. Add route in `App.tsx`
3. Add nav item in `src/lib/constants.ts` (PLATFORM_NAV or TENANT_NAV)
4. Update role visibility in `Sidebar.tsx` if needed

### API Client

All 88 backend endpoints are pre-mapped in `src/api/client.ts`:
- `authApi.*` — login/refresh/me for both portals
- `platformApi.*` — companies, plans, admins, system config, audit log
- `tenantApi.*` — users, locations, metrics, data entry, review, documents, notifications, settings

### Design System

- **Sidebar:** Deep navy (#0f172a)
- **Accents:** Teal-blue (#0ea5e9, #14b8a6)
- **Font:** Plus Jakarta Sans
- **Layout:** Fixed sidebar + sticky topbar + scrollable content
- **Pattern:** Salesforce meets SAP Fiori — clean, corporate, data-dense
