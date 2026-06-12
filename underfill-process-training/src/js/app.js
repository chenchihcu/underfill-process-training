/* =========================================================
   underfill-process-training — App Modules v1.0
   Revealing Module Pattern | No dependencies
   ========================================================= */

;(function () {
  "use strict";

  /* =====================================================
     App.Storage — localStorage wrapper with quota guard
     ===================================================== */
  const Storage = (function () {
    const PREFIX = "uftp_";

    function get(key) {
      try {
        return JSON.parse(localStorage.getItem(PREFIX + key));
      } catch { return null; }
    }

    function set(key, value) {
      try {
        localStorage.setItem(PREFIX + key, JSON.stringify(value));
        return true;
      } catch {
        Toast.show("儲存空間已滿，請清除瀏覽器資料", "error");
        return false;
      }
    }

    function remove(key) {
      try { localStorage.removeItem(PREFIX + key); } catch { /* noop */ }
    }

    return { get: get, set: set, remove: remove };
  })();

  /* =====================================================
     App.Toast — notification system
     ===================================================== */
  const Toast = (function () {
    var container = null;

    function ensureContainer() {
      if (!container) {
        container = document.createElement("div");
        container.className = "toast-container";
        document.body.appendChild(container);
      }
      return container;
    }

    function show(message, type) {
      type = type || "info";
      var el = document.createElement("div");
      el.className = "toast" + (type === "error" ? " toast--error" : "");
      el.textContent = message;
      ensureContainer().appendChild(el);
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 2600);
    }

    return { show: show };
  })();

  /* =====================================================
     App.State — centralized state
     ===================================================== */
  const State = (function () {
    var currentSection = 0;
    var totalSections = 0;

    function init(total) {
      totalSections = total;
      var saved = Storage.get("section");
      currentSection = (saved !== null && !isNaN(saved))
        ? Math.min(Math.max(0, saved), totalSections - 1)
        : 0;
    }

    function getCurrent() { return currentSection; }

    function setCurrent(i) {
      if (i < 0 || i >= totalSections) return false;
      currentSection = i;
      Storage.set("section", i);
      return true;
    }

    function getTotal() { return totalSections; }

    return { init: init, getCurrent: getCurrent, setCurrent: setCurrent, getTotal: getTotal };
  })();

  /* =====================================================
     App.Navigation — sidebar + section switching
     ===================================================== */
  const Navigation = (function () {
    var sections = [];
    var navEl = null;

    function init(navSelector, sectionSelector) {
      navEl = document.querySelector(navSelector);
      if (!navEl) return;

      sections = [].slice.call(document.querySelectorAll(sectionSelector));
      if (sections.length === 0) return;

      State.init(sections.length);

      sections.forEach(function (sec, i) {
        var btn = document.createElement("button");
        btn.className = "nav-btn";
        btn.setAttribute("data-index", i);
        btn.setAttribute("aria-label", sec.dataset.title || ("第 " + (i + 1) + " 節"));

        var iconSpan = document.createElement("span");
        iconSpan.className = "nav-icon";
        iconSpan.innerHTML = getIconHTML(i);
        btn.appendChild(iconSpan);

        var textSpan = document.createElement("span");
        textSpan.textContent = sec.dataset.title || ("Section " + (i + 1));
        btn.appendChild(textSpan);

        btn.addEventListener("click", function () { show(i); });
        navEl.appendChild(btn);
      });

      show(State.getCurrent());
    }

    function getIconHTML(index) {
      var icons = [
        "M4 6h16M4 12h16M4 18h16",                // 0: menu
        "M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z", // 1: info
        "M9 5l7 7-7 7",                            // 2: chevron
        "M3 15a4 4 0 004 4h9a5 5 0 10-4.5-7.2A3.5 3.5 0 003 15z", // 3: cloud
        "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4", // 4: cube
        "M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65-1.7-2.94-2.53.64c-.56-.38-1.14-.7-1.75-.94L17 1.18h-4l-2.14 1.93c-.61.34-1.19.72-1.75 1.02l-2.52-.64L6.4 9.41 8.5 11.1c.04.32.07.65.07.98s-.03.66-.07.98l-2.1 1.65 1.7 2.94 2.52-.64c.56.38 1.14.7 1.75.94L13 22.82h4l2.14-1.93c.61-.34 1.19-.72 1.75-1.02l2.53.64 1.7-2.94-2.11-1.65zM12 16a4 4 0 100-8 4 4 0 000 8z", // 5: settings
        "M12 6V2M8 18l4 4 4-4m-8-8l-4-4 4-4",      // 6: arrows
        "M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z", // 7: tool
        "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z", // 8: check-circle
        "M9 5l7 7-7 7",                            // 9: chevron
        "M12 15a2 2 0 100-4 2 2 0 000 4zm0 0v6m4-10a4 4 0 10-4 4", // 10: help-circle
        "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z", // 11: layout
        "M11 4a8 8 0 100 16 8 8 0 000-16zm-3 8h6", // 12: minus-circle
        "M9 12h6m-3-3v6"                           // 13: plus
      ];
      var d = icons[index] || icons[0];
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="' + d + '"/></svg>';
    }

    function show(index) {
      if (!State.setCurrent(index)) return;

      sections.forEach(function (s) { s.classList.remove("active"); });
      var btns = navEl.querySelectorAll(".nav-btn");
      btns.forEach(function (b) { b.classList.remove("active"); });

      if (sections[index]) sections[index].classList.add("active");
      if (btns[index]) btns[index].classList.add("active");

      Progress.update(index);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    return { init: init, show: show };
  })();

  /* =====================================================
     App.Progress — progress bar
     ===================================================== */
  const Progress = (function () {
    var barEl = null;

    function init(selector) {
      barEl = document.querySelector(selector);
    }

    function update(currentIndex) {
      if (!barEl) return;
      var total = State.getTotal();
      var pct = total > 0 ? ((currentIndex + 1) / total * 100).toFixed(0) : 0;
      barEl.style.width = pct + "%";
    }

    return { init: init, update: update };
  })();

  /* =====================================================
     App.Clipboard — copy with fallback
     ===================================================== */
  const Clipboard = (function () {
    function init() {
      document.addEventListener("click", function (e) {
        var btn = e.target.closest("[data-copy]");
        if (!btn) return;
        var id = btn.getAttribute("data-copy");
        if (!id) return;
        copy(id);
      });
    }

    function copy(elementId) {
      var el = document.getElementById(elementId);
      if (!el) {
        Toast.show("複製失敗：找不到內容", "error");
        return;
      }
      var text = el.innerText || el.textContent;

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(
          function () { Toast.show("已複製到剪貼簿"); },
          function () { fallbackCopy(text); }
        );
      } else {
        fallbackCopy(text);
      }
    }

    function fallbackCopy(text) {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        Toast.show("已複製到剪貼簿");
      } catch {
        Toast.show("複製失敗，請手動選取複製", "error");
      }
      document.body.removeChild(ta);
    }

    return { init: init };
  })();

  /* =====================================================
     App.Notes — personal notes
     ===================================================== */
  const Notes = (function () {
    var textarea = null;

    function init(selector) {
      textarea = document.querySelector(selector);
      if (!textarea) return;
      var saved = Storage.get("notes");
      if (saved) textarea.value = saved;
      textarea.addEventListener("input", autoSave);
    }

    function autoSave() {
      if (textarea) Storage.set("notes", textarea.value);
    }

    function save() {
      if (textarea) {
        Storage.set("notes", textarea.value);
        Toast.show("筆記已儲存");
      }
    }

    function clear_() {
      if (textarea) {
        textarea.value = "";
        Storage.remove("notes");
        Toast.show("筆記已清除");
      }
    }

    return { init: init, save: save, clear: clear_ };
  })();

  /* =====================================================
     App.Checkbox — checklist persistence
     ===================================================== */
  const Checkbox = (function () {
    function init() {
      var checks = [].slice.call(document.querySelectorAll("[data-check]"));
      var saved = Storage.get("checks") || {};
      checks.forEach(function (c, i) {
        c.checked = !!saved[i];
        c.addEventListener("change", function () {
          var data = {};
          checks.forEach(function (x, idx) { data[idx] = x.checked; });
          Storage.set("checks", data);
          recalcProgress(checks);
        });
      });
      recalcProgress(checks);
    }

    function recalcProgress(checks) {
      var total = checks.length;
      var done = checks.filter(function (c) { return c.checked; }).length;
      var pct = total > 0 ? (done / total * 100).toFixed(0) : 0;
      var bar = document.getElementById("check-progress");
      if (bar) bar.style.width = pct + "%";
    }

    return { init: init };
  })();

  /* =====================================================
     Global Exports (for inline onclick handlers)
     ===================================================== */
  window.AppNotesSave = Notes.save;
  window.AppNotesClear = Notes.clear;

  /* =====================================================
     Bootstrap
     ===================================================== */
  document.addEventListener("DOMContentLoaded", function () {
    Navigation.init("#nav", ".section");
    Progress.init("#bar");
    Clipboard.init();
    Notes.init("#notes");
    Checkbox.init();
  });

})();
