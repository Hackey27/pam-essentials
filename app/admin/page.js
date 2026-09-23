"use client";
import RequireRole from "@/components/RequireRole";
import { useAuth, signOut } from "@/components/AuthProvider";

function AdminHome() {
  const { user } = useAuth();
  return (
    <main>
      <h1>Admin dashboard</h1>
      <p>Signed in as {user?.email}.</p>
      <p>Products, stock and reports will be managed here.</p>
      <p><a href="/pos">Open the till</a></p>
      <p><button onClick={signOut}>Sign out</button></p>
    </main>
  );
}

export default function AdminPage() {
  return (
    <RequireRole allow={["owner"]}>
      <AdminHome />
    </RequireRole>
  );
}
