# AlgoSutra — web client

React 19 + Vite 6 + Redux Toolkit + Tailwind v4 frontend for the AlgoSutra coding classroom platform.

## Setup

```bash
npm install
cp .env.example .env     # then edit VITE_API_BASE_URL
npm run dev
```

## Environment

| Variable            | Default                 | Purpose                                              |
| ------------------- | ----------------------- | ---------------------------------------------------- |
| `VITE_API_BASE_URL` | `http://localhost:5000` | Backend REST + Socket.IO origin (no trailing slash). |

Vite reads `.env`, `.env.local`, `.env.[mode]` and `.env.[mode].local`. Only `.env.example` is committed; every other
`.env*` file is git-ignored. Values are baked in at build time, so rebuild after changing them.

## Scripts

| Script               | What it does                                             |
| -------------------- | -------------------------------------------------------- |
| `npm run dev`        | Dev server on `0.0.0.0:5173`                             |
| `npm run build`      | Production build to `dist/`                              |
| `npm run build:prod` | Same, with `--mode production` made explicit             |
| `npm run preview`    | Serve the `dist/` build locally                          |
| `npm run lint`       | ESLint (0 errors required)                               |

Production builds strip `console.*` / `debugger` and split vendor code into `vendor-react`, `vendor-ace`,
`vendor-slate`, `vendor-chart` and `vendor-net` chunks (see `vite.config.js`).

## Project layout

```
src/
  App.jsx                      routes (lazy pages, ErrorBoundary, mustChangePassword gate)
  common/
    constants.js               API_BASE_URL and shared constants
    services/api.js            axios instance + every REST call (throws message strings)
    services/socket.js         shared authenticated Socket.IO client
    components/redux/          auth / classes slices and the store
  pannels/
    pages/                     Login, ForgotPassword, ResetPassword, ChangePassword
    admin/ teacher/ student/   role dashboards
```

## Auth behaviour

- The JWT lives in `localStorage.token`; an expired token is discarded on boot.
- Any 401 from the API (other than login / forgot / reset password) clears the token and redirects to
  `/login?expired=1`.
- Logout clears the token, `exam:*` localStorage keys, `algo-run-history:*` sessionStorage keys and disconnects the
  socket.
- If `/auth/me` reports `mustChangePassword: true`, every authenticated route redirects to `/change-password` until
  the password is changed.
