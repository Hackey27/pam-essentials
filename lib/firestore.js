// Server-side Firestore access via the Admin SDK.
// On Cloud Run this authenticates automatically as the service's runtime
// service account, so no key files are needed. Admin SDK access is governed
// by IAM, not by Firestore security rules.
import { initializeApp, getApps, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

export function db() {
  if (!getApps().length) {
    initializeApp({ credential: applicationDefault() });
  }
  return getFirestore();
}
