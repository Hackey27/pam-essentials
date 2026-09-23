import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function adminApp() {
  if (!getApps().length) {
    initializeApp({
      credential: applicationDefault(),
      projectId: process.env.GOOGLE_CLOUD_PROJECT || "pam-essentials-2d7fb",
    });
  }
  return getApps()[0];
}

export function adminDb() {
  return getFirestore(adminApp());
}

export function adminAuth() {
  return getAuth(adminApp());
}

export async function requireRole(request, allowedRoles) {
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) {
    return { error: "Sign in is required.", status: 401 };
  }

  try {
    const decoded = await adminAuth().verifyIdToken(token);
    const profile = await adminDb().collection("users").doc(decoded.uid).get();
    const data = profile.exists ? profile.data() : {};
    const role = data.role || decoded.role || null;
    const active = data.active !== false;

    if (!active || !allowedRoles.includes(role)) {
      return { error: "This account does not have permission.", status: 403 };
    }

    return {
      user: {
        uid: decoded.uid,
        email: decoded.email || data.email || "",
        displayName: data.displayName || decoded.name || decoded.email || "Staff",
        role,
      },
    };
  } catch {
    return { error: "Your session has expired. Sign in again.", status: 401 };
  }
}

