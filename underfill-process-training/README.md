# Underfill 製程訓練 + SMT 3D 模擬器

整合版本：Underfill 製程訓練教材（明亮主題）+ SMT 3D Process Simulator（含 9 個模組）。

## 功能

### 教學訓練 (index.html)
互動式訓練教材，涵蓋材料規格 (UF3808)、製程流程、參數控制 (KPI)、點膠 Pattern 決策 (I/L/U)、檢驗標準 (Visual/X-Ray/CSAM) 與實戰案例。可直接離線開啟。

### 3D 模擬器 (simulation.html)
SMT 製程 3D 模擬器，包含 9 個模組：
- Underfill Dispensing
- SPI - Solder Paste Inspection
- FPC Assembly (FPCA)
- Reflow Soldering
- BGA Cross-Section
- Capillary Flow Lab
- Dispensing Pattern Lab
- Void Simulation
- Warpage Analysis

功能：Analytics 面板、Quiz/Defect Lab、Flow 製程演示、物理引擎（SPH-2D / Heat-2D / FEA）

## 使用方式

### 教學訓練（可離線直接開啟）
```
直接用瀏覽器開啟 index.html
```

### 3D 模擬器（需 HTTP 伺服器）
```bash
# 在專案目錄執行
python -m http.server 8000
# 然後開啟 http://localhost:8000/simulation.html
```

### 建置生產版本
```powershell
.\scripts\build.ps1
# 輸出至 _site/ 目錄
```

## 專案結構

```
├── index.html              # 教學訓練主頁（明亮主題，可離線）
├── simulation.html         # SMT 3D 模擬器（深色主題，需伺服器）
├── js/                     # 3D 模擬器 JS 引擎
│   ├── app.js              # 主控制器
│   ├── scene.js            # Three.js 場景
│   ├── ui.js               # UI 控制面板
│   ├── data/               # Analytics, Flow Controller, Materials
│   ├── helpers/            # Animation, Geometry, Materials
│   ├── modules/            # 9 個 3D 模擬模組（全部保留）
│   ├── physics/            # SPH-2D, Heat-2D, Stress-FEA
│   └── training/           # Defect Lab, Scenarios
├── css/
│   └── style.css           # 3D 模擬器深色主題
├── src/                    # 教學訓練開發原始檔
│   ├── index.html          # 開發版教學頁
│   ├── css/style.css       # 教學頁明亮主題設計系統
│   └── js/app.js           # 教學頁 JS 模組
├── scripts/
│   └── build.ps1           # 建置腳本（整合版）
├── .github/workflows/
│   └── deploy.yml          # CI/CD → GitHub Pages
└── TERMINOLOGY.md          # 術語中英對照表
```

## 技術規格

- 教學頁：純 HTML/CSS/JS，零依賴，可離線
- 3D 模擬器：Three.js v0.160（CDN），ES Modules
- 明亮主題設計系統（教學頁）
- 深色主題 3D 介面（模擬器）
- localStorage 狀態持久化
- 響應式設計

## 部署

推送到 `main` 或 `master` 分支後自動建置並部署至 GitHub Pages。
