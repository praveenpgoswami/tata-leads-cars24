# OEM Lead Dispatcher: implementation plan (draft for approval)

Status: **approved 2026-10-01**, with these decisions:

| Q | Decision |
|---|---|
| Headers | Exactly `mobile`, `customerName`, `modelSlug`, `customerCitySlug`, `areaName`, `pincode`, in that order; read from the first sheet |
| DEV | Dry run: build and validate the payload, make no network call. If `OEM_DEV_BASE_URL` and `OEM_DEV_TOKEN` are set later, DEV calls that URL instead |
| Endpoint | The cars24.team host is confirmed |
| areaName | Numeric area ID; blank defaults to 2 |
| userAgent | The sample's Firefox string, sent verbatim |
| Mobile | 10 digits starting 6–9; one leading `0` is allowed and stripped; `+91` is rejected |
| Model | Accepts the six IDs or the model names from the doc ("Nexon EV", "nexon-ev", "NexonEV") |
| Git | Not used for now |
| Unanswered | `proxy.ts` (Next 16); lat/long sent as `null` as in the sample; files moved to `docs/`; 5,000-row cap; no duplicate flagging |

---

## 0. Discrepancies with the brief (found before reading)

| Brief says | Workspace actually has |
|---|---|
| `docs/` folder | `doc/` folder |
| `docs/Active Cities.xls` (legacy .xls) | `doc/Active Cities.xlsx` (modern .xlsx) |

I will read the files from where they are. During implementation I'll move them to `docs/` unless you want them left in `doc/` (Q1).

---

## 1. What the docs say

### 1.1 Excel layout: `doc/Excel sheet screenshot.jpeg`

Six columns, A to F, header in row 1, data from row 2:

| # | Header (as visible) | Sample values | What the data looks like |
|---|---|---|---|
| A | `mobile` | 8823098494, 9991879860 | 10-digit Indian mobile; Excel stores it as a number |
| B | `customerNa…` (cut off, almost certainly `customerName`) | Rama, karan, Kirti, pooja | Free text, mixed case |
| C | `modelSlug` | 1188, 1348 | **A numeric model ID**, not a slug. 1188 = Harrier EV, 1348 = Curvv EV in the API doc's model table |
| D | `customerCity…` (cut off: `customerCity` or `customerCitySlug`) | new-delhi, gurgaon, udaipur, vellore | **City slugs**, and all four exist in the Active Cities `slug` column |
| E | `areaName` | 2 | **A numeric area ID** (2 is the API doc's default area), not a name |
| F | `pincode` | 110003, 122001, 313001, 632001 | 6-digit number |

What the screenshot does **not** show: the sheet/tab name, any email column, any date column. Your brief mentions email and date validation, but those columns don't exist in this layout, so I won't validate them (Q2, Q3).

### 1.2 API contract: `doc/Adtrafix - lead contract tata api doc.docx`

The whole document is one curl example plus field notes. There are no tables or images.

| Item | What the doc says | Source in doc |
|---|---|---|
| Endpoint | `https://cms-bike-backend-prod.cars24.team/api/v1/consumer/leads/third-party-leads` | "Lead api:" curl line |
| Method | POST (curl's default when `--data` is passed; the doc never says so explicitly) | curl `--data` |
| Headers | `Content-Type: application/json`, `auth-token: <token>` | curl `--header` lines |
| Auth | One static token in the `auth-token` header. No token-generation endpoint | curl `--header` |
| DEV/UAT URL | **Not given.** Only the `-prod` host appears | — |
| Batch endpoint | None. One lead per request | curl body is a single object |
| Response shape / status codes | **Not documented** | — |
| Rate limits | **Not documented** | — |

**Mandatory fields** (section "Mandatory fields:"): `customerName`, `interestedModelId`, `customerNumber`, `interestedMakeId`, `customerCitySlug`, `customerAreaId`.

**Remaining fields:** the doc says "The rest of the fields remain the same", so I'll send them exactly as in the sample:

| Field | Fixed value | JSON type in sample |
|---|---|---|
| `userAgent` | `"Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:145.0) Gecko/20100101 Firefox/145.0"` | string (Q7) |
| `whatsappOptIn` | `false` | boolean |
| `trafficType` | `"PARTNERSHIP"` | string |
| `sourceUrl` | `null` | null |
| `leadSource` | `"adtrafix"` | string |
| `utmCampaign`, `utmMedium`, `utmAdGroup` | `null` | null |
| `leadIntent` | `"PRIMARY"` | string |
| `gclid` | `null` | null |
| `customerLatitude`, `customerLongitude` | `null` | null (Q8) |
| `interestedInFinance` | `false` | boolean |
| `productType` | `"NEW_CARS"` | string |

**Lookup values:**
- Make: `Tata` = `69`. This is a fixed constant ("Make Id mapping").
- Models ("Model Id mapping"): PunchEV 1523, NexonEV 1372, Harrier EV 1188, Tiago EV 1148, Curvv EV 1348, Sierra 1480.
- Area: "In case City doesn't have an area then pass the default area id that is 2." The first line says "Make-Model, City and Area Mapping provided", but **no area mapping file was provided** (Q5).
- City: "customerCitySlug mapping csv shared with you separately". I'm treating `Active Cities.xlsx` as that file.

**Security note:** the doc contains what looks like a **real production `auth-token` in plain text**. I will not copy it into any file in this repo. It goes only into the Vercel env var. Since the doc has been shared around, consider asking the provider to rotate it.

**Another note:** the host is `cars24.team`, not a Tata domain. I'm assuming this is the intended partner endpoint for Tata leads (Q4).

### 1.3 Excel column → API field mapping

| Excel | API field | Transform and validation |
|---|---|---|
| `mobile` | `customerNumber` (string) | Convert to string, trim, then must match `^[6-9]\d{9}$` (Q6: should we strip a `+91` or `0` prefix?) |
| `customerName` | `customerName` (string) | Trim and collapse spaces; 1–100 chars; letters, spaces, `.`, `'`, `-` |
| `modelSlug` | `interestedModelId` (number) | Must be one of the six IDs. Optionally also accept the model names from the doc (Q9) |
| `customerCity…` | `customerCitySlug` (string) | City matcher (§1.4). No match means the row is "Unmapped city" |
| `areaName` | `customerAreaId` (number) | Positive integer; blank defaults to `2` (doc note) |
| `pincode` | `pinCode` (number) | 6 digits, `^[1-9]\d{5}$` |
| — | `interestedMakeId` | Constant `69` |
| — | all other fields | Fixed values from §1.2 |

### 1.4 City file: `doc/Active Cities.xlsx`

- One sheet, `Sheet1`, range `A1:G422`, which is **421 cities**.
- Columns: `id`, `name`, `slug`, `latitude`, `longitude`, `stateId`, `isActive`.
- `isActive` is `1` on every row. `id`, `name` and `slug` are all unique and none is blank.
- In every row, `slug` equals the lower-cased, hyphenated `name` (e.g. New Delhi → new-delhi).
- **The API needs `slug`** (`customerCitySlug`), not `id`.
- Canonical spellings differ from the examples in the brief: the list has **`Bangalore`** (no Bengaluru), **`Gurgaon`** (no Gurugram) and **`New Delhi`** (no plain Delhi). So the default alias map will be:
  `bengaluru → bangalore`, `gurugram → gurgaon`, `delhi → new-delhi`, `bombay → mumbai`, `poona → pune`, plus a few others such as `calcutta → kolkata` and `madras → chennai`, kept only where the target exists in the list.

**Matching steps:** trim → lower-case → collapse whitespace → normalise to the slug form (spaces and underscores become `-`). Then look for (1) an exact slug match, (2) an exact name match, (3) an alias. This accepts `new-delhi`, `New Delhi` and `Delhi` alike. The preview shows the original value next to the matched city's name and slug.

`npm run build:cities` reads the xlsx, validates it with zod, and writes `lib/cities/active-cities.generated.ts`. Only rows with `isActive === 1` are kept. The generated file is committed, so Vercel builds don't need the xlsx.

---

## 2. Stack choices and one deviation from the brief

- **Next.js 16.3 (latest stable).** Next 16 renamed `middleware.ts` to **`proxy.ts`** and deprecated the old name. I'll use `proxy.ts`. It does the same job: protect every route except `/login`, `/api/auth/login` and static assets (Q10).
- **SheetJS.** The `xlsx` package on npm is stuck at 0.18.5, which has known advisories (prototype pollution, ReDoS). I'll install 0.20.x from SheetJS's official CDN tarball (`https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`), as SheetJS recommends.
- **Other libraries:** `zod` v4, `bcryptjs`, `jose`, `@upstash/redis`, `@upstash/ratelimit`, Tailwind v4, `lucide-react`, Vitest. For the large table I'll use `@tanstack/react-table`, with pagination at 50 rows per page. Pagination is simpler and more accessible than virtualization.
- **ESLint** with `no-ternary: error` and `@typescript-eslint/no-explicit-any: error`, so the code standards are enforced by tooling rather than by review.

---

## 3. Folder structure

```
app/
  layout.tsx                     root layout, Inter font
  login/page.tsx                 centred login card
  (protected)/layout.tsx         top bar; server-side session check
  (protected)/page.tsx           dashboard
  (protected)/settings/page.tsx  change password
  api/auth/login/route.ts
  api/auth/logout/route.ts
  api/auth/password/route.ts
  api/leads/send/route.ts        batch send (≤10 rows), maxDuration 60
proxy.ts                         route protection (Next 16 name for middleware)
components/
  layout/TopBar.tsx, ModeSwitch.tsx, ConfirmDialog.tsx
  upload/Dropzone.tsx
  preview/LeadTable.tsx, StatusBadge.tsx, SummaryBar.tsx, ProgressBar.tsx
  forms/LoginForm.tsx, ChangePasswordForm.tsx
  ui/Button.tsx, Input.tsx, Alert.tsx
config/
  city-aliases.ts                editable alias map
  models.ts                      model name → id (from API doc)
  oem-defaults.ts                fixed payload values (from API doc)
  excel-layout.ts                expected headers and order, size and row caps
lib/
  env.ts                         zod-validated server env
  redis.ts                       Upstash client
  auth/session.ts, password.ts, rate-limit.ts, credentials.ts
  excel/parse.ts, validate-headers.ts, validate-rows.ts, error-report.ts
  cities/active-cities.generated.ts, match-city.ts
  oem/build-payload.ts, client.ts, send-batch.ts
  validation/schemas.ts          shared zod schemas (row, payload, forms, API I/O)
  log.ts                         structured logger with PII masking
scripts/
  build-cities.ts, hash-password.ts
tests/
  validate-headers.test.ts, validate-rows.test.ts, match-city.test.ts,
  build-payload.test.ts, change-password.test.ts, send-batch.test.ts
docs/                            reference files (moved from doc/)
.env.example, README.md, CLAUDE.md
```

---

## 4. Data flow

1. **Login.** The browser posts to `/api/auth/login`. The login is rate-limited at 5 attempts per 15 minutes per IP (Upstash). The server checks credentials against the Redis hash, falling back to the env seed, using `bcrypt.compare`. On success it issues a JWT `{ sub, sv }` with an 8-hour expiry in an httpOnly, Secure, SameSite=Strict cookie. Failures always return "Invalid username or password".
2. **Protection.** `proxy.ts` verifies the JWT signature and expiry, and checks `sv` against `admin:session_version` in Redis. A protected route handler runs the same check again through `requireSession()`. Anything that fails is redirected to `/login`; API routes get a 401.
3. **Upload.** The browser checks the drop or pick (exactly one file, `.xlsx` or `.xls`, ≤5 MB), then SheetJS parses it locally.
   - Structure check: first sheet (Q3); headers trimmed and compared exactly, in order, to `config/excel-layout.ts`. On failure, show one error listing missing, extra and misordered columns, and no table.
   - Row check: each row goes through the zod row schema and then the city matcher. Status is Valid, Invalid (with a reason per cell) or Unmapped city.
4. **Preview.** Summary counts, a sticky-header table, filters by status, "Clear file" and "Download error report" (a CSV built in the browser).
5. **Send.** Clicking Send in LIVE mode opens a confirmation dialog showing "Send N leads to LIVE?". The client then sends rows that are Valid and not yet Sent, in batches of 10, as `{ mode, rows: [{ rowIndex, payloadInput }] }` to `/api/leads/send`. It updates the table after each batch and checks a cancel flag between batches.
6. **Server send.** The route handler checks the session, validates the body with zod, and rebuilds the payload on the server. The server re-runs the city match and model lookup itself rather than trusting the client's payload. It picks the URL and token for the given mode from env, and calls the OEM with concurrency 3 and an 8-second timeout per call. A network error or 5xx gets one retry after about 500 ms of backoff; a 4xx is not retried. It logs one JSON line per row: `{ mode, rowIndex, outcome, httpStatus, attempt, phone: "******6655" }`. Tokens, names and full numbers are never logged. It returns a status and a short message for each row.
7. **Change password.** The server verifies the current password, applies the rules (≥8 chars, different from current, matches confirmation), writes the new bcrypt hash to `admin:password_hash`, increments `admin:session_version`, and clears the cookie. The client is sent to `/login`.

**Redis keys:** `admin:password_hash`, `admin:session_version`, plus the rate-limit prefix `ratelimit:login:*`.

---

## 5. Environment variables (`lib/env.ts`, validated with zod)

| Var | Required | Notes |
|---|---|---|
| `ADMIN_USERNAME` | yes | |
| `ADMIN_PASSWORD_HASH` | yes | bcrypt hash used to seed the admin; generate with `npm run hash-password -- <plain>` |
| `SESSION_SECRET` | yes | ≥32 random chars; signs the JWT |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | yes* | *Also accepts `KV_REST_API_URL` / `KV_REST_API_TOKEN`, the names Vercel's Upstash integration injects |
| `OEM_LIVE_BASE_URL` | yes | e.g. `https://cms-bike-backend-prod.cars24.team`. The path `/api/v1/consumer/leads/third-party-leads` is a constant in code |
| `OEM_LIVE_TOKEN` | yes | sent as the `auth-token` header |
| `OEM_DEV_BASE_URL` | see Q11 | |
| `OEM_DEV_TOKEN` | see Q11 | |
| `OEM_REQUEST_TIMEOUT_MS` | no | default 8000 |

The values in `leadSource`, `trafficType` and the other fixed fields live in `config/oem-defaults.ts`, not in env, because they're contract values from the doc and not secrets.

---

## 6. Implementation steps (after approval)

After every step I'll run `tsc --noEmit`, `eslint` (zero warnings) and `vitest`, and fix everything before moving on.

1. Scaffold: Next 16, TS strict, Tailwind, ESLint rules, Vitest, `CLAUDE.md`, `.env.example`, `lib/env.ts`. I'll also run `git init` so each step is a reviewable commit (Q12).
2. Cities: `scripts/build-cities.ts`, generated module, `match-city.ts`, alias config, tests.
3. Excel: header validation, row schema, parsing, error-report CSV, tests.
4. OEM: payload builder, client with retry and timeout, batch sender, logger, tests.
5. Auth: Redis, session, password, rate limit, login and logout routes, `proxy.ts`, login page, tests.
6. Change password: route, settings page, session rotation, tests.
7. Dashboard UI: top bar, mode switch with confirmation, dropzone, table, summary, send flow with progress and cancel.
8. `README.md`, final pass, and `next build`.

---

## 7. Open questions

1. **Folder:** move `doc/` to `docs/`, or leave it?
2. **Email and date:** the screenshot has no email or date column. Confirm that the six columns shown are the complete layout.
3. **Headers and sheet:** two headers are cut off. Are they exactly `customerName` and `customerCity` (or `customerCitySlug`)? Is there a required sheet name, or should I use the first sheet?
4. **Endpoint:** the only URL is `cms-bike-backend-prod.cars24.team`. Is that the right destination for these "Tata" leads?
5. **Area:** the doc says an area mapping was provided, but I only have cities. Is `areaName` always a numeric area ID (default 2 when blank), or will it hold area names that need a mapping file you haven't shared?
6. **Mobile:** should I accept and strip a `+91`, `91` or `0` prefix, or reject anything that isn't exactly 10 digits?
7. **userAgent:** send the sample's Firefox string verbatim ("the rest of the fields remain the same"), a fixed string like `AdtrafixLeadDispatcher/1.0`, or the admin's browser user agent?
8. **Lat/long:** the city file has coordinates. Send them in `customerLatitude`/`customerLongitude`, or keep `null` as in the sample?
9. **Model column:** the header is `modelSlug` but the values are IDs. Accept only the six IDs, or also names like "Nexon EV" / "nexon-ev"?
10. **`proxy.ts`:** OK to use Next 16's `proxy.ts` instead of `middleware.ts`? Alternatively I can pin Next 15 and keep `middleware.ts`.
11. **DEV environment:** there is no DEV/UAT URL. Options:
    (a) you get a UAT URL and token from the provider and I wire them up;
    (b) DEV mode is a **dry run**: the server builds and validates the exact payload, logs it with PII masked, and returns a simulated success without making any network call. If `OEM_DEV_BASE_URL` is set later, it calls that URL instead.
    I recommend **(b)**.
12. **Git:** OK to `git init` and commit after each step?
13. **Response handling:** without a documented response, I'll treat any 2xx as Sent and show a short, sanitised piece of the response body (≤200 chars) as the message. If you have a sample success and error response, I'll parse the ID properly.
14. **Duplicates and limits:** should I flag duplicate mobile numbers within a file? I'd also like to cap files at 5,000 rows. OK?
