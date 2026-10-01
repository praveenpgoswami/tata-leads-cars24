# CLAUDE.md

Guidance for working in this repo (OEM Lead Dispatcher: Next.js 16 App Router on Vercel).

## Commands
- `npm run check`: runs `tsc --noEmit`, ESLint (zero warnings) and Vitest. Run it after every change, and fix everything before moving on.
- `npm run build:cities`: regenerates `lib/cities/active-cities.generated.ts` from `docs/Active Cities.xlsx`. Never edit the generated file by hand, and never read the xlsx at runtime.
- `npm run hash-password -- <plain>`: prints a bcrypt hash for `ADMIN_PASSWORD_HASH`.

## Code standards (strict)
- Functional React components only.
- **No ternary operators anywhere** (enforced by ESLint `no-ternary`). Use lookup maps (`Record<Status, string>`), early returns, `switch`, `&&` in JSX, or small helper functions.
- Every new file starts with a JSDoc header (purpose, exports, notes). Every exported function has JSDoc.
- TypeScript strict mode with `noUncheckedIndexedAccess`. No `any`. Must pass `tsc --noEmit` and ESLint with zero errors and zero warnings.
- zod validates everything at boundaries: Excel rows, API request bodies, OEM payloads, form inputs, env vars (`lib/env.ts`).
- Keep the module layout: `app/` (routes), `components/`, `lib/auth`, `lib/excel`, `lib/cities`, `lib/oem`, `lib/validation`, `config/` (editable business config).
- Add Vitest tests in `tests/` for any logic change: header validation, row validation, city mapping, payload mapping, auth flows.
- Never log tokens or full PII. Use `lib/log.ts` and mask phone numbers.

## Design rules
- Light theme only; neutral grays plus one deep-blue accent (`blue-800`). No gradients, glass effects, glows, emoji, sparkle icons, or heavy shadows.
- 1px borders, small radii (`rounded` or `rounded-md`), 8px spacing scale, dense tables.
- Status colours (muted green, amber, red) always appear next to a text label.
- Visible focus rings, labelled inputs, keyboard-operable controls, WCAG AA contrast.

## Domain facts (cite `docs/` when changing them)
- Excel headers, exact and in order: `mobile, customerName, modelSlug, customerCitySlug, areaName, pincode`, read from the first sheet.
- OEM: `POST {base}/api/v1/consumer/leads/third-party-leads` with an `auth-token` header and one lead per request. Fixed payload values live in `config/oem-defaults.ts`.
- DEV mode is a dry run unless `OEM_DEV_BASE_URL` and `OEM_DEV_TOKEN` are both set.
- Next 16 uses `proxy.ts` (formerly `middleware.ts`). It does only an optimistic JWT check; the full session check (including session version) runs in `requireSession()` and the protected layout.
