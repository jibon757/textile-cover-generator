// Firebase connection. This web config is PUBLIC by design (it only identifies
// the project). Security comes from Firestore Rules and the Worker, not from hiding it.
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";

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
export { signInAnonymously, onAuthStateChanged };
