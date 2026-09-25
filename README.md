# Feather

Rake-to-site logistics watchdog for packaged cement and bulk construction materials.
© Webrizen AI Labs Pvt Ltd.

Feather tracks every parent consignment (railway rake / river barge / coastal ship) as it
breaks into dozens of truck trips. It forces two-point weighment, counts cement bags in
buckets, locks transporter freight when material goes missing, and blocks dispatch to
customers who are over their credit limit.

## Monorepo layout

```
apps/
  api/        Node.js + Express 5 + MongoDB (Mongoose). Auth, rules, alerts, Excel export.
  owner/      Owner / Finance web app (Vite + React + Tailwind + Headless UI). Port 5173.
  ops/        Operations app for field phones — installable PWA, works offline. Port 5174.
packages/
  shared/     @feather/shared — roles, calculations (loss, bags, demurrage, credit),
              formatters and zod validation. Used by the API AND both apps.
  ui/         @feather/ui — Tailwind theme, Headless UI components, API client, auth, hooks.
  assets/     @feather/assets — logo and other images/videos for every app.
  config/     @feather/config — shared Vite config (aliases, API proxy, brand icon).
```

Import aliases: `@/…` points to the current app's `src/` (API included, via `apps/api/alias.js`).
Shared code is imported as `@feather/shared`, `@feather/ui`, `@feather/assets/…`.

## Getting started

Needs Node 22.9+ and pnpm 11.

```bash
pnpm install
cp apps/api/.env.example apps/api/.env   # then fill it in (already done for development)
pnpm seed                                 # creates the owner account from OWNER_EMAIL
pnpm seed -- --demo                       # optional: sample materials, places, users, 2 rakes
pnpm dev                                  # API :4000, Owner :5173, Operations :5174
```

Demo logins (after `--demo`) in the Operations app:

| Role | Login |
|---|---|
| Siding supervisor | phone `9876500001`, PIN `1234` |
| Gate inspector | phone `9876500002`, PIN `1234` |
| Owner / dispatch | email OTP to `OWNER_EMAIL` |

Run the calculation tests with `pnpm test`.

## Logo and colours

Replace `packages/assets/brand/logo.svg` with the real logo (same file name). It is used in both
apps, as the favicon, and as the phone app icon. Brand colours live in one place:
`packages/ui/src/theme.css` (`--color-brand-*`). Change them to match the logo.

## Roles

| Role | App | Can | Cannot |
|---|---|---|---|
| Owner / Finance | Owner (+ Ops) | Everything, override credit, waive deductions, correct weights | — |
| Dispatch & Logistics | Ops | Orders, assign trucks to orders, delays, breakdowns, dispatch from yard | See purchase prices / margins |
| Siding supervisor | Ops | Load trucks from a rake / ship, start & release the rake clock | See prices, freight, the other end's weights |
| Gate inspector | Ops | Receive trucks (blind), bag buckets, stock count (blind) | See prices, loading weights, billed bags, book stock |

Hiding is done **on the server** (`apps/api/src/utils/present.js`), not just in the UI.

## Rules the system enforces

- **Two-point weighment.** Loading net vs. receipt net. Loss above the material's tolerance
  (default 0.5%) locks freight, and the excess loss × landed cost is deducted. A weight *gain*
  above tolerance is also flagged (water spraying).
- **Blind receipt.** The gate inspector never sees the loading weight or the billed bag count.
  Missing bags = billed − counted, calculated by the server.
- **Cement buckets.** Good → prime stock, torn → seconds (discount), hard/wet → rejected and charged,
  light bags → sample-weighed and the shortfall charged, missing → charged.
- **Tare checks.** Empty weight is compared with the truck's last 10 trips and between the two weighbridges.
- **Demurrage clock.** Placement time is server time. Shows lifting speed now vs. speed needed and the
  projected penalty; emails the owner when a rake turns "at risk" or "overdue".
- **Credit hard-stop.** Exposure = unpaid bills + value already on the road. Over limit or any bill
  older than credit days → no challan. The owner can allow a limited override (N challans / H hours).
- **Nothing is edited silently.** Entries are final once submitted. Owner corrections re-run every check
  and write to the audit log with a reason.
- **Offline.** Field entries are saved on the phone (photo included) and sent when the signal returns.
  Each entry has an id, so retries never create duplicates. Times are server times.
- **Camera-only photos** with GPS, compressed on the phone before upload.

## Configuration

See `apps/api/.env.example`. Before going live:

- Set `STORAGE_DRIVER=r2` and the four `R2_*` values (Cloudflare R2 bucket, private).
- Use a new long `JWT_SECRET` and `FILE_URL_SECRET`.
- Set `NODE_ENV=production` — the API then refuses to start with local photo storage or without SMTP.
- Set `CORS_ORIGINS` to the real app URLs, or serve both apps and `/api` from one domain behind a proxy.

## Excel exports

Owner app → buttons on Dashboard / Trips / Rakes / Customers / Transporters / Stock.
API: `GET /api/exports/{trips|consignments|transporters|credit|stock}.xlsx` (owner only).
