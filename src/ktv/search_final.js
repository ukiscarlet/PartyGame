const puppeteer = require('puppeteer');

async function searchLyrics(keyword) {
    // 1. 啟動一個隱藏的瀏覽器
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    // 2. 導向魔鏡歌詞網（建立合法的 Cookie 與網頁環境）
    await page.goto('https://mojigeci.com/', { waitUntil: 'networkidle2' });

    // 3. 在網頁內部執行我們破解的簽名與請求邏輯
    const result = await page.evaluate(async (searchKeyword) => {
        // 這就是你挖出來的加密核心邏輯，直接在瀏覽器環境裡跑
        function getSignature(kw, ts) {
            const SECRET_KEY = "wmn_api_secret_2024_v1";
            const signatureString = kw + ts + SECRET_KEY;
            // 直接借用網頁自帶的 CryptoJS
            return CryptoJS.SHA256(signatureString).toString();
        }

        const timestamp = Date.now().toString();
        const signature = getSignature(searchKeyword, timestamp);
        const encodedKeyword = encodeURIComponent(searchKeyword).toUpperCase();
        
        const apiUrl = `https://mojigeci.com/api/search_lists?keyword=${encodedKeyword}&timestamp=${timestamp}&signature=${signature}&page=1&pageSize=12`;

        try {
            // 直接用瀏覽器原生的 fetch 發送請求，會自動帶上所有正確的 Cookie 與 Headers
            const response = await fetch(apiUrl, {
                headers: {
                    'Accept': 'application/json, text/plain, */*'
                }
            });
            return await response.json();
        } catch (err) {
            return { error: err.message };
        }
    }, keyword);

    // 4. 關閉瀏覽器並輸出結果
    await browser.close();
    
    console.log("透過瀏覽器環境抓取成功！結果如下：");
    console.log(JSON.stringify(result, null, 2));
}

// 測試搜尋「周杰倫」
searchLyrics('周杰倫');