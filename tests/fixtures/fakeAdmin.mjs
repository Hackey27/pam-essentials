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

