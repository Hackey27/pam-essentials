import { adminAuth, adminDb } from "@/lib/admin";

export async function customerIdentity(request) {
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return { error: "Sign in to your customer account.", status: 401 };
  try {
    const user = await adminAuth().verifyIdToken(token);
    const profile = await adminDb().collection("users").doc(user.uid).get();
    if (user.role || profile.exists && (profile.data()?.role || profile.data()?.active === false)) return { error: "Use a customer account for this feature.", status: 403 };
    return { uid: user.uid, email: user.email || "" };
  } catch { return { error: "Your customer session has expired. Sign in again.", status: 401 }; }
}

export async function optionalCustomerIdentity(request) {
  return request.headers.get("authorization") ? customerIdentity(request) : { uid: null, email: "" };
}

