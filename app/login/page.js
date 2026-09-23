"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/components/AuthProvider";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { user, role, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.replace(role === "cashier" ? "/pos" : "/admin");
  }, [loading, user, role, router]);

  async function handleSignIn(event) {
    event?.preventDefault();
    setBusy(true);
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      const code = err?.code || "";
      setError(
        code === "auth/invalid-credential" || code === "auth/wrong-password"
          ? "That email and password don't match an account."
          : code === "auth/network-request-failed"
          ? "No connection. Signing in needs internet; sales already on this device still work."
          : "Sign-in failed. Check the details and try again."
      );
      setBusy(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-brand-panel">
        <a href="/" className="login-brand">PAM <span>Essentials & More</span></a>
        <div><p className="eyebrow">One connected retail system</p><h1>Storefront, till and inventory in step.</h1><p>Secure access for every member of the shop team, with permissions matched to their role.</p></div>
        <p className="login-footnote">PAM Essentials & More · Ghana</p>
      </section>
      <section className="login-form-panel">
      <form className="login-card" onSubmit={handleSignIn}>
        <p className="eyebrow">Staff access</p>
        <h2>Welcome back</h2>
        <p>Sign in to open the till or Admin Portal. Customers can browse without an account.</p>
        <label htmlFor="email">Email<input
          id="email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        /></label>
        <label htmlFor="password">Password<input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        /></label>
        {error && <p className="notice error-notice">{error}</p>}
        <button className="button primary" disabled={busy || !email || !password}>
          {busy ? "Signing in…" : "Sign in securely"}
        </button>
        <a className="back-link" href="/">← Back to the storefront</a>
      </form>
      </section>
    </main>
  );
}
