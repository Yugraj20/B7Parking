# ParkLedger

ParkLedger is a public, read-only parking/property expense ledger with a protected Google-authenticated admin console.

## Architecture

- Public app: `index.html` → `src/main.tsx` → `src/App.tsx` using `BrowserRouter`.
- Admin app: `admin.html` → `src/admin-main.tsx` → `src/AdminApp.tsx` using `HashRouter` for GitHub Pages.
- React 19 + Vite + TypeScript + Firebase Auth/Firestore/Storage.
- Money is integer paise in `amountCents`. Expense splits are integer paise and must sum exactly to `amountCents`.
- The public app never writes to Firestore.
- Admin writes are enforced by Firestore/Storage rules using the Firebase custom claim `admin: true` and a verified email.

## Local development

1. Copy `.env.example` to `.env` and fill the Firebase web configuration.
2. Run `npm install`.
3. Run `npm run dev`.
4. For a production build, run `npm run build`.

Firebase web configuration is not a service-account credential. Never add service-account JSON or private keys to the repository.

## Admin authorization

The client uses `VITE_ADMIN_EMAIL` only as a UX gate. The security boundary is the Firebase custom claim checked by Firestore and Storage rules.

Set the first administrator claim with a trusted Firebase Admin SDK environment, for example from a private script that is **not** committed to this repository:

```ts
await getAuth().setCustomUserClaims("FIREBASE_UID", { admin: true });
```

After setting the claim, the administrator must sign in again or refresh their ID token. The signed-in Google account must also have a verified email.

Do not replace the claim check with an email string in `firestore.rules` or `storage.rules`.

## Public/private resident data

Public `residents/{id}` documents contain only:

- `name`
- `flatId`
- `shares`
- `active`

Private resident contact data belongs in `residentPrivate/{id}` and is admin-only. Existing deployments should migrate phone/notes out of public resident documents before relying on the new public read rules.

## Ledger calculations

`src/lib/ledger.ts` is the single shared domain layer used by public and admin views.

For each resident:

- `owedCents` = all allocated split shares.
- `paidCents` = recorded payments plus the payer's own split share for each expense.
- `remainingCents` = owed minus paid, including negative credits.
- Status is `clear`, `pending`, `partial`, `paid`, or `credit`.

Totals include outstanding positive balances and credits separately. Charts receive rupee values, not paise.

## Split rules

`exactSplit()` operates in integer paise. For proportional splits it floors each share and assigns the remainder to the participant with the largest weight. Custom weights that total zero are rejected instead of silently changing to equal shares.

## Dates

Local calendar dates use `localISODate()` and `localMonthKey()`. Billing-period calculations use `settings.monthStartDay`, capped to days 1–28.

## Recurring generation

The normal Generate action creates the current billing period only. Catch-up explicitly creates every missing billing period from `startMonth` through the current period. Generated expense IDs are deterministic as `exp_{recurringId}_{yyyy-mm}` so retries cannot create duplicates.

## Reports

Six distinct reports are available: Monthly, Yearly, Expense, Payment, Outstanding Dues, and Resident. Each exports CSV, XLSX, and paginated PDF. Text cells are sanitized against Excel formula injection.

## Backup restore

Backups are JSON. Restore confirms that matching IDs are replaced while records absent from the backup are kept. Restore uses Firestore batches of at most 400 writes and does not restore `id`, `createdAt`, or `updatedAt` into document bodies.

## GitHub Pages

The deploy workflow uses `npm ci`, builds both `index.html` and `admin.html`, and sets `VITE_BASE_PATH` to the repository path. Production sourcemaps are disabled. Public assets are referenced with a base-aware relative path.

`public/404.html` uses a repository prefix only on `github.io` hostnames, so custom domains and user Pages are not given a false repository prefix.
