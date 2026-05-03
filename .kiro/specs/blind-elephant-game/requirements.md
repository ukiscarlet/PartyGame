# 需求文件：盲人摸象（Blind Elephant Game）

## 簡介

「盲人摸象」是一款多人派對遊戲，玩家分為「騙子」與「瞎子」兩種角色。瞎子拿到與答案相關的提示詞，騙子拿到正確答案，所有玩家輪流口頭發言，最後投票猜出誰是騙子。遊戲透過 Firebase Realtime Database 進行即時同步，支援多輪累計計分。

---

## 詞彙表

- **遊戲系統（Game_System）**：整體遊戲應用程式，負責協調所有遊戲邏輯與狀態。
- **房間（Room）**：一個獨立的遊戲場次，由唯一的房間 ID 識別。
- **主持人（Host）**：建立房間的玩家，擁有推進遊戲狀態的權限。
- **玩家（Player）**：加入房間的參與者，包含主持人。
- **騙子（Liar）**：知道正確答案的角色，目標是不被其他玩家識破。
- **瞎子（Blind）**：拿到提示詞而非答案的角色，目標是找出騙子。
- **提示詞（Prompt）**：與答案相關但不直接揭露答案的描述詞，分配給瞎子。
- **答案（Answer）**：當局的正確詞彙，只有騙子知道。
- **題庫（Question_Bank）**：外掛 JSON 格式的題目集合，每題包含一個答案與多個提示詞。
- **狀態機（State_Machine）**：控制遊戲流程的五個階段：WAITING → ASSIGN → SPEAK → VOTE → RESULT。
- **投票（Vote）**：每位玩家選出自己認為是騙子的對象。
- **分數（Score）**：玩家跨局累計的個人得分。
- **預想答案（Liar_Guess）**：騙子在 VOTE 階段設定的詞彙，代表騙子預測瞎子會猜出的答案。
- **猜測答案（Answer_Guess）**：瞎子在 VOTE 階段輸入的詞彙，代表瞎子對本局正確答案的猜測。

---

## 需求

### 需求 1：房間管理

**使用者故事：** 身為玩家，我希望能建立或加入房間，以便與其他人一起遊玩。

#### 驗收標準

1. THE Game_System SHALL 為每個新建立的房間產生唯一的房間 ID。
2. WHEN 玩家輸入有效的房間 ID，THE Game_System SHALL 允許該玩家加入對應的房間。
3. IF 玩家輸入的房間 ID 不存在，THEN THE Game_System SHALL 顯示「房間不存在」的錯誤訊息。
4. WHEN 玩家成功加入房間，THE Game_System SHALL 在 Firebase Realtime Database 的 `rooms/{roomId}/players` 節點新增該玩家資料。
5. THE Game_System SHALL 將建立房間的玩家設定為主持人（Host），並記錄於 `rooms/{roomId}/hostId`。
6. WHEN 主持人離開房間，THE Game_System SHALL 將房間狀態標記為結束，並通知所有玩家。

---

### 需求 2：等待大廳（WAITING 階段）

**使用者故事：** 身為玩家，我希望在遊戲開始前能看到目前房間的玩家列表與房號，以便確認所有人都已加入。

#### 驗收標準

1. WHILE 房間狀態為 WAITING，THE Game_System SHALL 顯示目前房間 ID 供玩家分享。
2. WHILE 房間狀態為 WAITING，THE Game_System SHALL 即時顯示已加入房間的玩家名稱列表。
3. WHILE 房間狀態為 WAITING，THE Game_System SHALL 僅向主持人顯示「開始遊戲」按鈕。
4. WHEN 主持人按下「開始遊戲」，THE Game_System SHALL 將房間狀態從 WAITING 轉換為 ASSIGN。
5. IF 房間內玩家人數少於 2 人，THEN THE Game_System SHALL 禁止主持人按下「開始遊戲」並顯示提示訊息。

---

### 需求 3：角色分配（ASSIGN 階段）

**使用者故事：** 身為玩家，我希望系統自動分配角色與提示詞，以便公平地開始每一局遊戲。

#### 驗收標準

1. WHEN 房間狀態進入 ASSIGN，THE Game_System SHALL 依照每 4 位玩家分配 1 位騙子的比例，隨機指定騙子角色（例如：4 人 = 1 騙子，8 人 = 2 騙子）。
2. WHEN 房間狀態進入 ASSIGN，THE Game_System SHALL 從題庫中隨機選取一題，且該題在同一房間內不得與已使用過的題目重複。
3. WHEN 角色分配完成，THE Game_System SHALL 將騙子的 `role` 設為 `liar`，其餘玩家設為 `blind`，並寫入 Firebase。
4. WHEN 角色分配完成，THE Game_System SHALL 為每位瞎子分配不同的提示詞，並寫入 `currentRound/prompts/{playerId}`。
5. IF 題目的提示詞數量少於瞎子人數，THEN THE Game_System SHALL 循環重複使用提示詞，直到每位瞎子都獲得一個提示詞。
6. WHEN 角色分配完成，THE Game_System SHALL 將房間狀態從 ASSIGN 轉換為 SPEAK。
7. WHEN 房間狀態進入 ASSIGN，THE Game_System SHALL 僅向騙子顯示正確答案，僅向瞎子顯示其個人提示詞。

---

### 需求 4：發言階段（SPEAK 階段）

**使用者故事：** 身為玩家，我希望能依序看到輪到誰發言，以便進行口頭描述。

#### 驗收標準

1. WHILE 房間狀態為 SPEAK，THE Game_System SHALL 顯示目前輪到發言的玩家名稱。
2. WHILE 房間狀態為 SPEAK，THE Game_System SHALL 持續顯示玩家自己的角色資訊（提示詞或答案）。
3. WHILE 房間狀態為 SPEAK，THE Game_System SHALL 僅向主持人顯示「下一位」按鈕。
4. WHEN 主持人按下「下一位」，THE Game_System SHALL 將發言順序推進至下一位玩家。
5. WHEN 所有玩家均已完成發言，THE Game_System SHALL 將房間狀態從 SPEAK 轉換為 VOTE。

---

### 需求 5：投票階段（VOTE 階段）

**使用者故事：** 身為玩家，我希望能在投票階段完成各自的行動，以便決定勝負並進行猜答。

#### 驗收標準

1. WHILE 房間狀態為 VOTE，THE Game_System SHALL 顯示所有玩家的名稱供投票選擇。
2. WHILE 房間狀態為 VOTE，THE Game_System SHALL 向瞎子顯示投票區（radio button 列表）與猜測答案文字輸入欄位，並於同一畫面一併提交。
3. THE Game_System SHALL 在投票 radio button 列表中排除玩家自己，確保列表中只顯示其他玩家。
4. WHILE 房間狀態為 VOTE，THE Game_System SHALL 向騙子顯示預想答案文字輸入欄位，供騙子輸入其預測瞎子會猜出的詞彙。
5. WHEN 瞎子提交，THE Game_System SHALL 將投票結果寫入 `currentRound/votes/{playerId}`，並將猜測答案寫入 `currentRound/answerGuesses/{playerId}`。
6. WHEN 騙子提交預想答案，THE Game_System SHALL 將預想答案寫入 `currentRound/liarGuesses/{playerId}`。
7. WHILE 房間狀態為 VOTE，THE Game_System SHALL 隱藏所有投票結果與猜測答案，直到所有玩家均完成提交。
8. WHEN 所有玩家均完成提交，THE Game_System SHALL 將房間狀態從 VOTE 轉換為 RESULT。
9. THE Game_System SHALL 允許每位玩家在同一輪中僅提交一次。

---

### 需求 6：結算階段（RESULT 階段）

**使用者故事：** 身為玩家，我希望在結算時看到騙子身份、投票結果、猜答結果與得分，以便了解本局勝負。

#### 驗收標準

1. WHEN 房間狀態進入 RESULT，THE Game_System SHALL 公開顯示所有騙子的玩家名稱。
2. WHEN 房間狀態進入 RESULT，THE Game_System SHALL 顯示每位玩家的投票對象。
3. WHEN 房間狀態進入 RESULT，THE Game_System SHALL 為每位成功投票給騙子的瞎子增加 1 分，並更新 `players/{playerId}/score`。
4. THE Game_System SHALL 不為投票錯誤的玩家增加分數。
5. WHEN 房間狀態進入 RESULT，THE Game_System SHALL 對每位騙子，比對所有瞎子提交的猜測答案（`currentRound/answerGuesses/{playerId}`）與該騙子設定的預想答案（`currentRound/liarGuesses/{liarId}`），若字串完全相符，THEN THE Game_System SHALL 為該騙子增加 1 分，並更新 `players/{liarId}/score`。
6. WHEN 房間狀態進入 RESULT，THE Game_System SHALL 顯示每位騙子的預想答案與瞎子的猜測答案，以及各騙子是否獲得猜答得分。
7. WHEN 房間狀態進入 RESULT，THE Game_System SHALL 顯示所有玩家的目前累計分數。
8. WHILE 房間狀態為 RESULT，THE Game_System SHALL 僅向主持人顯示「下一局」按鈕。
9. WHEN 主持人按下「下一局」，THE Game_System SHALL 清除本局資料（`currentRound`）並將房間狀態重置為 ASSIGN，開始新一局。

---

### 需求 7：題庫管理

**使用者故事：** 身為開發者，我希望題庫以外掛 JSON 格式提供，以便日後輕鬆擴充題目。

#### 驗收標準

1. THE Game_System SHALL 從外部 JSON 檔案載入題庫，格式為包含 `answer`（字串）與 `prompts`（字串陣列）的物件陣列。
2. IF 題庫 JSON 格式不符合預期結構，THEN THE Game_System SHALL 在主控台輸出錯誤訊息並停止遊戲初始化。
3. THE Game_System SHALL 追蹤同一房間內已使用的題目，記錄於 `currentRound/usedQuestions`，確保題目不重複出現。
4. IF 題庫中所有題目均已使用，THEN THE Game_System SHALL 顯示提示訊息，告知主持人題庫已用盡。

---

### 需求 8：即時同步

**使用者故事：** 身為玩家，我希望所有玩家的畫面能即時同步，以便流暢地進行遊戲。

#### 驗收標準

1. THE Game_System SHALL 使用 Firebase Realtime Database 作為唯一的即時資料同步來源。
2. WHEN Firebase 資料庫中的房間狀態發生變更，THE Game_System SHALL 在 500 毫秒內更新所有已連線玩家的畫面。
3. WHEN 玩家的網路連線中斷，THE Game_System SHALL 顯示連線中斷的提示訊息。
4. THE Game_System SHALL 依照以下 Firebase 資料結構儲存所有遊戲資料：
   ```
   rooms/{roomId}/state
   rooms/{roomId}/hostId
   rooms/{roomId}/players/{playerId}
   rooms/{roomId}/currentRound/answer
   rooms/{roomId}/currentRound/usedQuestions
   rooms/{roomId}/currentRound/prompts/{playerId}
   rooms/{roomId}/currentRound/votes/{playerId}
   rooms/{roomId}/currentRound/liarGuesses/{playerId}
   rooms/{roomId}/currentRound/answerGuesses/{playerId}
   ```
