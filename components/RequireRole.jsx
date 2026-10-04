"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut, useAuth } from "./AuthProvider";

// Guards a page in the browser. The real enforcement is in Firestore rules:
// a cashier who reaches /admin still cannot read or write owner-only data.
export default function RequireRole({ allow, children }) {
  const { user, role, loading } = useAuth();
  const router = useRouter();
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState("");

  async function retrySignIn() {
    if (retrying) return;
    setRetrying(true);
    setRetryError("");
    try {
      await signOut();
      window.location.replace("/login");
    } catch {
      setRetryError("Could not sign out. Please try again.");
      setRetrying(false);
    }
  }

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading) return <main><p>Loading…</p></main>;
  if (!user) return null;

  if (!allow.includes(role)) {
    return (
      <main className="access-denied">
        <h1>No access</h1>
        <p>
          {role
            ? "This account doesn't have permission for this page."
            : "This account has no role yet. Ask the owner to set one up."}
        </p>
        {retryError && <p className="notice error-notice" role="alert">{retryError}</p>}
        <div className="access-recovery-actions"><button type="button" className="button primary" onClick={retrySignIn} disabled={retrying}>{retrying ? "Opening sign in…" : "Retry sign in"}</button><a className="button secondary" href={role === "cashier" ? "/pos" : "/"}>Go back</a></div>
      </main>
    );
  }
  return children;
}
