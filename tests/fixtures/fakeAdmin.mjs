export function adminDb() {
  return globalThis.__pamTestStore;
}

export function adminAuth() {
  return {
    async verifyIdToken(token) {
      const user = globalThis.__pamTestUsers?.get(token);
      if (!user) throw new Error("Invalid test token");
      return user;
    },
  };
}

