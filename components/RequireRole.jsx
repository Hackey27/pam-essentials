"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { staffLoginUrl } from "@/lib/staffAccess.mjs";
import { signOut, useAuth } from "./AuthProvider";
import StaffSessionGate from "./StaffSessionGate";

// Guards a page in the browser. The real enforcement is in Firestore rules:
// a cashier who reaches /admin still cannot read or write owner-only data.
export default function RequireRole({ allow, children }) {
  const { user, role, loading, roleError, retryRole } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const loginUrl = staffLoginUrl(pathname);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState("");

  async function retrySignIn() {
    if (retrying) return;
    setRetrying(true);
    setRetryError("");
    try {
      await signOut();
      window.location.replace(loginUrl);
    } catch {
      setRetryError("Could not sign out. Please try again.");
      setRetrying(false);
    }
  }

  useEffect(() => {
    if (!loading && !user) router.replace(loginUrl);
  }, [loading, user, router, loginUrl]);

  if (loading) return <main><p>Loading…</p></main>;
  if (!user) return null;

  if (roleError) return <main className="access-denied"><h1>Staff access unavailable</h1><p role="alert">{roleError}</p><div className="access-recovery-actions"><button type="button" className="button primary" onClick={retryRole}>Retry access check</button><button type="button" className="button secondary" onClick={retrySignIn} disabled={retrying}>Retry sign in</button></div>{retryError && <p role="alert">{retryError}</p>}</main>;

  if (!allow.includes(role)) {
    return (
      <main className="access-denied">
        <h1>No access</h1>
        <p>
          {role
            ? "This account doesn't have permission for this page."
            : "This account has no role yet. Ask the owner to set one up."}
        </p>
        <p>Signed in as {user.email}</p>
        <button type="button" className="button secondary" onClick={retryRole}>Recheck access</button>
        {retryError && <p className="notice error-notice" role="alert">{retryError}</p>}
        <div className="access-recovery-actions"><button type="button" className="button primary" onClick={retrySignIn} disabled={retrying}>{retrying ? "Opening sign in…" : "Retry sign in"}</button><a className="button secondary" href={role === "cashier" ? "/pos" : "/"}>Go back</a></div>
      </main>
    );
  }
  return <StaffSessionGate key={user.uid} user={user} accessLabel={pathname === "/admin" ? "Admin access" : "Staff access"}>{children}</StaffSessionGate>;
}
