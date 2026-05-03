/**
 * 遊戲邏輯引擎測試：assignRoles 屬性測試
 *
 * 需求：3.1、3.3
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { assignRoles } from '../game.js';

describe('assignRoles', () => {
  it('騙子數量符合比例規則', () => {
    // Feature: blind-elephant-game, Property 6: 騙子數量符合比例規則
    // Validates: Requirements 3.1, 3.3
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1 }), { minLength: 2, maxLength: 20 }).filter(
          arr => new Set(arr).size === arr.length // 確保玩家 ID 唯一
        ),
        (players) => {
          const { liars, blinds } = assignRoles(players);
          const expectedLiars = Math.max(1, Math.floor(players.length / 4));

          // 騙子數量符合比例規則
          if (liars.length !== expectedLiars) return false;

          // 騙子 + 瞎子 = 全部玩家
          if (liars.length + blinds.length !== players.length) return false;

          // 所有玩家 ID 恰好出現一次（在 liars 或 blinds 中）
          const allAssigned = [...liars, ...blinds].sort();
          const allPlayers = [...players].sort();
          if (JSON.stringify(allAssigned) !== JSON.stringify(allPlayers)) return false;

          // 沒有玩家同時出現在 liars 和 blinds 中
          const liarSet = new Set(liars);
          if (blinds.some(id => liarSet.has(id))) return false;

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
