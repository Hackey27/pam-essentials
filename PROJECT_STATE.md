# PAM Essentials project state

Updated: 2026-09-27
Repository: https://github.com/Hackey27/pam-essentials
Primary branch: `main`
Current status: storefront, customer flows and presentation are live; corrected Firestore rules are deployed and verified. Owner-supplied media and contact details remain pending.

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

- Catalogue metadata import, browsing, product detail, Quick View, variant-aware cart, customer orders and presentation are live. The production Firestore rules now restrict direct product and sale reads to active Owner/Admin profiles.
- The user will supply accurate product photos, hero flyer and footer details later. Continue using labelled placeholders until then. Existing Admin category order and initialized child order remain authoritative.

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
- Customer account creation and tracking are implemented in the current chunk with a separate `/account` path; live account creation has not been exercised with a production test identity.
- The zero-stock visibility conflict is resolved: all 29 current zero-stock rows are unpriced and stay hidden until priced. Show future priced zero-stock items with an Out of Stock tag and disabled purchase controls.
- The repository and supplied workbook contain no hero flyer or product/variant image assets. The user will provide them later; continue with clearly marked placeholders.
- The workbook has no sort-number columns. Existing Admin category order is authoritative; child initial order follows workbook appearance within each parent. Admin can change all three levels later.
- The Admin Import catalogue endpoint already ran successfully and safely refreshed 264 product details and the child hierarchy. Live stock, prices, cost and audits remain intact.
- Corrected Firestore rules were deployed on 2026-09-27 and the anonymous product read was denied. The live role matrix beyond anonymous was tested in the emulator, not with production staff identities.
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

1. At the next chunk start, reread this file and `main`; continue with presentation and release, using placeholders until the owner supplies the flyer and product imagery.

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

## Product and cart checkpoint (2026-09-27)

- Commit `9c9ea65157ec0761f468762a488b8ee32c01400f` added a full product page at `/products/[id]`, Quick View from the listing, and a reusable variant selector. Each SKU remains a separate listing, while the selector groups the eight current variant families by `productGroupId`. Size and colour choices update the selected SKU, price, stock state, WhatsApp draft and image source. Unavailable priced choices are disabled. Accurate variant photos are still absent; the UI uses labelled placeholders until images are supplied in Admin.
- The customer cart now persists across product-page navigation in browser storage and refreshes each line against the public catalogue before checkout. Add-to-cart opens a confirmation with Continue shopping and View cart. Cart lines show chosen SKU, colour and size. Server-created website orders and POS sales store product group, exact variant ID (currently the SKU), SKU, colour and size alongside the existing product ID and repriced totals. POS order/receipt text exposes the SKU. The WhatsApp cart message includes item detail, subtotal, discount, total and fulfilment fields.
- The live Cloud Run storefront served the new product controls after the push. Search for Heat resistant water bottle returned six separate SKU listings with the shared price range. Quick View changed from `BOT-HRB-595-003-BK` at GH₵28.47 to `BOT-HRB-795-004-GN` at GH₵31.46 when 795ml was selected, then to `BOT-HRB-795-004-WH` when Mousse White was selected. The add confirmation and cart displayed that exact white 795ml SKU. A full product page loaded its selector, details, delivery/pickup section and related products. No real order, WhatsApp message, payment or POS sale was submitted during testing.
- Local production builds passed before deployment and after the follow-up correction. The correction disables wishlist and comparison controls until their customer-facing flows exist; it also ranks related products from the same subcategory first. The existing `/login` is staff authentication and must not be used for customer accounts.
- Next chunk: customer orders. Add optional customer accounts, wishlist gate and account-based tracking; keep guest checkout; complete delivery/pickup details on orders and receipts; add Admin-rule discount eligibility messages; verify order security and totals. Then pause at its own checkpoint. Presentation and release follows, with flyer asset still outstanding.

## Customer orders checkpoint (2026-09-27)

- Commit `8e4fa4c8d07a20df00443abbf2f2550a2521a49b` added a separate `/account` customer sign-in and registration page. Customer accounts can save a wishlist and view only orders attached to their Firebase UID; earlier guest orders can be claimed with their order reference and checkout phone. Guest checkout remains available. Staff `/login` and its role checks remain separate. Product-page Add to wishlist directs customers to the account page.
- The old reference-plus-phone public order lookup was removed. `/api/orders` GET now requires a customer token and returns only that UID's orders. Customer wishlists live in server-managed `customer_accounts`, protected from direct client Firestore writes by the existing rules. Website orders still reprice and validate stock on the server. No production test customer or real order was created in this checkpoint, so registration, order claiming and a customer-authenticated response remain unverified end to end.
- The Admin-controlled seeded global 5% rule now checks total cart units across products in the storefront, website order endpoint and POS. Other scoped rule priority remains intact. A focused two-test suite passed for the three-unit threshold, Admin deactivation and product-rule precedence. A local production build passed.
- Checkout records the shop collection address `PAM Essentials & More, Awoshie, Accra, Ghana`; shop-arranged delivery requires a destination and self-arranged delivery displays the shop address to the customer. Order records, Admin order detail, POS sale snapshots and linked POS receipts carry fulfilment details. The WhatsApp cart draft includes the shop and destination details. No real receipt was printed.
- Live Cloud Run checks showed Sign In and Track Order linking to `/account`. The account page recognized the existing staff session and kept it out of customer features. In the cart, two units showed “Add 1 more to qualify for 5% off”; three units showed “5% quantity discount applied” and a GH₵4.72 discount on GH₵94.38 subtotal. Self-arranged delivery showed the shop address. The cart was returned to its original one unit after testing. Direct anonymous API requests were blocked by the available browser tool, so endpoint authorization is verified by code review rather than a live 401 response.
- A follow-up guard also rejects staff custom-claim roles from customer API routes. The owner will supply the hero flyer and accurate product photos later. Next chunk is presentation and release: complete the hero, PAM Deals activation and benefits, active footer links/pages, and responsive/live checks. Read this state and `main` before starting it.

## Presentation and release checkpoint (2026-09-27)

- This chunk began by rereading this state and confirming GitHub `main` at `09d799648a94cc101a63363059378cba1de0b1a1`. The source snapshot was unchanged at that head before editing.
- The hero now uses the requested copy and actions. An abstract placeholder stands in for the owner-supplied flyer. Admin can set `HERO_FLYER_URL` to an HTTPS image URL; the rendered layer has 55% transparency. Real product photos remain pending and editable in Admin.
- Admin Settings can activate/deactivate PAM Deals. The storefront shows the Deals navigation, collection filter and feature only while active. Its percentage line appears only for an active applicable product/category discount of at most 20%; otherwise it says “Selected everyday offers.” No live Deals setting or discount was changed in this chunk.
- Added the four requested Why shop with PAM benefits, a responsive footer and working information pages for contact, payment/delivery, returns, privacy, FAQs, About Us and Our Story. Track My Order opens the account page; WhatsApp links use the supplied phone number. No email address or social profile URLs were supplied, so social links lead to an explanatory page instead of invented profiles. Online payment is still unavailable.
- Files changed: `app/page.js`, `app/globals.css`, `app/admin/page.js`, `app/api/admin/settings/route.js`, `app/api/catalog/products/route.js`, `app/info/[slug]/page.js`, `README.md`, and this file. `npm run build` and the focused discount tests passed locally.
- Release status: presentation commit `958887d3ac01519c69d83a1096241a3b16c30891` was pushed to `main` and observed on the live Cloud Run storefront. The storefront loaded 235 priced products, the new hero/actions, four benefits and all footer groups; Deals discovery is hidden while its Admin switch is unset. The delivery information page loaded with the correct shop address and payment status. At 390px and 1440px widths, measured document width stayed within the viewport and the footer reflowed from six columns to two. The flyer layer computed at 45% opacity (55% transparency). No live Admin setting, payment or order was changed for this verification.
- Next recommended steps: pause at this checkpoint; when supplied, add the official flyer, accurate product photos, email address and social profile URLs in a later chunk. The owner can tag deal products, configure an applicable discount and activate PAM Deals from Admin Settings when ready.

## Customer order reliability checkpoint (2026-09-27)

- This chunk began by rereading this file and `AGENTS.md` and reconciling with GitHub `main` at `b66effb50fcb40633e60135a6b9924da479f8219`. The owner confirmed that footer details will be supplied later, so no email or social destination was invented.
- Reviewed customer authentication, guest checkout, account order claims, WhatsApp handoff and server pricing. The WhatsApp draft previously used browser-cart subtotal, discount and line prices while the server could have repriced the saved order. It now uses the server-returned saved item, variant, SKU and total snapshot.
- Order creation now limits item count and input length, validates phone format, uses a random suffix on order references and creates the order document without overwriting an existing ID. The account claim endpoint still accepts earlier order references. A page-level request guard prevents simultaneous checkout submissions from rapid repeated clicks.
- Files changed: `app/api/orders/route.js`, `app/api/customer/orders/claim/route.js`, `app/page.js`, `lib/whatsappOrder.mjs`, `tests/whatsappOrder.test.mjs`, `README.md`, and this file. The production build and all three focused tests passed locally.
- Release status: commit `b9064da0e24657bffe24698bf51c6aaf4a9368ae` was pushed to `main`. A changed storefront bundle was observed on Cloud Run. The live catalogue still showed 235 priced products, and the existing variant SKU remained in the cart through the guest checkout form with both pay-on-fulfilment and WhatsApp choices. No order was submitted, so the new server response and account claim are verified by build, focused test and code review rather than a production order. The browser blocked direct navigation to `/api/orders`, so an anonymous 401 was not observed live.
- Next: pause at this checkpoint. The official flyer, product photos, footer email/social details and payment provider remain pending owner input. If further work is requested before those arrive, test customer registration and order claiming in a disposable non-production environment, then review launch operations and payment integration choices.

## Isolated customer flow validation checkpoint (2026-09-27)

- This chunk began by rereading this state and `AGENTS.md` and confirming GitHub `main` at `bbe237bf99b7b742b61c53c439b7908a8d4017f1`. The user said footer details will arrive later; no footer values were changed.
- The Firebase CLI, Firestore emulator and Java runtime were initially unavailable. The official Firebase CLI was installed only in the temporary checkout, and the Authentication emulator was started under `demo-pam-essentials`. No Java runtime or Firestore emulator was installed. A disposable in-memory Firestore harness was added for the actual customer route handlers. The tests do not connect to the live Firebase project or write production records.
- `npm test` passed eight focused checks: global quantity discount behavior; WhatsApp formatting; guest checkout with exact SKU/variant, stock and server totals; account claim by reference and phone; denial to another customer; wishlist isolation and staff denial; mixed-variant prices and WhatsApp totals; legacy reference compatibility; and rejection of unpriced, out-of-stock and inactive-category products. `npm run build` passed.
- The official local Authentication emulator test passed: the Firebase client SDK created two disposable accounts, signed them in, and produced tokens verified by the Admin SDK. The actual account order GET and claim handlers accepted one account's token and denied the other account. Test accounts were deleted after the run. The Firestore data used by these route calls remained in memory.
- Files changed: `tests/fixtures/route-loader.mjs`, `tests/fixtures/register-loader.mjs`, `tests/fixtures/fakeAdmin.mjs`, `tests/fixtures/memoryFirestore.mjs`, `tests/customerFlows.test.mjs`, `tests/authEmulator.test.mjs`, `package.json`, `firebase.json`, `README.md`, and this file. No storefront, POS, Admin or order route behavior was changed by this test-only chunk.
- Open validation gap: the live deployed Firestore rules and hosted Firebase service were not exercised. A disposable Firebase project or local Firestore emulator with Java is needed for full service-level checks. No live customer account, order, payment, message or stock movement was created.
- Release status: the isolated route suite was pushed in commit `0ce54db8f59c88fa7240666e0141eb162b1b1fdf`; the Auth emulator follow-up was pushed in `feb0f6cc24c3e56b5351a3a989e75465dcd3249f`. The Auth emulator check passed, all eight other tests passed again, and the production build passed. The Auth emulator was stopped after testing. Only test tooling, documentation and emulator configuration were published; production application behavior is unchanged. Pause at this checkpoint. Next recommended chunk: verify Firestore rules in an isolated emulator/project, then review launch operations. The flyer, product photos, footer email/social details and payment provider remain pending owner input.

## Firestore rules validation checkpoint (2026-09-27)

- This chunk began by rereading this state and `AGENTS.md` and confirming GitHub `main` at `ccba687078e9af04cc918ed5395afa5a2d9a9d0c`. The owner authorized moving to the following chunk after this checkpoint. The official Firebase CLI was already in the temporary checkout; a checksum-verified portable Temurin Java 21 runtime and Firestore emulator were added there without changing system Java.
- The Firestore and Auth emulators ran under `demo-pam-essentials`, isolated from the live project. The first rules test reproduced two serious direct-client exposures in the versioned rules: an anonymous client could read a priced product document containing `costPrice`, and a cashier could read a sale document containing `cost` and `profit`.
- `firestore.rules` now limits direct product and sale document reads to active Owner/Admin profiles. Storefront and POS routes already use Admin SDK server APIs with field-limited projections, so their intended access path remains. Emulator checks now pass for anonymous, customer, cashier, supervisor and owner reads; active-category access; customer profile boundaries; and denied direct writes.
- Files changed: `firestore.rules`, `firebase.json`, `tests/firestoreRules.test.mjs`, `package.json`, `README.md`, and this file. Local Java and emulator archives are temporary and are not part of the repository.
- Production rules deployment is a critical open step: Firebase CLI reports no authorized account in this environment, and pushing `firestore.rules` to GitHub does not activate it in Firebase. Until the corrected rules are deployed, the existing direct-read exposure may remain live. No production records or rules were changed in this chunk.
- Release status: commit `3b1580673484e9afad632a9ac4a85c8c30c80617` was pushed to `main`. `npm test` (eight checks), `npm run test:auth-emulator`, `npm run test:firestore-emulator` and `npm run build` all passed. The emulators were stopped after testing. Cloud Run builds do not publish Firestore rules; the live-rule deployment remains open. At the checkpoint, reread this file and `main` before the next chunk. Secure Firebase CLI access and deploy/verify the corrected rules, then continue launch operations review. Flyer, product photos, footer email/social details and payment provider still await owner input.

## Production rules deployment checkpoint (2026-09-27)

- Began by rereading this file and confirming GitHub `main` at `b5209a7c700cb7eb930988cc3cf09a85703b0e81`. Prepared and completed the Firebase CLI login using the owner's Google account, then confirmed `pam-essentials-2d7fb` appears in the accessible Firebase projects. No credential or authorization code is stored in this file or the repository commit.
- Before deployment, a read-only anonymous Firestore REST request for the known product `BOT-HRB-795-004-WH` returned HTTP 200 with `costPrice` and `wholesalePackPrice` fields present. Values were not printed. This confirmed that the direct-read exposure was live.
- Deployed the tested `firestore.rules` from the main snapshot with `firebase deploy --only firestore:rules --project pam-essentials-2d7fb --non-interactive`. Firebase reported successful compilation and release to Cloud Firestore. Repeating the same anonymous product read returned HTTP 403 `PERMISSION_DENIED`.
- Immediately after release, the Cloud Run homepage and `/api/catalog/products` both returned HTTP 200; the catalogue API still contained the known product SKU. No product, order, payment or staff account was changed.
- Files changed in this chunk: only `PROJECT_STATE.md`. The production rules release is an independent Firebase operation. Live staff-role access was not tested with production identities; emulator coverage for those roles remains the validation evidence.
- Next: publish this checkpoint to `main`, then begin a launch operations review. The official flyer, product photos, footer email/social details and payment provider remain pending owner input.

## Launch operations review checkpoint (2026-09-27)

- Began by rereading this file and `AGENTS.md` and confirming GitHub `main` at `1954c59254490f5f077e96cf237a192a7fdbc60e`. The Firestore rules release and anonymous denial remain the current production state.
- Reviewed the Dockerfile, deployment notes, health route, public catalogue and protected API routes. A live read-only check found 235 public catalogue products with no cost/profit fields, HTTP 200 for health and catalogue, and HTTP 401 for anonymous POS, Admin, order-tracking and wishlist requests. No customer identity, order, POS sale or payment was created.
- Added `scripts/check_release.mjs` and `npm run check:release` as a repeatable read-only production smoke check. It also confirms that a direct anonymous Firestore read of a public product receives HTTP 403 `PERMISSION_DENIED`. The script passed against the live service. `npm test` passed all eight focused checks. Updated `README.md` with the command and corrected its outdated rules validation note.
- Files changed: `scripts/check_release.mjs`, `package.json`, `README.md`, `.gitignore`, and this file. Runtime storefront, POS and Admin logic were not changed. The release check uses the public Firebase Web API key already configured in `lib/firebase.js`; update both if that public config changes. `.gitignore` now excludes the local Firebase CLI credential profile and test-only emulator/runtime caches.
- Open launch items: a full hosted customer account/order exercise in a disposable project; owner-supplied hero flyer, product photos, footer email and social profile URLs; and selection/configuration of an online payment provider before Pay Now can be enabled. The `STORE_PUBLIC` flag remains unset until the owner chooses public launch.
- Release check and test runner change was pushed to `main` as `cea5e9260c5911b3d8d6b969f4e4593c9f0ab08e`; its Cloud Build was working at the time of this note. Next: push the ignore-rule follow-up, verify the resulting Cloud Run build/live routes, then pause at the validation checkpoint. A later chunk can exercise hosted customer flow in a disposable project without touching production orders.

