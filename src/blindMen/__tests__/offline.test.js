/**
 * 離線偵測測試
 *
 * 需求：1.6、8.3
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Firebase modules
vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({})),
}));

vi.mock('firebase/database', () => {
  const mockOnDisconnect = {
    set: vi.fn(() => Promise.resolve()),
  };

  return {
    getDatabase: vi.fn(() => ({})),
    ref: vi.fn((db, path) => ({ path })),
    set: vi.fn(() => Promise.resolve()),
    get: vi.fn(() => Promise.resolve({ exists: () => false, val: () => null })),
    push: vi.fn(() => ({ key: 'mock-key' })),
    remove: vi.fn(() => Promise.resolve()),
    onValue: vi.fn((ref, callback) => {
      // Store callback for testing
      if (ref.path === '.info/connected') {
        mockOnValueCallbacks.push(callback);
      }
      return vi.fn();
    }),
    off: vi.fn(),
    onDisconnect: vi.fn(() => mockOnDisconnect),
  };
});

// Store onValue callbacks for .info/connected
const mockOnValueCallbacks = [];

import { onDisconnect, ref, onValue, off } from 'firebase/database';
import { setupDisconnectHandlers, monitorConnection, initFirebase } from '../../roomService.js';

beforeEach(() => {
  vi.clearAllMocks();
  mockOnValueCallbacks.length = 0;
});

describe('setupDisconnectHandlers', () => {
  beforeEach(() => {
    initFirebase();
  });

  it('設定玩家離線時 connected 為 false', () => {
    // 需求：8.3
    setupDisconnectHandlers('ROOM01', 'player1', false);

    // Should call ref for the player's connected path
    expect(ref).toHaveBeenCalledWith(expect.anything(), 'rooms/ROOM01/players/player1/connected');

    // Should call onDisconnect and set false
    expect(onDisconnect).toHaveBeenCalled();
    const mockDisconnect = onDisconnect.mock.results[0].value;
    expect(mockDisconnect.set).toHaveBeenCalledWith(false);
  });

  it('主持人離線時設定房間 state 為 ENDED', () => {
    // 需求：1.6
    setupDisconnectHandlers('ROOM01', 'host1', true);

    // Should call onDisconnect twice: once for connected, once for state
    expect(onDisconnect).toHaveBeenCalledTimes(2);

    // First call: player connected = false
    const firstDisconnect = onDisconnect.mock.results[0].value;
    expect(firstDisconnect.set).toHaveBeenCalledWith(false);

    // Second call: room state = ENDED
    const secondDisconnect = onDisconnect.mock.results[1].value;
    expect(secondDisconnect.set).toHaveBeenCalledWith('ENDED');
  });

  it('非主持人不設定房間 state 的 onDisconnect', () => {
    // 需求：1.6
    setupDisconnectHandlers('ROOM01', 'player1', false);

    // Should only call onDisconnect once (for connected)
    expect(onDisconnect).toHaveBeenCalledTimes(1);
  });
});

describe('monitorConnection', () => {
  beforeEach(() => {
    initFirebase();
  });

  it('監聽 .info/connected 路徑', () => {
    // 需求：8.3
    const callback = vi.fn();
    monitorConnection(callback);

    expect(ref).toHaveBeenCalledWith(expect.anything(), '.info/connected');
    expect(onValue).toHaveBeenCalled();
  });

  it('連線時回呼 true', () => {
    // 需求：8.3
    const callback = vi.fn();
    monitorConnection(callback);

    // Simulate Firebase calling back with connected = true
    const onValueCallback = mockOnValueCallbacks[0];
    onValueCallback({ val: () => true });

    expect(callback).toHaveBeenCalledWith(true);
  });

  it('斷線時回呼 false', () => {
    // 需求：8.3
    const callback = vi.fn();
    monitorConnection(callback);

    // Simulate Firebase calling back with connected = false
    const onValueCallback = mockOnValueCallbacks[0];
    onValueCallback({ val: () => false });

    expect(callback).toHaveBeenCalledWith(false);
  });

  it('回傳取消監聽函式', () => {
    // 需求：8.3
    const callback = vi.fn();
    const unsubscribe = monitorConnection(callback);

    expect(typeof unsubscribe).toBe('function');

    // Calling unsubscribe should invoke the function returned by onValue
    unsubscribe();
    // The unsubscribe function returned by onValue mock is a vi.fn()
    const onValueReturnedFn = onValue.mock.results[onValue.mock.results.length - 1].value;
    expect(onValueReturnedFn).toHaveBeenCalled();
  });
});
