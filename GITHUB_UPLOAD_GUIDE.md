# GitHub 上傳快速指南（Apps Script 已完成）

## 上傳前：確認設定網址

1. 在電腦上解壓縮 `github-ready-project.zip`。
2. 打開解壓縮資料夾中的 `config.js`。
3. 把 `PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE` 換成你已部署的 Apps Script「網頁應用程式網址」，網址通常以 `/exec` 結尾。只替換引號裡的網址，保留其他符號。
4. 儲存檔案。不要把 `ADMIN_TOKEN` 或任何管理密碼放進前端檔案；管理密碼應留在 Apps Script 的指令碼屬性。

範例格式：

```js
window.SURVEY_CONFIG = {
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/你的部署識別碼/exec"
};
```

## 用 GitHub 網頁上傳

1. 登入 GitHub，按右上角 `+` → `New repository`。
2. Repository name 可填 `survey`。若使用 GitHub Free，請選 **Public** 才能使用免費 GitHub Pages。不要上傳問卷回收資料、CSV、個資或管理密碼。
3. 建立 repository 時，建議先不要勾選自動建立 README，避免和專案裡現有檔案衝突。
4. 建立後進入 repository，點 `Add file` → `Upload files`。
5. 在電腦中打開解壓縮後的專案資料夾，選取並拖曳**資料夾裡面的所有內容**，而不是只把 ZIP 檔上傳。至少要看到 `index.html`、`admin.html`、`config.js`、`assets/`、`apps-script/`、`README.md`。
6. 滑到頁面底部，在 commit message 填 `Upload survey website`，按 `Commit changes`。

## 開啟 GitHub Pages

1. 在 repository 裡開啟 `Settings` → 左側 `Pages`。
2. 在 `Build and deployment` 的 `Source` 選 `Deploy from a branch`。
3. `Branch` 選 `main`，資料夾選 `/(root)`，按 `Save`。
4. 等待 Pages 部署完成；初次部署可能需要幾分鐘，偶爾會更久。回到 `Settings` → `Pages`，使用 `Visit site` 開啟網站。

若 repository 名稱是 `survey`，網址格式通常是：

- 問卷：`https://你的GitHub帳號.github.io/survey/`
- 管理頁：`https://你的GitHub帳號.github.io/survey/admin.html`

## 上線後測試

1. 開啟問卷頁面，確認床上情境影片、視訊側錄、九宮格圖片都能顯示。
2. 完整填寫一次測試問卷，確認資料有寫進 Google Sheet。
3. 打開管理頁並用你已設定的管理密碼登入，測試資料載入與 CSV 匯出。
4. 測試完成後，刪除 Google Sheet 裡的測試資料列（保留表頭）。

**隱私提醒：** GitHub Pages 網站是公開可由網路存取的。Repository 只放網站程式與素材；不要放受訪者資料、匯出檔、密碼或其他敏感資訊。
