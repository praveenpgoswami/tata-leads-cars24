# OEM Lead Dispatcher

Internal tool for one admin. You upload an Excel file of leads, review the validated rows, and send them to the OEM lead API, switching between DEV and LIVE as needed.

Built with Next.js 16 (App Router), TypeScript, Tailwind, SheetJS, zod, jose and bcryptjs, plus Upstash Redis. It deploys to Vercel with no custom server config.

---

## How it works

1. **Sign in.** One admin account. Sessions are a signed JWT in an httpOnly, `SameSite=Strict` cookie that lasts 8 hours. Logins are limited to 5 attempts per 15 minutes per IP.
2. **Upload.** Drop or pick one `.xlsx` or `.xls` file (5 MB max, 5,000 rows max). It is parsed **in the browser** and never uploaded.
3. **Validate.**
   - *Structure:* the first sheet must have exactly these headers, in this order:
     `mobile, customerName, modelSlug, customerCitySlug, areaName, pincode`.
   - *Rows:* each row is checked against the field rules below. Its city is matched against the active city list. Every row ends up Valid, Invalid or Unmapped city.
4. **Send.** Valid rows go to `/api/leads/send` in batches of 10. On the server, each row is validated again, its payload is built and validated with zod, and the OEM is called with 3 requests in flight at a time. Network errors and 5xx responses get one retry; 4xx responses are never retried. LIVE sends need a confirmation first.

### Field rules

| Excel column | API field | Rule |
|---|---|---|
| `mobile` | `customerNumber` (string) | 10 digits starting 6–9. One leading `0` is stripped. `+91` is rejected |
| `customerName` | `customerName` | Required, 1–100 characters |
| `modelSlug` | `interestedModelId` | A model ID (1523, 1372, 1188, 1148, 1348, 1480) or name ("Nexon EV", "nexon-ev") |
| `customerCitySlug` | `customerCitySlug` | Matched to an active city by slug, name or alias, then sent as the canonical slug |
| `areaName` | `customerAreaId` | Positive whole number. Blank becomes `2` |
| `pincode` | `pinCode` (number) | 6 digits, not starting with 0 |

`interestedMakeId` is always `69` (Tata). All other payload fields use the fixed values from the API doc's sample. See `config/oem-defaults.ts`.

### Where each rule comes from

| Fact | Source |
|---|---|
| Headers and order | `docs/Excel sheet screenshot.jpeg` (two cut-off names confirmed by the business owner) |
| Endpoint `POST /api/v1/consumer/leads/third-party-leads`, `auth-token` header | API doc, "Lead api" curl sample |
| Mandatory fields | API doc, "Mandatory fields" |
| Fixed values (`trafficType`, `leadSource`, `userAgent`, …) | API doc: "The rest of the fields remain the same" |
| Default area ID 2 | API doc note under the mandatory fields |
| Model IDs, make ID 69 | API doc, "Model Id mapping" and "Make Id mapping" |
| City slugs | `docs/Active Cities.xlsx` (columns `id, name, slug, …`; the API needs `slug`) |

The API doc does not define a response format, status codes or rate limits. The app treats any 2xx as **Sent** and shows a short, sanitised piece of the response body as the row's message.

### DEV vs LIVE

| Mode | Behaviour |
|---|---|
| DEV (the default on every page load) | **Dry run.** Payloads are built and validated on the server and logged with PII masked. No network call is made. If both `OEM_DEV_BASE_URL` and `OEM_DEV_TOKEN` are set, DEV calls that endpoint instead |
| LIVE | Calls `OEM_LIVE_BASE_URL` with `OEM_LIVE_TOKEN`. Switching to LIVE and sending in LIVE both ask for confirmation and show the lead count |

Rows sent in DEV show as **Sent (DEV)** and become sendable again in LIVE. Rows sent in LIVE are never sent again.

Tokens and URLs exist only on the server. The browser sends just `{ mode, rows }`.

---

## Local setup

Requirements: Node.js 20.9 or later, and an Upstash Redis database (the free tier is fine).

```bash
npm install
cp .env.example .env.local
npm run hash-password -- "choose-a-strong-password"
```

Paste the **escaped** line printed by `hash-password` into `.env.local`. Next.js expands `$` in `.env` files, so every `$` must be written as `\$`. If the hash gets mangled, the app refuses to start and tells you so.

Fill in the rest of `.env.local`. `.env.example` describes every variable.

```bash
npm run dev          # http://localhost:3000
```

> **Local Redis:** use a real Upstash database. `@upstash/ratelimit` uses an Upstash-only Lua option (`allow-key-locking`) that plain Redis and the `serverless-redis-http` emulator reject, so login fails against them. If the project is already linked to Vercel, `vercel env pull .env.local` fetches the Upstash variables for you.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js dev server, production build, production server |
| `npm run check` | `tsc --noEmit`, ESLint (zero warnings allowed) and Vitest. Run it before every commit |
| `npm run hash-password -- <plain>` | Prints a bcrypt hash: a raw copy for Vercel and an escaped copy for `.env.local` |
| `npm run build:cities` | Regenerates `lib/cities/active-cities.generated.ts` from `docs/Active Cities.xlsx` |

### Updating the city list

1. Replace `docs/Active Cities.xlsx`. Keep the `id, name, slug, …, isActive` columns.
2. Run `npm run build:cities`. Only rows with `isActive = 1` are kept. The script fails on duplicate ids or slugs.
3. Run `npm run check`. A test confirms every alias in `config/city-aliases.ts` still points to an active city.
4. Commit the regenerated file. The app never reads the xlsx at runtime.

Alternative spellings go in **`config/city-aliases.ts`** (for example `bengaluru → bangalore`, `gurugram → gurgaon`, `delhi → new-delhi`). The OEM list uses the older names as canonical.

---

## Deploying to Vercel

1. **Import the repository** in Vercel. The framework preset is detected as Next.js, and no build settings need changing.
2. **Add Upstash Redis:** in the project, open *Storage*, choose *Create / Connect Database*, pick *Upstash for Redis*, create the database and connect it to the project. This injects `KV_REST_API_URL` and `KV_REST_API_TOKEN`, which the app accepts as-is.
3. **Set environment variables** under *Settings → Environment Variables* (Production, plus Preview if you use it):

   | Variable | Value |
   |---|---|
   | `ADMIN_USERNAME` | admin username |
   | `ADMIN_PASSWORD_HASH` | the **raw** hash from `npm run hash-password` (no backslashes in the Vercel UI) |
   | `SESSION_SECRET` | 32+ random characters: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
   | `OEM_LIVE_BASE_URL` | `https://cms-bike-backend-prod.cars24.team` |
   | `OEM_LIVE_TOKEN` | the production `auth-token` (mark it **Sensitive**) |
   | `OEM_DEV_BASE_URL`, `OEM_DEV_TOKEN` | leave unset for dry-run DEV, or set both to a UAT endpoint |
   | `OEM_REQUEST_TIMEOUT_MS` | optional, default `8000` |

4. **Deploy.** `instrumentation.ts` validates every variable at startup. A misconfiguration shows up in the function logs as a list of the variables that are wrong.
5. **Smoke test:** sign in, upload a small file, send in DEV (dry run), then send one known-good lead in LIVE.

### Operations

- **Changing the password:** use *Settings → Change password*. The new hash is stored in Redis and overrides `ADMIN_PASSWORD_HASH`. Every session is signed out.
- **Forgotten password:** delete the Redis key `admin:password_hash` (Upstash console → Data Browser). The login falls back to `ADMIN_PASSWORD_HASH`. To also sign out every session, increment `admin:session_version`.
- **Logs:** each lead produces one JSON line, `lead.sent` or `lead.rejected`, containing `mode`, `rowNumber`, `outcome`, `httpStatus`, `attempts` and a masked phone number (`******8765`). Names and tokens are never logged.
- **Timeouts:** each batch request is capped at `maxDuration = 60` seconds. With 10 rows, 3 at a time, 8-second timeouts and one retry, a batch stays inside that limit.

### Security notes

- The API doc in `docs/` contains a production token in plain text. Don't commit it anywhere else, and consider asking the provider to rotate it.
- The `xlsx` package is installed from the SheetJS CDN (0.20.3) because the npm registry copy (0.18.5) has known vulnerabilities.

---

## Project layout

```
app/                 routes: /login, /(protected) dashboard and settings, /api/*
components/          UI: layout (top bar, mode switch), dashboard, forms, ui primitives
config/              editable business config: Excel layout, models, OEM fixed fields, city aliases
lib/auth             sessions (jose), passwords (bcrypt), credential store, rate limit
lib/excel            parsing (SheetJS), header checks, row state, error report CSV
lib/cities           generated active-city list and the matcher
lib/oem              payload mapping, HTTP client with retry, batch sender
lib/validation       zod schemas for rows, API requests and responses, forms
lib/env.ts           zod-validated environment
proxy.ts             route protection (Next 16's name for middleware)
scripts/             build-cities, hash-password
tests/               Vitest unit tests
```

Code standards for contributors are in `CLAUDE.md`. The most notable: no ternary operators (enforced by ESLint), no `any`, and a JSDoc header on every file.
