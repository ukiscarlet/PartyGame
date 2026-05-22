/**
 * src/main.js
 *
 * Entry point: Firebase init, question bank loading, home screen logic, state machine routing.
 * Requirements: 1.1-1.6, 2.1-2.5, 3.1-3.6, 7.4, 8.1, 8.2
 */

import { initFirebase, createRoom, joinRoom, RoomNotFoundError, onRoomStateChange, onPlayersChange, setRoomState, getHostId, getPlayerName, getPlayersData, setupDisconnectHandlers, monitorConnection } from '../roomService.js';
import { onRoundDataChange, writeRoundData, updateSpeakerIndex, submitVote, submitAnswerGuess, submitLiarGuess, updateScore, BLIND_MEN_PLAYER_DEFAULTS } from './firebase.js';
import { showScreen, renderWaiting, renderAssign, renderSpeak, renderVote, renderResult } from './ui.js';
import { loadQuestions } from './questionBank.js';
import { assignRoles, selectQuestion, assignPrompts, canStartGame, advanceSpeaker, calculateScores } from './game.js';

let questionBank = [];
let unsubscribeState = null;
let unsubscribePlayers = null;
let unsubscribeRoundData = null;
let unsubscribeVoteRoundData = null;
let unsubscribeVotePlayers = null;
let unsubscribeResultRoundData = null;
let unsubscribeResultPlayers = null;
let unsubscribeConnection = null;
let usedQuestions = [];
let currentRoundNumber = 0;
const MAX_ROUNDS = 3;

async function init() {
  initFirebase();
  try {
    questionBank = await loadQuestions(`${import.meta.env.BASE_URL}questions.json`);
  } catch (err) {
    console.error('題庫載入失敗：', err);
  }
  setupHomeScreen();
}

function setupHomeScreen() {
  const btnCreate = document.getElementById('btn-create-room');
  const btnJoin = document.getElementById('btn-join-room');
  if (btnCreate) {
    btnCreate.addEventListener('click', handleCreateRoom);
  }
  if (btnJoin) {
    btnJoin.addEventListener('click', handleJoinRoom);
  }
}

async function handleCreateRoom() {
  const nameInput = document.getElementById('input-create-name');
  const playerName = nameInput ? nameInput.value.trim() : '';
  if (!playerName) return;
  try {
    const { roomId, playerId } = await createRoom(playerName, BLIND_MEN_PLAYER_DEFAULTS);
    saveSession(roomId, playerId, playerName);
    setupDisconnectHandlers(roomId, playerId, true);
    startConnectionMonitor();
    subscribeRoomState(roomId);
  } catch (err) {
    console.error('建立房間失敗：', err);
  }
}

async function handleJoinRoom() {
  const nameInput = document.getElementById('input-join-name');
  const roomIdInput = document.getElementById('input-room-id');
  const errorEl = document.getElementById('join-error');
  const playerName = nameInput ? nameInput.value.trim() : '';
  const roomId = roomIdInput ? roomIdInput.value.trim().toUpperCase() : '';
  if (!playerName || !roomId) return;
  if (errorEl) errorEl.textContent = '';
  try {
    const { playerId } = await joinRoom(roomId, playerName, BLIND_MEN_PLAYER_DEFAULTS);
    saveSession(roomId, playerId, playerName);
    setupDisconnectHandlers(roomId, playerId, false);
    startConnectionMonitor();
    subscribeRoomState(roomId);
  } catch (err) {
    if (err instanceof RoomNotFoundError) {
      if (errorEl) errorEl.textContent = '房間不存在';
    } else {
      console.error('加入房間失敗：', err);
    }
  }
}

// --- Session Management ---

function saveSession(roomId, playerId, playerName) {
  sessionStorage.setItem('roomId', roomId);
  sessionStorage.setItem('playerId', playerId);
  sessionStorage.setItem('playerName', playerName);
}

export function getSession() {
  return {
    roomId: sessionStorage.getItem('roomId'),
    playerId: sessionStorage.getItem('playerId'),
    playerName: sessionStorage.getItem('playerName'),
  };
}

// --- State Machine Listener and Screen Routing (Task 8.2) ---

/**
 * Subscribe to room state changes and route to the corresponding screen.
 * Requirements: 1.6, 8.2
 * @param {string} roomId
 */
export function subscribeRoomState(roomId) {
  if (unsubscribeState) {
    unsubscribeState();
    unsubscribeState = null;
  }

  unsubscribeState = onRoomStateChange(roomId, (state) => {
    handleStateChange(state, roomId);
  });
}

/**
 * Route to the appropriate screen based on room state.
 * Requirements: 8.2
 * @param {string|null} state
 * @param {string} roomId
 */
function handleStateChange(state, roomId) {
  // Clean up players subscription when leaving WAITING state
  if (state !== 'WAITING') {
    cleanupWaitingSubscription();
  }

  // Clean up round data subscription when leaving SPEAK state
  if (state !== 'SPEAK') {
    cleanupSpeakSubscription();
  }

  // Clean up vote subscriptions when leaving VOTE state
  if (state !== 'VOTE') {
    cleanupVoteSubscription();
  }

  // Clean up result subscriptions when leaving RESULT state
  if (state !== 'RESULT') {
    cleanupResultSubscription();
  }

  switch (state) {
    case 'WAITING':
      showScreen('screen-waiting');
      setupWaitingPhase(roomId);
      break;

    case 'ASSIGN':
      showScreen('screen-assign');
      setupAssignPhase(roomId);
      break;

    case 'SPEAK':
      showScreen('screen-speak');
      setupSpeakPhase(roomId);
      break;

    case 'VOTE':
      showScreen('screen-vote');
      setupVotePhase(roomId);
      break;

    case 'RESULT':
      showScreen('screen-result');
      setupResultPhase(roomId);
      break;

    case 'ENDED':
      handleRoomEnded();
      break;

    default:
      break;
  }
}

// ─── WAITING Phase Logic (Task 8.3) ─────────────────────

/**
 * Clean up the players subscription from WAITING phase.
 */
function cleanupWaitingSubscription() {
  if (unsubscribePlayers) {
    unsubscribePlayers();
    unsubscribePlayers = null;
  }
}

/**
 * Set up the WAITING phase: subscribe to player changes and wire up the start game button.
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1-3.6, 7.4
 * @param {string} roomId
 */
function setupWaitingPhase(roomId) {
  const session = getSession();
  let currentPlayers = [];
  let hostId = null;

  // Subscribe to real-time player list updates
  unsubscribePlayers = onPlayersChange(roomId, (playersData) => {
    if (!playersData) {
      currentPlayers = [];
      renderWaiting(roomId, [], false);
      return;
    }

    // Convert Firebase players object to array format expected by renderWaiting
    currentPlayers = Object.entries(playersData).map(([id, data]) => ({
      id,
      name: data.name,
    }));

    // Determine hostId from the first player callback (host is stored in room data)
    // We check if current player is the host
    const isHost = session.playerId === hostId;

    renderWaiting(roomId, currentPlayers, isHost);

    // Update question exhaustion status
    updateQuestionExhaustedUI();
  });

  // Fetch hostId from Firebase to determine if current player is host
  getHostId(roomId).then((fetchedHostId) => {
    hostId = fetchedHostId;
    const isHost = session.playerId === hostId;
    // Re-render with correct isHost value
    if (currentPlayers.length > 0) {
      renderWaiting(roomId, currentPlayers, isHost);
      updateQuestionExhaustedUI();
    }
  });

  // Set up the "開始遊戲" button click handler
  setupStartGameButton(roomId, () => currentPlayers);
}

/**
 * Update UI when question bank is exhausted.
 */
function updateQuestionExhaustedUI() {
  const startBtn = document.getElementById('btn-start-game');
  const minMsg = document.getElementById('waiting-min-players-msg');

  const available = questionBank.filter(q => !new Set(usedQuestions).has(q.answer));
  if (available.length === 0 && questionBank.length > 0) {
    if (startBtn) {
      startBtn.disabled = true;
    }
    if (minMsg) {
      minMsg.textContent = '題庫已用盡';
      minMsg.style.display = 'block';
    }
  }
}

/**
 * Set up the "開始遊戲" button event listener.
 * Requirements: 2.4, 3.1-3.6, 7.4
 * @param {string} roomId
 * @param {Function} getPlayers - Returns current players array
 */
function setupStartGameButton(roomId, getPlayers) {
  const startBtn = document.getElementById('btn-start-game');
  if (!startBtn) return;

  // Remove any existing listener by cloning the button
  const newBtn = startBtn.cloneNode(true);
  startBtn.parentNode.replaceChild(newBtn, startBtn);

  newBtn.addEventListener('click', async () => {
    const players = getPlayers();
    const playerIds = players.map(p => p.id);

    // Check minimum player count
    if (!canStartGame(playerIds.length)) {
      return;
    }

    // Select a question from the bank
    const question = selectQuestion(questionBank, usedQuestions);
    if (question === null) {
      // Question bank exhausted
      updateQuestionExhaustedUI();
      return;
    }

    // Assign roles
    const { liars, blinds } = assignRoles(playerIds);

    // Assign prompts to blind players
    const promptsMap = assignPrompts(blinds, question.prompts);

    // Build round data for Firebase
    const promptsObj = {};
    promptsMap.forEach((prompt, playerId) => {
      promptsObj[playerId] = prompt;
    });

    const roles = {};
    liars.forEach(id => { roles[id] = 'liar'; });
    blinds.forEach(id => { roles[id] = 'blind'; });

    // Build speaker order (all players shuffled)
    const speakerOrder = [...playerIds].sort(() => Math.random() - 0.5);

    const roundData = {
      answer: question.answer,
      usedQuestions: [...usedQuestions, question.answer],
      prompts: promptsObj,
      roles,
      speakerIndex: 0,
      speakerOrder,
    };

    // Track used questions locally
    usedQuestions = [...usedQuestions, question.answer];
    currentRoundNumber = 1;

    // Write round data to Firebase
    await writeRoundData(roomId, roundData);

    // Advance state to ASSIGN
    await setRoomState(roomId, 'ASSIGN');
  });
}

// ─── ASSIGN Phase Logic (Task 8.3 → SPEAK transition) ─────────────────────

/**
 * Set up the ASSIGN phase: read round data, render role info, then auto-transition to SPEAK.
 * Requirements: 3.6, 3.7
 * @param {string} roomId
 */
function setupAssignPhase(roomId) {
  const session = getSession();
  let hasTransitioned = false;

  // Subscribe to round data to get role and content
  const unsubAssign = onRoundDataChange(roomId, async (roundData) => {
    if (!roundData || hasTransitioned) return;

    const { roles, prompts, answer } = roundData;
    if (!roles) return;

    const selfRole = roles[session.playerId] || 'blind';
    let content = '';
    if (selfRole === 'liar') {
      content = answer || '';
    } else {
      content = (prompts && prompts[session.playerId]) || '';
    }

    renderAssign(selfRole, content);

    // Unsubscribe after rendering
    hasTransitioned = true;
    if (unsubAssign) unsubAssign();

    // Auto-transition to SPEAK after a short delay (let players read their role)
    const hostId = await getHostId(roomId);
    if (session.playerId === hostId) {
      setTimeout(async () => {
        // Only transition if still in ASSIGN state
        await setRoomState(roomId, 'SPEAK');
      }, 3000);
    }
  });
}

// ─── SPEAK Phase Logic (Task 8.4) ─────────────────────

/**
 * Clean up the round data subscription from SPEAK phase.
 */
function cleanupSpeakSubscription() {
  if (unsubscribeRoundData) {
    unsubscribeRoundData();
    unsubscribeRoundData = null;
  }
}

/**
 * Set up the SPEAK phase: subscribe to round data changes and wire up the next speaker button.
 * Each player sees the "下一位" button only when it's their turn to speak.
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 * @param {string} roomId
 */
function setupSpeakPhase(roomId) {
  const session = getSession();

  // Subscribe to round data changes to get speakerIndex updates
  unsubscribeRoundData = onRoundDataChange(roomId, (roundData) => {
    if (!roundData) return;
    const { speakerIndex, speakerOrder, roles, prompts, answer } = roundData;

    // Determine current speaker from speakerOrder
    const currentSpeakerId = speakerOrder[speakerIndex];

    // Determine self role and content
    const selfRole = roles ? roles[session.playerId] : 'blind';
    let selfContent = '';
    if (selfRole === 'liar') {
      selfContent = answer || '';
    } else {
      selfContent = (prompts && prompts[session.playerId]) || '';
    }

    // Show "下一位" button only to the current speaker (not just host)
    const isCurrentSpeaker = session.playerId === currentSpeakerId;

    renderSpeakWithPlayerName(roomId, currentSpeakerId, selfRole, selfContent, isCurrentSpeaker, speakerIndex, speakerOrder);
  });
}

/**
 * Render the SPEAK screen with resolved player name and set up next speaker button.
 * @param {string} roomId
 * @param {string} speakerId - Current speaker's player ID
 * @param {string} selfRole
 * @param {string} selfContent
 * @param {boolean} isCurrentSpeaker - Whether the current user is the one speaking
 * @param {number} speakerIndex
 * @param {string[]} speakerOrder
 */
async function renderSpeakWithPlayerName(roomId, speakerId, selfRole, selfContent, isCurrentSpeaker, speakerIndex, speakerOrder) {
  // Resolve all speaker names for the order list
  const speakerNames = await Promise.all(
    speakerOrder.map(id => getPlayerName(roomId, id).then(name => name || id))
  );

  const currentSpeakerName = speakerNames[speakerIndex] || speakerId;

  renderSpeak(currentSpeakerName, selfRole, selfContent, isCurrentSpeaker);

  // Render speaker order list
  const orderList = document.getElementById('speak-order-list');
  if (orderList) {
    orderList.innerHTML = speakerNames.map((name, i) => {
      let style = '';
      if (i < speakerIndex) style = 'color:#666;text-decoration:line-through;';
      else if (i === speakerIndex) style = 'color:#e94560;font-weight:bold;';
      else style = 'color:#aaa;';
      return `<li style="${style}">${i + 1}. ${name}${i === speakerIndex ? ' ← 發言中' : ''}</li>`;
    }).join('');
  }

  // Set up the "下一位" button click handler
  setupNextSpeakerButton(roomId, speakerIndex, speakerOrder);
}

/**
 * Set up the "下一位" button event listener.
 * Requirements: 4.4, 4.5
 * @param {string} roomId
 * @param {number} speakerIndex
 * @param {string[]} speakerOrder
 */
function setupNextSpeakerButton(roomId, speakerIndex, speakerOrder) {
  const nextBtn = document.getElementById('btn-next-speaker');
  if (!nextBtn) return;

  // Remove existing listener by cloning the button
  const newBtn = nextBtn.cloneNode(true);
  nextBtn.parentNode.replaceChild(newBtn, nextBtn);

  let clicked = false;
  newBtn.addEventListener('click', async () => {
    if (clicked) return;
    clicked = true;
    newBtn.disabled = true;

    const nextIndex = advanceSpeaker(speakerIndex, speakerOrder);
    if (nextIndex === null) {
      // All players have spoken, advance to VOTE
      await setRoomState(roomId, 'VOTE');
    } else {
      // Update speakerIndex in Firebase
      await updateSpeakerIndex(roomId, nextIndex);
      clicked = false;
      newBtn.disabled = false;
    }
  });
}

// ─── VOTE Phase Logic (Task 8.5) ─────────────────────

/**
 * Clean up the vote phase subscriptions.
 */
function cleanupVoteSubscription() {
  if (unsubscribeVoteRoundData) {
    unsubscribeVoteRoundData();
    unsubscribeVoteRoundData = null;
  }
  if (unsubscribeVotePlayers) {
    unsubscribeVotePlayers();
    unsubscribeVotePlayers = null;
  }
}

/**
 * Set up the VOTE phase: render vote UI, wire up submit buttons, and monitor completion.
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9
 * @param {string} roomId
 */
function setupVotePhase(roomId) {
  const session = getSession();
  let currentPlayers = [];
  let selfRole = null;
  let hasSubmitted = false;
  let hasRendered = false;
  let hasTransitioned = false;
  let totalPlayerCount = 0;
  let hostId = null;
  let latestRoundData = null;

  // Fetch hostId - only host triggers state transition
  getHostId(roomId).then((fetchedHostId) => {
    hostId = fetchedHostId;
    tryRender();
    tryCheckCompletion();
  });

  function tryRender() {
    if (hasRendered || hasSubmitted) return;
    if (!selfRole || currentPlayers.length === 0) return;

    hasRendered = true;
    renderVote(currentPlayers, selfRole, session.playerId);
    setupVoteSubmitButtons(roomId, session.playerId, selfRole, () => {
      hasSubmitted = true;
    });
  }

  function tryCheckCompletion() {
    if (hasTransitioned || !latestRoundData || !hostId) return;
    if (session.playerId !== hostId) return;
    if (totalPlayerCount === 0) return;

    const { roles, votes, liarGuesses } = latestRoundData;
    checkAllVotesSubmitted(roomId, roles, votes, liarGuesses, totalPlayerCount, () => {
      hasTransitioned = true;
    });
  }

  // Subscribe to players to get the player list for rendering
  unsubscribeVotePlayers = onPlayersChange(roomId, (playersData) => {
    if (!playersData) return;
    currentPlayers = Object.entries(playersData).map(([id, data]) => ({
      id,
      name: data.name,
    }));
    totalPlayerCount = currentPlayers.length;
    tryRender();
    tryCheckCompletion();
  });

  // Subscribe to round data to get role info and monitor vote completion
  unsubscribeVoteRoundData = onRoundDataChange(roomId, (roundData) => {
    if (!roundData) return;
    latestRoundData = roundData;

    const { roles } = roundData;

    // Determine self role from round data
    if (roles && roles[session.playerId]) {
      selfRole = roles[session.playerId];
    }

    tryRender();
    tryCheckCompletion();
  });
}

/**
 * Set up the vote submit button event listeners.
 * Requirements: 5.5, 5.6, 5.9
 * @param {string} roomId
 * @param {string} playerId
 * @param {'liar'|'blind'} selfRole
 * @param {Function} onSubmitted - Callback when submission is complete
 */
function setupVoteSubmitButtons(roomId, playerId, selfRole, onSubmitted) {
  if (selfRole === 'blind') {
    const submitBtn = document.getElementById('btn-submit-blind');
    if (!submitBtn) return;

    // Remove existing listener by cloning the button
    const newBtn = submitBtn.cloneNode(true);
    submitBtn.parentNode.replaceChild(newBtn, submitBtn);

    newBtn.addEventListener('click', async () => {
      // Get selected vote target
      const selectedRadio = document.querySelector('input[name="vote-target"]:checked');
      if (!selectedRadio) return;
      const targetId = selectedRadio.value;

      // Get answer guess
      const guessInput = document.getElementById('input-answer-guess');
      const guess = guessInput ? guessInput.value.trim() : '';
      if (!guess) return;

      // Submit vote and answer guess
      await submitVote(roomId, playerId, targetId);
      await submitAnswerGuess(roomId, playerId, guess);

      // Show submitted message
      const submittedMsg = document.getElementById('vote-submitted-msg');
      const blindSection = document.getElementById('vote-blind-section');
      if (blindSection) blindSection.style.display = 'none';
      if (submittedMsg) submittedMsg.style.display = 'block';

      onSubmitted();
    });
  } else {
    // Liar
    const submitBtn = document.getElementById('btn-submit-liar');
    if (!submitBtn) return;

    // Remove existing listener by cloning the button
    const newBtn = submitBtn.cloneNode(true);
    submitBtn.parentNode.replaceChild(newBtn, submitBtn);

    newBtn.addEventListener('click', async () => {
      // Get liar guess
      const liarInput = document.getElementById('input-liar-guess');
      const guess = liarInput ? liarInput.value.trim() : '';
      if (!guess) return;

      // Submit liar guess
      await submitLiarGuess(roomId, playerId, guess);

      // Show submitted message
      const submittedMsg = document.getElementById('vote-submitted-msg');
      const liarSection = document.getElementById('vote-liar-section');
      if (liarSection) liarSection.style.display = 'none';
      if (submittedMsg) submittedMsg.style.display = 'block';

      onSubmitted();
    });
  }
}

/**
 * Check if all players have submitted their votes/guesses and transition to RESULT.
 * Requirements: 5.7, 5.8
 * @param {string} roomId
 * @param {Object} roles - { playerId: 'liar'|'blind' }
 * @param {Object|undefined} votes - { playerId: targetId }
 * @param {Object|undefined} liarGuesses - { playerId: guess }
 * @param {number} totalPlayerCount
 * @param {Function} onTransition - Called when transition is triggered
 */
function checkAllVotesSubmitted(roomId, roles, votes, liarGuesses, totalPlayerCount, onTransition) {
  if (!roles) return;

  // Count how many blinds and liars there are
  const blindIds = [];
  const liarIds = [];
  for (const [playerId, role] of Object.entries(roles)) {
    if (role === 'blind') blindIds.push(playerId);
    else if (role === 'liar') liarIds.push(playerId);
  }

  // Check if all blinds have voted
  const voteCount = votes ? Object.keys(votes).length : 0;
  const allBlindsVoted = voteCount >= blindIds.length;

  // Check if all liars have submitted their guesses
  const liarGuessCount = liarGuesses ? Object.keys(liarGuesses).length : 0;
  const allLiarsGuessed = liarGuessCount >= liarIds.length;

  // If all players have submitted, transition to RESULT
  if (allBlindsVoted && allLiarsGuessed) {
    onTransition();
    setRoomState(roomId, 'RESULT');
  }
}

// ─── RESULT Phase Logic (Task 8.6) ─────────────────────

/**
 * Clean up the result phase subscriptions.
 */
function cleanupResultSubscription() {
  if (unsubscribeResultRoundData) {
    unsubscribeResultRoundData();
    unsubscribeResultRoundData = null;
  }
  if (unsubscribeResultPlayers) {
    unsubscribeResultPlayers();
    unsubscribeResultPlayers = null;
  }
}

/**
 * Set up the RESULT phase: calculate scores, update Firebase, render result screen.
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9
 * @param {string} roomId
 */
function setupResultPhase(roomId) {
  const session = getSession();
  let hostId = null;
  let roundData = null;
  let playersData = null;
  let scoresUpdated = false;

  // Fetch hostId to determine if current player is host
  getHostId(roomId).then((fetchedHostId) => {
    hostId = fetchedHostId;
    tryRenderResult();
  });

  // Subscribe to round data to get votes, roles, guesses
  unsubscribeResultRoundData = onRoundDataChange(roomId, (data) => {
    roundData = data;
    tryRenderResult();
  });

  // Subscribe to players data to get cumulative scores and names
  unsubscribeResultPlayers = onPlayersChange(roomId, (data) => {
    playersData = data;
    tryRenderResult();
  });

  /**
   * Attempt to render the result screen once all data is available.
   * Also handles score updates (only once per RESULT phase).
   */
  async function tryRenderResult() {
    if (!roundData || !playersData || hostId === null) return;

    const { votes, roles, answerGuesses, liarGuesses } = roundData;
    if (!roles) return;

    // Determine liars from roles
    const liars = Object.entries(roles)
      .filter(([, role]) => role === 'liar')
      .map(([id]) => id);

    // Calculate score deltas and update Firebase (only once)
    if (!scoresUpdated && votes) {
      scoresUpdated = true;
      const scoreDeltas = calculateScores(
        votes || {},
        liars,
        answerGuesses || {},
        liarGuesses || {}
      );

      // Batch update scores for each player with non-zero delta
      const updatePromises = [];
      for (const [playerId, delta] of scoreDeltas.entries()) {
        if (delta !== 0) {
          updatePromises.push(updateScore(roomId, playerId, delta));
        }
      }
      await Promise.all(updatePromises);
    }

    // Build resultData for renderResult
    const revealedLiars = liars.map(id => playersData[id]?.name || id);

    // Build voteResults: { playerName: targetName }
    const voteResults = {};
    if (votes) {
      for (const [voterId, targetId] of Object.entries(votes)) {
        const voterName = playersData[voterId]?.name || voterId;
        const targetName = playersData[targetId]?.name || targetId;
        voteResults[voterName] = targetName;
      }
    }

    // Build liarGuessResults: { liarName: { guess, matched } }
    const liarGuessResults = {};
    for (const liarId of liars) {
      const liarName = playersData[liarId]?.name || liarId;
      const guess = (liarGuesses && liarGuesses[liarId]) || '';
      // Check if any blind player's answer guess matches the liar's guess
      const matched = answerGuesses
        ? Object.entries(answerGuesses).some(
            ([guesserId, g]) => roles[guesserId] === 'blind' && g === guess
          )
        : false;
      liarGuessResults[liarName] = { guess, matched };
    }

    const resultData = { revealedLiars, voteResults, liarGuessResults };

    // Build cumulative scores: { playerName: score }
    const scores = {};
    for (const [playerId, data] of Object.entries(playersData)) {
      scores[data.name || playerId] = data.score || 0;
    }

    const isHost = session.playerId === hostId;

    renderResult(resultData, scores, isHost);

    // Show round info
    const roundInfo = document.getElementById('result-round-info');
    if (roundInfo) {
      if (currentRoundNumber >= MAX_ROUNDS) {
        roundInfo.textContent = `第 ${currentRoundNumber}/${MAX_ROUNDS} 局（最後一局）`;
      } else {
        roundInfo.textContent = `第 ${currentRoundNumber}/${MAX_ROUNDS} 局`;
      }
    }
    // Wire up "下一局" button for host
    setupNextRoundButton(roomId);
  }
}

/**
 * Set up the "下一局" button event listener.
 * Requirements: 6.9
 * @param {string} roomId
 */
function setupNextRoundButton(roomId) {
  const nextRoundBtn = document.getElementById('btn-next-round');
  if (!nextRoundBtn) return;

  // Remove existing listener by cloning the button
  const newBtn = nextRoundBtn.cloneNode(true);
  nextRoundBtn.parentNode.replaceChild(newBtn, nextRoundBtn);

  newBtn.addEventListener('click', async () => {
    // Check if max rounds reached
    if (currentRoundNumber >= MAX_ROUNDS) {
      alert(`已完成 ${MAX_ROUNDS} 局遊戲！`);
      // Return to waiting room
      await setRoomState(roomId, 'WAITING');
      currentRoundNumber = 0;
      usedQuestions = [];
      return;
    }

    currentRoundNumber++;

    // Fetch current players
    const playersData = await getPlayersData(roomId);
    if (!playersData) return;

    const playerIds = Object.keys(playersData);

    // Select a new question
    const question = selectQuestion(questionBank, usedQuestions);
    if (question === null) {
      alert('題庫已用盡！');
      await setRoomState(roomId, 'WAITING');
      return;
    }

    // Assign roles
    const { liars, blinds } = assignRoles(playerIds);

    // Assign prompts
    const promptsMap = assignPrompts(blinds, question.prompts);
    const promptsObj = {};
    promptsMap.forEach((prompt, playerId) => {
      promptsObj[playerId] = prompt;
    });

    const roles = {};
    liars.forEach(id => { roles[id] = 'liar'; });
    blinds.forEach(id => { roles[id] = 'blind'; });

    // Build speaker order
    const speakerOrder = [...playerIds].sort(() => Math.random() - 0.5);

    // Track used questions
    usedQuestions = [...usedQuestions, question.answer];

    const roundData = {
      answer: question.answer,
      usedQuestions,
      prompts: promptsObj,
      roles,
      speakerIndex: 0,
      speakerOrder,
    };

    // Write new round data and transition to ASSIGN
    await writeRoundData(roomId, roundData);
    await setRoomState(roomId, 'ASSIGN');
  });
}

/**
 * Handle ENDED state: show alert that host left, return to home screen.
 * Requirements: 1.6
 */
function handleRoomEnded() {
  if (unsubscribeState) {
    unsubscribeState();
    unsubscribeState = null;
  }

  stopConnectionMonitor();

  sessionStorage.removeItem('roomId');
  sessionStorage.removeItem('playerId');
  sessionStorage.removeItem('playerName');

  alert('主持人已離開房間');
  showScreen('screen-home');
}

// ─── 連線狀態監控 (Task 8.7) ─────────────────────

/**
 * 開始監控 Firebase 連線狀態，連線中斷時顯示 Banner。
 * 需求：8.3
 */
function startConnectionMonitor() {
  stopConnectionMonitor();

  unsubscribeConnection = monitorConnection((isConnected) => {
    const banner = document.getElementById('offline-banner');
    if (!banner) return;
    banner.style.display = isConnected ? 'none' : 'block';
  });
}

/**
 * 停止連線狀態監控並隱藏 Banner。
 */
function stopConnectionMonitor() {
  if (unsubscribeConnection) {
    unsubscribeConnection();
    unsubscribeConnection = null;
  }
  const banner = document.getElementById('offline-banner');
  if (banner) {
    banner.style.display = 'none';
  }
}

// --- Start ---

init();
