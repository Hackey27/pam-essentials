# pam-essentials

PAM Essentials e-commerce: storefront, admin dashboard and POS inventory sync.

## Stack
- Next.js (App Router), one app: storefront at `/`, admin at `/admin`, API routes under `/api`
- Firestore (Native mode, `(default)` database, europe-west1) via the Firebase Admin SDK (`lib/firestore.js`)
- Deployed to Cloud Run (europe-west1) from the `Dockerfile`

## Deployment
Every push to `main` triggers Cloud Build, which builds the Docker image and deploys a new Cloud Run revision.
Check the live site after the build finishes (about 3 to 5 minutes).

## Local development
```
npm install
npm run dev
```
