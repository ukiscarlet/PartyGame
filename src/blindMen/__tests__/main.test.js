/**
 * Unit tests for state machine listener and screen routing (Task 8.2).
 * Requirements: 1.6, 8.2
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

let stateCallback = null;

// Mock roomService (path relative to THIS test file)
vi.mock('../../roomService.js', () => {
  return {
    initFirebase: vi.fn(),
    createRoom: vi.fn(),
    joinRoom: vi.fn(),
    RoomNotFoundError: class RoomNotFoundError extends Error {
      constructor(roomId) {
        super(`房間不存在：${roomId}`);
        this.name = 'RoomNotFoundError';
      }
    },
    onRoomStateChange: vi.fn((roomId, callback) => {
      stateCallback = callback;
      return vi.fn(); // unsubscribe
    }),
    onPlayersChange: vi.fn((roomId, callback) => {
      return vi.fn();
    }),
    setRoomState: vi.fn(() => Promise.resolve(undefined)),
    getHostId: vi.fn(() => Promise.resolve(null)),
    getPlayerName: vi.fn(() => Promise.resolve('TestPlayer')),
    getPlayersData: vi.fn(() => Promise.resolve(null)),
    setupDisconnectHandlers: vi.fn(),
    monitorConnection: vi.fn(() => vi.fn()),
    getDb: vi.fn(() => ({})),
  };
});

// Mock blindMen firebase (path relative to THIS test file)
vi.mock('../firebase.js', () => ({
  onRoundDataChange: vi.fn((roomId, callback) => {
    return vi.fn();
  }),
  writeRoundData: vi.fn(() => Promise.resolve(undefined)),
  updateSpeakerIndex: vi.fn(() => Promise.resolve(undefined)),
  submitVote: vi.fn(() => Promise.resolve(undefined)),
  submitAnswerGuess: vi.fn(() => Promise.resolve(undefined)),
  submitLiarGuess: vi.fn(() => Promise.resolve(undefined)),
  updateScore: vi.fn(() => Promise.resolve(undefined)),
  BLIND_MEN_PLAYER_DEFAULTS: { score: 0, role: null },
}));

// Mock questionBank.js
vi.mock('../questionBank.js', () => ({
  loadQuestions: vi.fn().mockResolvedValue([]),
}));

// Mock game.js
vi.mock('../game.js', () => ({
  assignRoles: vi.fn(() => ({ liars: [], blinds: [] })),
  selectQuestion: vi.fn(() => null),
  assignPrompts: vi.fn(() => new Map()),
  canStartGame: vi.fn(() => false),
  advanceSpeaker: vi.fn(() => null),
  calculateScores: vi.fn(() => new Map()),
}));

describe('State Machine Routing (Task 8.2)', () => {
  beforeEach(() => {
    stateCallback = null;
    document.body.innerHTML = `
      <div id="screen-home" class="screen active" style="display:block;"></div>
      <div id="screen-waiting" class="screen" style="display:none;">
        <strong id="waiting-room-id"></strong>
        <ul id="waiting-player-list"></ul>
        <p id="waiting-min-players-msg" class="info-msg"></p>
        <button id="btn-start-game" style="display:none;">開始遊戲</button>
      </div>
      <div id="screen-assign" class="screen" style="display:none;">
        <div id="assign-role-display"></div>
        <div id="assign-content-display"></div>
      </div>
      <div id="screen-speak" class="screen" style="display:none;">
        <strong id="speak-current-player"></strong>
        <div id="speak-self-info"></div>
        <ul id="speak-order-list"></ul>
        <button id="btn-next-speaker" style="display:none;">下一位</button>
      </div>
      <div id="screen-vote" class="screen" style="display:none;">
        <div id="vote-blind-section" style="display:none;"></div>
        <div id="vote-liar-section" style="display:none;"></div>
        <p id="vote-submitted-msg" style="display:none;"></p>
      </div>
      <div id="screen-result" class="screen" style="display:none;">
        <div id="result-liars"></div>
        <div id="result-votes"></div>
        <div id="result-guesses"></div>
        <div id="result-scores"></div>
        <button id="btn-next-round" style="display:none;">下一局</button>
      </div>
      <div id="offline-banner" style="display:none;"></div>
      <button id="btn-create-room"></button>
      <button id="btn-join-room"></button>
      <input id="input-create-name" />
      <input id="input-join-name" />
      <input id="input-room-id" />
      <p id="join-error"></p>
    `;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('subscribeRoomState calls onRoomStateChange with roomId', async () => {
    const { onRoomStateChange } = await import('../../roomService.js');
    const { subscribeRoomState } = await import('../main.js');

    subscribeRoomState('ROOM123');
    expect(onRoomStateChange).toHaveBeenCalledWith('ROOM123', expect.any(Function));
  });

  it('WAITING state shows screen-waiting', async () => {
    const { subscribeRoomState } = await import('../main.js');
    subscribeRoomState('ROOM123');
    stateCallback('WAITING');

    const screen = document.getElementById('screen-waiting');
    expect(screen.style.display).toBe('block');
    expect(screen.classList.contains('active')).toBe(true);
  });

  it('ASSIGN state shows screen-assign', async () => {
    const { subscribeRoomState } = await import('../main.js');
    subscribeRoomState('ROOM123');
    stateCallback('ASSIGN');

    const screen = document.getElementById('screen-assign');
    expect(screen.style.display).toBe('block');
    expect(screen.classList.contains('active')).toBe(true);
  });

  it('SPEAK state shows screen-speak', async () => {
    const { subscribeRoomState } = await import('../main.js');
    subscribeRoomState('ROOM123');
    stateCallback('SPEAK');

    const screen = document.getElementById('screen-speak');
    expect(screen.style.display).toBe('block');
    expect(screen.classList.contains('active')).toBe(true);
  });

  it('VOTE state shows screen-vote', async () => {
    const { subscribeRoomState } = await import('../main.js');
    subscribeRoomState('ROOM123');
    stateCallback('VOTE');

    const screen = document.getElementById('screen-vote');
    expect(screen.style.display).toBe('block');
    expect(screen.classList.contains('active')).toBe(true);
  });

  it('RESULT state shows screen-result', async () => {
    const { subscribeRoomState } = await import('../main.js');
    subscribeRoomState('ROOM123');
    stateCallback('RESULT');

    const screen = document.getElementById('screen-result');
    expect(screen.style.display).toBe('block');
    expect(screen.classList.contains('active')).toBe(true);
  });

  it('ENDED state shows alert and returns to home screen', async () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const { subscribeRoomState } = await import('../main.js');

    sessionStorage.setItem('roomId', 'ROOM123');
    sessionStorage.setItem('playerId', 'player1');
    sessionStorage.setItem('playerName', 'Alice');

    subscribeRoomState('ROOM123');
    stateCallback('ENDED');

    expect(alertMock).toHaveBeenCalledWith('主持人已離開房間');

    const homeScreen = document.getElementById('screen-home');
    expect(homeScreen.style.display).toBe('block');
    expect(homeScreen.classList.contains('active')).toBe(true);

    expect(sessionStorage.getItem('roomId')).toBeNull();
    expect(sessionStorage.getItem('playerId')).toBeNull();
    expect(sessionStorage.getItem('playerName')).toBeNull();

    alertMock.mockRestore();
  });

  it('ENDED state unsubscribes from state listener', async () => {
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    const { onRoomStateChange } = await import('../../roomService.js');
    const { subscribeRoomState } = await import('../main.js');

    subscribeRoomState('ROOM123');
    const unsubscribe = onRoomStateChange.mock.results[onRoomStateChange.mock.results.length - 1].value;

    stateCallback('ENDED');
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('null state does not change screen', async () => {
    const { subscribeRoomState } = await import('../main.js');
    subscribeRoomState('ROOM123');

    const homeScreen = document.getElementById('screen-home');
    homeScreen.style.display = 'block';
    homeScreen.classList.add('active');

    stateCallback(null);
    expect(homeScreen.style.display).toBe('block');
  });

  it('subscribing again unsubscribes previous listener', async () => {
    const { onRoomStateChange } = await import('../../roomService.js');
    const { subscribeRoomState } = await import('../main.js');

    subscribeRoomState('ROOM1');
    const firstUnsubscribe = onRoomStateChange.mock.results[onRoomStateChange.mock.results.length - 1].value;

    subscribeRoomState('ROOM2');
    expect(firstUnsubscribe).toHaveBeenCalled();
  });
});
