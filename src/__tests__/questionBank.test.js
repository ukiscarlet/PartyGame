/**
 * 單元測試：loadQuestions 格式驗證與邊界條件
 *
 * 需求：7.1、7.2
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadQuestions, QuestionBankError } from '../questionBank.js';

// 建立一個模擬 fetch 回應的輔助函式
function mockFetch(body, { ok = true, status = 200 } = {}) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(body),
  });
}

// 建立一個模擬 fetch 回傳 JSON 解析失敗的輔助函式
function mockFetchBadJson() {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.reject(new SyntaxError('Unexpected token')),
  });
}

// 建立一個模擬 fetch 網路錯誤的輔助函式
function mockFetchNetworkError(message = 'Failed to fetch') {
  return vi.fn().mockRejectedValue(new TypeError(message));
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('loadQuestions', () => {
  describe('成功載入', () => {
    it('格式正確的 JSON 應成功載入並回傳陣列', async () => {
      const questions = [
        { answer: '蘋果', prompts: ['紅色', '圓形', '水果'] },
        { answer: '香蕉', prompts: ['黃色', '彎曲'] },
      ];
      vi.stubGlobal('fetch', mockFetch(questions));

      const result = await loadQuestions('http://example.com/questions.json');

      expect(result).toEqual(questions);
      expect(result).toHaveLength(2);
    });

    it('空陣列應視為有效格式並成功載入', async () => {
      vi.stubGlobal('fetch', mockFetch([]));

      const result = await loadQuestions('http://example.com/questions.json');

      expect(result).toEqual([]);
      expect(Array.isArray(result)).toBe(true);
    });

    it('單一題目的陣列應成功載入', async () => {
      const questions = [{ answer: '貓', prompts: ['毛茸茸', '會喵喵叫'] }];
      vi.stubGlobal('fetch', mockFetch(questions));

      const result = await loadQuestions('http://example.com/questions.json');

      expect(result).toEqual(questions);
    });

    it('prompts 為空陣列的題目應成功載入', async () => {
      const questions = [{ answer: '謎題', prompts: [] }];
      vi.stubGlobal('fetch', mockFetch(questions));

      const result = await loadQuestions('http://example.com/questions.json');

      expect(result).toEqual(questions);
    });
  });

  describe('HTTP 錯誤', () => {
    it('HTTP 404 應拋出 QuestionBankError', async () => {
      vi.stubGlobal('fetch', mockFetch(null, { ok: false, status: 404 }));

      await expect(loadQuestions('http://example.com/questions.json'))
        .rejects.toThrow(QuestionBankError);
    });

    it('HTTP 500 應拋出 QuestionBankError 且訊息包含狀態碼', async () => {
      vi.stubGlobal('fetch', mockFetch(null, { ok: false, status: 500 }));

      await expect(loadQuestions('http://example.com/questions.json'))
        .rejects.toThrow('500');
    });

    it('網路錯誤應拋出 QuestionBankError', async () => {
      vi.stubGlobal('fetch', mockFetchNetworkError('Failed to fetch'));

      await expect(loadQuestions('http://example.com/questions.json'))
        .rejects.toThrow(QuestionBankError);
    });
  });

  describe('格式驗證錯誤', () => {
    it('根層級為物件（非陣列）應拋出 QuestionBankError', async () => {
      vi.stubGlobal('fetch', mockFetch({ answer: '蘋果', prompts: [] }));

      await expect(loadQuestions('http://example.com/questions.json'))
        .rejects.toThrow(QuestionBankError);
    });

    it('根層級為字串應拋出 QuestionBankError', async () => {
      vi.stubGlobal('fetch', mockFetch('invalid'));

      await expect(loadQuestions('http://example.com/questions.json'))
        .rejects.toThrow(QuestionBankError);
    });

    it('根層級為 null 應拋出 QuestionBankError', async () => {
      vi.stubGlobal('fetch', mockFetch(null));

      await expect(loadQuestions('http://example.com/questions.json'))
        .rejects.toThrow(QuestionBankError);
    });

    it('缺少 answer 欄位應拋出 QuestionBankError', async () => {
      const questions = [{ prompts: ['提示1', '提示2'] }];
      vi.stubGlobal('fetch', mockFetch(questions));

      await expect(loadQuestions('http://example.com/questions.json'))
        .rejects.toThrow(QuestionBankError);
    });

    it('answer 為數字（非字串）應拋出 QuestionBankError', async () => {
      const questions = [{ answer: 42, prompts: ['提示'] }];
      vi.stubGlobal('fetch', mockFetch(questions));

      await expect(loadQuestions('http://example.com/questions.json'))
        .rejects.toThrow(QuestionBankError);
    });

    it('answer 為 null 應拋出 QuestionBankError', async () => {
      const questions = [{ answer: null, prompts: ['提示'] }];
      vi.stubGlobal('fetch', mockFetch(questions));

      await expect(loadQuestions('http://example.com/questions.json'))
        .rejects.toThrow(QuestionBankError);
    });

    it('缺少 prompts 欄位應拋出 QuestionBankError', async () => {
      const questions = [{ answer: '蘋果' }];
      vi.stubGlobal('fetch', mockFetch(questions));

      await expect(loadQuestions('http://example.com/questions.json'))
        .rejects.toThrow(QuestionBankError);
    });

    it('prompts 為字串（非陣列）應拋出 QuestionBankError', async () => {
      const questions = [{ answer: '蘋果', prompts: '紅色' }];
      vi.stubGlobal('fetch', mockFetch(questions));

      await expect(loadQuestions('http://example.com/questions.json'))
        .rejects.toThrow(QuestionBankError);
    });

    it('prompts 為物件（非陣列）應拋出 QuestionBankError', async () => {
      const questions = [{ answer: '蘋果', prompts: { 0: '紅色' } }];
      vi.stubGlobal('fetch', mockFetch(questions));

      await expect(loadQuestions('http://example.com/questions.json'))
        .rejects.toThrow(QuestionBankError);
    });

    it('prompts 陣列中含有非字串元素應拋出 QuestionBankError', async () => {
      const questions = [{ answer: '蘋果', prompts: ['紅色', 123] }];
      vi.stubGlobal('fetch', mockFetch(questions));

      await expect(loadQuestions('http://example.com/questions.json'))
        .rejects.toThrow(QuestionBankError);
    });

    it('陣列中第二筆格式錯誤應拋出 QuestionBankError', async () => {
      const questions = [
        { answer: '蘋果', prompts: ['紅色'] },
        { answer: '香蕉' }, // 缺少 prompts
      ];
      vi.stubGlobal('fetch', mockFetch(questions));

      await expect(loadQuestions('http://example.com/questions.json'))
        .rejects.toThrow(QuestionBankError);
    });

    it('陣列中含有非物件元素應拋出 QuestionBankError', async () => {
      const questions = [
        { answer: '蘋果', prompts: ['紅色'] },
        '不是物件',
      ];
      vi.stubGlobal('fetch', mockFetch(questions));

      await expect(loadQuestions('http://example.com/questions.json'))
        .rejects.toThrow(QuestionBankError);
    });
  });

  describe('錯誤訊息與類型', () => {
    it('拋出的錯誤應為 QuestionBankError 實例', async () => {
      const questions = [{ prompts: ['提示'] }]; // 缺少 answer
      vi.stubGlobal('fetch', mockFetch(questions));

      try {
        await loadQuestions('http://example.com/questions.json');
        expect.fail('應拋出錯誤');
      } catch (err) {
        expect(err).toBeInstanceOf(QuestionBankError);
        expect(err.name).toBe('QuestionBankError');
      }
    });

    it('格式錯誤時應在主控台輸出錯誤訊息', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const questions = [{ answer: 123, prompts: [] }];
      vi.stubGlobal('fetch', mockFetch(questions));

      await expect(loadQuestions('http://example.com/questions.json'))
        .rejects.toThrow(QuestionBankError);

      expect(consoleSpy).toHaveBeenCalled();
    });

    it('HTTP 錯誤時應在主控台輸出錯誤訊息', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.stubGlobal('fetch', mockFetch(null, { ok: false, status: 403 }));

      await expect(loadQuestions('http://example.com/questions.json'))
        .rejects.toThrow(QuestionBankError);

      expect(consoleSpy).toHaveBeenCalled();
    });
  });
});
