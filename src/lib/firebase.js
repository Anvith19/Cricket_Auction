import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import {
  getDatabase,
  ref,
  onValue,
  goOffline,
} from "firebase/database";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
  databaseURL:
    import.meta.env.VITE_FIREBASE_DATABASE_URL ||
    import.meta.env.VITE_RTDB_FIREBASE_DATABASE_URL,
};

// --------------------------------------------------
// Firebase App
// --------------------------------------------------

const app = initializeApp(firebaseConfig);

// --------------------------------------------------
// Authentication
// --------------------------------------------------

export const auth = getAuth(app);

// --------------------------------------------------
// Firestore
// --------------------------------------------------

// Use getFirestore instead of initializeFirestore.
// This avoids Vite HMR errors when the module reloads.
export const db = getFirestore(app);

// --------------------------------------------------
// Realtime Database
// --------------------------------------------------

// IMPORTANT:
// RTDB now uses the SAME Firebase app as Authentication.
export const rtdb = getDatabase(
  app,
  import.meta.env.VITE_FIREBASE_DATABASE_URL ||
    import.meta.env.VITE_RTDB_FIREBASE_DATABASE_URL
);
console.log("🔥 FIREBASE CONFIG CHECK:", {
  projectId: firebaseConfig.projectId,
  databaseURL:
    import.meta.env.VITE_FIREBASE_DATABASE_URL ||
    import.meta.env.VITE_RTDB_FIREBASE_DATABASE_URL,
  authProject: auth.app.options.projectId,
  rtdbProject: rtdb.app.options.projectId
});

// --------------------------------------------------
// Firebase Analytics
// --------------------------------------------------

let analytics = null;

if (typeof window !== "undefined") {
  window.addEventListener(
    "load",
    () => {
      import("firebase/analytics")
        .then(({ getAnalytics }) => {
          analytics = getAnalytics(app);
        })
        .catch((error) => {
          console.warn(
            "Firebase Analytics initialization failed:",
            error
          );
        });
    },
    { once: true }
  );
}

export { analytics };

// --------------------------------------------------
// Server Time
// --------------------------------------------------

let _serverTimeOffset = 0;

try {
  const offsetRef = ref(rtdb, ".info/serverTimeOffset");

  onValue(offsetRef, (snap) => {
    _serverTimeOffset = snap.val() || 0;
  });

  // AuctionContext will call goOnline(rtdb)
  // when an auction becomes active.
  goOffline(rtdb);
} catch (error) {
  console.warn(
    "Realtime Database initialization warning:",
    error
  );
}

// --------------------------------------------------
// Server Time Helpers
// --------------------------------------------------

export const getServerTime = () => {
  return Date.now() + _serverTimeOffset;
};

export const getServerTimeOffset = () => {
  return _serverTimeOffset;
};

// --------------------------------------------------
// Default Export
// --------------------------------------------------

export default app;