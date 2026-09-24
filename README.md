# ParkLedger

A production-oriented React + TypeScript + Firebase parking/property expense manager.

The supplied HTML was used as the functional starting point. Its public view-only model, remainder-safe split concept, partial-payment concept, CSV export and administrator surface are preserved, but the information architecture and visual system have been rebuilt around a public ledger plus a protected admin console. The original static demo values are not automatically written into Firestore.

## Stack

- React + Vite + TypeScript
- Firebase Authentication, Firestore and Storage
- Recharts for responsive analytics
- Motion-ready React architecture
- Libraries.dev `border-beam` used selectively on the protected login surface
- XLSX and jsPDF exports are implemented for Excel-compatible and PDF reports

Libraries.dev documents its React effects as standalone npm packages and recommends selective use of motion that respects reduced-motion preferences. See https://libraries.dev/introduction and https://libraries.dev/how-to-use.

## Run locally

1. Copy `.env.example` to `.env`.
2. Run `npm install`.
3. Run `npm run dev`.
4. Open the Vite URL.

The Firebase web configuration supplied in `.env.example` is client configuration, not a service-account credential. Never put a Firebase service-account JSON, private key or Admin SDK credential in this project.

## Firebase setup

In Firebase Console:

1. Create/select project `b7auth`.
2. Enable Authentication > Google.
3. Add your local and deployed domains under Authentication > Settings > Authorized domains.
4. Create a Firestore database.
5. Apply `firestore.rules`.
6. If receipt uploads are enabled, apply `storage.rules`.
7. Set the admin email to `yugrajsekhon20@gmail.com` in the environment.
8. Deploy the Vite `dist` directory to Firebase Hosting, GitHub Pages with an SPA fallback, Vercel, Netlify, or another static host.

## Data model

Top-level collections:

- `residents`
- `flats`
- `categories`
- `expenses`
- `payments`
- `recurringExpenses`
- `activityLogs`
- `settings/global`
- `users/{uid}`

Expenses store monetary values as integer paise in `amountCents`. Splits are also integer paise. This avoids floating-point rounding errors.

### Expense shape

```ts
{
  title: string,
  amountCents: number,
  categoryId: string,
  payerId: string,
  date: "YYYY-MM-DD",
  dueDate?: "YYYY-MM-DD",
  type: "one-time" | "monthly" | "recurring",
  recurringId?: string,
  splitMode: "shares" | "equal" | "custom",
  split: { [residentId]: number }
}
```

## Security model

The public dashboard has no authentication requirement and can only read public collections. The administrator signs in with Google, but client-side email checks are not the security boundary. Firestore rules check the verified Firebase Authentication token email and allow writes only to `yugrajsekhon20@gmail.com`.

`recurringExpenses` and `activityLogs` are admin-only reads because they are operational data and do not need to be public.

For a stronger production deployment, move sensitive administrative reports or resident contact data into admin-only collections and expose only aggregated/public fields to the dashboard.

## Exact split algorithm

`exactSplit()` works entirely in integer paise. It computes each proportional share, floors the result, then assigns the full remainder to the final participant. Therefore:

`sum(split) === expense.amountCents`

for equal, weighted-share and custom-weight splits.

The payer's own share is stored in the same split map as everyone else's. The payer does not get an automatic exemption unless the administrator explicitly chooses a split rule that produces one.

## Recurring expense duplicate protection

Monthly generation checks both:

- `recurringExpense.lastGeneratedMonth`
- an existing `expense` with the same `recurringId` and target month

This protects against repeated button presses and stale last-generated metadata.

## Backup

- JSON backup preserves the full application structure.
- TXT export maintains a simple line-oriented legacy format.
- Restore validates the ParkLedger wrapper and required arrays and asks for confirmation before replacing matching document IDs.

## Notes

The public dashboard is deliberately view-only. No public UI writes to Firestore. Admin-only actions are routed through the protected console and Firestore rules.

The source includes the original Firebase project configuration as environment variables only, rather than embedding it in application logic.

## GitHub Pages deployment

This repository includes `.github/workflows/deploy.yml`.

### 1. Push the project

Create a GitHub repository and push the project to the `main` branch.

### 2. Add GitHub Actions secrets

Repository → Settings → Secrets and variables → Actions → New repository secret.

Add:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MEASUREMENT_ID`
- `VITE_ADMIN_EMAIL`

The Firebase web configuration is intended for client-side use. Never add a Firebase service-account private key.

### 3. Enable GitHub Pages

Repository → Settings → Pages → Build and deployment → Source: **GitHub Actions**.

The workflow automatically builds and publishes `dist/` whenever `main` changes.

### 4. GitHub Pages URL

For a project repository, the normal URL is:

`https://YOUR_USERNAME.github.io/YOUR_REPOSITORY/`

If the repository is a user/organization Pages repository or you use a custom domain, set `VITE_BASE_PATH` appropriately.

### 5. Firebase authorized domains

Firebase Console → Authentication → Settings → Authorized domains.

Add the GitHub Pages hostname used by the deployed app, for example:

`YOUR_USERNAME.github.io`

Google Authentication will otherwise reject the deployed origin.

### 6. Firestore rules

Deploy `firestore.rules` to the Firebase project. Do not weaken the administrator write rule merely to make the frontend work.

### 7. Important GitHub Pages note

The application uses client-side React routing. `public/404.html` is included as a fallback for direct route loads. If your repository is hosted below a path, keep `VITE_BASE_PATH` aligned with that repository path.
