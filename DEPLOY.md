# 部署指南 (Deployment Guide)

本專案會在每次推送到 `main` 分支時，自動觸發兩個部署流程：

| 流程 | 工作流程檔 | 發布目錄 | 需要的設定 |
| --- | --- | --- | --- |
| **Netlify** | `.github/workflows/deploy-netlify.yml` | `dashboard/` | `NETLIFY_SITE_ID`、`NETLIFY_AUTH_TOKEN` (GitHub Secrets) |
| **GitHub Pages** | `.github/workflows/deploy-pages.yml` | `dashboard/` | 需在 Settings → Pages 啟用，來源選 **GitHub Actions** |

> `dashboard/` 為預先建置好的靜態 PWA（`index.html`、`app.js`、`style.css`、`sw.js`、`manifest.json`），不需要額外的建置步驟。

---

## 一、部署到 Netlify（建議流程）

工作流程已經寫好，只差憑證。完成下列步驟後，每次推送到 `main` 就會自動部署。

### 1. 建立 Netlify 站台
- 前往 <https://app.netlify.com> → **Add new site**。
- 站台一旦建立，Netlify 就會配給網址（`https://<站台名稱>.netlify.app`），之後可在 Domain settings 改名。

### 2. 取得兩個值
- **Site ID**：站台 → **Site configuration → General → Site information** → 複製 **Site ID**（即 API ID）。
- **Auth token**：右上角頭像 → **User settings → Applications → Personal access tokens** → **New access token** → 複製權杖。

### 3. 加入 GitHub Secrets
前往：`https://github.com/chenchihcu/underfill-process-training/settings/secrets/actions`

新增兩個 **Repository secret**（名稱必須完全一致）：
- `NETLIFY_SITE_ID` → 貼上 Site ID
- `NETLIFY_AUTH_TOKEN` → 貼上權杖

### 4. 觸發部署
- 最快：到 **Actions** 分頁 → **Deploy to Netlify** → 在最新一次執行按 **Re-run jobs**。
- 或直接推送任何 commit 到 `main`。

> 部署成功後，執行紀錄（log）會印出實際的網址；在此之前 log 只會顯示
> `Netlify credentials not provided, not deployable`（代表 Secrets 尚未設定）。

### （替代）從自己的電腦手動部署
```bash
npx netlify-cli login            # 開啟瀏覽器，連結你的帳號
npx netlify-cli deploy --prod --dir dashboard
```
指令結束時會印出線上網址。

---

## 二、部署到 GitHub Pages

1. 前往 `https://github.com/chenchihcu/underfill-process-training/settings/pages`
2. **Build and deployment → Source** 選擇 **GitHub Actions**。
3. 之後推送到 `main`（或重新執行 **Deploy to GitHub Pages** 工作流程）即會發布。

---

## 注意事項

- **手機限制**：GitHub 與 Netlify 的 App 不會顯示「Settings」相關頁面。請改用**手機瀏覽器並切換為「電腦版網站／Desktop site」**，或直接用電腦操作。
- **預設分支**：本專案以 `main` 為正式（canonical）分支。
