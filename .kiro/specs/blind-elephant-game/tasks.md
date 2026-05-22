# 實作計畫：盲人摸象（Blind Elephant Game）

## 概覽

以 Vanilla JavaScript + Firebase Realtime Database 實作多人派對遊戲。依模組職責拆分任務，從專案骨架、核心邏輯、Firebase 服務、UI 渲染，到整合串接，逐步完成。

## 任務

- [x] 1. 建立專案骨架與開發環境
  - 初始化 Vite 專案，安裝 Firebase SDK、Vitest、fast-check 依賴
  - 建立目錄結構：`src/`、`src/__tests__/`、`public/`
  - 建立 `public/questions.json` 範例題庫（至少 5 題，每題含 `answer` 與 `prompts` 陣列）
  - 建立 `index.html`，包含六個畫面 div：`#screen-home`、`#screen-waiting`、`#screen-assign`、`#screen-speak`、`#screen-vote`、`#screen-result`
  - 建立 `src/main.js` 進入點（空骨架，僅初始化 Firebase 與載入題庫）
  - 設定 `vitest.config.js`
  - _需求：7.1、8.1_

- [x] 2. 實作題庫載入器（`src/questionBank.js`）
  - [x] 2.1 實作 `loadQuestions(url)` 函式
    - fetch 指定 URL，解析 JSON，驗證格式（每筆需有 `answer: string` 與 `prompts: string[]`）
    - 格式不符時拋出 `QuestionBankError`，並在主控台輸出錯誤訊息
    - _需求：7.1、7.2_

  - [ ]* 2.2 撰寫屬性測試：`loadQuestions` 格式驗證
    - **屬性 16：題庫 JSON 格式驗證**
    - **驗證需求：7.1、7.2**

  - [ ]* 2.3 撰寫單元測試：`loadQuestions` 邊界條件
    - 測試格式正確的 JSON 成功載入
    - 測試缺少 `answer` 欄位、`prompts` 非陣列等格式錯誤情境
    - _需求：7.2_

- [ ] 3. 實作遊戲邏輯引擎（`src/game.js`）
  - [x] 3.1 實作 `assignRoles(players)` 函式
    - 依 `Math.max(1, Math.floor(n / 4))` 計算騙子數量，隨機指定騙子與瞎子
    - 回傳 `{ liars: string[], blinds: string[] }`
    - _需求：3.1、3.3_

  - [ ]* 3.2 撰寫屬性測試：`assignRoles` 騙子比例
    - **屬性 6：騙子數量符合比例規則**
    - **驗證需求：3.1、3.3**

  - [x] 3.3 實作 `selectQuestion(questionBank, usedQuestions)` 函式
    - 從題庫中隨機選取未使用的題目，若全部已用則回傳 `null`
    - _需求：3.2、7.3、7.4_

  - [ ]* 3.4 撰寫屬性測試：`selectQuestion` 不重複選題
    - **屬性 7：題目選取不重複**
    - **驗證需求：3.2、7.3**

  - [x] 3.5 實作 `assignPrompts(blindPlayers, prompts)` 函式
    - 循環分配提示詞，確保每位瞎子都獲得一個提示詞
    - 回傳 `Map<playerId, prompt>`
    - _需求：3.4、3.5_

  - [ ]* 3.6 撰寫屬性測試：`assignPrompts` 覆蓋所有瞎子
    - **屬性 8：提示詞分配覆蓋所有瞎子（含循環）**
    - **驗證需求：3.4、3.5_**

  - [x] 3.7 實作 `calculateScores(votes, liars, answerGuesses, liarGuesses)` 函式
    - 投票目標為騙子的瞎子得 1 分
    - 騙子的預想答案與任一瞎子猜測完全相符時，該騙子得 1 分（字串完全比對）
    - 回傳 `Map<playerId, scoreDelta>`
    - _需求：6.3、6.4、6.5_

  - [ ]* 3.8 撰寫屬性測試：`calculateScores` 投票計分正確性
    - **屬性 14：投票結果計分正確性**
    - **驗證需求：6.3、6.4**

  - [ ]* 3.9 撰寫屬性測試：`calculateScores` 猜答計分正確性
    - **屬性 15：猜答計分正確性（字串完全相符）**
    - **驗證需求：6.5**

  - [x] 3.10 實作 `canStartGame(playerCount)` 函式
    - 玩家人數 ≥ 2 時回傳 `true`，否則回傳 `false`
    - _需求：2.5_

  - [ ]* 3.11 撰寫屬性測試：`canStartGame` 人數門檻
    - **屬性 5：玩家人數不足時無法開始遊戲**
    - **驗證需求：2.5**

  - [x] 3.12 實作 `advanceSpeaker(speakerIndex, speakerOrder)` 函式
    - 回傳下一個 `speakerIndex`；若已到最後一位，回傳 `null`（表示應轉換至 VOTE）
    - _需求：4.4、4.5_

  - [ ]* 3.13 撰寫屬性測試：`advanceSpeaker` 索引單調遞增
    - **屬性 11：發言索引單調遞增**
    - **驗證需求：4.4、4.5**

  - [x] 3.14 實作 `getVoteOptions(players, selfId)` 函式
    - 從玩家列表中排除自己，回傳可投票的玩家陣列
    - _需求：5.3_

  - [ ]* 3.15 撰寫屬性測試：`getVoteOptions` 排除自己
    - **屬性 12：投票選項排除自己**
    - **驗證需求：5.3**

- [x] 4. 檢查點 — 確認所有測試通過
  - 確認所有測試通過，如有問題請向使用者提問。

- [ ] 5. 實作 Firebase 服務層（`src/firebase.js`）
  - [x] 5.1 實作房間管理函式
    - `createRoom(playerName)`：建立房間、產生唯一 roomId、設定 hostId、寫入玩家資料，回傳 `{ roomId, playerId }`
    - `joinRoom(roomId, playerName)`：驗證房間存在，寫入玩家資料，回傳 `{ playerId }`；房間不存在時拋出 `RoomNotFoundError`
    - `leaveRoom(roomId, playerId)`：移除玩家資料，若為主持人則將房間 state 設為 `ENDED`
    - _需求：1.1、1.2、1.3、1.4、1.5、1.6_

  - [ ]* 5.2 撰寫屬性測試：`createRoom` 建立者即為主持人
    - **屬性 4：建立者即為主持人**
    - **驗證需求：1.5**

  - [ ]* 5.3 撰寫屬性測試：`joinRoom` 加入不存在房間應回傳錯誤
    - **屬性 2：加入不存在房間應回傳錯誤**
    - **驗證需求：1.3**

  - [ ]* 5.4 撰寫屬性測試：`joinRoom` 加入後玩家資料存在
    - **屬性 3：加入房間後玩家資料存在於 Firebase**
    - **驗證需求：1.2、1.4**

  - [x] 5.5 實作狀態監聽函式
    - `onRoomStateChange(roomId, callback)`
    - `onPlayersChange(roomId, callback)`
    - `onRoundDataChange(roomId, callback)`
    - 每個函式回傳 `unsubscribe()` 取消監聽
    - _需求：8.1、8.2_

  - [x] 5.6 實作遊戲操作函式
    - `setRoomState(roomId, state)`
    - `writeRoundData(roomId, roundData)`
    - `submitVote(roomId, playerId, targetId)`：若已提交則忽略（冪等性）
    - `submitAnswerGuess(roomId, playerId, guess)`：若已提交則忽略
    - `submitLiarGuess(roomId, playerId, guess)`：若已提交則忽略
    - `updateScore(roomId, playerId, delta)`
    - _需求：5.5、5.6、5.9、6.3_

  - [ ]* 5.7 撰寫屬性測試：`submitVote` 提交冪等性
    - **屬性 13：提交冪等性**
    - **驗證需求：5.9**

  - [ ]* 5.8 撰寫屬性測試：`generateRoomId` 唯一性
    - **屬性 1：房間 ID 唯一性**
    - **驗證需求：1.1**

- [ ] 6. 實作 UI 控制器（`src/ui.js`）
  - [x] 6.1 實作畫面切換輔助函式
    - `showScreen(screenId)`：隱藏所有畫面 div，顯示指定畫面
    - _需求：8.2_

  - [x] 6.2 實作 `renderWaiting(roomId, players, isHost)`
    - 顯示房間 ID、玩家列表
    - 僅當 `isHost` 為 `true` 時顯示「開始遊戲」按鈕
    - 玩家人數 < 2 時禁用「開始遊戲」按鈕並顯示提示
    - _需求：2.1、2.2、2.3、2.5_

  - [ ]* 6.3 撰寫屬性測試：`renderWaiting` 主持人專屬按鈕
    - **屬性 10：主持人專屬按鈕控制（WAITING）**
    - **驗證需求：2.3**

  - [x] 6.4 實作 `renderAssign(role, content)`
    - 騙子顯示答案，瞎子顯示提示詞，兩者不互相洩漏
    - _需求：3.7_

  - [ ]* 6.5 撰寫屬性測試：`renderAssign` 角色資訊隔離
    - **屬性 9：角色資訊隔離**
    - **驗證需求：3.7**

  - [x] 6.6 實作 `renderSpeak(currentSpeaker, selfRole, selfContent, isHost)`
    - 顯示目前發言玩家名稱與自己的角色資訊
    - 僅當 `isHost` 為 `true` 時顯示「下一位」按鈕
    - _需求：4.1、4.2、4.3_

  - [ ]* 6.7 撰寫屬性測試：`renderSpeak` 主持人專屬按鈕
    - **屬性 10：主持人專屬按鈕控制（SPEAK）**
    - **驗證需求：4.3**

  - [x] 6.8 實作 `renderVote(players, selfRole, selfId)`
    - 瞎子顯示投票 radio button 列表（排除自己）與猜測答案輸入欄
    - 騙子顯示預想答案輸入欄
    - _需求：5.1、5.2、5.3、5.4_

  - [x] 6.9 實作 `renderResult(resultData, scores, isHost)`
    - 顯示騙子身份、每位玩家投票對象、猜答結果、累計分數
    - 僅當 `isHost` 為 `true` 時顯示「下一局」按鈕
    - _需求：6.1、6.2、6.6、6.7、6.8_

  - [ ]* 6.10 撰寫屬性測試：`renderResult` 主持人專屬按鈕
    - **屬性 10：主持人專屬按鈕控制（RESULT）**
    - **驗證需求：6.8**

- [x] 7. 檢查點 — 確認所有測試通過
  - 確認所有測試通過，如有問題請向使用者提問。

- [ ] 8. 整合串接（`src/main.js`）
  - [x] 8.1 實作首頁邏輯（`#screen-home`）
    - 建立房間：呼叫 `createRoom`，將 session 存入 `sessionStorage`，切換至等待大廳
    - 加入房間：呼叫 `joinRoom`，處理 `RoomNotFoundError` 並顯示錯誤訊息
    - _需求：1.1、1.2、1.3_

  - [x] 8.2 實作狀態機監聽與畫面路由
    - 訂閱 `onRoomStateChange`，依 state 值呼叫對應 `renderXxx` 函式並切換畫面
    - 處理 `ENDED` 狀態：顯示主持人離開提示，返回首頁
    - _需求：1.6、8.2_

  - [x] 8.3 實作 WAITING 階段互動
    - 訂閱 `onPlayersChange`，即時更新玩家列表
    - 主持人按下「開始遊戲」：呼叫 `assignRoles`、`selectQuestion`、`assignPrompts`，將結果寫入 Firebase，再呼叫 `setRoomState(roomId, 'ASSIGN')`
    - 題庫已用盡時顯示提示，禁用「開始遊戲」
    - _需求：2.1、2.2、2.3、2.4、2.5、3.1–3.6、7.4_

  - [x] 8.4 實作 SPEAK 階段互動
    - 訂閱 `onRoundDataChange`，依 `speakerIndex` 顯示目前發言玩家
    - 主持人按下「下一位」：呼叫 `advanceSpeaker`，更新 Firebase `speakerIndex`；若回傳 `null` 則呼叫 `setRoomState(roomId, 'VOTE')`
    - _需求：4.1–4.5_

  - [x] 8.5 實作 VOTE 階段互動
    - 瞎子提交：呼叫 `submitVote` 與 `submitAnswerGuess`
    - 騙子提交：呼叫 `submitLiarGuess`
    - 監聽所有玩家提交完成後，呼叫 `setRoomState(roomId, 'RESULT')`
    - _需求：5.1–5.9_

  - [x] 8.6 實作 RESULT 階段互動
    - 呼叫 `calculateScores`，批次呼叫 `updateScore` 更新各玩家分數
    - 主持人按下「下一局」：清除 `currentRound`，呼叫 `setRoomState(roomId, 'ASSIGN')`
    - _需求：6.1–6.9_

  - [x] 8.7 實作離線偵測
    - 使用 Firebase `onDisconnect` 設定主持人離線時將房間 state 設為 `ENDED`
    - 玩家離線時設定 `connected: false`，UI 顯示連線中斷 Banner
    - _需求：1.6、8.3_

- [x] 9. 最終檢查點 — 確認所有測試通過
  - 確認所有測試通過，如有問題請向使用者提問。

## 備註

- 標記 `*` 的子任務為選填，可跳過以加速 MVP 開發
- 每個任務均對應具體需求，確保可追溯性
- 屬性測試使用 fast-check，每個屬性最少執行 100 次隨機迭代
- 單元測試使用 Vitest
- Firebase 整合測試建議搭配 Firebase Local Emulator Suite 執行
