# PAM Essentials project state

Updated: 2026-09-26
Repository: https://github.com/Hackey27/pam-essentials
Primary branch: `main`
Current status: homepage navigation and search update complete and validated on the live Cloud Run storefront.

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

## Current work in progress

- No homepage change is in progress. Await the next requested product change.

## Key constraints and requirements

- Apply approved changes to this repository and commit them to `main`, as the user instructed. Recheck the branch head before every write.
- Every push to `main` triggers Cloud Build and a Cloud Run revision according to `README.md`; verify the build and live site after a push.
- `Data.xlsx` is the catalogue source. Include every product in Admin. Products without a positive selling price must stay out of the storefront and POS.
- Preserve server-side pricing, stock validation, role checks, audit trails, and cost/profit access controls when changing commerce flows.
- Target Google Cloud/Firebase project `pam-essentials-2d7fb`, Cloud Run service `pam-essentials`, region `europe-west1`. Confirm the target explicitly before cloud operations.
- Firestore rules are deployed separately from the Cloud Run image.

## Decisions already made

- The repository's `main` branch is the delivery branch. The user authorized direct commits to `main`.
- The top-bar Sign In link uses the existing `/login` route, which is staff access; customer browsing remains account-free. A customer account flow was not requested.
- Use the existing Next.js/Firebase/Firestore/Cloud Run architecture unless a requested change justifies revisiting it.
- Keep unpriced products manageable in Admin while excluding them from customer and cashier sales surfaces.
- Do not enable online `Pay Now` without a selected and configured payment provider.

## Files changed or created

- `PROJECT_STATE.md` — running project state and checkpoint protocol.
- `AGENTS.md` — durable instruction to read and maintain this file.
- `app/page.js` — homepage header, navigation, search, popular terms, and catalogue browsing modes.
- `app/globals.css` — header, navigation, search, and responsive layout styles.
- `lib/productData.js` — expose product creation time to support New Arrivals.

## Open issues, risks, and questions

- A temporary repository snapshot was downloaded for local validation. Local builds and live browser/deployment checks passed for this homepage change.
- `/login` currently identifies itself as staff access. If customer accounts are wanted, they need a separate requirement and implementation.
- The earlier chat reported that publishing versioned Firestore rules required an authenticated Firebase account. Current deployed rules have not been verified here.
- The payment provider for online `Pay Now` has not been selected.
- Public storefront count was 235 priced products on 2026-09-26; role behavior should be rechecked when relevant to a requested change.

## Next recommended steps

1. Receive the next requested change, then reread this file and confirm the current `main` head.
2. Define a five-to-seven-step chunk for that change.
3. Inspect, implement, build, and validate the chunk.
4. Commit to `main`, verify Cloud Build and the live service, and update this file before the checkpoint.
