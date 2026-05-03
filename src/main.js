/**
 * src/main.js — 進入點
 *
 * 初始化 Firebase 並載入題庫。
 * 完整的遊戲邏輯將在後續任務中實作。
 */

import { initFirebase } from './firebase.js';
import { loadQuestions } from './questionBank.js';

// ── Firebase 初始化 ──────────────────────────────────────────────────────────
// Firebase 設定由環境變數或 firebase.js 中的設定物件提供。
// 此處僅呼叫初始化函式；實際設定值在 src/firebase.js 中管理。
let db = null;

try {
  db = initFirebase();
} catch (err) {
  console.error('[main] Firebase 初始化失敗：', err);
}

// ── 題庫載入 ─────────────────────────────────────────────────────────────────
let questionBank = [];

async function bootstrap() {
  try {
    questionBank = await loadQuestions('/questions.json');
    console.log(`[main] 題庫載入成功，共 ${questionBank.length} 題`);
  } catch (err) {
    console.error('[main] 題庫載入失敗，停止初始化：', err);
    // 顯示錯誤畫面（後續任務實作）
    return;
  }

  // 後續任務將在此處掛載 UI 事件監聽與狀態機
}

bootstrap();

export { db, questionBank };
