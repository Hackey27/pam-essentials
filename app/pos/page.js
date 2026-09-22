"use client";
import { useEffect, useState } from "react";
import RequireRole from "@/components/RequireRole";
import { useAuth, signOut } from "@/components/AuthProvider";

function Till() {
  const { user, role } = useAuth();
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return (
    <main>
      <h1>Till</h1>
      <p>Signed in as {user?.email} ({role}).</p>
      <p className="status">
        {online
          ? "Connected. Sales save straight away."
          : "Working offline. Cash sales are saved on this device and sync when the connection returns."}
      </p>
      <p>Product search, cart and cash checkout come next.</p>
      {role === "owner" && <p><a href="/admin">Back to admin</a></p>}
      <p><button onClick={signOut}>Sign out</button></p>
    </main>
  );
}

export default function PosPage() {
  return (
    <RequireRole allow={["owner", "cashier"]}>
      <Till />
    </RequireRole>
  );
}
