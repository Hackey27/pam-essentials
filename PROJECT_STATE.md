# PAM Essentials project state

Updated: 2026-09-27
Repository: https://github.com/Hackey27/pam-essentials
Primary branch: `main`
Current status: catalogue browsing hierarchy and filters deployed and verified; product detail and cart chunk is next.

## Working protocol

1. Read this file at the start of every new work session and before each major task step. Compare it with the current repository state; correct stale facts before acting.
2. Break each requested change into chunks of about five to seven concrete steps. Work on one chunk at a time.
3. At the start of every chunk, reread this file, confirm the active requirements and decisions, and state the steps for that chunk.
4. At the end of every chunk, update this file, then pause and give a short validation checkpoint: completed work, changed files, checks, problems, and next step.
5. If a new request conflicts with a recorded constraint or decision, explain the conflict before changing direction.
6. Keep this file factual and concise. Distinguish verified repository facts from claims carried forward from the earlier chat.

## Completed work

- The existing Next.js application contains a customer storefront, staff POS, and protected Admin Portal backed by Firestore and Firebase Authentication. This is documented in `README.md`; individual features have not been retested in this setup chunk.
- The earlier shared chat reports that three implementation milestones were pushed to `main`, ending at commit `7711e4b`. That commit was verified as the branch head before this orchestration setup.
- The earlier chat reports 264 products in Firestore/Admin, 29 unpriced products hidden from storefront and POS, and 14 categories. Those counts remain historical. The public storefront count of 235 priced products was rechecked live on 2026-09-26.
- GitHub access for this task was verified as `Hackey27` with push permission to this repository.
- This setup chunk added `PROJECT_STATE.md` and `AGENTS.md` to preserve the working process.
- Homepage chunk 1 implemented the requested top Sign In link, main navigation, prominent search, Cart, and popular searches. The New Arrivals, Promotions, and Deals controls filter or sort the catalogue. The local `npm run build` passed on 2026-09-26.
- Homepage chunk 2 verified Cloud Build `05b87c4c` for commit `c7ba610` and Cloud Build `09a7cbe4` for correction commit `ba64b47`; both succeeded. The Cloud Run service was healthy.
- Chunk 2 placed the logo and main navigation on one desktop row, wrapped all six navigation links on mobile, and matched singular/plural popular search terms to catalogue products. The local production build passed.
- Live storefront checks at 1440px and 390px confirmed the header layout. The public catalogue showed 235 priced products. Popular searches returned: water bottles 11, lunch boxes 2, pens 44, pencils 19, school supplies 81. New Arrivals, Promotions, and Deals opened their catalogue views.
- Expanded-catalogue discovery on 2026-09-27 read the user-supplied `Data.xlsx` as data. It has 264 SKUs and 18 columns, including subcategory, optional sub-subcategory, product group, size, colour, and keywords. Compared with the repository workbook, it has the same SKUs, quantities, and prices, plus 13 renamed products and 6 recategorised products. There are 25 rows in 8 `PRODUCT_ID` groups. The 29 zero-stock rows are exactly the 29 zero-price rows; no priced row has zero stock in the supplied sheet.

## Current work in progress

- Catalogue metadata import and the catalogue browsing chunk are live. The next chunk covers product pages, Quick View, variant selection and exact cart lines.
- Awaiting the hero flyer asset. The user resolved sorting: preserve the current Admin category order and initialize child order from workbook appearance within each parent.

## Key constraints and requirements

- Apply approved changes to this repository and commit them to `main`, as the user instructed. Recheck the branch head before every write.
- Every push to `main` triggers Cloud Build and a Cloud Run revision according to `README.md`; verify the build and live site after a push.
- The user-supplied `Data.xlsx` is the source for descriptive catalogue metadata. Keep its sensitive pricing, cost and stock columns out of new public commits. Include every product in Admin. Products without a positive selling price must stay out of the storefront and POS.
- Preserve server-side pricing, stock validation, role checks, audit trails, and cost/profit access controls when changing commerce flows.
- Target Google Cloud/Firebase project `pam-essentials-2d7fb`, Cloud Run service `pam-essentials`, region `europe-west1`. Confirm the target explicitly before cloud operations.
- Firestore rules are deployed separately from the Cloud Run image.

## Decisions already made

- The repository's `main` branch is the delivery branch. The user authorized direct commits to `main`.
- The top-bar Sign In link currently uses the existing `/login` staff route. The new request calls for optional customer accounts and account-based order tracking; design these as a separate customer path while preserving staff role checks and guest checkout.
- Use the existing Next.js/Firebase/Firestore/Cloud Run architecture unless a requested change justifies revisiting it.
- Keep unpriced products manageable in Admin while excluding them from customer and cashier sales surfaces. The user reconfirmed on 2026-09-27 that the 29 unpriced zero-stock rows stay hidden until priced; priced products that later reach zero stock should remain visible with an Out of Stock tag and no purchase action.
- Do not enable online `Pay Now` without a selected and configured payment provider.

## Files changed or created

- `PROJECT_STATE.md` — running project state and checkpoint protocol.
- `AGENTS.md` — durable instruction to read and maintain this file.
- `app/page.js` — homepage header, navigation, search, popular terms, and catalogue browsing modes.
- `app/globals.css` — header, navigation, search, and responsive layout styles.
- `lib/productData.js` — expose product creation time to support New Arrivals.
- This discovery chunk will change only `PROJECT_STATE.md`; the supplied workbook has not yet been copied into the repository.

## Open issues, risks, and questions

- A temporary repository snapshot was downloaded for local validation. Local builds and live browser/deployment checks passed for this homepage change.
- Customer account creation and tracking are now requested; the customer path must remain separate from staff role checks.
- The zero-stock visibility conflict is resolved: all 29 current zero-stock rows are unpriced and stay hidden until priced. Show future priced zero-stock items with an Out of Stock tag and disabled purchase controls.
- The repository and supplied workbook contain no hero flyer or product/variant image assets. Request the flyer and accurate product imagery, or use clearly marked placeholders if the user approves.
- The workbook has no sort-number columns. Existing Admin category order is authoritative; child initial order follows workbook appearance within each parent. Admin can change all three levels later.
- The Admin Import catalogue endpoint now safely syncs descriptive metadata for existing products. An authenticated execution is still required for changes to appear live; live stock, prices, cost and audits must remain intact.
- The earlier chat reported that publishing versioned Firestore rules required an authenticated Firebase account. Current deployed rules have not been verified here.
- The payment provider for online `Pay Now` has not been selected.
- Public storefront count was 235 priced products on 2026-09-26; role behavior should be rechecked when relevant to a requested change.

## Work chunks for the expanded request

1. Discovery (six steps): read state and branch; inspect workbook; compare old source; audit variant/category data; trace app imports and orders; record conflicts and roadmap.
2. Catalogue data (six steps): verify workbook structure; replace the repository source; extend generation for hierarchy, variants and tags; add safe metadata sync for existing records; expose fields to Admin/POS/storefront; validate and deploy.
3. Catalogue browsing (six steps): build ordered category tree; add checkbox filters and breadcrumbs; add availability/offers/collection filters; label new/low/out-of-stock items; add click and purchase signals without changing current curated searches; validate desktop/mobile.
4. Product and cart (six steps): add product route; implement quick view; link size/colour variants by `PRODUCT_ID`; maintain exact SKU, price and stock through cart/order/POS; add related products and share controls; validate variant combinations and stock boundaries.
5. Customer orders (six steps): add optional customer accounts and wishlist gate; protect account-based tracking while preserving guest checkout; format WhatsApp cart orders; implement delivery/pickup address and receipt details; show discount eligibility messaging from Admin rules; validate order security and totals.
6. Presentation and release (six steps): place the supplied flyer at the requested transparency; complete hero buttons, PAM Deals and benefits; build footer pages and active links; validate content and contact details; build and deploy; inspect Cloud Run and update this file.

## Next recommended steps

1. Reread this file and the current `main` head at the next chunk.
2. Use the confirmed unpriced-item rule and Admin-owned hierarchy sorting. Obtain the flyer asset when available.
3. Continue with the catalogue browsing chunk using the imported hierarchy; keep Admin-owned sort and active settings authoritative.
4. Pause at the catalogue hierarchy validation checkpoint before the browsing chunk.

## Catalogue hierarchy checkpoint (2026-09-27)

- The supplied workbook was read locally without changing its columns or records. Its SHA-256 is `8DE099EE2C5E2C442359AD4E260AC07D48EB8F4298AA04D0AE268B44C5870E68`. Automatic approval review rejected publishing this workbook or the generated full catalogue to the public GitHub repository because they expose internal cost, wholesale pricing and stock. The public commit therefore leaves the existing workbook and full product seed intact, and adds `data/product_metadata.json` with only descriptive fields.
- Header-based generation produced 264 product metadata records, 13 category source labels, 51 subcategories and 13 sub-subcategories. Child initial sort orders follow first appearance in the workbook within each parent. The workbook needs no sort-number columns.
- Admin forms now manage sort order and active/archived state at category, subcategory and sub-subcategory levels. New Firestore collections `subcategories` and `sub_subcategories` add to the existing data structure. Existing category records, their sort orders and their active states are preserved.
- The Admin Import catalogue action is idempotent: it updates product names, category assignment and descriptive hierarchy/variant/search metadata, but does not overwrite live stock, selling price, cost, product active state, images or pinned status. It creates only missing hierarchy records and preserves any child Admin edits on later imports.
- Public and POS APIs return the same ordered active hierarchy and hide products under deactivated child nodes. The storefront and POS category controls use API category order. Admin product labels follow current hierarchy names.
- Files changed in the public-safe commit: `data/product_metadata.json`, `data/category_hierarchy.json`, `scripts/generate_seed_data.py`, `lib/categoryHierarchy.js`, `lib/commerce.js`, `lib/productData.js`, `app/api/admin/catalog/route.js`, `app/api/admin/categories/route.js`, `app/api/admin/hierarchy/route.js`, `app/api/admin/seed/route.js`, `app/api/catalog/products/route.js`, `app/api/pos/products/route.js`, `app/api/orders/route.js`, `app/api/pos/sales/route.js`, `app/admin/page.js`, `app/page.js`, `app/pos/page.js`, and this file.
- Local `npm run build` passed. The initial validation attempt used a dependency junction that Turbopack rejected; a normal offline install resolved that local-only issue.
- Outstanding release work: execute the authenticated Admin import and verify live child hierarchy and order. No live Firestore change is yet confirmed. If the workbook itself must be stored in GitHub, the owner must choose a private destination and approve that separate publication. The hero flyer and product images remain unavailable.

## Deployment verification and sidebar correction

- Public-safe hierarchy commit `dd740d1d6a039b0a577b5471a5349934b8ff74e7` was pushed to `main`. Cloud Build `b59a7721-0c19-4ea5-8f7a-6e0284b8ad42` succeeded, and Cloud Run revision `pam-essentials-00025-thh` serves 100% of traffic.
- The live storefront still shows 235 priced products, but its category sidebar showed only “All categories” before the Firestore import. This follow-up normalizes Firestore document IDs in the hierarchy API and falls back to categories derived from visible products when category records cannot be matched. Apply the same correction in POS.
- The PAM Admin tab is still at the staff login form. The user has been asked to sign in; no Admin import has run and no live hierarchy records have been created yet.
- After the sidebar correction deploys, verify category buttons, then use the signed-in Admin Import catalogue action and validate sorted hierarchy counts and active settings before starting the next chunk.

## Final validation checkpoint for this work session

- Commits `2922f7daba14ab9c93f0fa74ada0e9f78b6bec42` and `37253ed428f3ed2e7bd516fb9f7d0d3080b8ce3f` corrected category display and normalized hierarchy IDs to Firestore document IDs. Both local production builds passed.
- Cloud Builds `5b462a70` and `ed3834cb` succeeded. Cloud Run revision `pam-essentials-00027-kgk` has 100% traffic. A fresh live storefront load shows 235 priced products and individual category controls, including Writing Materials & Accessories and Bottles & Accessories.
- The Admin Portal in the available Chrome session still redirects to the staff login form. The one-time Import catalogue action has not been run. Until it runs, the 51 subcategories, 13 sub-subcategories, 13 product renames and 6 recategorizations from the supplied workbook are not confirmed in Firestore or the live storefront/POS.
- At the next chunk start, reread this file and check the current main head. After staff sign-in, run Import catalogue once, verify the Admin counts/order and public/POS projections, then pause at the next validation checkpoint before the browsing chunk.

## Admin import access checkpoint (2026-09-27)

- The user reported signing in. The Chrome PAM tab available to this task was refreshed, and direct navigation to `/admin` redirected to `/login`; its staff email and password fields remained empty. The accessible Chrome profile therefore has no usable PAM Admin session. No import was run and no Firestore data was changed.
- The Admin seed route and UI were reread. The action requires Owner or Admin, preserves existing operational product fields and hierarchy settings, and returns created/updated counts. Its code is deployed on `main`.
- GitHub `main` was confirmed at `069b5a50b521fb4ea4aa7dad3c65a4facea4bd24` before this checkpoint. Cloud Build for that commit succeeded, and Cloud Run revision `pam-essentials-00028-plj` served 100% of traffic.
- Next: sign in on the open PAM tab in the Chrome profile available to this task, then click Admin Products > Import catalogue. Verify 264 product records, 51 subcategories and 13 sub-subcategories, current category sort order, 235 priced storefront products, and POS visibility before continuing.

## Authenticated catalogue import checkpoint (2026-09-27)

- The user signed in through the Codex in-app PAM browser. The Owner Admin dashboard appeared. GitHub `main` was `31524f78bd85dff308e5c9afa1bff88a3e5181df` before import; the target site was the PAM Cloud Run service backed by Firebase project `pam-essentials-2d7fb`.
- Admin Products > Import catalogue completed once: 0 products added, 264 product details refreshed, 0 categories added, 51 subcategories added, and 13 sub-subcategories added. The UI confirmed existing Admin sort orders and active settings were kept. The import preserves operational price, stock, cost, images, active/pinned flags and audits by code.
- Admin Categories showed 14 top-level categories, 51 subcategories and 13 sub-subcategories (78 rows). Writing Materials & Accessories retained sort order 3; its Pencil Cases and Notepads children have sort orders 1 and 2, and Pens > Gel and Ball Point have sort orders 1 and 2 within Pens. Child edit forms exposed sort order within parent, Active and Archived; no manual hierarchy settings were changed in this verification.
- Storefront reloaded with 235 priced products. POS also exposed exactly 235 product buttons. Both displayed the same ordered nonempty active category list; Drawing Materials had no visible products after recategorisation and was absent from those product filters. The Owner POS session loaded renamed product names and preserved prices/stock.
- Admin overview showed 264 product records and 29 needing pricing; those unpriced records remain excluded from storefront and POS. No sale, payment or stock movement was made during verification.
- Files changed in this checkpoint: only `PROJECT_STATE.md`. Next: pause at this validation checkpoint, then implement the requested category checkbox filters, breadcrumbs and availability/offer controls in the next chunk. Continue reading this file before each chunk.

## Catalogue browsing checkpoint (2026-09-27)

- Commits `03bff26a22f14ad6d07a1bd1c56cbb0c7750d7b1` and `572c002bbdbf4a2a6a2173a10248f25732ef7897` added the browsable hierarchy and kept raw popularity totals out of the public product response. The first commit was observed live; the second was pushed after a passing local build and awaits separate Cloud Build confirmation.
- The storefront shows all 14 active top-level categories in Admin order, including the empty Drawing Materials category. Customers can expand/collapse a category; clicking its main row shows every product in that category. Subcategory checkboxes filter their products and can be combined. Clicking a sub-subcategory clears parent and sibling selections and shows only that leaf. Clicking the main category again clears child filters.
- Live checks: Writing Materials & Accessories showed 60 products, Pens showed 8, Pens > Gel showed 4, and returning to the main category restored 60. Selecting Pens and Pencils together showed 15 products, a parent breadcrumb and removable chips. The Back to School collection returned 76 products. Mobile layout dimensions were checked at 390px and desktop at 1440px. POS still loaded 235 priced products.
- Added availability, offer and collection controls; New, Low stock, Best seller and On sale badges; and a WhatsApp notification link for future priced zero-stock items. There are currently no priced zero-stock products, so the out-of-stock customer path has no live example. Existing 29 unpriced products remain hidden. Admin can mark New Arrivals and product collection membership without changing the workbook.
- Curated popular searches remain unchanged until `STORE_PUBLIC=true` is set at the public launch. Once enabled, add-to-cart clicks are counted once per page session and qualified products can appear beside the curated terms. Walk-in POS sales and paid website orders increment purchase counts. The public API returns the Best seller flag and ranked products, not raw engagement totals. This chunk did not enable the launch flag; its Cloud Run value has not been read directly.
- Files changed: `app/page.js`, `app/globals.css`, `app/admin/page.js`, `app/api/admin/products/route.js`, `app/api/admin/orders/route.js`, `app/api/catalog/products/route.js`, `app/api/catalog/engagement/route.js`, `app/api/pos/sales/route.js`, `lib/productData.js`, `lib/catalogueBrowse.mjs`, `README.md`, and this file. Local production build and focused browse helper checks passed.
- Next: pause at this checkpoint. The product/cart chunk must add product pages, Quick View, variant image/size/colour selection, exact SKU cart/order lines and related products. A separate later presentation chunk must add the Admin-wide PAM Deals activation control and complete the requested hero/footer work.

