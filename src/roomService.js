/**
 * src/roomService.js — 通用房間管理服務
 *
 * 封裝房間建立、加入、離開、玩家監聽、連線偵測等通用邏輯。
 * 不包含任何遊戲專屬邏輯。
 */

import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, push, remove, onValue, onDisconnect } from 'firebase/database';

// Firebase 設定
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

export function getDb() {
  return db;
}

// ─── 錯誤類別 ───────────────────────────────────────────

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
 * 建立房間。
 * @param {string} playerName - 建立者名稱
 * @param {Object} [extraPlayerData] - 遊戲專屬的玩家初始欄位（例如 { score: 0, role: null }）
 * @returns {Promise<{ roomId: string, playerId: string }>}
 */
export async function createRoom(playerName, extraPlayerData = {}) {
  const roomId = generateRoomId();
  const playerId = push(ref(db, 'rooms')).key;

  const roomRef = ref(db, `rooms/${roomId}`);
  await set(roomRef, {
    state: 'WAITING',
    hostId: playerId,
    players: {
      [playerId]: {
        name: playerName,
        connected: true,
        ...extraPlayerData,
      },
    },
  });

  return { roomId, playerId };
}

/**
 * 加入現有房間。
 * @param {string} roomId
 * @param {string} playerName
 * @param {Object} [extraPlayerData] - 遊戲專屬的玩家初始欄位
 * @returns {Promise<{ playerId: string }>}
 * @throws {RoomNotFoundError}
 */
export async function joinRoom(roomId, playerName, extraPlayerData = {}) {
  const stateRef = ref(db, `rooms/${roomId}/state`);
  const snapshot = await get(stateRef);

  if (!snapshot.exists()) {
    throw new RoomNotFoundError(roomId);
  }

  const playerId = push(ref(db, 'rooms')).key;
  const playerRef = ref(db, `rooms/${roomId}/players/${playerId}`);
  await set(playerRef, {
    name: playerName,
    connected: true,
    ...extraPlayerData,
  });

  return { playerId };
}

/**
 * 離開房間。若為主持人則將房間狀態設為 ENDED。
 * @param {string} roomId
 * @param {string} playerId
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
  return onValue(stateRef, (snapshot) => {
    callback(snapshot.val());
  });
}

export function onPlayersChange(roomId, callback) {
  const playersRef = ref(db, `rooms/${roomId}/players`);
  return onValue(playersRef, (snapshot) => {
    callback(snapshot.val());
  });
}

export async function setRoomState(roomId, state) {
  const stateRef = ref(db, `rooms/${roomId}/state`);
  await set(stateRef, state);
}

export async function getHostId(roomId) {
  const hostIdRef = ref(db, `rooms/${roomId}/hostId`);
  const snapshot = await get(hostIdRef);
  return snapshot.exists() ? snapshot.val() : null;
}

export async function getPlayerName(roomId, playerId) {
  const nameRef = ref(db, `rooms/${roomId}/players/${playerId}/name`);
  const snapshot = await get(nameRef);
  return snapshot.exists() ? snapshot.val() : null;
}

export async function getPlayersData(roomId) {
  const playersRef = ref(db, `rooms/${roomId}/players`);
  const snapshot = await get(playersRef);
  return snapshot.exists() ? snapshot.val() : null;
}

// ─── 離線偵測 ────────────────────────────────────────────

/**
 * 設定 Firebase onDisconnect 處理器。
 * @param {string} roomId
 * @param {string} playerId
 * @param {boolean} isHost
 */
export function setupDisconnectHandlers(roomId, playerId, isHost) {
  const connectedRef = ref(db, `rooms/${roomId}/players/${playerId}/connected`);
  onDisconnect(connectedRef).set(false);

  if (isHost) {
    const stateRef = ref(db, `rooms/${roomId}/state`);
    onDisconnect(stateRef).set('ENDED');
  }
}

/**
 * 監聽 Firebase 連線狀態。
 * @param {function(boolean): void} callback
 * @returns {function(): void} 取消監聽的函式
 */
export function monitorConnection(callback) {
  const connectedRef = ref(db, '.info/connected');
  return onValue(connectedRef, (snapshot) => {
    callback(snapshot.val() === true);
  });
}
