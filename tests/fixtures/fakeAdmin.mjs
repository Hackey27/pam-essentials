export function adminDb() {
  return globalThis.__pamTestStore;
}

export function adminAuth() {
  if (globalThis.__pamTestAuth) return globalThis.__pamTestAuth;
  return {
    async verifyIdToken(token) {
      const user = globalThis.__pamTestUsers?.get(token);
      if (!user) throw new Error("Invalid test token");
      return user;
    },
  };
}

export async function requireRole(request, allowedRoles) {
  const header = request.headers.get("authorization") || "";
  if (!header.startsWith("Bearer ")) return { error: "Sign in is required.", status: 401 };
  try {
    const user = await adminAuth().verifyIdToken(header.slice(7));
    const profile = await adminDb().collection("users").doc(user.uid).get();
    const data = profile.exists ? profile.data() : {};
    if (data.active === false || !allowedRoles.includes(data.role || user.role)) return { error: "This account does not have permission.", status: 403 };
    return { user: { uid: user.uid, role: data.role || user.role } };
  } catch {
    return { error: "Your session has expired. Sign in again.", status: 401 };
  }
}

