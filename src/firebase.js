/**
 * src/firebase.js — Firebase 服務層（骨架）
 *
 * 封裝所有 Firebase Realtime Database 操作。
 * 完整實作將在任務 5 中完成。
 */

import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

// Firebase 設定（請替換為實際專案設定）
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

let app = null;
let db = null;

/**
 * 初始化 Firebase 應用程式並回傳 Realtime Database 實例。
 * @returns {import('firebase/database').Database}
 */
export function initFirebase() {
  app = initializeApp(firebaseConfig);
  db = getDatabase(app);
  return db;
}

export { db };
