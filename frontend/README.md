# Waliin – Frontend (PWA)

Waliin helps Ethiopian public hospitals keep medical equipment in service. Clinical staff report equipment faults in a few taps, biomedical engineers assess, repair and test machines, and requests for spare parts, outside help and new equipment are tracked until they are answered.

## Features

### Clinical staff

- **Home:** quick actions, report and request counts, machines in your ward with their status
- **Report a fault:** choose the machine, what is wrong, whether it can still be used and the effect on patients, review and send
- **My fault reports:** status filters (Received, In repair, Waiting for part, Back in use, Closed) and a timeline for each report
- **Equipment requests:** request a new machine for the ward and follow it until it is received
- **Notifications:** bell with unread count, mark as read, and clear error and retry states

### Biomedical engineers

- **Dashboard:** what needs attention first, new fault reports and returned registrations
- **Equipment:** register machines one by one or from a CSV file, see your registrations and their approval status
- **Faults:** review reports, assign, assess (severity, clinical criticality, backup) and see the priority score
- **Maintenance:** record repairs and tests, and release a machine to service only after the functional and safety tests pass
- **Requests:** request spare parts, outside help or replacements; edit and resubmit returned requests; add technical requirements to clinical equipment requests
- **Reports and profile**
- **Mobile menu:** on phones the sidebar opens from the ☰ button

### Account security

- Sign in with email and password, chosen on the **Continue as** page
- **Authenticator app (MFA)** for engineers: first sign-in shows a QR code (with the setup key as a backup), then a 6-digit code at every sign-in
- Accept invitation, forgot password and reset password pages
- No patient information is ever asked for or stored

---

## Tech stack

| Area         | Tools                                                    |
| ------------ | -------------------------------------------------------- |
| Framework    | Next.js 16 (App Router, Turbopack), React 19, TypeScript |
| Styling      | Tailwind CSS 4, CSS modules                              |
| Forms        | React Hook Form                                          |
| Icons and QR | lucide-react, qrcode.react                               |
| Tests        | Vitest                                                   |
| Quality      | ESLint, Prettier, Husky + lint-staged (pre-commit)       |
| Hosting      | Vercel                                                   |

---

## Getting started

### 1. Requirements

- Node.js 22 or newer and npm
- The Waliin backend running locally, or the URL of a deployed backend

### 2. Install

```bash
git clone git@github.com:akirachix/solvya-frontend.git
cd solvya-frontend
npm ci
```

### 3. Environment variables

Copy the example file and fill it in:

```bash
cp .env.example .env.local
```

| Variable                    | What it is                                                                                                  | Example                 |
| --------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------- |
| `BACKEND_URL`               | Base URL of the FastAPI backend that `/api/*` is forwarded to                                               | `http://localhost:8000` |
| `BACKEND_API_PREFIX`        | Path prefix of the backend routes. Leave it empty when routes start at the root (as in the current backend) | _(empty)_               |
| `NEXT_PUBLIC_DASHBOARD_URL` | Address of the manager dashboard, used to send managers there from **Continue as**                          | `http://localhost:3001` |

Never commit `.env.local`.

### 4. Run

```bash
npm run dev
```

Open http://localhost:3000.

---

## Scripts

| Command                | What it does                        |
| ---------------------- | ----------------------------------- |
| `npm run dev`          | Start the development server        |
| `npm run build`        | Production build (also type-checks) |
| `npm start`            | Run the production build            |
| `npm run lint`         | ESLint                              |
| `npm run format`       | Format all files with Prettier      |
| `npm run format:check` | Check formatting (used in CI)       |
| `npm test`             | Run the Vitest tests                |

A pre-commit hook runs ESLint and Prettier on the files you commit.

---

## Project structure

```
app/                      Pages (Next.js App Router)
  continue-as/            Choose clinical staff or biomedical engineer
  login/                  Sign in, MFA setup (QR code) and MFA verify
  accept-invite/          Set name and password from an invitation
  forgot-password/, reset-password/[token]/
  home/                   Clinical home
  requests/               My fault reports, report a fault, report detail
  equipment-requests/     Clinical equipment requests
  biomedical-engineer/    Engineer pages: dashboard, equipment, faults,
                          maintenance, requests, reports, profile
  api/fault-list/         Server route that loads the full faults list
components/               UI components by feature (login, faults, nav,
                          notifications, maintenance, engineer-requests, …)
lib/                      API calls, session, validation, helpers and tests
public/images/            Logo and images
docs/openapi.json         Backend API description
```

---

## How the app talks to the backend

The browser only calls `/api/...` on the same site. `next.config.ts` forwards those requests to `BACKEND_URL` + `BACKEND_API_PREFIX`, so the session cookie stays on the app's own domain.

- `/api/:path*` → backend `/:path*`
- `/api/faults/` → backend `/faults/` (the one call that needs a trailing slash)
- `app/api/fault-list/route.ts` loads the full faults list on the server and passes the cookie along

Clinical staff only see **approved** machines; this is enforced by the backend.

---

## Testing

```bash
npm test
```

Unit tests live next to the code (`lib/*.test.ts`) and cover auth, MFA, validation, notifications, requests and helpers.

The QA test cases for the whole system are kept in the team's test coverage workbook.

---

## Contributing

1. Branch from `develop`: `feature/<name>` or `fix/<name>`.
2. Before pushing, run `npm run format:check`, `npm run lint`, `npm test` and `npm run build`.
3. Open a pull request into `develop` as a **Draft** and fill in the Engineers Checklist.
4. When CI is green, mark it **Ready for review**. Three approvals are needed.
5. Releases go from `develop` to `main`.

Do not commit `.env` files, secrets or real patient data.

---

## Deployment (Vercel)

The live app is the Vercel project `waliin-solvya`, deployed from `main`.

Environment variables on Vercel (Production):

- `BACKEND_URL` and `BACKEND_API_PREFIX`: together they must make the backend address. Vercel does not allow an empty value, so `BACKEND_URL` is the Heroku URL without `.com` and `BACKEND_API_PREFIX` is `.com`.
- `NEXT_PUBLIC_DASHBOARD_URL`: `https://waliin.vercel.app`

Deploy from a clean copy of `main`:

```bash
git checkout main && git pull
git archive main | tar -x -C ~/waliin-pwa-deploy
cd ~/waliin-pwa-deploy && npx vercel --prod
```  |
