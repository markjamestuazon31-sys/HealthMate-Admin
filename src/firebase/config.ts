import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

/**
 * HealthMate production Firebase web configuration.
 * Firebase web configuration identifies the project; database access is
 * authorized separately by Realtime Database Security Rules.
 */
export const firebaseConfig = {
  apiKey: "AIzaSyBKZUP-UfTWwM_vY4TR9LvcVuI5EHtDX5k",
  authDomain: "health-mate-74738.firebaseapp.com",
  databaseURL: "https://health-mate-74738-default-rtdb.firebaseio.com",
  projectId: "health-mate-74738",
  storageBucket: "health-mate-74738.firebasestorage.app",
  messagingSenderId: "171824578044",
  appId: "1:171824578044:web:73943d8b50a298e00b8679",
  measurementId: "G-ZEETBBGH5V",
} as const;

export const firebaseApp =
  getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(firebaseApp);
export const database = getDatabase(firebaseApp);
