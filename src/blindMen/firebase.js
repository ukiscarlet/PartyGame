/**
 * src/blindMen/firebase.js — 盲人摸象專屬 Firebase 操作
 *
 * 封裝 roundData、投票、計分等遊戲專屬的資料庫操作。
 */

import { ref, set, get, onValue } from 'firebase/database';
import { getDb } from '../roomService.js';

/** 盲人摸象玩家初始欄位 */
export const BLIND_MEN_PLAYER_DEFAULTS = { score: 0, role: null };

// ─── Round Data ──────────────────────────────────────────

export function onRoundDataChange(roomId, callback) {
  const db = getDb();
  const roundRef = ref(db, `rooms/${roomId}/currentRound`);
  return onValue(roundRef, (snapshot) => {
    callback(snapshot.val());
  });
}

export async function writeRoundData(roomId, roundData) {
  const db = getDb();
  const roundRef = ref(db, `rooms/${roomId}/currentRound`);
  await set(roundRef, roundData);
}

// ─── 投票 ────────────────────────────────────────────────

export async function submitVote(roomId, playerId, targetId) {
  const db = getDb();
  const voteRef = ref(db, `rooms/${roomId}/currentRound/votes/${playerId}`);
  const snapshot = await get(voteRef);
  if (snapshot.exists()) return;
  await set(voteRef, targetId);
}

export async function submitAnswerGuess(roomId, playerId, guess) {
  const db = getDb();
  const guessRef = ref(db, `rooms/${roomId}/currentRound/answerGuesses/${playerId}`);
  const snapshot = await get(guessRef);
  if (snapshot.exists()) return;
  await set(guessRef, guess);
}

export async function submitLiarGuess(roomId, playerId, guess) {
  const db = getDb();
  const guessRef = ref(db, `rooms/${roomId}/currentRound/liarGuesses/${playerId}`);
  const snapshot = await get(guessRef);
  if (snapshot.exists()) return;
  await set(guessRef, guess);
}

// ─── 計分 ────────────────────────────────────────────────

export async function updateScore(roomId, playerId, delta) {
  const db = getDb();
  const scoreRef = ref(db, `rooms/${roomId}/players/${playerId}/score`);
  const snapshot = await get(scoreRef);
  const currentScore = snapshot.exists() ? snapshot.val() : 0;
  await set(scoreRef, currentScore + delta);
}

// ─── 發言 ────────────────────────────────────────────────

export async function updateSpeakerIndex(roomId, newIndex) {
  const db = getDb();
  const indexRef = ref(db, `rooms/${roomId}/currentRound/speakerIndex`);
  await set(indexRef, newIndex);
}
