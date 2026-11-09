# Waliin – Manager Dashboard

Waliin helps Ethiopian public hospitals keep medical equipment in service. This repository is the **web dashboard for health managers**: they see the condition of the hospital's equipment, approve equipment registrations and requests, manage staff accounts and download reports.

## Features

### Dashboard

- **Cards:** Needs attention now, Out of service (with the longest open fault), Waiting for your decision, Back in use
- **Equipment availability:** working machines, machines out of service or in repair, and the percentage available (approved machines only)
- **Faults over time**, **open faults by priority** and **faults by department** charts
- **Waiting for your decision:** registrations and requests, oldest first, each with a Review link
- **Machines waiting for repair**, ordered by priority and waiting time
- **Parts and replacement outlook:** open requests by type, to plan the budget
- **Overdue follow-ups:** requests with no reply after their follow-up date
- **Filters:** 7, 30 or 90 days and department; **Refresh**; **Download report** (PDF)
- If one data source fails, its card shows an error with Retry instead of a misleading zero

### Equipment

- List of all registrations with their status
- Review a pending registration and **approve** it or **return** it with a reason

### Requests

- Spare parts, outside help, replacement and new equipment requests
- Request detail with items and technical requirements
- **Approve, reject or return** with a reason

### Users and departments

- **Invite** clinical staff and biomedical engineers by email, with a role and department
- Users list with status: Active, Invited, Invite expired, Revoked
- Change role or department, **resend an invitation**, **send a reset link**, **revoke access**
- Add departments

### Account security

- Sign in with email and password, plus a 6-digit code from an **authenticator app** (MFA) for managers
- Accept invitation, forgot password and reset password pages
- Notifications bell, profile page, light and dark theme

---

## Tech stack

| Area      | Tools                                                    |
| --------- | -------------------------------------------------------- |
| Framework | Next.js 16 (App Router, Turbopack), React 19, TypeScript |
| Styling   | Tailwind CSS 4                                           |
| UI        | Radix UI (dialog, dropdown menu), lucide-react           |
| Forms     | React Hook Form                                          |
| API types | openapi-typescript                                       |
| Tests     | Vitest                                                   |
| Quality   | ESLint, Prettier, TypeScript, Husky + lint-staged        |
| Hosting   | Vercel                                                   |

---

## Getting started

### 1. Requirements

- Node.js 22 or newer and npm
- The Waliin backend running locally, or the URL of a deployed backend
- A health manager account (with an authenticator app)

### 2. Install

```bash
git clone git@github.com:akirachix/solvya-dashboard.git
cd solvya-dashboard
npm ci
```

### 3. Environment variables

Copy the example file and fill it in:

```bash
cp .env.example .env.local
```

| Variable             | What it is                                                                                                  | Example                 |
| -------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------- |
| `BACKEND_URL`        | Base URL of the FastAPI backend that `/api/*` is forwarded to                                               | `http://localhost:8000` |
| `BACKEND_API_PREFIX` | Path prefix of the backend routes. Leave it empty when routes start at the root (as in the current backend) | _(empty)_               |

Never commit `.env.local`.

### 4. Run

```bash
npm run dev
```

Open http://localhost:3000. If the PWA is also running on port 3000, start one of them with `npm run dev -- -p 3001`.

---

## Scripts

| Command                | What it does                      |
| ---------------------- | --------------------------------- |
| `npm run dev`          | Start the development server      |
| `npm run build`        | Production build                  |
| `npm start`            | Run the production build          |
| `npm run lint`         | ESLint                            |
| `npm run typecheck`    | TypeScript check (`tsc --noEmit`) |
| `npm run format`       | Format all files with Prettier    |
| `npm run format:check` | Check formatting (used in CI)     |
| `npm test`             | Run the Vitest tests              |

A pre-commit hook runs ESLint and Prettier on the files you commit. CI runs format check, lint, type check and build on every pull request.

---

## Project structure

```
src/
  app/
    (auth)/          login, MFA setup and verify, accept invitation,
                     forgot and reset password, welcome
    (dashboard)/     dashboard, equipment, requests, users,
                     notifications, profile
    api/fault-list/  Server route that loads the full faults list
    onboarding/
  features/          One folder per feature: auth, dashboard, departments,
                     equipment, notifications, onboarding, profile,
                     reports, requests, splash, users
                     (api.ts, components, hooks, pages and tests)
  components/        Shared layout and UI components
  lib/               API client and shared helpers
```

---

## How the dashboard talks to the backend

The browser only calls `/api/...` on the same site. `next.config.ts` forwards `/api/:path*` to `BACKEND_URL` + `BACKEND_API_PREFIX`, so the session cookie stays on the dashboard's own domain. `src/app/api/fault-list/route.ts` loads the full faults list on the server and passes the cookie along.

---

## Testing

```bash
npm test
```

Unit tests live next to the code (`*.test.ts`) and cover the API calls, dashboard calculations (for example availability), validation, MFA and users.

---

## Pull request rules

Every PR uses the [PR template](.github/pull_request_template.md). Fill in every section.

1. **Branch from `develop`** (`feature/<name>` or `fix/<name>`) and open the PR into `develop` as a **Draft**.
2. **Add a recording and screenshots** across screens (mobile, tablet, desktop), with before and after where it applies.
3. **Add the Figma designs:** screenshots and the Figma link, where they apply.
4. **Mark it Ready for review only when** all CI checks pass, the recording and screenshots are attached, the Figma screenshots and link are attached, and you have reviewed and tested your own changes. Tick each item in the **Ready for Review** checklist.

**How this is enforced:** the [PR Ready Check](.github/workflows/pr-ready-check.yml) workflow skips Draft PRs, and fails a PR marked Ready for review if any checklist item is not ticked. The failure message lists what is missing. Finish the items and tick them; the check runs again when you edit the description.

A PR cannot be merged until all required checks pass. Releases go from `develop` to `main`.

Do not commit `.env` files, secrets or real patient data.

---

## Deployment (Vercel)

The live dashboard is the Vercel project `waliin`, deployed from `main`.

Environment variables on Vercel (Production): `BACKEND_URL` and `BACKEND_API_PREFIX`. Together they must make the backend address. Vercel does not allow an empty value, so `BACKEND_URL` is the Heroku URL without `.com` and `BACKEND_API_PREFIX` is `.com`.

Deploy from a clean copy of `main`:

```bash
git checkout main && git pull
git archive main | tar -x -C ~/waliin-deploy
cd ~/waliin-deploy && npx vercel --prod
```

(The folder must contain the `.vercel` link to the project.)

---

