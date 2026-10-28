import { initializeApp, getApps, getApp } from "firebase/app";
import { getMessaging, isSupported } from "firebase/messaging";

/**
 * Firebase Client Configuration loaded strictly from environment variables.
 * Compatible with Next.js (browser & server-safe).
 */
export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "",
};

export const fcmVapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || "";

/**
 * Checks if the required Firebase configuration keys are present.
 */
export function isFirebaseConfigured(): boolean {
  return Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.messagingSenderId &&
    firebaseConfig.appId
  );
}

/**
 * Initializes and returns the Firebase app instance safely.
 */
export function getFirebaseApp() {
  if (getApps().length > 0) {
    return getApp();
  }
  return initializeApp(firebaseConfig);
}

/**
 * Returns the Firebase Messaging instance if supported in the current browser.
 */
export async function getFirebaseMessagingInstance() {
  if (typeof window === "undefined") return null;
  const supported = await isSupported();
  if (!supported) return null;
  const app = getFirebaseApp();
  return getMessaging(app);
}
