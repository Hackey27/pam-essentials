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

  async function handleSignIn() {
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
    <main>
      <h1>Sign in</h1>
      <p>For staff. Customers don&apos;t need an account to browse the store.</p>
      <div className="form">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSignIn()}
        />
        {error && <p className="error">{error}</p>}
        <button onClick={handleSignIn} disabled={busy || !email || !password}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </div>
      <p><a href="/">Back to the store</a></p>
    </main>
  );
}
