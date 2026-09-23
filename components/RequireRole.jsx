"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";

// Guards a page in the browser. The real enforcement is in Firestore rules:
// a cashier who reaches /admin still cannot read or write owner-only data.
export default function RequireRole({ allow, children }) {
  const { user, role, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading) return <main><p>Loading…</p></main>;
  if (!user) return null;

  if (!allow.includes(role)) {
    return (
      <main>
        <h1>No access</h1>
        <p>
          {role
            ? "This account doesn't have permission for this page."
            : "This account has no role yet. Ask the owner to set one up."}
        </p>
        <p><a href={role === "cashier" ? "/pos" : "/"}>Go back</a></p>
      </main>
    );
  }
  return children;
}
