# Migration notes

The provided public HTML was inspected as the starting point. It contained:
- Public view-only dashboard and admin entry.
- Search/category filtering.
- Split formula viewer.
- WhatsApp dues digest generation.
- CSV export.
- A simulated admin authentication flow that was replaced with real Firebase Google authentication.
- Static resident, expense, dues and spending examples.
- A separate admin HTML surface with expense, payment, resident, backup, recurring and exact-split concepts.

The provided admin HTML also exposed the intended protected administrator email and the remainder-safe split concept. The new project preserves those concepts while moving the security boundary to Firebase Authentication + Firestore Security Rules.

The supplied Firebase web configuration was moved into `.env.example`; no service-account credentials are included.
