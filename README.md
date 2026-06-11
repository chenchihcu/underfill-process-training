# Underfill 製程訓練 (Underfill Process Training)

BGA/Flip Chip Underfill 製程互動式訓練教材。涵蓋材料規格 (UF3808)、製程流程、參數控制 (KPI)、點膠 Pattern 決策 (I/L/U)、檢驗標準 (Visual/X-Ray/CSAM) 與實戰案例。

## 使用方式

本訓練為單頁 HTML 應用程式 (SPA)，可直接於瀏覽器離線開啟。

```bash
# 1. 開發模式 — 直接開啟 src/index.html
# 2. 建置模式 — 產生 production 單檔
pwsh scripts/build.ps1
# 輸出: index.html (minified + inlined)
```

## 專案結構

```
├── src/
│   ├── index.html      # 開發原始檔
│   ├── css/style.css   # 設計系統 + 元件樣式
│   └── js/app.js       # 6 個模組 (State/Nav/Progress/Clipboard/Notes/Checkbox)
├── assets/
├── scripts/
│   └── build.ps1       # 壓縮 + 內聯建置腳本
├── .github/workflows/
│   └── deploy.yml      # CI/CD → GitHub Pages
├── TERMINOLOGY.md      # 術語中英對照表
└── README.md
```

## 技術規格

- 純 HTML/CSS/JS，零依賴
- 明亮主題設計系統 (Design Tokens)
- Revealing Module Pattern
- 響應式設計 (360px / 768px / 1280px)
- WCAG AA 無障礙標準
- localStorage 狀態持久化

## 部署

推送到 `main` 分支後自動建置並部署至 GitHub Pages：

```
https://chenchihfu.github.io/underfill-process-training
```
