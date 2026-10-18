import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics, isSupported } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyDRz-z-eYe1WKQxjuC60EUbrSXEeACBiGA",
  authDomain: "saas-delivery-551a4.firebaseapp.com",
  projectId: "saas-delivery-551a4",
  storageBucket: "saas-delivery-551a4.firebasestorage.app",
  messagingSenderId: "636977701177",
  appId: "1:636977701177:web:661d9d4ea96e6fe371c8e8",
  measurementId: "G-2FXYQN7MSR"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export async function startAnalytics() {
  if (typeof window === "undefined") return null;
  if (!(await isSupported())) return null;
  return getAnalytics(app);
}
