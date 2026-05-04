/**
 * src/ui.js — UI 控制器
 *
 * 根據遊戲狀態渲染對應畫面。
 * 需求：2.1–2.5、3.7、4.1–4.3、5.1–5.4、6.1–6.8、8.2
 */

/**
 * 隱藏所有畫面 div，顯示指定畫面。
 * 需求：8.2
 * @param {string} screenId - 目標畫面的 ID（例如 'screen-home'）
 */
export function showScreen(screenId) {
  const screens = document.querySelectorAll('.screen');
  screens.forEach((screen) => {
    screen.style.display = 'none';
    screen.classList.remove('active');
  });

  const target = document.getElementById(screenId);
  if (target) {
    target.style.display = 'block';
    target.classList.add('active');
  }
}

/**
 * 渲染等待大廳畫面。
 * 需求：2.1、2.2、2.3、2.5
 * @param {string} roomId - 房間 ID
 * @param {Array<{id: string, name: string}>} players - 玩家列表
 * @param {boolean} isHost - 是否為主持人
 */
export function renderWaiting(roomId, players, isHost) {
  const screen = document.getElementById('screen-waiting');

  // 房間 ID
  const roomIdEl = screen.querySelector('#waiting-room-id');
  if (roomIdEl) {
    roomIdEl.textContent = roomId;
  }

  // 玩家列表
  const playerList = screen.querySelector('#waiting-player-list');
  if (playerList) {
    playerList.innerHTML = players
      .map((p) => `<li>${p.name}</li>`)
      .join('');
  }

  // 開始遊戲按鈕：僅主持人可見
  const startBtn = screen.querySelector('#btn-start-game');
  if (startBtn) {
    startBtn.style.display = isHost ? 'inline-block' : 'none';

    // 玩家人數 < 2 時禁用按鈕
    if (players.length < 2) {
      startBtn.disabled = true;
    } else {
      startBtn.disabled = false;
    }
  }

  // 人數不足提示
  const minMsg = screen.querySelector('#waiting-min-players-msg');
  if (minMsg) {
    if (players.length < 2) {
      minMsg.textContent = '至少需要 2 位玩家才能開始遊戲';
      minMsg.style.display = 'block';
    } else {
      minMsg.textContent = '';
      minMsg.style.display = 'none';
    }
  }

  showScreen('screen-waiting');
}

/**
 * 渲染角色揭示畫面。
 * 需求：3.7 — 騙子只看到答案，瞎子只看到提示詞，兩者不互相洩漏。
 * @param {'liar'|'blind'} role - 玩家角色
 * @param {string} content - 騙子為答案，瞎子為提示詞
 */
export function renderAssign(role, content) {
  const screen = document.getElementById('screen-assign');

  const roleDisplay = screen.querySelector('#assign-role-display');
  const contentDisplay = screen.querySelector('#assign-content-display');

  if (role === 'liar') {
    roleDisplay.textContent = '你是騙子';
    contentDisplay.textContent = `你是騙子，答案是：${content}`;
  } else {
    roleDisplay.textContent = '你是瞎子';
    contentDisplay.textContent = `你是瞎子，提示詞是：${content}`;
  }

  showScreen('screen-assign');
}

/**
 * 渲染發言階段畫面。
 * 需求：4.1、4.2、4.3
 * @param {string} currentSpeaker - 目前發言玩家名稱
 * @param {'liar'|'blind'} selfRole - 自己的角色
 * @param {string} selfContent - 自己的角色資訊（答案或提示詞）
 * @param {boolean} isHost - 是否為主持人
 */
export function renderSpeak(currentSpeaker, selfRole, selfContent, isHost) {
  const screen = document.getElementById('screen-speak');

  // 目前發言玩家
  const speakerEl = screen.querySelector('#speak-current-player');
  if (speakerEl) {
    speakerEl.textContent = currentSpeaker;
  }

  // 自己的角色資訊
  const selfInfo = screen.querySelector('#speak-self-info');
  if (selfInfo) {
    if (selfRole === 'liar') {
      selfInfo.textContent = `你是騙子，答案是：${selfContent}`;
    } else {
      selfInfo.textContent = `你是瞎子，提示詞是：${selfContent}`;
    }
  }

  // 下一位按鈕：僅主持人可見
  const nextBtn = screen.querySelector('#btn-next-speaker');
  if (nextBtn) {
    nextBtn.style.display = isHost ? 'inline-block' : 'none';
  }

  showScreen('screen-speak');
}

/**
 * 渲染投票階段畫面。
 * 需求：5.1、5.2、5.3、5.4
 * @param {Array<{id: string, name: string}>} players - 所有玩家列表
 * @param {'liar'|'blind'} selfRole - 自己的角色
 * @param {string} selfId - 自己的玩家 ID
 */
export function renderVote(players, selfRole, selfId) {
  const screen = document.getElementById('screen-vote');

  const blindSection = screen.querySelector('#vote-blind-section');
  const liarSection = screen.querySelector('#vote-liar-section');
  const submittedMsg = screen.querySelector('#vote-submitted-msg');

  // 重置顯示狀態
  if (submittedMsg) submittedMsg.style.display = 'none';

  if (selfRole === 'blind') {
    // 瞎子：顯示投票 radio button 列表（排除自己）+ 猜測答案輸入
    if (blindSection) blindSection.style.display = 'block';
    if (liarSection) liarSection.style.display = 'none';

    const voteOptions = screen.querySelector('#vote-options');
    if (voteOptions) {
      const otherPlayers = players.filter((p) => p.id !== selfId);
      voteOptions.innerHTML = otherPlayers
        .map(
          (p) =>
            `<label style="display:block;margin-bottom:0.4rem;">` +
            `<input type="radio" name="vote-target" value="${p.id}" /> ${p.name}` +
            `</label>`
        )
        .join('');
    }

    // 清空猜測輸入
    const guessInput = screen.querySelector('#input-answer-guess');
    if (guessInput) guessInput.value = '';
  } else {
    // 騙子：顯示預想答案輸入
    if (blindSection) blindSection.style.display = 'none';
    if (liarSection) liarSection.style.display = 'block';

    // 清空預想答案輸入
    const liarInput = screen.querySelector('#input-liar-guess');
    if (liarInput) liarInput.value = '';
  }

  showScreen('screen-vote');
}

/**
 * 渲染結算畫面。
 * 需求：6.1、6.2、6.6、6.7、6.8
 * @param {Object} resultData - 結算資料
 * @param {string[]} resultData.revealedLiars - 騙子玩家名稱列表
 * @param {Object<string, string>} resultData.voteResults - 每位玩家的投票對象 { playerName: targetName }
 * @param {Object<string, {guess: string, matched: boolean}>} resultData.liarGuessResults - 騙子猜答結果
 * @param {Object<string, number>} scores - 累計分數 { playerName: score }
 * @param {boolean} isHost - 是否為主持人
 */
export function renderResult(resultData, scores, isHost) {
  const screen = document.getElementById('screen-result');

  const { revealedLiars, voteResults, liarGuessResults } = resultData;

  // 騙子身份
  const liarsEl = screen.querySelector('#result-liars');
  if (liarsEl) {
    liarsEl.innerHTML =
      `<h2>騙子身份</h2>` +
      `<p>${revealedLiars.join('、')}</p>`;
  }

  // 投票結果
  const votesEl = screen.querySelector('#result-votes');
  if (votesEl) {
    const voteEntries = Object.entries(voteResults);
    votesEl.innerHTML =
      `<h2>投票結果</h2>` +
      `<ul>${voteEntries
        .map(([player, target]) => `<li>${player} → ${target}</li>`)
        .join('')}</ul>`;
  }

  // 猜答結果
  const guessesEl = screen.querySelector('#result-guesses');
  if (guessesEl) {
    const guessEntries = Object.entries(liarGuessResults);
    guessesEl.innerHTML =
      `<h2>猜答結果</h2>` +
      `<ul>${guessEntries
        .map(
          ([liar, { guess, matched }]) =>
            `<li>${liar}：預想「${guess}」— ${matched ? '✅ 得分' : '❌ 未得分'}</li>`
        )
        .join('')}</ul>`;
  }

  // 累計分數
  const scoresEl = screen.querySelector('#result-scores');
  if (scoresEl) {
    const scoreEntries = Object.entries(scores);
    scoresEl.innerHTML =
      `<h2>累計分數</h2>` +
      `<ul>${scoreEntries
        .map(([player, score]) => `<li>${player}：${score} 分</li>`)
        .join('')}</ul>`;
  }

  // 下一局按鈕：僅主持人可見
  const nextRoundBtn = screen.querySelector('#btn-next-round');
  if (nextRoundBtn) {
    nextRoundBtn.style.display = isHost ? 'inline-block' : 'none';
  }

  showScreen('screen-result');
}
