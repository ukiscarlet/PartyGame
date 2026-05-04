/**
 * 遊戲邏輯引擎測試：assignRoles 屬性測試
 *
 * 需求：3.1、3.3
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { assignRoles, selectQuestion, assignPrompts, calculateScores, canStartGame, advanceSpeaker, getVoteOptions } from '../game.js';

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


describe('selectQuestion', () => {
  const questionBank = [
    { answer: '蘋果', prompts: ['紅色', '水果'] },
    { answer: '香蕉', prompts: ['黃色', '彎的'] },
    { answer: '西瓜', prompts: ['綠色', '大顆'] },
  ];

  it('從未使用的題目中選取一題', () => {
    // 需求：3.2、7.3
    const result = selectQuestion(questionBank, []);
    expect(result).not.toBeNull();
    expect(questionBank).toContainEqual(result);
  });

  it('不會選取已使用的題目', () => {
    // 需求：3.2、7.3
    const usedQuestions = ['蘋果', '香蕉'];
    const result = selectQuestion(questionBank, usedQuestions);
    expect(result).not.toBeNull();
    expect(result.answer).toBe('西瓜');
  });

  it('所有題目均已使用時回傳 null', () => {
    // 需求：7.4
    const usedQuestions = ['蘋果', '香蕉', '西瓜'];
    const result = selectQuestion(questionBank, usedQuestions);
    expect(result).toBeNull();
  });

  it('空題庫回傳 null', () => {
    const result = selectQuestion([], []);
    expect(result).toBeNull();
  });

  it('usedQuestions 中有不存在於題庫的答案時不影響選取', () => {
    const result = selectQuestion(questionBank, ['不存在的答案']);
    expect(result).not.toBeNull();
    expect(questionBank).toContainEqual(result);
  });
});


describe('assignPrompts', () => {
  it('每位瞎子都獲得一個提示詞', () => {
    // 需求：3.4
    const blindPlayers = ['p1', 'p2', 'p3'];
    const prompts = ['紅色', '圓形', '甜的'];
    const result = assignPrompts(blindPlayers, prompts);

    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(3);
    expect(result.get('p1')).toBe('紅色');
    expect(result.get('p2')).toBe('圓形');
    expect(result.get('p3')).toBe('甜的');
  });

  it('提示詞不足時循環分配', () => {
    // 需求：3.5
    const blindPlayers = ['p1', 'p2', 'p3', 'p4', 'p5'];
    const prompts = ['紅色', '圓形'];
    const result = assignPrompts(blindPlayers, prompts);

    expect(result.size).toBe(5);
    expect(result.get('p1')).toBe('紅色');
    expect(result.get('p2')).toBe('圓形');
    expect(result.get('p3')).toBe('紅色');  // 循環回第一個
    expect(result.get('p4')).toBe('圓形');  // 循環回第二個
    expect(result.get('p5')).toBe('紅色');  // 再次循環
  });

  it('只有一個提示詞時所有瞎子獲得相同提示詞', () => {
    // 需求：3.5
    const blindPlayers = ['p1', 'p2', 'p3'];
    const prompts = ['唯一提示'];
    const result = assignPrompts(blindPlayers, prompts);

    expect(result.size).toBe(3);
    for (const [, prompt] of result) {
      expect(prompt).toBe('唯一提示');
    }
  });

  it('只有一位瞎子時正確分配', () => {
    // 需求：3.4
    const blindPlayers = ['p1'];
    const prompts = ['紅色', '圓形', '甜的'];
    const result = assignPrompts(blindPlayers, prompts);

    expect(result.size).toBe(1);
    expect(result.get('p1')).toBe('紅色');
  });

  it('提示詞數量等於瞎子人數時一對一分配', () => {
    // 需求：3.4
    const blindPlayers = ['p1', 'p2'];
    const prompts = ['紅色', '圓形'];
    const result = assignPrompts(blindPlayers, prompts);

    expect(result.size).toBe(2);
    expect(result.get('p1')).toBe('紅色');
    expect(result.get('p2')).toBe('圓形');
  });
});


describe('calculateScores', () => {
  it('瞎子投票給騙子得 1 分', () => {
    // 需求：6.3
    const votes = { blind1: 'liar1', blind2: 'liar1' };
    const liars = ['liar1'];
    const answerGuesses = { blind1: '蘋果', blind2: '香蕉' };
    const liarGuesses = { liar1: '西瓜' };

    const scores = calculateScores(votes, liars, answerGuesses, liarGuesses);

    expect(scores).toBeInstanceOf(Map);
    expect(scores.get('blind1')).toBe(1);
    expect(scores.get('blind2')).toBe(1);
  });

  it('瞎子投票給非騙子得 0 分', () => {
    // 需求：6.4
    const votes = { blind1: 'blind2' };
    const liars = ['liar1'];
    const answerGuesses = { blind1: '蘋果' };
    const liarGuesses = { liar1: '西瓜' };

    const scores = calculateScores(votes, liars, answerGuesses, liarGuesses);

    expect(scores.has('blind1')).toBe(false);
  });

  it('騙子預想答案與瞎子猜測完全相符時得 1 分', () => {
    // 需求：6.5
    const votes = { blind1: 'blind2' };
    const liars = ['liar1'];
    const answerGuesses = { blind1: '蘋果', blind2: '蘋果' };
    const liarGuesses = { liar1: '蘋果' };

    const scores = calculateScores(votes, liars, answerGuesses, liarGuesses);

    expect(scores.get('liar1')).toBe(1);
  });

  it('騙子預想答案與瞎子猜測不相符時不得分', () => {
    // 需求：6.5
    const votes = { blind1: 'liar1' };
    const liars = ['liar1'];
    const answerGuesses = { blind1: '蘋果' };
    const liarGuesses = { liar1: '香蕉' };

    const scores = calculateScores(votes, liars, answerGuesses, liarGuesses);

    expect(scores.has('liar1')).toBe(false);
  });

  it('字串比對區分大小寫與空白', () => {
    // 需求：6.5
    const votes = {};
    const liars = ['liar1', 'liar2'];
    const answerGuesses = { blind1: 'Apple' };
    const liarGuesses = { liar1: 'apple', liar2: 'Apple ' };

    const scores = calculateScores(votes, liars, answerGuesses, liarGuesses);

    // 'apple' !== 'Apple'，'Apple ' !== 'Apple'
    expect(scores.has('liar1')).toBe(false);
    expect(scores.has('liar2')).toBe(false);
  });

  it('多位騙子各自獨立計分', () => {
    // 需求：6.5
    const votes = { blind1: 'liar1', blind2: 'liar2' };
    const liars = ['liar1', 'liar2'];
    const answerGuesses = { blind1: '蘋果', blind2: '香蕉' };
    const liarGuesses = { liar1: '蘋果', liar2: '西瓜' };

    const scores = calculateScores(votes, liars, answerGuesses, liarGuesses);

    // blind1 投票給 liar1（騙子）→ +1
    expect(scores.get('blind1')).toBe(1);
    // blind2 投票給 liar2（騙子）→ +1
    expect(scores.get('blind2')).toBe(1);
    // liar1 預想 '蘋果' 與 blind1 猜測 '蘋果' 相符 → +1
    expect(scores.get('liar1')).toBe(1);
    // liar2 預想 '西瓜' 無人猜中 → 不得分
    expect(scores.has('liar2')).toBe(false);
  });

  it('無人投票時回傳空 Map', () => {
    const votes = {};
    const liars = ['liar1'];
    const answerGuesses = {};
    const liarGuesses = {};

    const scores = calculateScores(votes, liars, answerGuesses, liarGuesses);

    expect(scores).toBeInstanceOf(Map);
    expect(scores.size).toBe(0);
  });

  it('騙子的投票不計入瞎子投票計分', () => {
    // 騙子投票給另一個騙子，不應得分
    const votes = { liar1: 'liar2' };
    const liars = ['liar1', 'liar2'];
    const answerGuesses = {};
    const liarGuesses = { liar1: '蘋果', liar2: '香蕉' };

    const scores = calculateScores(votes, liars, answerGuesses, liarGuesses);

    // liar1 是騙子，投票不計入瞎子投票計分
    expect(scores.has('liar1')).toBe(false);
  });

  it('騙子未提交預想答案時不計猜答分', () => {
    const votes = { blind1: 'liar1' };
    const liars = ['liar1'];
    const answerGuesses = { blind1: '蘋果' };
    const liarGuesses = {};

    const scores = calculateScores(votes, liars, answerGuesses, liarGuesses);

    expect(scores.get('blind1')).toBe(1);
    expect(scores.has('liar1')).toBe(false);
  });
});


describe('canStartGame', () => {
  it('玩家人數 >= 2 時回傳 true', () => {
    // 需求：2.5
    expect(canStartGame(2)).toBe(true);
    expect(canStartGame(3)).toBe(true);
    expect(canStartGame(10)).toBe(true);
  });

  it('玩家人數 < 2 時回傳 false', () => {
    // 需求：2.5
    expect(canStartGame(0)).toBe(false);
    expect(canStartGame(1)).toBe(false);
  });

  it('邊界值：恰好 2 人時回傳 true', () => {
    // 需求：2.5
    expect(canStartGame(2)).toBe(true);
  });

  it('邊界值：恰好 1 人時回傳 false', () => {
    // 需求：2.5
    expect(canStartGame(1)).toBe(false);
  });
});

describe('advanceSpeaker', () => {
  it('回傳下一個 speakerIndex', () => {
    // 需求：4.4
    const speakerOrder = ['p1', 'p2', 'p3'];
    expect(advanceSpeaker(0, speakerOrder)).toBe(1);
    expect(advanceSpeaker(1, speakerOrder)).toBe(2);
  });

  it('已到最後一位時回傳 null', () => {
    // 需求：4.5
    const speakerOrder = ['p1', 'p2', 'p3'];
    expect(advanceSpeaker(2, speakerOrder)).toBeNull();
  });

  it('只有一位玩家時，第一次即回傳 null', () => {
    // 需求：4.5
    const speakerOrder = ['p1'];
    expect(advanceSpeaker(0, speakerOrder)).toBeNull();
  });

  it('兩位玩家時正確推進', () => {
    // 需求：4.4、4.5
    const speakerOrder = ['p1', 'p2'];
    expect(advanceSpeaker(0, speakerOrder)).toBe(1);
    expect(advanceSpeaker(1, speakerOrder)).toBeNull();
  });
});

describe('getVoteOptions', () => {
  it('排除自己，回傳其他玩家', () => {
    // 需求：5.3
    const players = ['p1', 'p2', 'p3', 'p4'];
    const result = getVoteOptions(players, 'p2');

    expect(result).toEqual(['p1', 'p3', 'p4']);
    expect(result).not.toContain('p2');
  });

  it('自己是唯一玩家時回傳空陣列', () => {
    // 需求：5.3
    const players = ['p1'];
    const result = getVoteOptions(players, 'p1');

    expect(result).toEqual([]);
  });

  it('兩位玩家時回傳另一位', () => {
    // 需求：5.3
    const players = ['p1', 'p2'];
    const result = getVoteOptions(players, 'p1');

    expect(result).toEqual(['p2']);
  });

  it('selfId 不在玩家列表中時回傳全部玩家', () => {
    // 需求：5.3
    const players = ['p1', 'p2', 'p3'];
    const result = getVoteOptions(players, 'p999');

    expect(result).toEqual(['p1', 'p2', 'p3']);
  });

  it('不修改原始玩家陣列', () => {
    // 需求：5.3
    const players = ['p1', 'p2', 'p3'];
    const original = [...players];
    getVoteOptions(players, 'p2');

    expect(players).toEqual(original);
  });

  it('空玩家列表回傳空陣列', () => {
    // 需求：5.3
    const result = getVoteOptions([], 'p1');

    expect(result).toEqual([]);
  });
});
