/**
 * src/game.js — 遊戲邏輯引擎
 *
 * 包含角色分配、題目選取、提示詞分配、計分等核心邏輯。
 */

/**
 * 隨機打亂陣列（Fisher-Yates shuffle），回傳新陣列。
 * @param {Array} arr
 * @returns {Array}
 */
function shuffle(arr) {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * 依比例規則分配騙子與瞎子角色。
 * 規則：Math.max(1, Math.floor(n / 4)) 位騙子，其餘為瞎子。
 *
 * @param {string[]} players - 玩家 ID 陣列
 * @returns {{ liars: string[], blinds: string[] }}
 */
export function assignRoles(players) {
  const n = players.length;
  const liarCount = Math.max(1, Math.floor(n / 4));

  const shuffled = shuffle(players);
  const liars = shuffled.slice(0, liarCount);
  const blinds = shuffled.slice(liarCount);

  return { liars, blinds };
}

/**
 * 從題庫中隨機選取一題未使用的題目。
 * 若所有題目均已使用，回傳 null。
 *
 * @param {{ answer: string, prompts: string[] }[]} questionBank
 * @param {string[]} usedQuestions - 已使用題目的 answer 字串陣列
 * @returns {{ answer: string, prompts: string[] } | null}
 */
export function selectQuestion(questionBank, usedQuestions) {
  const usedSet = new Set(usedQuestions);
  const available = questionBank.filter(q => !usedSet.has(q.answer));
  if (available.length === 0) return null;
  const idx = Math.floor(Math.random() * available.length);
  return available[idx];
}

/**
 * 循環分配提示詞給每位瞎子。
 *
 * @param {string[]} blindPlayers - 瞎子玩家 ID 陣列
 * @param {string[]} prompts - 提示詞陣列（長度 ≥ 1）
 * @returns {Map<string, string>} playerId → prompt
 */
export function assignPrompts(blindPlayers, prompts) {
  const result = new Map();
  blindPlayers.forEach((playerId, index) => {
    result.set(playerId, prompts[index % prompts.length]);
  });
  return result;
}

/**
 * 計算本局得分增量。
 * - 投票目標為騙子的瞎子得 1 分
 * - 騙子的預想答案與任一瞎子猜測完全相符時，該騙子得 1 分
 *
 * @param {{ [playerId: string]: string }} votes - 每位玩家的投票目標 playerId
 * @param {string[]} liars - 騙子 playerId 陣列
 * @param {{ [playerId: string]: string }} answerGuesses - 瞎子的猜測答案
 * @param {{ [playerId: string]: string }} liarGuesses - 騙子的預想答案
 * @returns {Map<string, number>} playerId → scoreDelta
 */
export function calculateScores(votes, liars, answerGuesses, liarGuesses) {
  const scores = new Map();
  const liarSet = new Set(liars);

  // 投票計分：瞎子投票給騙子得 1 分
  for (const [voterId, targetId] of Object.entries(votes)) {
    if (!liarSet.has(voterId) && liarSet.has(targetId)) {
      scores.set(voterId, (scores.get(voterId) ?? 0) + 1);
    }
  }

  // 猜答計分：騙子預想答案與任一瞎子猜測完全相符得 1 分
  for (const liarId of liars) {
    const liarGuess = liarGuesses[liarId];
    if (liarGuess === undefined) continue;
    const matched = Object.entries(answerGuesses).some(
      ([guesserId, guess]) => !liarSet.has(guesserId) && guess === liarGuess
    );
    if (matched) {
      scores.set(liarId, (scores.get(liarId) ?? 0) + 1);
    }
  }

  return scores;
}

/**
 * 判斷是否可以開始遊戲（玩家人數 ≥ 2）。
 *
 * @param {number} playerCount
 * @returns {boolean}
 */
export function canStartGame(playerCount) {
  return playerCount >= 2;
}

/**
 * 推進發言索引。
 * 若已到最後一位，回傳 null（表示應轉換至 VOTE）。
 *
 * @param {number} speakerIndex
 * @param {string[]} speakerOrder
 * @returns {number | null}
 */
export function advanceSpeaker(speakerIndex, speakerOrder) {
  const next = speakerIndex + 1;
  return next < speakerOrder.length ? next : null;
}

/**
 * 從玩家列表中排除自己，回傳可投票的玩家陣列。
 *
 * @param {string[]} players - 所有玩家 ID 陣列
 * @param {string} selfId - 自己的玩家 ID
 * @returns {string[]}
 */
export function getVoteOptions(players, selfId) {
  return players.filter(id => id !== selfId);
}
