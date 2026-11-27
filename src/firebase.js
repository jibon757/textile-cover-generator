// Firebase connection. This web config is PUBLIC by design (it only identifies
// the project). Security comes from Firestore Rules and the Worker, not from hiding it.
import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  GoogleAuthProvider,
  linkWithPopup,
  signInWithPopup,
  signInWithCredential,
  signOut,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyD6T7OAT7SWqWZEY7Oi7FgZtTdF3EzL2Xo",
  authDomain: "textile-cover-generator.firebaseapp.com",
  projectId: "textile-cover-generator",
  storageBucket: "textile-cover-generator.firebasestorage.app",
  messagingSenderId: "619043696450",
  appId: "1:619043696450:web:c34b1bf26ba8fa5f6f62db",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export { signInAnonymously, onAuthStateChanged, signOut };

// Google sign-in. A visitor who already has an anonymous ID keeps the same ID
// (linkWithPopup); if that Google account was used before, we sign in to it instead.
export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const current = auth.currentUser;
  if (current && current.isAnonymous) {
    try {
      return (await linkWithPopup(current, provider)).user;
    } catch (err) {
      if (err.code === "auth/credential-already-in-use") {
        const cred = GoogleAuthProvider.credentialFromError(err);
        if (cred) return (await signInWithCredential(auth, cred)).user;
      }
      throw err;
    }
  }
  return (await signInWithPopup(auth, provider)).user;
}

export function googleErrorMessage(err) {
  const code = err?.code || "";
  if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return "Sign-in was cancelled.";
  if (code === "auth/popup-blocked") return "Your browser blocked the sign-in window. Allow pop-ups and try again.";
  if (code === "auth/unauthorized-domain") return "This website address is not yet allowed in Firebase (Authorized domains).";
  if (code === "auth/operation-not-allowed") return "Google sign-in is not turned on in Firebase.";
  if (code === "auth/network-request-failed") return "No internet connection. Please try again.";
  return "Google sign-in failed. Please try again.";
}
