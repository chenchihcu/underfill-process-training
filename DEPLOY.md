# 部署指南 (Deployment Guide)

## 線上網址 (Live URLs)

| 平台 | 網址 |
| --- | --- |
| **Netlify** | <https://underfill-tutorial.netlify.app/> |
| **GitHub Pages** | <https://chenchihcu.github.io/underfill-process-training/> |

---

本專案會在每次推送到 `main` 分支時，自動觸發兩個發布流程：

| 流程 | 工作流程檔 | 發布目錄 | 需要的設定 |
| --- | --- | --- | --- |
| **Netlify** | Netlify GitHub App | `dashboard/` | Netlify site 連到 `chenchihcu/underfill-process-training` 的 `main` |
| **GitHub Pages** | `.github/workflows/deploy-pages.yml` | `dashboard/` → `gh-pages` 分支 | 無需額外設定（Pages 來源為 `gh-pages` 分支） |

> `dashboard/` 為預先建置好的靜態 PWA（`index.html`、`app.js`、`style.css`、`sw.js`、`manifest.json`），不需要額外的建置步驟。

---

## 一、部署到 Netlify（正式流程）

Netlify 是正式 production host。請使用 Netlify 原生 Git deploy，不使用
`netlify deploy --prod` 或 GitHub Actions token deploy 作為日常發布方式。

### 1. Netlify site 設定

- Site：`underfill-tutorial`
- Site ID：`c9d4764d-79aa-4d43-a0d3-c8658b024e63`
- Production branch：`main`
- Publish directory：`dashboard`
- Build command：空字串

### 2. GitHub App 連線

- Netlify site 必須連到 `chenchihcu/underfill-process-training`。
- GitHub Netlify App 使用 **Only select repositories** 時，必須授權本 repo。
- Netlify API 檢查時，`build_settings.installation_id` 不可為 `null`。

### 3. 驗證部署

```bash
npx netlify api getSite --data '{"site_id":"c9d4764d-79aa-4d43-a0d3-c8658b024e63"}'
npx netlify api listSiteBuilds --data '{"site_id":"c9d4764d-79aa-4d43-a0d3-c8658b024e63"}'
npx netlify api listSiteDeploys --data '{"site_id":"c9d4764d-79aa-4d43-a0d3-c8658b024e63"}'
```

完成狀態必須符合：
- `build_settings.provider = github`
- `build_settings.repo_path = chenchihcu/underfill-process-training`
- `build_settings.repo_branch = main`
- `build_settings.dir = dashboard`
- `build_settings.installation_id` 不是 `null`
- 最新 production deploy 的 `branch = main`
- 最新 production deploy 的 `commit_ref` 對到 GitHub `main`

---

## 二、部署到 GitHub Pages

本專案的 Pages 來源設定為 **「Deploy from a branch」→ `gh-pages`**，因此
`deploy-pages.yml` 會使用 `peaceiris/actions-gh-pages` 把 `dashboard/` 發佈到
`gh-pages` 分支，**無需任何 Settings 變更**。

- 每次推送到 `main` 會自動更新 `gh-pages` 分支並重新發佈。
- 若站台未上線，請確認 **Settings → Pages → Source** 為
  **Deploy from a branch**、分支選 `gh-pages`（根目錄 `/`）。

---

## 注意事項

- **手機限制**：GitHub 與 Netlify 的 App 不會顯示「Settings」相關頁面。請改用**手機瀏覽器並切換為「電腦版網站／Desktop site」**，或直接用電腦操作。
- **預設分支**：本專案以 `main` 為正式（canonical）分支。
- **緊急備援**：只有 Netlify Git deploy 異常時，才考慮手動 deploy；平時不要使用 `netlify deploy --prod` 覆蓋 production。
