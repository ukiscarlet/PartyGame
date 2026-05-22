import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { assignRoles, selectQuestion, assignPrompts, calculateScores, canStartGame, advanceSpeaker, getVoteOptions } from '../game.js';

describe('assignRoles', () => {
  it('liars count follows ratio rule', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1 }), { minLength: 2, maxLength: 20 }).filter(
          arr => new Set(arr).size === arr.length
        ),
        (players) => {
          const { liars, blinds } = assignRoles(players);
          const expectedLiars = Math.max(1, Math.floor(players.length / 4));
          if (liars.length !== expectedLiars) return false;
          if (liars.length + blinds.length !== players.length) return false;
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('selectQuestion', () => {
  const bank = [{ answer: 'a', prompts: ['x'] }, { answer: 'b', prompts: ['y'] }];
  it('selects unused', () => { expect(selectQuestion(bank, [])).not.toBeNull(); });
  it('returns null when exhausted', () => { expect(selectQuestion(bank, ['a','b'])).toBeNull(); });
});

describe('assignPrompts', () => {
  it('assigns prompts', () => {
    const r = assignPrompts(['p1','p2'], ['a','b']);
    expect(r.get('p1')).toBe('a');
    expect(r.get('p2')).toBe('b');
  });
  it('cycles', () => {
    const r = assignPrompts(['p1','p2','p3'], ['a','b']);
    expect(r.get('p3')).toBe('a');
  });
});

describe('calculateScores', () => {
  it('blind voting liar gets point', () => {
    const s = calculateScores({b1:'l1'}, ['l1'], {b1:'x'}, {l1:'z'});
    expect(s.get('b1')).toBe(1);
  });
  it('liar match gets point', () => {
    const s = calculateScores({}, ['l1'], {b1:'apple'}, {l1:'apple'});
    expect(s.get('l1')).toBe(1);
  });
});

describe('canStartGame', () => {
  it('>= 2 true', () => { expect(canStartGame(2)).toBe(true); });
  it('< 2 false', () => { expect(canStartGame(1)).toBe(false); });
});

describe('advanceSpeaker', () => {
  it('next', () => { expect(advanceSpeaker(0, ['a','b'])).toBe(1); });
  it('null at end', () => { expect(advanceSpeaker(1, ['a','b'])).toBeNull(); });
});

describe('getVoteOptions', () => {
  it('excludes self', () => { expect(getVoteOptions(['p1','p2','p3'], 'p2')).toEqual(['p1','p3']); });
});
