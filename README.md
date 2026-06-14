# Underfill Smart Dispensing & Quality Control Dashboard

An industrial IoT-style interactive dashboard for managing Loctite UF 3808
semiconductor underfill dispensing processes and quality acceptance.

## 線上網址 (Live URLs)

| 平台 | 網址 |
| --- | --- |
| **Netlify** | <https://underfill-tutorial.netlify.app/> |
| **GitHub Pages** | <https://chenchihcu.github.io/underfill-process-training/> |

## 專案結構

- `dashboard/` — 已建置的靜態 PWA（部署目標）
- `underfill-process-training/` — 教學用單頁應用 (SPA) 原始碼
- `docs/`、`Outputs/`、`*.py` — 文件重建與素材處理工具
- `.github/workflows/` — GitHub Pages 自動部署；Netlify 由 Netlify GitHub App 直接部署

## 部署

推送到 `main` 會自動部署到 Netlify 與 GitHub Pages。
詳細步驟與設定見 [`DEPLOY.md`](./DEPLOY.md)。
