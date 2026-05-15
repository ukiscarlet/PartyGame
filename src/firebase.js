/**
 * src/firebase.js — Firebase 服務層
 *
 * 封裝所有 Firebase Realtime Database 操作。
 */

import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, push, remove, onValue, off, onDisconnect } from 'firebase/database';

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

// ─── 錯誤類別 ───────────────────────────────────────────

/**
 * 房間不存在時拋出的錯誤。
 * 需求：1.3
 */
export class RoomNotFoundError extends Error {
  constructor(roomId) {
    super(`房間不存在：${roomId}`);
    this.name = 'RoomNotFoundError';
    this.roomId = roomId;
  }
}

// ─── 房間 ID 產生 ────────────────────────────────────────

const ROOM_ID_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const ROOM_ID_LENGTH = 6;

/**
 * 產生唯一的 6 字元英數房間 ID。
 * 需求：1.1
 * @returns {string}
 */
export function generateRoomId() {
  let id = '';
  for (let i = 0; i < ROOM_ID_LENGTH; i++) {
    id += ROOM_ID_CHARS.charAt(Math.floor(Math.random() * ROOM_ID_CHARS.length));
  }
  return id;
}

// ─── 房間管理 ────────────────────────────────────────────

/**
 * 建立房間、產生唯一 roomId、設定 hostId、寫入玩家資料。
 * 需求：1.1、1.4、1.5
 */
export async function createRoom(playerName) {
  const roomId = generateRoomId();
  const playerId = push(ref(db, 'rooms')).key;

  const roomRef = ref(db, `rooms/${roomId}`);
  await set(roomRef, {
    state: 'WAITING',
    hostId: playerId,
    players: {
      [playerId]: {
        name: playerName,
        score: 0,
        role: null,
        connected: true,
      },
    },
  });

  return { roomId, playerId };
}

/**
 * 加入現有房間，驗證房間存在後寫入玩家資料。
 * 需求：1.2、1.3、1.4
 */
export async function joinRoom(roomId, playerName) {
  const stateRef = ref(db, `rooms/${roomId}/state`);
  const snapshot = await get(stateRef);

  if (!snapshot.exists()) {
    throw new RoomNotFoundError(roomId);
  }

  const playerId = push(ref(db, 'rooms')).key;
  const playerRef = ref(db, `rooms/${roomId}/players/${playerId}`);
  await set(playerRef, {
    name: playerName,
    score: 0,
    role: null,
    connected: true,
  });

  return { playerId };
}

/**
 * 離開房間，移除玩家資料。若為主持人則將房間狀態設為 ENDED。
 * 需求：1.6
 */
export async function leaveRoom(roomId, playerId) {
  const hostIdRef = ref(db, `rooms/${roomId}/hostId`);
  const hostSnapshot = await get(hostIdRef);
  const hostId = hostSnapshot.val();

  if (playerId === hostId) {
    const stateRef = ref(db, `rooms/${roomId}/state`);
    await set(stateRef, 'ENDED');
  }

  const playerRef = ref(db, `rooms/${roomId}/players/${playerId}`);
  await remove(playerRef);
}

// ─── 狀態監聽 ────────────────────────────────────────────

export function onRoomStateChange(roomId, callback) {
  const stateRef = ref(db, `rooms/${roomId}/state`);
  const unsubscribe = onValue(stateRef, (snapshot) => {
    callback(snapshot.val());
  });
  return unsubscribe;
}

export function onPlayersChange(roomId, callback) {
  const playersRef = ref(db, `rooms/${roomId}/players`);
  const unsubscribe = onValue(playersRef, (snapshot) => {
    callback(snapshot.val());
  });
  return unsubscribe;
}

export function onRoundDataChange(roomId, callback) {
  const roundRef = ref(db, `rooms/${roomId}/currentRound`);
  const unsubscribe = onValue(roundRef, (snapshot) => {
    callback(snapshot.val());
  });
  return unsubscribe;
}

// ─── 遊戲操作 ────────────────────────────────────────────

export async function setRoomState(roomId, state) {
  const stateRef = ref(db, `rooms/${roomId}/state`);
  await set(stateRef, state);
}

export async function writeRoundData(roomId, roundData) {
  const roundRef = ref(db, `rooms/${roomId}/currentRound`);
  await set(roundRef, roundData);
}

export async function submitVote(roomId, playerId, targetId) {
  const voteRef = ref(db, `rooms/${roomId}/currentRound/votes/${playerId}`);
  const snapshot = await get(voteRef);
  if (snapshot.exists()) return;
  await set(voteRef, targetId);
}

export async function submitAnswerGuess(roomId, playerId, guess) {
  const guessRef = ref(db, `rooms/${roomId}/currentRound/answerGuesses/${playerId}`);
  const snapshot = await get(guessRef);
  if (snapshot.exists()) return;
  await set(guessRef, guess);
}

export async function submitLiarGuess(roomId, playerId, guess) {
  const guessRef = ref(db, `rooms/${roomId}/currentRound/liarGuesses/${playerId}`);
  const snapshot = await get(guessRef);
  if (snapshot.exists()) return;
  await set(guessRef, guess);
}

export async function updateScore(roomId, playerId, delta) {
  const scoreRef = ref(db, `rooms/${roomId}/players/${playerId}/score`);
  const snapshot = await get(scoreRef);
  const currentScore = snapshot.exists() ? snapshot.val() : 0;
  await set(scoreRef, currentScore + delta);
}

/**
 * 更新發言索引。
 * 需求：4.4
 * @param {string} roomId
 * @param {number} newIndex
 * @returns {Promise<void>}
 */
export async function updateSpeakerIndex(roomId, newIndex) {
  const indexRef = ref(db, `rooms/${roomId}/currentRound/speakerIndex`);
  await set(indexRef, newIndex);
}


/**
 * 取得房間的主持人 ID。
 * @param {string} roomId
 * @returns {Promise<string|null>}
 */
export async function getHostId(roomId) {
  const hostIdRef = ref(db, `rooms/${roomId}/hostId`);
  const snapshot = await get(hostIdRef);
  return snapshot.exists() ? snapshot.val() : null;
}

/**
 * 取得指定玩家的名稱。
 * @param {string} roomId
 * @param {string} playerId
 * @returns {Promise<string|null>}
 */
export async function getPlayerName(roomId, playerId) {
  const nameRef = ref(db, `rooms/${roomId}/players/${playerId}/name`);
  const snapshot = await get(nameRef);
  return snapshot.exists() ? snapshot.val() : null;
}


// ─── 離線偵測 ────────────────────────────────────────────

/**
 * 設定 Firebase onDisconnect 處理器。
 * - 主持人離線時將房間 state 設為 ENDED
 * - 所有玩家離線時設定 connected: false
 * 需求：1.6、8.3
 * @param {string} roomId
 * @param {string} playerId
 * @param {boolean} isHost
 */
export function setupDisconnectHandlers(roomId, playerId, isHost) {
  // 玩家離線時設定 connected: false
  const connectedRef = ref(db, `rooms/${roomId}/players/${playerId}/connected`);
  onDisconnect(connectedRef).set(false);

  // 主持人離線時將房間 state 設為 ENDED
  if (isHost) {
    const stateRef = ref(db, `rooms/${roomId}/state`);
    onDisconnect(stateRef).set('ENDED');
  }
}

/**
 * 監聽 Firebase 連線狀態，回傳取消監聽的函式。
 * 需求：8.3
 * @param {function(boolean): void} callback - 連線狀態變更時呼叫，true 表示已連線，false 表示中斷
 * @returns {function(): void} 取消監聽的函式
 */
export function monitorConnection(callback) {
  const connectedRef = ref(db, '.info/connected');
  const unsubscribe = onValue(connectedRef, (snapshot) => {
    const isConnected = snapshot.val() === true;
    callback(isConnected);
  });
  return unsubscribe;
}
