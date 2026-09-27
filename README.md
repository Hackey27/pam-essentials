# PAM Essentials

PAM Essentials is one connected retail system with a customer storefront, a staff POS and a protected Admin Portal. Firestore is the shared source of truth and Cloud Run hosts the Next.js application.

## Stack
- Next.js App Router: storefront at `/`, POS at `/pos`, Admin Portal at `/admin`
- Firestore (Native mode, `(default)` database, europe-west1) via the Firebase Admin SDK (`lib/admin.js`)
- Firebase Authentication for staff identity and separate optional customer accounts
- Deployed to Cloud Run (europe-west1) from the `Dockerfile`

## Product catalogue

`Data.xlsx` in the public repository is the original seed. The newer private 18-column workbook supplies descriptive hierarchy, variant and keyword fields. Generate only public-safe metadata from that workbook with:

```bash
python scripts/generate_seed_data.py /path/to/private/Data.xlsx
```

This writes `data/product_metadata.json` and `data/category_hierarchy.json`. Keep the private workbook and any regenerated full product seed containing cost, wholesale pricing or stock out of public commits. The protected Admin **Import catalogue** action syncs descriptive product fields and creates missing hierarchy records. It preserves existing prices, costs, stock, images, product availability, and Admin sort and active settings. Products without a positive selling price remain in Admin and are excluded from the storefront and POS.

For an authenticated deployment/operator environment, the original base seed can still create missing products with Application Default Credentials; it does not sync the newer descriptive hierarchy:

```bash
npm run seed:firestore
```

## Storefront browsing

The storefront receives ordered active categories, subcategories and sub-subcategories from the catalogue API. Selecting a category shows all products beneath it; subcategory checkboxes can be combined, while selecting a sub-subcategory shows its exact products. Admin owns hierarchy order and active state. Products with a selling price remain visible when stock reaches zero, with an Out of Stock tag.

Admin can mark a product as a New Arrival or assign it to Back to School, Promotion or PAM Deals. Targeted active discount rules drive the On Sale filter; the standard global quantity discount does not label every product as on sale. Set the Cloud Run environment variable `STORE_PUBLIC=true` only at the public launch to enable anonymous product click counting and popularity-based ordering. Until then, the five curated popular searches remain unchanged. Paid orders and completed walk-in POS sales increment purchase counts; raw click and purchase totals are not returned in the public catalogue API.

## Customer orders

Customers can check out as guests or create an account at `/account`. Staff sign-in remains at `/login`. A customer account stores its wishlist and can view only orders attached to that account. Earlier guest orders can be linked with their reference and checkout phone number. The public order status endpoint requires customer authentication; the reference and phone number alone no longer reveal an order.

The global seeded 5% rule applies when the cart contains at least three units across products, subject to the active Admin rule. Storefront, order creation and POS use the same rule and keep server-side prices authoritative. Self-arranged delivery records the shop collection address; shop-arranged delivery requires a destination. Both fields appear in order details and linked POS receipts. Online payment remains unavailable until a provider is configured.

Website order creation returns the saved SKU, variant, price, subtotal, discount and total snapshot. The WhatsApp draft uses that server response so its message agrees with the recorded order even if catalogue prices or discount rules changed while the cart was open. Order references include a random suffix; the account claim flow accepts both these and earlier references. The storefront blocks concurrent checkout submissions from the same page.

## Storefront presentation

The hero uses an abstract placeholder until the owner supplies the official flyer. Set `HERO_FLYER_URL` to an HTTPS image URL in Admin Settings to display that image at 55% transparency. Product photos remain individually editable in Admin.

Admin Settings has a PAM Deals activation button. Tag products with the `PAM Deals` collection in Products, then activate the collection to show its navigation, filter and feature section. Add an active product or category percentage discount rule if the feature should advertise an actual discount; the storefront displays a percentage only when a selected product has an applicable rule of 20% or less. Deactivation hides the Deals discovery controls without changing product tags or discount rules.

The footer links to contact, delivery, returns, privacy, FAQ and about pages. Social profile URLs and an email address have not been supplied, so the footer does not invent them. Online payment remains unavailable until a provider is selected.

## Server-authoritative operations

- Public orders are repriced from Firestore before being created.
- POS checkout resolves product → category → global discounts, reprices products, validates available stock, decrements stock and records an inventory movement in one Firestore transaction.
- Client transaction IDs make POS writes idempotent.
- Cost and profit data are returned only by protected Admin APIs.
- Products, categories, stock movements, discounts, staff, settings and order status changes are written through protected, audited server routes.
- Supervisors receive stock and process orders without receiving cost or profit fields; cashier payloads contain neither.
- Seeded settings and discount rules are created only when absent.

The Admin Portal provides working sections for the catalogue, categories, inventory receiving and adjustment, searchable order fulfilment, discount rules, staff roles, custom-period sales/profit reporting, product/category/channel analytics, expense recording, settings and the append-only audit trail. The POS includes both till and cross-channel order views, direct order-to-till loading, cash/mobile-money/card tendering, printable receipts, open/close shifts, offline cash-sale replay and server-side stock/discount validation. The storefront includes filtering, pagination, tracked orders, pickup/delivery ordering and a WhatsApp ordering hand-off.

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

