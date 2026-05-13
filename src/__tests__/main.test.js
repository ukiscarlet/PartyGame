/**
 * src/__tests__/main.test.js
 *
 * Unit tests for state machine listener and screen routing (Task 8.2).
 * Requirements: 1.6, 8.2
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock firebase.js
vi.mock('../firebase.js', () => {
  let stateCallback = null;
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
      return vi.fn(); // unsubscribe
    }),
    onRoundDataChange: vi.fn((roomId, callback) => {
      return vi.fn(); // unsubscribe
    }),
    setRoomState: vi.fn(() => Promise.resolve(undefined)),
    writeRoundData: vi.fn(() => Promise.resolve(undefined)),
    updateSpeakerIndex: vi.fn(() => Promise.resolve(undefined)),
    getHostId: vi.fn(() => Promise.resolve(null)),
    getPlayerName: vi.fn(() => Promise.resolve('TestPlayer')),
    db: {},
    __triggerStateChange: (state) => {
      if (stateCallback) stateCallback(state);
    },
    __getStateCallback: () => stateCallback,
  };
});

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
}));

describe('State Machine Routing (Task 8.2)', () => {
  let showScreenMock;

  beforeEach(() => {
    // Set up DOM with all screen divs
    document.body.innerHTML = `
      <div id="screen-home" class="screen active" style="display:block;"></div>
      <div id="screen-waiting" class="screen" style="display:none;">
        <strong id="waiting-room-id"></strong>
        <ul id="waiting-player-list"></ul>
        <p id="waiting-min-players-msg" class="info-msg"></p>
        <button id="btn-start-game" style="display:none;">開始遊戲</button>
      </div>
      <div id="screen-assign" class="screen" style="display:none;"></div>
      <div id="screen-speak" class="screen" style="display:none;">
        <strong id="speak-current-player"></strong>
        <div id="speak-self-info"></div>
        <button id="btn-next-speaker" style="display:none;">下一位</button>
      </div>
      <div id="screen-vote" class="screen" style="display:none;"></div>
      <div id="screen-result" class="screen" style="display:none;"></div>
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
    const { onRoomStateChange } = await import('../firebase.js');
    const { subscribeRoomState } = await import('../main.js');

    subscribeRoomState('ROOM123');

    expect(onRoomStateChange).toHaveBeenCalledWith('ROOM123', expect.any(Function));
  });

  it('WAITING state shows screen-waiting', async () => {
    const { __triggerStateChange } = await import('../firebase.js');
    const { subscribeRoomState } = await import('../main.js');

    subscribeRoomState('ROOM123');
    __triggerStateChange('WAITING');

    const waitingScreen = document.getElementById('screen-waiting');
    expect(waitingScreen.style.display).toBe('block');
    expect(waitingScreen.classList.contains('active')).toBe(true);
  });

  it('ASSIGN state shows screen-assign', async () => {
    const { __triggerStateChange } = await import('../firebase.js');
    const { subscribeRoomState } = await import('../main.js');

    subscribeRoomState('ROOM123');
    __triggerStateChange('ASSIGN');

    const assignScreen = document.getElementById('screen-assign');
    expect(assignScreen.style.display).toBe('block');
    expect(assignScreen.classList.contains('active')).toBe(true);
  });

  it('SPEAK state shows screen-speak', async () => {
    const { __triggerStateChange } = await import('../firebase.js');
    const { subscribeRoomState } = await import('../main.js');

    subscribeRoomState('ROOM123');
    __triggerStateChange('SPEAK');

    const speakScreen = document.getElementById('screen-speak');
    expect(speakScreen.style.display).toBe('block');
    expect(speakScreen.classList.contains('active')).toBe(true);
  });

  it('VOTE state shows screen-vote', async () => {
    const { __triggerStateChange } = await import('../firebase.js');
    const { subscribeRoomState } = await import('../main.js');

    subscribeRoomState('ROOM123');
    __triggerStateChange('VOTE');

    const voteScreen = document.getElementById('screen-vote');
    expect(voteScreen.style.display).toBe('block');
    expect(voteScreen.classList.contains('active')).toBe(true);
  });

  it('RESULT state shows screen-result', async () => {
    const { __triggerStateChange } = await import('../firebase.js');
    const { subscribeRoomState } = await import('../main.js');

    subscribeRoomState('ROOM123');
    __triggerStateChange('RESULT');

    const resultScreen = document.getElementById('screen-result');
    expect(resultScreen.style.display).toBe('block');
    expect(resultScreen.classList.contains('active')).toBe(true);
  });

  it('ENDED state shows alert and returns to home screen', async () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const { __triggerStateChange } = await import('../firebase.js');
    const { subscribeRoomState } = await import('../main.js');

    // Set session data
    sessionStorage.setItem('roomId', 'ROOM123');
    sessionStorage.setItem('playerId', 'player1');
    sessionStorage.setItem('playerName', 'Alice');

    subscribeRoomState('ROOM123');
    __triggerStateChange('ENDED');

    // Should show alert
    expect(alertMock).toHaveBeenCalledWith('主持人已離開房間');

    // Should return to home screen
    const homeScreen = document.getElementById('screen-home');
    expect(homeScreen.style.display).toBe('block');
    expect(homeScreen.classList.contains('active')).toBe(true);

    // Should clear session
    expect(sessionStorage.getItem('roomId')).toBeNull();
    expect(sessionStorage.getItem('playerId')).toBeNull();
    expect(sessionStorage.getItem('playerName')).toBeNull();

    alertMock.mockRestore();
  });

  it('ENDED state unsubscribes from state listener', async () => {
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    const { onRoomStateChange, __triggerStateChange } = await import('../firebase.js');
    const { subscribeRoomState } = await import('../main.js');

    subscribeRoomState('ROOM123');
    const unsubscribe = onRoomStateChange.mock.results[onRoomStateChange.mock.results.length - 1].value;

    __triggerStateChange('ENDED');

    expect(unsubscribe).toHaveBeenCalled();
  });

  it('null state does not change screen', async () => {
    const { __triggerStateChange } = await import('../firebase.js');
    const { subscribeRoomState } = await import('../main.js');

    subscribeRoomState('ROOM123');

    // Home screen is active initially
    const homeScreen = document.getElementById('screen-home');
    homeScreen.style.display = 'block';
    homeScreen.classList.add('active');

    __triggerStateChange(null);

    // Home screen should still be active (no change)
    expect(homeScreen.style.display).toBe('block');
  });

  it('subscribing again unsubscribes previous listener', async () => {
    const { onRoomStateChange } = await import('../firebase.js');
    const { subscribeRoomState } = await import('../main.js');

    subscribeRoomState('ROOM1');
    const firstUnsubscribe = onRoomStateChange.mock.results[onRoomStateChange.mock.results.length - 1].value;

    subscribeRoomState('ROOM2');

    expect(firstUnsubscribe).toHaveBeenCalled();
  });
});
