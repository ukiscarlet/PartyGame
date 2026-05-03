/**
 * 煙霧測試：確認測試環境正常運作
 */
import { describe, it, expect } from 'vitest';

describe('開發環境', () => {
  it('Vitest 可正常執行', () => {
    expect(1 + 1).toBe(2);
  });

  it('jsdom 環境可用', () => {
    const div = document.createElement('div');
    div.id = 'test';
    expect(div.id).toBe('test');
  });
});
