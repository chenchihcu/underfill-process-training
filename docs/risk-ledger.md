# Project Risk Ledger - Underfill Dashboard

本文件記錄了 Underfill 點膠與品質控管儀表板的專案風險評估與後續行動。

| Scope | Risk | Guardrail | Next action (Owner=self) | Revalidation gate | Rollback | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **模擬器性能** | 舊式工業電腦瀏覽器執行 HTML5 Canvas 動畫可能會有掉幀或卡頓現象。 | 動態監測 RequestAnimationFrame 執行率，必要時提供靜態圖片回退方案。 | 若客戶反饋卡頓，將提供 Canvas 降級開關 (disable flow animation)。 | 工業電腦部署實機測試。 | 移除動畫腳本，改用單純 SVG 靜態路徑繪圖。 | `Active` |
| **數據持久化** | 重新整理頁面後，調校參數與 Daily Checklist 狀態會遺失，不利於日常班次交接。 | 目前在 app.js 中狀態暫存於記憶體，不涉及資料庫寫入風險。 | 評估是否引入 LocalStorage 將每日 checklist 狀態持久化。 | 完成第一階段實作後，由用戶確認是否需要離線保存狀態。 | 無需 Rollback，純功能新增。 | `Proposed` |
| **無障礙性與相容性** | 舊版瀏覽器對 CSS Grid 與 Backdrop-filter 支援度不足導致版面跑掉。 | style.css 已加上 `-webkit-backdrop-filter` 支援，並提供 Flexbox 響應式降級。 | 在老舊 IE 或 Edge 舊版本上進行開啟測試。 | 實機測試。 | 將 style.css 的 backdrop-filter 移除，改用純色 `#1A1A24` 背景。 | `Resolved` |
