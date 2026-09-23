"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut as fbSignOut } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

const AuthContext = createContext({ user: null, role: null, loading: true });

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) {
        setRole(null);
        setLoading(false);
      }
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    // Live role lookup, so a role change takes effect without signing out.
    const unsub = onSnapshot(
      doc(db, "users", user.uid),
      (snap) => {
        setRole(snap.exists() ? snap.data().role : null);
        setLoading(false);
      },
      () => {
        setRole(null);
        setLoading(false);
      }
    );
    return unsub;
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, role, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
export const signOut = () => fbSignOut(auth);
