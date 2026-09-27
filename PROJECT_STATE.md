# PAM Essentials project state

Updated: 2026-09-27
Repository: https://github.com/Hackey27/pam-essentials
Primary branch: `main`
Current status: discovery checkpoint for the expanded catalogue and storefront request; no application or catalogue data has been changed yet.

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

- Discovery chunk complete. The next chunk will update the repository catalogue source and build an idempotent metadata sync for existing Firestore products, then validate the generated data and Admin/POS/public projections.
- Awaiting the hero flyer asset and category/subcategory sort numbers. The user confirmed that unpriced zero-stock products remain hidden until priced.

## Key constraints and requirements

- Apply approved changes to this repository and commit them to `main`, as the user instructed. Recheck the branch head before every write.
- Every push to `main` triggers Cloud Build and a Cloud Run revision according to `README.md`; verify the build and live site after a push.
- `Data.xlsx` is the catalogue source. Include every product in Admin. Products without a positive selling price must stay out of the storefront and POS.
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
- The workbook has no category or subcategory sort-number columns. Existing Admin category `sortOrder` exists; await the user's sorting preference for subcategories.
- The existing seed endpoints skip existing Firestore documents. A controlled metadata sync and an authenticated execution path are required for the changes to appear live; do not overwrite live stock, prices, or audits.
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
2. Use the confirmed unpriced-item rule; resolve the flyer asset and sort order from the pending user answers when available.
3. Complete catalogue-data chunk steps without overwriting live operational quantities or prices.
4. Update this file and pause at its validation checkpoint.
