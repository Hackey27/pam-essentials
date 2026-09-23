# PAM Essentials

PAM Essentials is one connected retail system with a customer storefront, a staff POS and a protected Admin Portal. Firestore is the shared source of truth and Cloud Run hosts the Next.js application.

## Stack
- Next.js App Router: storefront at `/`, POS at `/pos`, Admin Portal at `/admin`
- Firestore (Native mode, `(default)` database, europe-west1) via the Firebase Admin SDK (`lib/admin.js`)
- Firebase Authentication for staff identity and role-aware access
- Deployed to Cloud Run (europe-west1) from the `Dockerfile`

## Product catalogue

`Data.xlsx` is the source for `data/products.json`. Regenerate the seed after an intentional spreadsheet update with:

```bash
python scripts/generate_seed_data.py
```

The Admin Portal imports the generated catalogue through the owner-only `/api/admin/seed` endpoint. The import is additive and does not overwrite existing products or settings. Every spreadsheet product is retained in Admin. Products without a positive selling price are marked non-sellable and are excluded from both the storefront and POS.

For an authenticated deployment/operator environment, the same additive import can be run with Application Default Credentials:

```bash
npm run seed:firestore
```

## Server-authoritative operations

- Public orders are repriced from Firestore before being created.
- POS checkout resolves product → category → global discounts, reprices products, validates available stock and decrements stock in one Firestore transaction.
- Client transaction IDs make POS writes idempotent.
- Cost and profit data are returned only by protected Admin APIs.
- Products, categories, stock movements, discounts, staff, settings and order status changes are written through protected, audited server routes.
- Supervisors receive stock and process orders without receiving cost or profit fields; cashier payloads contain neither.
- Seeded settings and discount rules are created only when absent.

The Admin Portal provides working sections for the catalogue, categories, inventory receiving and adjustment, order fulfilment, discount rules, staff roles, analytics, settings and the append-only audit trail. The POS includes both till and cross-channel order views.

Firestore rules are versioned in `firestore.rules` and configured by `firebase.json`. Deploy rule changes independently of the Cloud Run container:

```bash
firebase deploy --only firestore:rules --project pam-essentials-2d7fb
```

## Deployment
Every push to `main` triggers Cloud Build, which builds the Docker image and deploys a new Cloud Run revision.
Check the live site after the build finishes (about 3 to 5 minutes).

## Local development
```
npm install
npm run dev
```

The local environment needs Application Default Credentials to access Firestore-backed API routes. Client authentication uses the Firebase project `pam-essentials-2d7fb`.
