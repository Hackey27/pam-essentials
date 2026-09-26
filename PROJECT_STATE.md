# PAM Essentials project state

Updated: 2026-09-26
Repository: https://github.com/Hackey27/pam-essentials
Primary branch: `main`
Current status: orchestration setup complete; waiting for the next requested product change.

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
- The earlier chat reports 264 products in Firestore/Admin, 235 priced products in public views, 29 unpriced products hidden from storefront and POS, and 14 categories. Treat these counts as historical until rechecked.
- GitHub access for this task was verified as `Hackey27` with push permission to this repository.
- This setup chunk added `PROJECT_STATE.md` and `AGENTS.md` to preserve the working process.

## Current work in progress

- No product change is in progress. Await the next requested change and define its first five-to-seven-step chunk before editing application code.

## Key constraints and requirements

- Apply approved changes to this repository and commit them to `main`, as the user instructed. Recheck the branch head before every write.
- Every push to `main` triggers Cloud Build and a Cloud Run revision according to `README.md`; verify the build and live site after a push.
- `Data.xlsx` is the catalogue source. Include every product in Admin. Products without a positive selling price must stay out of the storefront and POS.
- Preserve server-side pricing, stock validation, role checks, audit trails, and cost/profit access controls when changing commerce flows.
- Target Google Cloud/Firebase project `pam-essentials-2d7fb`, Cloud Run service `pam-essentials`, region `europe-west1`. Confirm the target explicitly before cloud operations.
- Firestore rules are deployed separately from the Cloud Run image.

## Decisions already made

- The repository's `main` branch is the delivery branch. The user authorized direct commits to `main`.
- Use the existing Next.js/Firebase/Firestore/Cloud Run architecture unless a requested change justifies revisiting it.
- Keep unpriced products manageable in Admin while excluding them from customer and cashier sales surfaces.
- Do not enable online `Pay Now` without a selected and configured payment provider.

## Files changed or created in this setup chunk

- `PROJECT_STATE.md` — running project state and checkpoint protocol.
- `AGENTS.md` — durable instruction to read and maintain this file.

## Open issues, risks, and questions

- This Codex task currently has no local repository checkout or runnable local build. GitHub connector writes are available, but local validation needs a writable checkout and dependencies.
- The earlier chat reported that publishing versioned Firestore rules required an authenticated Firebase account. Current deployed rules have not been verified here.
- The payment provider for online `Pay Now` has not been selected.
- Product counts, role behavior, and Cloud Run deployment health should be rechecked when relevant to a requested change.

## Next recommended steps

1. Receive a specific change request and reread this file and the current `main` head.
2. Define the first chunk of about five to seven steps, limited to the requested outcome.
3. Inspect the relevant code and requirements, then make and validate that chunk's changes.
4. Update this file with completed work, decisions, files, risks, and the next step before the checkpoint.
5. Commit to `main` when the chunk is ready, then inspect Cloud Build and the live service.
