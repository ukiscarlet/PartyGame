/**
 * src/questionBank.js — 題庫載入器
 *
 * 需求：7.1、7.2
 */

export class QuestionBankError extends Error {
  constructor(message) {
    super(message);
    this.name = 'QuestionBankError';
  }
}

/**
 * 從指定 URL 載入題庫 JSON。
 * @param {string} url
 * @returns {Promise<Array<{ answer: string, prompts: string[] }>>}
 * @throws {QuestionBankError} 格式不符或 HTTP 錯誤時拋出
 */
export async function loadQuestions(url) {
  let response;
  try {
    response = await fetch(url);
  } catch (err) {
    const msg = `無法載入題庫：網路錯誤 — ${err.message}`;
    console.error(msg);
    throw new QuestionBankError(msg);
  }

  if (!response.ok) {
    const msg = `無法載入題庫：HTTP ${response.status}`;
    console.error(msg);
    throw new QuestionBankError(msg);
  }

  let data;
  try {
    data = await response.json();
  } catch (err) {
    const msg = `無法載入題庫：JSON 解析失敗 — ${err.message}`;
    console.error(msg);
    throw new QuestionBankError(msg);
  }

  // 根層級必須為陣列
  if (!Array.isArray(data)) {
    const msg = '題庫格式錯誤：根層級應為陣列';
    console.error(msg);
    throw new QuestionBankError(msg);
  }

  // 驗證每一筆題目
  for (let i = 0; i < data.length; i++) {
    const item = data[i];

    if (typeof item !== 'object' || item === null) {
      const msg = `題庫格式錯誤：第 ${i} 筆資料不是物件`;
      console.error(msg);
      throw new QuestionBankError(msg);
    }

    if (typeof item.answer !== 'string') {
      const msg = `題庫格式錯誤：第 ${i} 筆資料缺少有效的 answer 欄位（應為字串）`;
      console.error(msg);
      throw new QuestionBankError(msg);
    }

    if (!Array.isArray(item.prompts)) {
      const msg = `題庫格式錯誤：第 ${i} 筆資料缺少有效的 prompts 欄位（應為陣列）`;
      console.error(msg);
      throw new QuestionBankError(msg);
    }

    for (let j = 0; j < item.prompts.length; j++) {
      if (typeof item.prompts[j] !== 'string') {
        const msg = `題庫格式錯誤：第 ${i} 筆資料的 prompts[${j}] 不是字串`;
        console.error(msg);
        throw new QuestionBankError(msg);
      }
    }
  }

  return data;
}
