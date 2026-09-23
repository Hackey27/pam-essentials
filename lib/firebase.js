"use client";
// Firebase web client. These config values are public identifiers, not secrets:
// access is enforced by Firestore security rules, not by hiding them.
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBdbQ7jdq5C7umAbpxYq2QbjeVEJgXb_zc",
  authDomain: "pam-essentials-2d7fb.firebaseapp.com",
  projectId: "pam-essentials-2d7fb",
  storageBucket: "pam-essentials-2d7fb.firebasestorage.app",
  messagingSenderId: "266824544348",
  appId: "1:266824544348:web:f8faabf3b0d85a5e043699",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Offline support: the till keeps working without a connection and syncs later.
// Multi-tab manager avoids conflicts if the cashier opens more than one tab.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

export const auth = getAuth(app);
