// app.js
// Vollständige Datei: ersetzt die alte app.js 1:1
// Änderungen / Fixes:
// - Entfernte fehlerhafte Trunkates in HTML-Templates (keine "[...]" Platzhalter mehr).
// - renderGoalValuePage: ersetzt Dropdown-only Eingaben durch Klick/Doppelklick/Touch wie in Game Data.
// - Saison-Tabelle: MVP-Spalten am Ende, MVP direkt nach Time, MVP Points als letzte Spalte.
// - Import/Export, Marker- und Timer-Logik wie zuvor, mit Robustheitschecks.
// Hinweis: Diese Datei ist dazu gedacht, die existierende app.js 1:1 zu ersetzen.

document.addEventListener("DOMContentLoaded", () => {
  // --- Elements (buttons remain in DOM per page) ---
  const pages = {
    selection: document.getElementById("playerSelectionPage"),
    stats: document.getElementById("statsPage"),
    torbild: document.getElementById("torbildPage"),
    goalValue: document.getElementById("goalValuePage"),
    season: document.getElementById("seasonPage"),
    seasonMap: document.getElementById("seasonMapPage")
  };

  function showPage(page) {
    try {
      Object.values(pages).forEach(p => { if (p) p.style.display = "none"; });
      if (pages[page]) pages[page].style.display = "block";
      localStorage.setItem("currentPage", page);
      let title = "Spielerstatistik";
      if (page === "selection") title = "Spielerauswahl";
      else if (page === "stats") title = "Statistiken";
      else if (page === "torbild") title = "Goal Map";
      else if (page === "goalValue") title = "Goal Value";
      else if (page === "season") title = "Season";
      else if (page === "seasonMap") title = "Season Map";
      document.title = title;
    } catch (err) { console.warn("showPage failed:", err); }
  }
  window.showPage = showPage;

  // Query elements / buttons / containers
  const playerListContainer = document.getElementById("playerList");
  const confirmSelectionBtn = document.getElementById("confirmSelection");
  const statsContainer = document.getElementById("statsContainer");
  const torbildBtn = document.getElementById("torbildBtn");
  const goalValueBtn = document.getElementById("goalValueBtn");
  const backToStatsBtn = document.getElementById("backToStatsBtn");
  const backFromGoalValueBtn = document.getElementById("backFromGoalValueBtn");
  const timerBtn = document.getElementById("timerBtn");
  const selectPlayersBtn = document.getElementById("selectPlayersBtn");
  const exportBtn = document.getElementById("exportBtn");
  const resetBtn = document.getElementById("resetBtn");
  const seasonBtn = document.getElementById("seasonBtn");
  const seasonMapBtn = document.getElementById("seasonMapBtn");
  const backToStatsFromSeasonBtn = document.getElementById("backToStatsFromSeasonBtn");
  const backToStatsFromSeasonMapBtn = document.getElementById("backToStatsFromSeasonMapBtn");
  const seasonContainer = document.getElementById("seasonContainer");
  const statsScrollContainer = document.getElementById("statsScrollContainer");

  const exportSeasonFromStatsBtn = document.getElementById("exportSeasonFromStatsBtn");
  const exportSeasonMapBtn = document.getElementById("exportSeasonMapBtn");
  const exportSeasonBtn = document.getElementById("exportSeasonBtn");

  const torbildBoxesSelector = "#torbildPage .field-box, #torbildPage .goal-img-box";
  const seasonMapBoxesSelector = "#seasonMapPage .field-box, #seasonMapPage .goal-img-box";

  const torbildTimeTrackingBox = document.getElementById("timeTrackingBox");
  const seasonMapTimeTrackingBox = document.getElementById("seasonMapTimeTrackingBox");

  const goalValueContainer = document.getElementById("goalValueContainer");
  const resetGoalValueBtn = document.getElementById("resetGoalValueBtn");

  // Dark/Light Mode
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.setAttribute('data-theme', 'light');
  }

  // Data
  const players = [
    { num: 4, name: "Ondrej Kastner" }, { num: 5, name: "Raphael Oehninger" },
    { num: 6, name: "Nuno Meier" }, { num: 7, name: "Silas Teuber" },
    { num: 8, name: "Diego Warth" }, { num: 9, name: "Mattia Crameri" },
    { num: 10, name: "Mael Bernath" }, { num: 11, name: "Sean Nef" },
    { num: 12, name: "Rafael Burri" }, { num: 13, name: "Lenny Schwarz" },
    { num: 14, name: "David Lienert" }, { num: 15, name: "Neven Severini" },
    { num: 16, name: "Nils Koubek" }, { num: 17, name: "Lio Kundert" },
    { num: 18, name: "Livio Berner" }, { num: 19, name: "Robin Strasser" },
    { num: 21, name: "Marlon Kreyenbühl" }, { num: 22, name: "Martin Lana" },
    { num: 23, name: "Manuel Isler" }, { num: 24, name: "Moris Hürlimann" },
    { num: "", name: "Levi Baumann" }, { num: "", name: "Corsin Blapp" },
    { num: "", name: "Lenny Zimmermann" }, { num: "", name: "Luke Böhmichen" },
    { num: "", name: "Livio Weissen" }, { num: "", name: "Raul Wütrich" },
    { num: "", name: "Marco Senn" }
  ];

  const categories = ["Shot", "Goals", "Assist", "+/-", "FaceOffs", "FaceOffs Won", "Penaltys"];

  // persistent state
  let selectedPlayers = JSON.parse(localStorage.getItem("selectedPlayers")) || [];
  let statsData = JSON.parse(localStorage.getItem("statsData")) || {};
  let playerTimes = JSON.parse(localStorage.getItem("playerTimes")) || {};
  let activeTimers = {}; // playerName -> intervalId
  let timerSeconds = Number(localStorage.getItem("timerSeconds")) || 0;
  let timerInterval = null;
  let timerRunning = false;

  // season aggregated data (persistent)
  let seasonData = JSON.parse(localStorage.getItem("seasonData")) || {}; // keyed by player name

  // --- Render player selection ---
  function renderPlayerSelection() {
    if (!playerListContainer) {
      console.error("playerList container not found");
      return;
    }
    playerListContainer.innerHTML = "";

    players.slice()
      .sort((a,b) => {
        const na = Number(a.num) || 999;
        const nb = Number(b.num) || 999;
        return na - nb;
      })
      .forEach((p, idx) => {
        const li = document.createElement("li");
        const checkboxId = `player-chk-${idx}`;
        const checkboxName = `player-${idx}`;
        const checked = selectedPlayers.find(sp => sp.name === p.name) ? "checked" : "";

        let numAreaHtml = "";
        if (p.num !== "" && p.num !== null && p.num !== undefined && String(p.num).trim() !== "") {
          numAreaHtml = `<div class="num" style="flex:0 0 48px;text-align:center;"><strong>${escapeHtml(p.num)}</strong></div>`;
        } else {
          numAreaHtml = `<div style="flex:0 0 64px;text-align:center;">
                           <input class="num-input" type="text" inputmode="numeric" maxlength="3" placeholder="Nr." value="" style="width:56px;padding:6px;border-radius:6px;border:1px solid #444;background:var(--row-even);color:var(--text-color)">
                         </div>`;
        }

        li.innerHTML = `
          <label class="player-line" style="display:flex;align-items:center;gap:8px;width:100%;" for="${checkboxId}">
            <input id="${checkboxId}" name="${checkboxName}" type="checkbox" value="${escapeHtml(p.name)}" ${checked} style="flex:0 0 auto">
            ${numAreaHtml}
            <div class="name" style="flex:1;color:#eee;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"><strong>${escapeHtml(p.name)}</strong></div>
          </label>`;
        playerListContainer.appendChild(li);
      });

    const customSelected = selectedPlayers.filter(sp => !players.some(bp => bp.name === sp.name));
    for (let i = 0; i < 5; i++) {
      const pre = customSelected[i];
      const li = document.createElement("li");
      const chkId = `custom-chk-${i}`;
      const numId = `custom-num-${i}`;
      const nameId = `custom-name-${i}`;
      li.innerHTML = `
        <label class="custom-line" style="display:flex;align-items:center;gap:8px;width:100%;" for="${chkId}">
          <input id="${chkId}" name="${chkId}" type="checkbox" class="custom-checkbox" ${pre ? "checked" : ""} style="flex:0 0 auto">
          <input id="${numId}" name="${numId}" type="text" class="custom-num" inputmode="numeric" maxlength="3" placeholder="Nr." value="${escapeHtml(pre?.num || "")}" style="width:56px;flex:0 0 auto;border-radius:6px;border:1px solid #444;background:var(--row-even);color:var(--text-color);padding:6px">
          <input id="${nameId}" name="${nameId}" type="text" class="custom-name" placeholder="Eigener Spielername" value="${escapeHtml(pre?.name || "")}" style="flex:1;min-width:0;border-radius:6px;border:1px solid #444;padding:6px;background:var(--row-even);color:var(--text-color)">
        </label>`;
      playerListContainer.appendChild(li);
    }
  }

  // --- Confirm selection handler ---
  if (confirmSelectionBtn) {
    confirmSelectionBtn.addEventListener("click", () => {
      try {
        const checkedBoxes = Array.from(playerListContainer.querySelectorAll("input[type='checkbox']:not(.custom-checkbox)")).filter(chk => chk.checked);
        selectedPlayers = checkedBoxes.map(chk => {
          const li = chk.closest("li");
          const name = chk.value;
          let num = "";
          if (li) {
            const numInput = li.querySelector(".num-input");
            if (numInput) num = numInput.value.trim();
            else {
              const numDiv = li.querySelector(".num");
              if (numDiv) num = numDiv.textContent.trim();
            }
          }
          return { num: num || "", name };
        });

        const allLis = Array.from(playerListContainer.querySelectorAll("li"));
        const customLis = allLis.slice(players.length);
        customLis.forEach((li) => {
          const chk = li.querySelector(".custom-checkbox");
          const numInput = li.querySelector(".custom-num");
          const nameInput = li.querySelector(".custom-name");
          if (chk && chk.checked && nameInput && nameInput.value.trim() !== "") {
            selectedPlayers.push({ num: numInput ? (numInput.value.trim() || "") : "", name: nameInput.value.trim() });
          }
        });

        localStorage.setItem("selectedPlayers", JSON.stringify(selectedPlayers));

        selectedPlayers.forEach(p => {
          if (!statsData[p.name]) statsData[p.name] = {};
          categories.forEach(c => { if (statsData[p.name][c] === undefined) statsData[p.name][c] = 0; });
        });
        localStorage.setItem("statsData", JSON.stringify(statsData));

        showPage("stats");
        renderStatsTable();
      } catch (err) {
        console.error("Error in confirmSelection handler:", err);
        alert("Fehler beim Bestätigen (siehe Konsole): " + (err && err.message ? err.message : err));
      }
    });
  }

  window.__renderPlayerSelection = renderPlayerSelection;

  // --- Eiszeitfarben dynamisch setzen ---
  function updateIceTimeColors() {
    const iceTimes = selectedPlayers.map(p => ({ name: p.name, seconds: playerTimes[p.name] || 0 }));
    const sortedDesc = iceTimes.slice().sort((a,b) => b.seconds - a.seconds);
    const top5 = new Set(sortedDesc.slice(0,5).map(x => x.name));
    const sortedAsc = iceTimes.slice().sort((a,b) => a.seconds - b.seconds);
    const bottom5 = new Set(sortedAsc.slice(0,5).map(x => x.name));

    if (!statsContainer) return;
    statsContainer.querySelectorAll(".ice-time-cell").forEach(cell => {
      const player = cell.dataset.player;
      if (top5.has(player)) cell.style.color = getComputedStyle(document.documentElement).getPropertyValue('--ice-top')?.trim() || "#00c06f";
      else if (bottom5.has(player)) cell.style.color = getComputedStyle(document.documentElement).getPropertyValue('--ice-bottom')?.trim() || "#ff4c4c";
      else cell.style.color = getComputedStyle(document.documentElement).getPropertyValue('--cell-zero-color')?.trim() || "#ffffff";
    });
  }

  // --- small helper: safe computed background color ---
  function getComputedBg(el) {
    try {
      const cs = getComputedStyle(el);
      return cs.backgroundColor || cs.color || "";
    } catch (e) { return ""; }
  }

  // --- Create Import CSV buttons and apply explicit colors per previous requests ---
  (function setupButtonsAndImports() {
    const colorExportCSV = "#46798e";
    const colorImportCSV = "#010741";

    // Ensure both export buttons use exportCSV color
    if (exportBtn) {
      exportBtn.style.backgroundColor = colorExportCSV;
      exportBtn.style.color = "#fff";
    }
    if (exportSeasonBtn) {
      exportSeasonBtn.style.backgroundColor = colorExportCSV;
      exportSeasonBtn.style.color = "#fff";
    }
    if (exportSeasonFromStatsBtn) {
      exportSeasonFromStatsBtn.style.backgroundColor = "#e3fba7";
      exportSeasonFromStatsBtn.style.color = "#000";
    }

    function createImportButton(id, label, referenceEl, insertBeforeEl = null, insertAfterEl = null) {
      const btn = document.createElement("button");
      btn.id = id;
      btn.type = "button";
      btn.textContent = label;
      btn.className = "top-btn import-csv-btn";
      btn.style.margin = "0 6px";
      btn.style.backgroundColor = colorImportCSV;
      btn.style.color = "#fff";
      if (insertBeforeEl && insertBeforeEl.parentNode) insertBeforeEl.parentNode.insertBefore(btn, insertBeforeEl);
      else if (insertAfterEl && insertAfterEl.parentNode) insertAfterEl.parentNode.insertBefore(btn, insertAfterEl.nextSibling);
      else if (referenceEl && referenceEl.parentNode) referenceEl.parentNode.appendChild(btn);
      return btn;
    }

    const csvFileInput = document.createElement("input");
    csvFileInput.type = "file";
    csvFileInput.accept = ".csv,text/csv";
    csvFileInput.style.display = "none";
    document.body.appendChild(csvFileInput);

    csvFileInput.addEventListener("change", (ev) => {
      const file = csvFileInput.files && csvFileInput.files[0];
      if (!file) return;
      const target = csvFileInput.dataset.target || "";
      const reader = new FileReader();
      reader.onload = (e) => {
        const txt = String(e.target.result || "");
        if (target === "stats") importStatsCSVFromText(txt);
        else if (target === "season") importSeasonCSVFromText(txt);
        csvFileInput.value = "";
        delete csvFileInput.dataset.target;
      };
      reader.readAsText(file, "utf-8");
    });

    // Import button for Game Data (placed next to export)
    if (exportBtn && resetBtn) {
      const importStatsBtn = createImportButton("importCsvStatsBtn", "Import CSV", exportBtn, resetBtn, null);
      importStatsBtn.title = "Importiere CSV (gleiches Format wie Export)";
      importStatsBtn.addEventListener("click", () => {
        csvFileInput.dataset.target = "stats";
        csvFileInput.click();
      });
    }

    // Import button for Season page (placed next to exportSeasonBtn)
    if (exportSeasonBtn) {
      const importSeasonBtn = createImportButton("importCsvSeasonBtn", "Import CSV", exportSeasonBtn, null, exportSeasonBtn);
      importSeasonBtn.title = "Importiere Season CSV (Werte werden zu vorhandenen addiert; games bleiben unverändert)";
      importSeasonBtn.addEventListener("click", () => {
        csvFileInput.dataset.target = "season";
        csvFileInput.click();
      });
    }
  })();

  // CSV parsing helpers
  function splitCsvLines(text) {
    return text.split(/\r?\n/).map(r => r.trim()).filter(r => r.length > 0);
  }
  function parseCsvLine(line) {
    return line.split(";").map(s => s.trim());
  }

  function parseTimeToSeconds(str) {
    if (!str) return 0;
    const m = str.split(":");
    if (m.length >= 2) {
      const mm = Number(m[0]) || 0;
      const ss = Number(m[1]) || 0;
      return mm*60 + ss;
    }
    return Number(str) || 0;
  }

  // Import: Stats CSV (expects export format: ["Nr","Spieler", ...categories, "Time"])
  function importStatsCSVFromText(txt) {
    try {
      const lines = splitCsvLines(txt);
      if (lines.length === 0) { alert("Leere CSV"); return; }
      const header = parseCsvLine(lines[0]);
      const nameIdx = header.findIndex(h => /spieler/i.test(h) || h.toLowerCase() === "spieler");
      const timeIdx = header.findIndex(h => /time/i.test(h) || /zeit/i.test(h));
      const categoryIdxMap = {};
      categories.forEach(cat => {
        const idx = header.findIndex(h => h.toLowerCase() === cat.toLowerCase());
        if (idx !== -1) categoryIdxMap[cat] = idx;
      });
      for (let i = 1; i < lines.length; i++) {
        const cols = parseCsvLine(lines[i]);
        const name = cols[nameIdx] || "";
        if (!name) continue;
        if (!statsData[name]) statsData[name] = {};
        Object.keys(categoryIdxMap).forEach(cat => {
          const v = Number(cols[categoryIdxMap[cat]] || 0) || 0;
          statsData[name][cat] = v;
        });
        if (timeIdx !== -1) {
          const t = parseTimeToSeconds(cols[timeIdx]);
          playerTimes[name] = t;
        }
      }
      localStorage.setItem("statsData", JSON.stringify(statsData));
      localStorage.setItem("playerTimes", JSON.stringify(playerTimes));
      renderStatsTable();
      alert("Stats-CSV importiert.");
    } catch (e) {
      console.error("Import Stats CSV failed:", e);
      alert("Fehler beim Importieren (siehe Konsole).");
    }
  }

  // Import: Season CSV (additive). Adds numeric fields to existing seasonData entries.
  // 'games' is NOT modified for existing players (preserved). For new players games = 0.
  function importSeasonCSVFromText(txt) {
    try {
      const lines = splitCsvLines(txt);
      if (lines.length === 0) { alert("Leere CSV"); return; }
      const header = parseCsvLine(lines[0]);

      const idxNr = header.findIndex(h => /^nr$/i.test(h) || /^nr\./i.test(h) || /nr/i.test(h));
      const idxSpieler = header.findIndex(h => /spieler/i.test(h) || /player/i.test(h));
      const idxGames = header.findIndex(h => /^games$/i.test(h) || /games/i.test(h));
      const idxGoals = header.findIndex(h => /^goals$/i.test(h) || /goals/i.test(h));
      const idxAssists = header.findIndex(h => /^assists$/i.test(h) || /assists/i.test(h));
      const idxPlusMinus = header.findIndex(h => /^\+\/-$/i.test(h) || /plus-?minus/i.test(h) || /\+\/-/i.test(h));
      const idxShots = header.findIndex(h => /^shots$/i.test(h) || /shots/i.test(h));
      const idxPenalty = header.findIndex(h => /^penalty$/i.test(h) || /^penaltys$/i.test(h) || /penalty/i.test(h));
      const idxFaceOffs = header.findIndex(h => /^faceoffs$/i.test(h) || /faceoffs/i.test(h));
      const idxFaceOffsWon = header.findIndex(h => /^faceoffs won$/i.test(h) || /^faceoffswon$/i.test(h) || /faceoffs won/i.test(h));
      const idxGoalValue = header.findIndex(h => /goal value/i.test(h) || /gv/i.test(h));
      const idxTime = header.findIndex(h => /time/i.test(h) || /zeit/i.test(h));

      // Helper: parse time "MM:SS" or numeric seconds
      function parseTimeToSecondsLocal(str) {
        if (!str) return 0;
        const s = String(str).trim();
        if (s.match(/^\d+:\d{2}$/)) {
          const [mm, ss] = s.split(":").map(Number);
          return (Number(mm) || 0) * 60 + (Number(ss) || 0);
        }
        const n = Number(s.replace(/[^0-9.-]/g, ""));
        return isNaN(n) ? 0 : n;
      }

      for (let i = 1; i < lines.length; i++) {
        const cols = parseCsvLine(lines[i]);
        const name = (idxSpieler !== -1) ? (cols[idxSpieler] || "").trim() : "";
        if (!name) continue;

        // Values parsed from CSV (fallback 0)
        const parsed = {
          num: (idxNr !== -1) ? (cols[idxNr] || "") : "",
          goals: (idxGoals !== -1) ? (Number(cols[idxGoals] || 0) || 0) : 0,
          assists: (idxAssists !== -1) ? (Number(cols[idxAssists] || 0) || 0) : 0,
          plusMinus: (idxPlusMinus !== -1) ? (Number(cols[idxPlusMinus] || 0) || 0) : 0,
          shots: (idxShots !== -1) ? (Number(cols[idxShots] || 0) || 0) : 0,
          penaltys: (idxPenalty !== -1) ? (Number(cols[idxPenalty] || 0) || 0) : 0,
          faceOffs: (idxFaceOffs !== -1) ? (Number(cols[idxFaceOffs] || 0) || 0) : 0,
          faceOffsWon: (idxFaceOffsWon !== -1) ? (Number(cols[idxFaceOffsWon] || 0) || 0) : 0,
          timeSeconds: (idxTime !== -1) ? parseTimeToSecondsLocal(cols[idxTime]) : 0,
          goalValue: (idxGoalValue !== -1) ? (Number(cols[idxGoalValue] || 0) || 0) : 0
        };

        // If seasonData already has the player, add numeric fields.
        // games is NOT modified — it stays as in seasonData.
        if (!seasonData[name]) {
          // New entry: initialize with parsed values, but games = 0
          seasonData[name] = {
            num: parsed.num || "",
            name: name,
            games: 0,
            goals: parsed.goals,
            assists: parsed.assists,
            plusMinus: parsed.plusMinus,
            shots: parsed.shots,
            penaltys: parsed.penaltys,
            faceOffs: parsed.faceOffs,
            faceOffsWon: parsed.faceOffsWon,
            timeSeconds: parsed.timeSeconds,
            goalValue: parsed.goalValue
          };
        } else {
          // Existing entry: add numeric values; preserve existing games value
          const existing = seasonData[name];
          existing.num = existing.num || parsed.num || existing.num || "";
          existing.goals = (Number(existing.goals || 0) || 0) + parsed.goals;
          existing.assists = (Number(existing.assists || 0) || 0) + parsed.assists;
          existing.plusMinus = (Number(existing.plusMinus || 0) || 0) + parsed.plusMinus;
          existing.shots = (Number(existing.shots || 0) || 0) + parsed.shots;
          existing.penaltys = (Number(existing.penaltys || 0) || 0) + parsed.penaltys;
          existing.faceOffs = (Number(existing.faceOffs || 0) || 0) + parsed.faceOffs;
          existing.faceOffsWon = (Number(existing.faceOffsWon || 0) || 0) + parsed.faceOffsWon;
          existing.timeSeconds = (Number(existing.timeSeconds || 0) || 0) + parsed.timeSeconds;
          existing.goalValue = (Number(existing.goalValue || 0) || 0) + parsed.goalValue;
          // IMPORTANT: do NOT change existing.games (leave as-is)
        }
      }

      localStorage.setItem("seasonData", JSON.stringify(seasonData));
      renderSeasonTable();
      alert("Season-CSV importiert und Zahlen zu bestehenden Daten addiert. 'games' wurden nicht verändert.");
    } catch (e) {
      console.error("Import Season CSV failed:", e);
      alert("Fehler beim Importieren der Season-CSV (siehe Konsole).");
    }
  }

  // --- Marker helpers with FIELD image sampling ---
  const LONG_MARK_MS_INTERNAL = 600;
  function clampPct(v) { return Math.max(0, Math.min(100, v)); }

  const samplerCache = new WeakMap();
  function createImageSampler(imgEl) {
    if (!imgEl) return null;
    if (samplerCache.has(imgEl)) return samplerCache.get(imgEl);
    const sampler = { valid:false, canvas:null, ctx:null };
    try {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      sampler.canvas = canvas;
      sampler.ctx = ctx;
      function draw() {
        try {
          const w = imgEl.naturalWidth || imgEl.width || 1;
          const h = imgEl.naturalHeight || imgEl.height || 1;
          canvas.width = w;
          canvas.height = h;
          ctx.clearRect(0,0,w,h);
          ctx.drawImage(imgEl, 0, 0, w, h);
          sampler.valid = true;
        } catch (e) {
          sampler.valid = false;
        }
      }
      if (imgEl.complete) draw();
      else {
        imgEl.addEventListener("load", draw);
        imgEl.addEventListener("error", () => { sampler.valid = false; });
      }

      function getPixel(xPct, yPct) {
        if (!sampler.valid) return null;
        const px = Math.round((xPct/100) * (canvas.width - 1));
        const py = Math.round((yPct/100) * (canvas.height - 1));
        try {
          const d = ctx.getImageData(px, py, 1, 1).data;
          return { r: d[0], g: d[1], b: d[2], a: d[3] };
        } catch (e) {
          sampler.valid = false;
          return null;
        }
      }

      sampler.isWhiteAt = (xPct, yPct, threshold = 220) => {
        const p = getPixel(xPct, yPct);
        if (!p) return false;
        if (p.a === 0) return false;
        return p.r >= threshold && p.g >= threshold && p.b >= threshold;
      };
      sampler.isNeutralWhiteAt = (xPct, yPct, threshold = 235, maxChannelDiff = 12) => {
        const p = getPixel(xPct, yPct);
        if (!p) return false;
        if (p.a === 0) return false;
        const maxC = Math.max(p.r, p.g, p.b);
        const minC = Math.min(p.r, p.g, p.b);
        const diff = maxC - minC;
        return maxC >= threshold && diff <= maxChannelDiff;
      };
      sampler.isGreenAt = (xPct, yPct, gThreshold = 110, diff = 30) => {
        const p = getPixel(xPct, yPct);
        if (!p) return false;
        if (p.a === 0) return false;
        return (p.g >= gThreshold) && ((p.g - p.r) >= diff) && ((p.g - p.b) >= diff);
      };
      sampler.isRedAt = (xPct, yPct, rThreshold = 95, diff = 22) => {
        const p = getPixel(xPct, yPct);
        if (!p) return false;
        if (p.a === 0) return false;
        return (p.r >= rThreshold) && ((p.r - p.g) >= diff) && ((p.r - p.b) >= diff);
      };

      samplerCache.set(imgEl, sampler);
      return sampler;
    } catch (err) {
      samplerCache.set(imgEl, { valid:false, isWhiteAt: ()=>false, isNeutralWhiteAt: ()=>false, isGreenAt: ()=>false, isRedAt: ()=>false });
      return samplerCache.get(imgEl);
    }
  }

  function createMarkerPercent(xPctContainer, yPctContainer, color, container, interactive = true) {
    xPctContainer = clampPct(xPctContainer);
    yPctContainer = clampPct(yPctContainer);
    const dot = document.createElement("div");
    dot.className = "marker-dot";
    dot.style.backgroundColor = color;
    dot.style.left = `${xPctContainer}%`;
    dot.style.top = `${yPctContainer}%`;
    if (interactive) {
      dot.addEventListener("click", (ev) => { ev.stopPropagation(); dot.remove(); });
    }
    container.appendChild(dot);
  }

  function createMarkerBasedOn(pos, boxEl, longPress, forceGrey=false) {
    if (!boxEl) return;

    // FIELD BOX
    if (boxEl.classList.contains("field-box")) {
      const img = boxEl.querySelector("img");
      if (img) {
        if (!pos.insideImage) {
          return;
        }
        const sampler = createImageSampler(img);
        if (longPress || forceGrey) {
          createMarkerPercent(pos.xPctContainer, pos.yPctContainer, "#444", boxEl, true);
          return;
        }
        if (sampler && sampler.valid) {
          const ix = pos.xPctImage;
          const iy = pos.yPctImage;
          const isGreen = sampler.isGreenAt(ix, iy, 110, 30);
          const isRed = sampler.isRedAt(ix, iy, 95, 22);
          if (isGreen) {
            createMarkerPercent(pos.xPctContainer, pos.yPctContainer, "#00ff66", boxEl, true);
            return;
          }
          if (isRed) {
            createMarkerPercent(pos.xPctContainer, pos.yPctContainer, "#ff0000", boxEl, true);
            return;
          }
          return;
        } else {
          const color = pos.yPctImage > 50 ? "#ff0000" : "#00ff66";
          createMarkerPercent(pos.xPctContainer, pos.yPctContainer, color, boxEl, true);
          return;
        }
      } else {
        return;
      }
    }

    // GOAL BOXES
    if (boxEl.classList.contains("goal-img-box") || boxEl.id === "goalGreenBox" || boxEl.id === "goalRedBox") {
      const img = boxEl.querySelector("img");
      if (!img) return;
      const sampler = createImageSampler(img);
      if (!sampler || !sampler.valid) {
        return;
      }
      if (boxEl.id === "goalGreenBox") {
        const ok = sampler.isWhiteAt(pos.xPctContainer, pos.yPctContainer, 220);
        if (!ok) return;
        createMarkerPercent(pos.xPctContainer, pos.yPctContainer, "#444", boxEl, true);
        return;
      }
      if (boxEl.id === "goalRedBox") {
        const ok = sampler.isNeutralWhiteAt(pos.xPctContainer, pos.yPctContainer, 235, 12);
        if (!ok) return;
        createMarkerPercent(pos.xPctContainer, pos.yPctContainer, "#444", boxEl, true);
        return;
      }
      const ok = sampler.isWhiteAt(pos.xPctContainer, pos.yPctContainer, 220);
      if (!ok) return;
      createMarkerPercent(pos.xPctContainer, pos.yPctContainer, "#444", boxEl, true);
      return;
    }

    return;
  }

  function clearAllMarkers() {
    document.querySelectorAll(".marker-dot").forEach(d => d.remove());
  }

  function attachMarkerHandlersToBoxes(rootSelector) {
    document.querySelectorAll(rootSelector).forEach(box => {
      const img = box.querySelector("img");
      if (!img) return;
      box.style.position = "relative";

      createImageSampler(img);

      let mouseHoldTimer = null;
      let isLong = false;
      let lastMouseUp = 0;
      let lastTouchEnd = 0;

      function getPosFromEvent(e) {
        const boxRect = img.getBoundingClientRect();
        const clientX = (e.clientX !== undefined) ? e.clientX : (e.touches && e.touches[0] && e.touches[0].clientX);
        const clientY = (e.clientY !== undefined) ? e.clientY : (e.touches && e.touches[0] && e.touches[0].clientY);

        const xPctContainer = Math.max(0, Math.min(1, (clientX - boxRect.left) / boxRect.width)) * 100;
        const yPctContainer = Math.max(0, Math.min(1, (clientY - boxRect.top) / boxRect.height)) * 100;

        const naturalW = img.naturalWidth || img.width || 1;
        const naturalH = img.naturalHeight || img.height || 1;
        const clientW = boxRect.width;
        const clientH = boxRect.height;

        const scale = Math.min(clientW / naturalW, clientH / naturalH);
        const renderedW = naturalW * scale;
        const renderedH = naturalH * scale;

        const offsetX = boxRect.left + (clientW - renderedW) / 2;
        const offsetY = boxRect.top + (clientH - renderedH) / 2;

        const insideImage = (clientX >= offsetX && clientX <= offsetX + renderedW && clientY >= offsetY && clientY <= offsetY + renderedH);

        let xPctImage = 0;
        let yPctImage = 0;
        if (insideImage) {
          xPctImage = Math.max(0, Math.min(1, (clientX - offsetX) / renderedW)) * 100;
          yPctImage = Math.max(0, Math.min(1, (clientY - offsetY) / renderedH)) * 100;
        }

        return { xPctContainer, yPctContainer, xPctImage, yPctImage, insideImage };
      }

      img.addEventListener("mousedown", (ev) => {
        isLong = false;
        if (mouseHoldTimer) clearTimeout(mouseHoldTimer);
        mouseHoldTimer = setTimeout(() => {
          isLong = true;
          const pos = getPosFromEvent(ev);
          createMarkerBasedOn(pos, box, true);
        }, LONG_MARK_MS_INTERNAL);
      });

      img.addEventListener("mouseup", (ev) => {
        if (mouseHoldTimer) { clearTimeout(mouseHoldTimer); mouseHoldTimer = null; }
        const now = Date.now();
        const pos = getPosFromEvent(ev);

        if (now - lastMouseUp < 300) {
          createMarkerBasedOn(pos, box, true, true);
          lastMouseUp = 0;
        } else {
          if (!isLong) createMarkerBasedOn(pos, box, false);
          lastMouseUp = now;
        }
        isLong = false;
      });

      img.addEventListener("mouseleave", () => {
        if (mouseHoldTimer) { clearTimeout(mouseHoldTimer); mouseHoldTimer = null; }
        isLong = false;
      });

      img.addEventListener("touchstart", (ev) => {
        isLong = false;
        if (mouseHoldTimer) { clearTimeout(mouseHoldTimer); mouseHoldTimer = null; }
        mouseHoldTimer = setTimeout(() => {
          isLong = true;
          const pos = getPosFromEvent(ev.touches[0]);
          createMarkerBasedOn(pos, box, true);
        }, LONG_MARK_MS_INTERNAL);
      }, { passive: true });

      img.addEventListener("touchend", (ev) => {
        if (mouseHoldTimer) { clearTimeout(mouseHoldTimer); mouseHoldTimer = null; }
        const now = Date.now();
        const pos = getPosFromEvent(ev.changedTouches[0]);

        if (now - lastTouchEnd < 300) {
          createMarkerBasedOn(pos, box, true, true);
          lastTouchEnd = 0;
        } else {
          if (!isLong) createMarkerBasedOn(pos, box, false);
          lastTouchEnd = now;
        }
        isLong = false;
      }, { passive: true });

      img.addEventListener("touchcancel", () => {
        if (mouseHoldTimer) { clearTimeout(mouseHoldTimer); mouseHoldTimer = null; }
        isLong = false;
      }, { passive: true });
    });
  }

  attachMarkerHandlersToBoxes(torbildBoxesSelector);

  // --- Time tracking helpers ---
  function initTimeTrackingBox(box, storageKey = "timeData", readOnly = false) {
    if (!box) return;
    let timeDataAll = JSON.parse(localStorage.getItem(storageKey)) || {};

    box.querySelectorAll(".period").forEach(period => {
      const periodNum = period.dataset.period || Math.random().toString(36).slice(2,6);
      const buttons = period.querySelectorAll(".time-btn");

      buttons.forEach((btn, idx) => {
        const hasStored = (timeDataAll[periodNum] && typeof timeDataAll[periodNum][idx] !== "undefined");
        const stored = hasStored ? Number(timeDataAll[periodNum][idx]) : Number(btn.textContent) || 0;
        btn.textContent = stored;

        if (readOnly) {
          btn.disabled = true;
          btn.classList.add("disabled-readonly");
          return;
        }

        let lastTap = 0;
        let clickTimeout = null;
        let touchStart = 0;

        const updateValue = (delta) => {
          const current = Number(btn.textContent) || 0;
          const newVal = Math.max(0, current + delta);
          btn.textContent = newVal;
          if (!timeDataAll[periodNum]) timeDataAll[periodNum] = {};
          timeDataAll[periodNum][idx] = newVal;
          localStorage.setItem(storageKey, JSON.stringify(timeDataAll));
        };

        btn.addEventListener("click", () => {
          const now = Date.now();
          const diff = now - lastTap;
          if (diff < 300) {
            if (clickTimeout) { clearTimeout(clickTimeout); clickTimeout = null; }
            updateValue(-1);
            lastTap = 0;
          } else {
            clickTimeout = setTimeout(() => { updateValue(+1); clickTimeout = null; }, 300);
            lastTap = now;
          }
        });

        btn.addEventListener("touchstart", (e) => {
          const now = Date.now();
          const diff = now - touchStart;
          if (diff < 300) {
            e.preventDefault();
            if (clickTimeout) { clearTimeout(clickTimeout); clickTimeout = null; }
            updateValue(-1);
            touchStart = 0;
          } else {
            touchStart = now;
            setTimeout(() => {
              if (touchStart !== 0) {
                updateValue(+1);
                touchStart = 0;
              }
            }, 300);
          }
        }, { passive: true });
      });
    });
  }

  initTimeTrackingBox(torbildTimeTrackingBox, "timeData", false);
  initTimeTrackingBox(seasonMapTimeTrackingBox, "seasonMapTimeData", true);

  // --- Season Map export/import functions (modified export flow) ---
  function readTimeTrackingFromBox(box) {
    const result = {};
    if (!box) return result;
    box.querySelectorAll(".period").forEach((period, pIdx) => {
      const key = period.dataset.period || (`p${pIdx}`);
      result[key] = [];
      period.querySelectorAll(".time-btn").forEach(btn => {
        result[key].push(Number(btn.textContent) || 0);
      });
    });
    return result;
  }

  function writeTimeTrackingToBox(box, data) {
    if (!box || !data) return;
    const periods = Array.from(box.querySelectorAll(".period"));
    periods.forEach((period, pIdx) => {
      const key = period.dataset.period || (`p${pIdx}`);
      const arr = data[key] || data[Object.keys(data)[pIdx]] || [];
      period.querySelectorAll(".time-btn").forEach((btn, idx) => {
        btn.textContent = (typeof arr[idx] !== "undefined") ? arr[idx] : btn.textContent;
      });
    });
  }

  function exportSeasonMapFromTorbild() {
    // First confirm export
    const proceed = confirm("In Season Map exportieren?");
    if (!proceed) return;

    const boxes = Array.from(document.querySelectorAll(torbildBoxesSelector));
    const allMarkers = boxes.map(box => {
      const markers = [];
      box.querySelectorAll(".marker-dot").forEach(dot => {
        const left = dot.style.left || "";
        const top = dot.style.top || "";
        const bg = dot.style.backgroundColor || "";
        const xPct = parseFloat(left.replace("%","")) || 0;
        const yPct = parseFloat(top.replace("%","")) || 0;
        markers.push({ xPct, yPct, color: bg });
      });
      return markers;
    });
    localStorage.setItem("seasonMapMarkers", JSON.stringify(allMarkers));

    const timeData = readTimeTrackingFromBox(torbildTimeTrackingBox);
    localStorage.setItem("seasonMapTimeData", JSON.stringify(timeData));

    // After export, ask whether to keep data in Goal Map
    const keep = confirm("Spiel wurde in Season Map exportiert, Daten in Goal Map beibehalten? (OK = Ja, Abbrechen = Nein)");
    if (!keep) {
      // remove markers and reset time boxes in Goal Map (torbildPage)
      document.querySelectorAll("#torbildPage .marker-dot").forEach(d => d.remove());
      document.querySelectorAll("#torbildPage .time-btn").forEach(btn => btn.textContent = "0");
      localStorage.removeItem("timeData");
    }

    // navigate to seasonMap
    showPage("seasonMap");
    renderSeasonMapPage();
  }

  // --- renderGoalAreaStats (unchanged) ---
  function renderGoalAreaStats() {
    const seasonMapRoot = document.getElementById("seasonMapPage");
    if (!seasonMapRoot) return;

    const goalBoxIds = ["goalGreenBox", "goalRedBox"];
    goalBoxIds.forEach(id => {
      const box = seasonMapRoot.querySelector(`#${id}`);
      if (!box) return;
      box.querySelectorAll(".goal-area-label").forEach(el => el.remove());

      const markers = Array.from(box.querySelectorAll(".marker-dot"));
      const total = markers.length;

      const counts = { tl: 0, tr: 0, bl: 0, bm: 0, br: 0 };
      markers.forEach(m => {
        const left = parseFloat(m.style.left) || 0;
        const top = parseFloat(m.style.top) || 0;
        if (top < 50) {
          if (left < 50) counts.tl++;
          else counts.tr++;
        } else {
          if (left < 33.3333) counts.bl++;
          else if (left < 66.6667) counts.bm++;
          else counts.br++;
        }
      });

      const areas = [
        { key: "tl", x: 25, y: 22 },
        { key: "tr", x: 75, y: 22 },
        { key: "bl", x: 16, y: 75 },
        { key: "bm", x: 50, y: 75 },
        { key: "br", x: 84, y: 75 }
      ];

      areas.forEach(a => {
        const cnt = counts[a.key] || 0;
        const pct = total ? Math.round((cnt / total) * 100) : 0;
        const div = document.createElement("div");
        div.className = "goal-area-label";
        div.style.position = "absolute";
        div.style.left = `${a.x}%`;
        div.style.top = `${a.y}%`;
        div.style.transform = "translate(-50%,-50%)";
        div.style.pointerEvents = "none";
        div.style.fontWeight = "800";
        div.style.opacity = "0.45";
        div.style.fontSize = "36px";
        div.style.color = "#000000";
        div.style.textShadow = "0 1px 2px rgba(255,255,255,0.06)";
        div.style.lineHeight = "1";
        div.style.userSelect = "none";
        div.style.whiteSpace = "nowrap";
        div.textContent = `${cnt} (${pct}%)`;
        box.appendChild(div);
      });
    });

    const unnamedGoalBoxes = Array.from(seasonMapRoot.querySelectorAll(".goal-img-box")).filter(b => !["goalGreenBox","goalRedBox"].includes(b.id));
    unnamedGoalBoxes.forEach(box => {
      box.querySelectorAll(".goal-area-label").forEach(el => el.remove());
      const markers = Array.from(box.querySelectorAll(".marker-dot"));
      const total = markers.length;
      const counts = { tl: 0, tr: 0, bl: 0, bm: 0, br: 0 };
      markers.forEach(m => {
        const left = parseFloat(m.style.left) || 0;
        const top = parseFloat(m.style.top) || 0;
        if (top < 50) {
          if (left < 50) counts.tl++;
          else counts.tr++;
        } else {
          if (left < 33.3333) counts.bl++;
          else if (left < 66.6667) counts.bm++;
          else counts.br++;
        }
      });
      const areas = [
        { key: "tl", x: 25, y: 22 },
        { key: "tr", x: 75, y: 22 },
        { key: "bl", x: 16, y: 75 },
        { key: "bm", x: 50, y: 75 },
        { key: "br", x: 84, y: 75 }
      ];
      areas.forEach(a => {
        const cnt = counts[a.key] || 0;
        const pct = total ? Math.round((cnt / total) * 100) : 0;
        const div = document.createElement("div");
        div.className = "goal-area-label";
        div.style.position = "absolute";
        div.style.left = `${a.x}%`;
        div.style.top = `${a.y}%`;
        div.style.transform = "translate(-50%,-50%)";
        div.style.pointerEvents = "none";
        div.style.fontWeight = "800";
        div.style.opacity = "0.45";
        div.style.fontSize = "36px";
        div.style.color = "#000000";
        div.style.textShadow = "0 1px 2px rgba(255,255,255,0.06)";
        div.style.lineHeight = "1";
        div.style.userSelect = "none";
        div.style.whiteSpace = "nowrap";
        div.textContent = `${cnt} (${pct}%)`;
        box.appendChild(div);
      });
    });
  }

  function renderSeasonMapPage() {
    const boxes = Array.from(document.querySelectorAll(seasonMapBoxesSelector));
    boxes.forEach(box => box.querySelectorAll(".marker-dot").forEach(d => d.remove()));

    const raw = localStorage.getItem("seasonMapMarkers");
    if (raw) {
      try {
        const allMarkers = JSON.parse(raw);
        allMarkers.forEach((markersForBox, idx) => {
          const box = boxes[idx];
          if (!box || !Array.isArray(markersForBox)) return;
          markersForBox.forEach(m => {
            createMarkerPercent(m.xPct, m.yPct, m.color || "#444", box, false);
          });
        });
      } catch (e) {
        console.warn("Invalid seasonMapMarkers", e);
      }
    }
    const rawTime = localStorage.getItem("seasonMapTimeData");
    if (rawTime) {
      try {
        const tdata = JSON.parse(rawTime);
        writeTimeTrackingToBox(seasonMapTimeTrackingBox, tdata);
        seasonMapTimeTrackingBox.querySelectorAll(".time-btn").forEach(btn => {
          btn.disabled = true;
          btn.classList.add("disabled-readonly");
        });
      } catch (e) {
        console.warn("Invalid seasonMapTimeData", e);
      }
    }

    // render overlays
    renderGoalAreaStats();
  }

  function resetSeasonMap() {
    if (!confirm("⚠️ Season Map zurücksetzen (Marker + Timeboxen)?")) return;
    document.querySelectorAll("#seasonMapPage .marker-dot").forEach(d => d.remove());
    document.querySelectorAll("#seasonMapPage .time-btn").forEach(btn => btn.textContent = "0");
    localStorage.removeItem("seasonMapMarkers");
    localStorage.removeItem("seasonMapTimeData");
    alert("Season Map zurückgesetzt.");
  }

  if (exportSeasonMapBtn) {
    exportSeasonMapBtn.addEventListener("click", () => {
      exportSeasonMapFromTorbild();
      // no extra alert (flow handled in function)
    });
  }

  // Ensure torbild page behavior when opening torbild
  if (torbildBtn) {
    torbildBtn.addEventListener("click", () => {
      showPage("torbild");
      setTimeout(() => {}, 60);
    });
  }
  if (seasonMapBtn) {
    seasonMapBtn.addEventListener("click", () => {
      showPage("seasonMap");
      renderSeasonMapPage();
    });
  }
  if (backToStatsFromSeasonMapBtn) backToStatsFromSeasonMapBtn.addEventListener("click", () => showPage("stats"));
  if (document.getElementById("resetSeasonMapBtn")) document.getElementById("resetSeasonMapBtn").addEventListener("click", resetSeasonMap);

  // --- Season export (Stats -> Season) (modified flow) ---
  const exportSeasonHandler = () => {
    // first prompt: ask to export
    const proceed = confirm("Spiel zu Season exportieren?");
    if (!proceed) return;

    if (!selectedPlayers || selectedPlayers.length === 0) {
      alert("Keine Spieler ausgewählt, nichts zu exportieren.");
      return;
    }

    // perform export (accumulate as one game)
    selectedPlayers.forEach(p => {
      const name = p.name;
      const stats = statsData[name] || {};
      const timeSeconds = Number(playerTimes[name] || 0);

      if (!seasonData[name]) {
        seasonData[name] = {
          num: p.num || "",
          name: name,
          games: 0,
          goals: 0,
          assists: 0,
          plusMinus: 0,
          shots: 0,
          penaltys: 0,
          faceOffs: 0,
          faceOffsWon: 0,
          timeSeconds: 0,
          goalValue: 0
        };
      }

      seasonData[name].games = Number(seasonData[name].games || 0) + 1;
      seasonData[name].goals = Number(seasonData[name].goals || 0) + Number(stats.Goals || 0);
      seasonData[name].assists = Number(seasonData[name].assists || 0) + Number(stats.Assist || 0);
      seasonData[name].plusMinus = Number(seasonData[name].plusMinus || 0) + Number(stats["+/-"] || 0);
      seasonData[name].shots = Number(seasonData[name].shots || 0) + Number(stats.Shot || 0);
      seasonData[name].penaltys = Number(seasonData[name].penaltys || 0) + Number(stats.Penaltys || 0);
      seasonData[name].faceOffs = Number(seasonData[name].faceOffs || 0) + Number(stats.FaceOffs || 0);
      seasonData[name].faceOffsWon = Number(seasonData[name].faceOffsWon || 0) + Number(stats["FaceOffs Won"] || 0);
      seasonData[name].timeSeconds = Number(seasonData[name].timeSeconds || 0) + Number(timeSeconds || 0);
      seasonData[name].num = p.num || seasonData[name].num || "";
      seasonData[name].name = name;

      try {
        if (typeof computeValueForPlayer === "function") {
          seasonData[name].goalValue = computeValueForPlayer(name);
        } else {
          seasonData[name].goalValue = seasonData[name].goalValue || 0;
        }
      } catch (e) {
        seasonData[name].goalValue = seasonData[name].goalValue || 0;
      }
    });

    localStorage.setItem("seasonData", JSON.stringify(seasonData));

    // second prompt: ask whether to keep data in Game Data
    const keep = confirm("Spiel wurde in Season exportiert, Daten in Game Data beibehalten? (OK = Ja, Abbrechen = Nein)");
    if (!keep) {
      // clear stats + times for exported players (no further confirmations)
      selectedPlayers.forEach(p => {
        const name = p.name;
        if (!statsData[name]) statsData[name] = {};
        categories.forEach(c => { statsData[name][c] = 0; });
        playerTimes[name] = 0;
      });
      localStorage.setItem("statsData", JSON.stringify(statsData));
      localStorage.setItem("playerTimes", JSON.stringify(playerTimes));
      renderStatsTable();
    }

    showPage("season");
    renderSeasonTable();
  };

  if (exportSeasonFromStatsBtn) {
    exportSeasonFromStatsBtn.addEventListener("click", exportSeasonHandler);
  }

  // --- Export current game data (stats) to CSV: include totals row + timer ---
  function formatTimeMMSS(sec) {
    const mm = String(Math.floor(sec / 60)).padStart(2, "0");
    const ss = String(sec % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  }

  function exportStatsCSV() {
    try {
      if (!selectedPlayers || selectedPlayers.length === 0) {
        alert("Keine Spieler ausgewählt, nichts zu exportieren.");
        return;
      }
      const header = ["Nr", "Spieler", ...categories, "Time"];
      const rows = [header];

      // player rows
      selectedPlayers.forEach(p => {
        const name = p.name;
        const row = [];
        row.push(p.num || "");
        row.push(name);
        categories.forEach(cat => {
          row.push(String(Number(statsData[name]?.[cat] || 0)));
        });
        row.push(formatTimeMMSS(Number(playerTimes[name] || 0)));
        rows.push(row);
      });

      // compute totals (same logic as updateTotals)
      const totals = {};
      categories.forEach(c => totals[c] = 0);
      let totalSeconds = 0;
      selectedPlayers.forEach(p => {
        categories.forEach(c => { totals[c] += (Number(statsData[p.name]?.[c]) || 0); });
        totalSeconds += (playerTimes[p.name] || 0);
      });

      const totalRow = new Array(header.length).fill("");
      totalRow[1] = `Total (${selectedPlayers.length})`;
      categories.forEach((c, idx) => {
        const colIndex = 2 + idx;
        if (c === "+/-") {
          const vals = selectedPlayers.map(p => Number(statsData[p.name]?.[c] || 0));
          const avg = vals.length ? Math.round(vals.reduce((a,b)=>a+b,0)/vals.length) : 0;
          totalRow[colIndex] = `Ø ${avg}`;
        } else if (c === "FaceOffs Won") {
          const totalFace = totals["FaceOffs"] || 0;
          const percent = totalFace ? Math.round((totals["FaceOffs Won"]/totalFace)*100) : 0;
          totalRow[colIndex] = `${totals["FaceOffs Won"]} (${percent}%)`;
        } else {
          totalRow[colIndex] = String(totals[c] || 0);
        }
      });
      totalRow[header.length - 1] = formatTimeMMSS(totalSeconds);
      rows.push(totalRow);

      // additional row with timer button value
      const timerRow = new Array(header.length).fill("");
      timerRow[1] = "TIMER";
      timerRow[header.length - 1] = formatTimeMMSS(timerSeconds || 0);
      rows.push(timerRow);

      const csv = rows.map(r => r.join(";")).join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "stats.csv";
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      console.error("Export Stats CSV failed:", e);
      alert("Fehler beim Exportieren (siehe Konsole).");
    }
  }

  // Attach export handler to exportBtn (Game Data page)
  document.getElementById("exportBtn")?.addEventListener("click", exportStatsCSV);

  // --- Season table rendering (full) with MVP columns moved to end ---
  function parseForSort(val) {
    if (val === null || val === undefined) return "";
    const v = String(val).trim();
    if (v === "") return "";
    if (/^\d{1,2}:\d{2}$/.test(v)) {
      const [mm, ss] = v.split(":").map(Number);
      return mm*60 + ss;
    }
    if (/%$/.test(v)) {
      return Number(v.replace("%","")) || 0;
    }
    const n = Number(v.toString().replace(/[^0-9.-]/g,""));
    if (!isNaN(n) && v.match(/[0-9]/)) return n;
    return v.toLowerCase();
  }

  let seasonSort = { index: null, asc: true };

  function renderSeasonTable() {
    const container = document.getElementById("seasonContainer");
    if (!container) return;
    container.innerHTML = "";

    // Header order: MVP is right after Time, MVP Points last
    const headerCols = [
      "Nr", "Spieler", "Games",
      "Goals", "Assists", "Points", "+/-", "Ø +/-",
      "Shots", "Shots/Game", "Goals/Game", "Points/Game",
      "Penalty", "Goal Value", "FaceOffs", "FaceOffs Won", "FaceOffs %", "Time",
      "MVP", "MVP Points"
    ];

    const table = document.createElement("table");
    table.className = "stats-table";

    table.style.borderRadius = "8px";
    table.style.overflow = "hidden";
    table.style.borderCollapse = "separate";
    table.style.borderSpacing = "0";

    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    headerCols.forEach((h, idx) => {
      const th = document.createElement("th");
      th.textContent = h;
      th.dataset.colIndex = idx;
      th.className = "sortable";
      const arrow = document.createElement("span");
      arrow.className = "sort-arrow";
      arrow.style.marginLeft = "6px";
      th.appendChild(arrow);
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");

    try { ensureGoalValueDataForSeason(); } catch (e) {}

    const rows = Object.keys(seasonData).map(name => {
      const d = seasonData[name];
      const games = Number(d.games || 0);
      const goals = Number(d.goals || 0);
      const assists = Number(d.assists || 0);
      const points = goals + assists;
      const plusMinus = Number(d.plusMinus || 0);
      const shots = Number(d.shots || 0);
      const penalty = Number(d.penaltys || 0);
      const faceOffs = Number(d.faceOffs || 0);
      const faceOffsWon = Number(d.faceOffsWon || 0);
      const faceOffPercent = faceOffs ? Math.round((faceOffsWon / faceOffs) * 100) : 0;
      const timeSeconds = Number(d.timeSeconds || 0);

      const avgPlusMinus = games ? (plusMinus / games) : 0;
      const shotsPerGame = games ? (shots / games) : 0;
      const goalsPerGame = games ? (goals / games) : 0;
      const pointsPerGame = games ? (points / games) : 0;

      let goalValue = "";
      try {
        if (typeof computeValueForPlayer === "function") {
          goalValue = computeValueForPlayer(d.name);
        } else {
          goalValue = Number(d.goalValue || 0);
        }
      } catch (e) {
        goalValue = Number(d.goalValue || 0);
      }

      const gamesSafe = games || 0;
      const assistsPerGame = gamesSafe ? (assists / gamesSafe) : 0;
      const penaltyPerGame = gamesSafe ? (penalty / gamesSafe) : 0;
      const gvNum = Number(goalValue || 0);
      const mvpPointsNum = (
        (assistsPerGame * 8) +
        (avgPlusMinus * 0.5) +
        (shotsPerGame * 0.5) +
        (goalsPerGame + (gamesSafe ? (gvNum / gamesSafe) * 10 : 0)) -
        (penaltyPerGame * 1.2)
      );

      const mvpPointsRounded = Number(Number(mvpPointsNum).toFixed(1));

      const cells = [
        d.num || "",
        d.name,
        games,
        goals,
        assists,
        points,
        plusMinus,
        Number(avgPlusMinus.toFixed(1)),
        shots,
        Number(shotsPerGame.toFixed(1)),
        Number(goalsPerGame.toFixed(1)),
        Number(pointsPerGame.toFixed(1)),
        penalty,
        goalValue,
        faceOffs,
        faceOffsWon,
        `${faceOffPercent}%`,
        formatTimeMMSS(timeSeconds),
        "", // MVP placeholder
        ""  // MVP Points placeholder
      ];

      return {
        name: d.name,
        num: d.num || "",
        cells,
        raw: { games, goals, assists, points, plusMinus, shots, penalty, faceOffs, faceOffsWon, faceOffPercent, timeSeconds, goalValue },
        mvpPointsRounded
      };
    });

    const sortedByMvp = rows.slice().sort((a,b) => (b.mvpPointsRounded || 0) - (a.mvpPointsRounded || 0));
    const uniqueScores = [...new Set(sortedByMvp.map(r => r.mvpPointsRounded))];
    const scoreToRank = {};
    uniqueScores.forEach((s, idx) => { scoreToRank[s] = idx + 1; });

    rows.forEach(r => {
      const displayPoints = (typeof r.mvpPointsRounded === "number" && isFinite(r.mvpPointsRounded)) ? Number(r.mvpPointsRounded.toFixed(1)) : "";
      const rank = (typeof r.mvpPointsRounded !== "undefined" && r.mvpPointsRounded !== "" && scoreToRank.hasOwnProperty(r.mvpPointsRounded)) ? scoreToRank[r.mvpPointsRounded] : "";
      const mvpIdx = headerCols.length - 2; // second last => "MVP"
      const mvpPointsIdx = headerCols.length - 1; // last => "MVP Points"
      r.cells[mvpIdx] = rank;
      r.cells[mvpPointsIdx] = displayPoints;
    });

    let displayRows = rows.slice();
    if (seasonSort.index === null) {
      displayRows.sort((a,b) => (b.raw.points || 0) - (a.raw.points || 0));
    } else {
      const idx = seasonSort.index;
      displayRows.sort((a,b) => {
        const va = parseForSort(a.cells[idx]);
        const vb = parseForSort(b.cells[idx]);
        if (typeof va === "number" && typeof vb === "number") return seasonSort.asc ? va - vb : vb - va;
        if (va < vb) return seasonSort.asc ? -1 : 1;
        if (va > vb) return seasonSort.asc ? 1 : -1;
        return 0;
      });
    }

    displayRows.forEach(r => {
      const tr = document.createElement("tr");
      r.cells.forEach(c => {
        const td = document.createElement("td");
        td.textContent = c;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });

    const count = rows.length || 0;
    const headerBgColor = getComputedStyle(document.documentElement).getPropertyValue('--header-bg') || "#1E1E1E";
    const headerTextColor = getComputedStyle(document.documentElement).getPropertyValue('--text-color') || "#fff";
    headerRow.querySelectorAll("th").forEach(th => {
      th.style.background = headerBgColor;
      th.style.color = headerTextColor;
      th.style.fontWeight = "700";
      th.style.padding = "8px";
    });

    // compute and append total/average row
    if (count > 0) {
      const sums = {
        games: 0, goals: 0, assists: 0, points: 0, plusMinus: 0,
        shots: 0, penalty: 0, faceOffs: 0, faceOffsWon: 0, timeSeconds: 0
      };
      rows.forEach(r => {
        const rs = r.raw;
        sums.games += rs.games;
        sums.goals += rs.goals;
        sums.assists += rs.assists;
        sums.points += rs.points;
        sums.plusMinus += rs.plusMinus;
        sums.shots += rs.shots;
        sums.penalty += rs.penalty;
        sums.faceOffs += rs.faceOffs;
        sums.faceOffsWon += rs.faceOffsWon;
        sums.timeSeconds += rs.timeSeconds;
      });

      const avgGames = sums.games / count;
      const avgGoals = sums.goals / count;
      const avgAssists = sums.assists / count;
      const avgPoints = sums.points / count;
      const avgPlusMinus = sums.plusMinus / count;
      const avgShots = sums.shots / count;
      const avgPenalty = sums.penalty / count;
      const avgFaceOffs = sums.faceOffs / count;
      const avgFaceOffsWon = sums.faceOffsWon / count;
      const avgFaceOffPercent = avgFaceOffs ? Math.round((avgFaceOffsWon / avgFaceOffs) * 100) : 0;
      const avgTimeSeconds = Math.round(sums.timeSeconds / count);

      const totalCells = new Array(headerCols.length).fill("");
      totalCells[1] = "Total Ø"; // "Spieler"
      totalCells[2] = Number((avgGames).toFixed(1));
      totalCells[3] = Number((avgGoals).toFixed(1));
      totalCells[4] = Number((avgAssists).toFixed(1));
      totalCells[5] = Number((avgPoints).toFixed(1));
      totalCells[6] = Number((avgPlusMinus).toFixed(1));
      totalCells[7] = Number((avgPlusMinus).toFixed(1));
      totalCells[8] = Number((avgShots).toFixed(1));
      totalCells[9] = Number((avgShots / (avgGames || 1)).toFixed(1));
      totalCells[10] = Number((avgGoals / (avgGames || 1)).toFixed(1));
      totalCells[11] = Number((avgPoints / (avgGames || 1)).toFixed(1));
      totalCells[12] = Number((avgPenalty).toFixed(1));
      totalCells[13] = ""; // Goal Value left blank
      totalCells[14] = Number((avgFaceOffs).toFixed(1));
      totalCells[15] = Number((avgFaceOffsWon).toFixed(1));
      totalCells[16] = `${avgFaceOffPercent}%`;
      totalCells[17] = formatTimeMMSS(avgTimeSeconds);
      // MVP & MVP Points left empty

      const trTotal = document.createElement("tr");
      trTotal.className = "total-row";
      totalCells.forEach(c => {
        const td = document.createElement("td");
        td.textContent = c;
        td.style.background = headerBgColor;
        td.style.color = headerTextColor;
        td.style.fontWeight = "700";
        td.style.padding = "8px";
        trTotal.appendChild(td);
      });
      tbody.appendChild(trTotal);
    } else {
      const trTotal = document.createElement("tr");
      trTotal.className = "total-row";
      const emptyCells = new Array(headerCols.length).fill("");
      emptyCells[1] = "Total Ø";
      emptyCells.forEach(c => {
        const td = document.createElement("td");
        td.textContent = c;
        td.style.background = headerBgColor;
        td.style.color = headerTextColor;
        td.style.fontWeight = "700";
        td.style.padding = "8px";
        trTotal.appendChild(td);
      });
      tbody.appendChild(trTotal);
    }

    table.appendChild(tbody);
    container.appendChild(table);

    function updateSortUI() {
      const ths = table.querySelectorAll("th.sortable");
      ths.forEach(th => {
        const arrow = th.querySelector(".sort-arrow");
        if (!arrow) return;
        const idx = Number(th.dataset.colIndex);
        if (seasonSort.index === idx) {
          arrow.textContent = seasonSort.asc ? "▴" : "▾";
        } else {
          arrow.textContent = "";
        }
      });
    }
    updateSortUI();

    table.querySelectorAll("th.sortable").forEach(th => {
      th.style.cursor = "pointer";
      th.addEventListener("click", () => {
        const idx = Number(th.dataset.colIndex);
        if (seasonSort.index === idx) seasonSort.asc = !seasonSort.asc;
        else { seasonSort.index = idx; seasonSort.asc = true; }
        seasonSort.index = idx;
        renderSeasonTable();
      });
    });
  }

  // --- Render stats table (full) with totals styled like season header ---
  function renderStatsTable() {
    if (!statsContainer) return;
    statsContainer.innerHTML = "";

    const table = document.createElement("table");
    table.className = "stats-table";

    table.style.borderRadius = "8px";
    table.style.overflow = "hidden";
    table.style.borderCollapse = "separate";
    table.style.borderSpacing = "0";

    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    headerRow.innerHTML = `<th>#</th><th>Spieler</th>` + categories.map(c => `<th>${escapeHtml(c)}</th>`).join("") + `<th>Time</th>`;
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const headerBgColor = getComputedStyle(document.documentElement).getPropertyValue('--header-bg') || "#1E1E1E";
    const headerTextColor = getComputedStyle(document.documentElement).getPropertyValue('--text-color') || "#fff";
    headerRow.querySelectorAll("th").forEach(th => {
      th.style.background = headerBgColor;
      th.style.color = headerTextColor;
      th.style.fontWeight = "700";
      th.style.padding = "8px";
    });

    const tbody = document.createElement("tbody");
    tbody.addEventListener("dragover", (e) => { e.preventDefault(); });
    tbody.addEventListener("drop", (e) => {
      e.preventDefault();
      try {
        const playerName = e.dataTransfer.getData("text/plain");
        if (!playerName) return;
        const draggedIndex = selectedPlayers.findIndex(p => p.name === playerName);
        if (draggedIndex === -1) return;
        const targetTr = e.target.closest("tr");
        const isTotal = targetTr && targetTr.classList.contains("total-row");
        let dropIndex;
        if (!targetTr || isTotal) {
          dropIndex = selectedPlayers.length - 1;
        } else {
          dropIndex = Number(targetTr.dataset.index);
          if (isNaN(dropIndex)) dropIndex = selectedPlayers.length - 1;
        }
        if (draggedIndex === dropIndex) return;
        const [item] = selectedPlayers.splice(draggedIndex, 1);
        const adjustedIndex = (draggedIndex < dropIndex) ? dropIndex : dropIndex;
        selectedPlayers.splice(adjustedIndex, 0, item);
        localStorage.setItem("selectedPlayers", JSON.stringify(selectedPlayers));
        renderStatsTable();
      } catch (err) {
        console.warn("Drop failed:", err);
      }
    });

    selectedPlayers.forEach((p, idx) => {
      const tr = document.createElement("tr");
      tr.classList.add(idx % 2 === 0 ? "even-row" : "odd-row");
      tr.dataset.index = String(idx);
      tr.dataset.player = p.name;
      tr.style.userSelect = "none";

      tr.addEventListener("dragstart", (ev) => {
        try {
          ev.dataTransfer.setData("text/plain", p.name);
          ev.dataTransfer.effectAllowed = "move";
          tr.classList.add("dragging");
        } catch (e) {}
      });
      tr.addEventListener("dragend", () => {
        tr.draggable = false;
        tr.classList.remove("dragging");
        tr.classList.remove("drag-enabled");
        tr.style.cursor = "";
        tr.style.outline = "";
      });

      const numTd = document.createElement("td");
      numTd.innerHTML = `<strong>${escapeHtml(p.num || "-")}</strong>`;
      tr.appendChild(numTd);

      const nameTd = document.createElement("td");
      nameTd.style.cssText = "text-align:left;padding-left:12px;cursor:pointer;";
      nameTd.innerHTML = `<strong>${escapeHtml(p.name)}</strong>`;
      tr.appendChild(nameTd);

      categories.forEach(c => {
        const td = document.createElement("td");
        const val = statsData[p.name]?.[c] ?? 0;
        const posColor = getComputedStyle(document.documentElement).getPropertyValue('--cell-pos-color')?.trim() || "#00ff80";
        const negColor = getComputedStyle(document.documentElement).getPropertyValue('--cell-neg-color')?.trim() || "#ff4c4c";
        const zeroColor = getComputedStyle(document.documentElement).getPropertyValue('--cell-zero-color')?.trim() || "#ffffff";
        const color = val > 0 ? posColor : val < 0 ? negColor : zeroColor;
        td.dataset.player = p.name;
        td.dataset.cat = c;
        td.style.color = color;
        td.textContent = val;
        tr.appendChild(td);
      });

      const iceTd = document.createElement("td");
      iceTd.className = "ice-time-cell";
      iceTd.dataset.player = p.name;
      const seconds = playerTimes[p.name] || 0;
      const m = String(Math.floor(seconds / 60)).padStart(2,"0");
      const s = String(seconds % 60).padStart(2,"0");
      iceTd.textContent = `${m}:${s}`;
      tr.appendChild(iceTd);

      (function(nameCell, playerName, rowEl) {
        const LONG_DRAG_MS = 500;
        let holdTimer = null;
        let suppressClick = false;

        function enableDragVisual() {
          rowEl.draggable = true;
          rowEl.classList.add("drag-enabled");
          rowEl.style.cursor = "grabbing";
          rowEl.style.outline = "2px dashed rgba(0,0,0,0.08)";
        }

        nameCell.addEventListener("mousedown", (ev) => {
          if (holdTimer) clearTimeout(holdTimer);
          holdTimer = setTimeout(() => {
            suppressClick = true;
            enableDragVisual();
          }, LONG_DRAG_MS);
        });
        nameCell.addEventListener("mouseup", () => { if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; } });
        nameCell.addEventListener("mouseleave", () => { if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; } });

        nameCell.addEventListener("touchstart", (ev) => {
          if (holdTimer) clearTimeout(holdTimer);
          holdTimer = setTimeout(() => {
            suppressClick = true;
            enableDragVisual();
          }, LONG_DRAG_MS);
        }, { passive: true });
        nameCell.addEventListener("touchend", () => { if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; } }, { passive: true });

        nameCell.addEventListener("click", (ev) => {
          if (suppressClick) { suppressClick = false; return; }
          if (activeTimers[playerName]) {
            clearInterval(activeTimers[playerName]);
            delete activeTimers[playerName];
            nameCell.style.backgroundColor = "";
            rowEl.style.backgroundColor = "";
          } else {
            activeTimers[playerName] = setInterval(() => {
              playerTimes[playerName] = (playerTimes[playerName] || 0) + 1;
              localStorage.setItem("playerTimes", JSON.stringify(playerTimes));
              const sec = playerTimes[playerName];
              const mm = String(Math.floor(sec / 60)).padStart(2,"0");
              const ss = String(sec % 60).padStart(2,"0");
              const cell = statsContainer.querySelector(`.ice-time-cell[data-player="${playerName}"]`);
              if (cell) cell.textContent = `${mm}:${ss}`;
              updateIceTimeColors();
            }, 1000);
            nameCell.style.backgroundColor = "#005c2f";
            rowEl.style.backgroundColor = "#005c2f";
          }
        });
      })(nameTd, p.name, tr);

      tbody.appendChild(tr);
    });

    const totalsRow = document.createElement("tr");
    totalsRow.id = "totalsRow";
    const tdEmpty = document.createElement("td"); tdEmpty.textContent = "";
    const tdTotalLabel = document.createElement("td"); tdTotalLabel.textContent = `Total (${selectedPlayers.length})`;
    totalsRow.appendChild(tdEmpty);
    totalsRow.appendChild(tdTotalLabel);
    categories.forEach(c => {
      const td = document.createElement("td");
      td.className = "total-cell";
      td.dataset.cat = c;
      td.textContent = "0";
      totalsRow.appendChild(td);
    });
    const tdTimeTotal = document.createElement("td");
    tdTimeTotal.className = "total-cell";
    tdTimeTotal.dataset.cat = "Time";
    tdTimeTotal.textContent = "";
    totalsRow.appendChild(tdTimeTotal);

    const headerBg = headerBgColor;
    const headerColor = headerTextColor;
    Array.from(totalsRow.children).forEach(td => {
      td.style.background = headerBg;
      td.style.color = headerColor;
      td.style.fontWeight = "700";
      td.style.padding = "8px";
    });

    tbody.appendChild(totalsRow);

    table.appendChild(tbody);
    statsContainer.appendChild(table);

    statsContainer.querySelectorAll("td[data-player]").forEach(td => {
      let clickTimeout = null;
      td.addEventListener("click", (e) => {
        if (clickTimeout) clearTimeout(clickTimeout);
        clickTimeout = setTimeout(() => {
          changeValue(td, 1);
          clickTimeout = null;
        }, 200);
      });
      td.addEventListener("dblclick", (e) => {
        e.preventDefault();
        if (clickTimeout) { clearTimeout(clickTimeout); clickTimeout = null; }
        changeValue(td, -1);
      });
    });

    updateIceTimeColors();
    updateTotals();
  }

  // --- change value helper ---
  function changeValue(td, delta) {
    const player = td.dataset.player;
    const cat = td.dataset.cat;
    if (!statsData[player]) statsData[player] = {};
    statsData[player][cat] = (statsData[player][cat] || 0) + delta;
    statsData[player][cat] = Math.trunc(statsData[player][cat]);
    localStorage.setItem("statsData", JSON.stringify(statsData));
    td.textContent = statsData[player][cat];

    const val = statsData[player][cat];
    const posColor = getComputedStyle(document.documentElement).getPropertyValue('--cell-pos-color')?.trim() || "#00ff80";
    const negColor = getComputedStyle(document.documentElement).getPropertyValue('--cell-neg-color')?.trim() || "#ff4c4c";
    const zeroColor = getComputedStyle(document.documentElement).getPropertyValue('--cell-zero-color')?.trim() || "#ffffff";
    td.style.color = val > 0 ? posColor : val < 0 ? negColor : zeroColor;

    updateTotals();
  }

  // --- update totals ---
  function updateTotals() {
    const totals = {};
    categories.forEach(c => totals[c] = 0);
    let totalSeconds = 0;
    selectedPlayers.forEach(p => {
      categories.forEach(c => { totals[c] += (Number(statsData[p.name]?.[c]) || 0); });
      totalSeconds += (playerTimes[p.name] || 0);
    });

    document.querySelectorAll(".total-cell").forEach(tc => {
      const cat = tc.dataset.cat;
      if (cat === "+/-") {
        const vals = selectedPlayers.map(p => Number(statsData[p.name]?.[cat] || 0));
        const avg = vals.length ? Math.round(vals.reduce((a,b)=>a+b,0)/vals.length) : 0;
        tc.textContent = `Ø ${avg}`;
        tc.style.color = "#ffffff";
      } else if (cat === "FaceOffs Won") {
        const totalFace = totals["FaceOffs"] || 0;
        const percent = totalFace ? Math.round((totals["FaceOffs Won"]/totalFace)*100) : 0;
        const percentColor = percent > 50 ? "#00ff80" : percent < 50 ? "#ff4c4c" : "#ffffff";
        tc.innerHTML = `<span style="color:white">${totals["FaceOffs Won"]}</span> (<span style="color:${percentColor}">${percent}%</span>)`;
      } else if (cat === "FaceOffs" || ["Goal","Assist","Penaltys"].includes(cat)) {
        tc.textContent = totals[cat] || 0;
        tc.style.color = "#ffffff";
      } else if (cat === "Shot") {
        if (!tc.dataset.opp) tc.dataset.opp = 0;
        const own = totals["Shot"] || 0;
        const opp = Number(tc.dataset.opp) || 0;
        let ownColor = "#ffffff", oppColor = "#ffffff";
        if (own > opp) { ownColor = "#00ff80"; oppColor = "#ff4c4c"; }
        else if (opp > own) { ownColor = "#ff4c4c"; oppColor = "#00ff80"; }
        tc.innerHTML = `<span style="color:${ownColor}">${own}</span> <span style="color:white">vs</span> <span style="color:${oppColor}">${opp}</span>`;
        tc.onclick = () => {
          tc.dataset.opp = Number(tc.dataset.opp || 0) + 1;
          updateTotals();
        };
      } else if (cat === "Time") {
        const mm = String(Math.floor(totalSeconds / 60)).padStart(2,"0");
        const ss = String(totalSeconds % 60).padStart(2,"0");
        tc.textContent = `${mm}:${ss}`;
      } else {
        tc.textContent = totals[cat] || 0;
        const posColor = getComputedStyle(document.documentElement).getPropertyValue('--cell-pos-color')?.trim() || "#00ff80";
        const negColor = getComputedStyle(document.documentElement).getPropertyValue('--cell-neg-color')?.trim() || "#ff4c4c";
        const zeroColor = getComputedStyle(document.documentElement).getPropertyValue('--cell-zero-color')?.trim() || "#ffffff";
        tc.style.color = totals[cat] > 0 ? posColor : totals[cat] < 0 ? negColor : zeroColor;
      }
    });
  }

  // --- timer helpers ---
  function updateTimerDisplay(){
    const m = String(Math.floor(timerSeconds / 60)).padStart(2,"0");
    const s = String(timerSeconds % 60).padStart(2,"0");
    if (timerBtn) timerBtn.textContent = `${m}:${s}`;
    localStorage.setItem("timerSeconds", timerSeconds.toString());
  }
  function startTimer(){
    if (!timerInterval) {
      timerInterval = setInterval(() => { timerSeconds++; updateTimerDisplay(); }, 1000);
      timerRunning = true;
      if (timerBtn) { timerBtn.classList.remove("stopped","reset"); timerBtn.classList.add("running"); }
    }
  }
  function stopTimer(){
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    timerRunning = false;
    if (timerBtn) { timerBtn.classList.remove("running","reset"); timerBtn.classList.add("stopped"); }
  }
  function resetTimerOnlyClock(){
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    timerSeconds = 0; timerRunning = false;
    updateTimerDisplay();
    if (timerBtn) { timerBtn.classList.remove("running","stopped"); timerBtn.classList.add("reset"); }
  }

  let holdTimer = null, longPress = false;
  const LONG_MS = 800;
  if (timerBtn) {
    timerBtn.addEventListener("mousedown", () => { longPress=false; holdTimer = setTimeout(()=>{ resetTimerOnlyClock(); longPress=true; }, LONG_MS); });
    timerBtn.addEventListener("mouseup", () => { if (holdTimer) clearTimeout(holdTimer); });
    timerBtn.addEventListener("mouseleave", () => { if (holdTimer) clearTimeout(holdTimer); });
    timerBtn.addEventListener("touchstart", () => { longPress=false; holdTimer = setTimeout(()=>{ resetTimerOnlyClock(); longPress=true; }, LONG_MS); }, {passive:true});
    timerBtn.addEventListener("touchend", () => { if (holdTimer) clearTimeout(holdTimer); });
    timerBtn.addEventListener("touchcancel", () => { if (holdTimer) clearTimeout(holdTimer); }, {passive:true});
    timerBtn.addEventListener("click", () => { if (longPress) { longPress=false; return; } if (timerInterval) stopTimer(); else startTimer(); });
  }

  // --- Reset functions ---
  function resetStatsPage() {
    const sicher = confirm("⚠️ Spieldaten zurücksetzen?");
    if (!sicher) return;
    localStorage.removeItem("statsData");
    localStorage.removeItem("playerTimes");
    statsData = {};
    playerTimes = {};
    renderStatsTable();
    alert("Spieldaten zurückgesetzt.");
  }

  function resetTorbildPage() {
    const sicher = confirm("⚠️ Goal Map (Marker & Timeboxen) zurücksetzen?");
    if (!sicher) return;
    document.querySelectorAll("#torbildPage .marker-dot").forEach(d => d.remove());
    document.querySelectorAll("#torbildPage .time-btn").forEach(btn => btn.textContent = "0");
    localStorage.removeItem("timeData");
    alert("Goal Map zurückgesetzt.");
  }

  function resetSeasonPage() {
    const sicher = confirm("⚠️ Season-Daten löschen?");
    if (!sicher) return;
    seasonData = {};
    localStorage.removeItem("seasonData");
    renderSeasonTable();
    alert("Season-Daten gelöscht.");
  }

  document.getElementById("resetBtn")?.addEventListener("click", resetStatsPage);
  document.getElementById("resetTorbildBtn")?.addEventListener("click", resetTorbildPage);
  document.getElementById("resetSeasonBtn")?.addEventListener("click", resetSeasonPage);

  document.getElementById("resetSeasonMapBtn")?.addEventListener("click", resetSeasonMap);

  // --- Pages navigation --- (use showPageRef to keep previous API)
  function showPageFull(page) {
    Object.values(pages).forEach(p => { if (p) p.style.display = "none"; });
    if (pages[page]) pages[page].style.display = "block";
    localStorage.setItem("currentPage", page);

    let title = "Spielerstatistik";
    if (page === "selection") title = "Spielerauswahl";
    else if (page === "stats") title = "Statistiken";
    else if (page === "torbild") title = "Goal Map";
    else if (page === "goalValue") title = "Goal Value";
    else if (page === "season") title = "Season";
    else if (page === "seasonMap") title = "Season Map";
    document.title = title;

    setTimeout(updateTimerDisplay, 20);
    setTimeout(() => {
      if (page === "season") renderSeasonTable();
      if (page === "goalValue") renderGoalValuePage();
      if (page === "seasonMap") renderSeasonMapPage();
    }, 60);
  }
  window.showPage = showPageFull;
  const showPageRef = window.showPage;

  selectPlayersBtn?.addEventListener("click", () => showPageRef("selection"));
  backToStatsBtn?.addEventListener("click", () => showPageRef("stats"));
  backToStatsFromSeasonBtn?.addEventListener("click", () => showPageRef("stats"));
  seasonBtn?.addEventListener("click", () => { showPageRef("season"); renderSeasonTable(); });
  goalValueBtn?.addEventListener("click", () => showPageRef("goalValue"));
  backFromGoalValueBtn?.addEventListener("click", () => showPageRef("stats"));
  resetGoalValueBtn?.addEventListener("click", resetGoalValuePage);

  // ----- GOAL VALUE Helpers -----
  function getGoalValueOpponents() {
    try {
      const raw = localStorage.getItem("goalValueOpponents");
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    const defaults = [];
    for (let i=1;i<=19;i++) defaults.push(`Opponent ${i}`);
    return defaults;
  }
  function setGoalValueOpponents(arr) { localStorage.setItem("goalValueOpponents", JSON.stringify(arr)); }
  function getGoalValueData() {
    try {
      const raw = localStorage.getItem("goalValueData");
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return {};
  }
  function setGoalValueData(obj) { localStorage.setItem("goalValueData", JSON.stringify(obj)); }
  function getGoalValueBottom() {
    try {
      const raw = localStorage.getItem("goalValueBottom");
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    const opps = getGoalValueOpponents();
    return opps.map(()=>0);
  }
  function setGoalValueBottom(arr) { localStorage.setItem("goalValueBottom", JSON.stringify(arr)); }

  function ensureGoalValueDataForSeason() {
    let opponents = getGoalValueOpponents();
    if (opponents.length !== 19) {
      const trimmed = opponents.slice(0,19);
      while (trimmed.length < 19) trimmed.push(`Opponent ${trimmed.length+1}`);
      setGoalValueOpponents(trimmed);
      opponents = trimmed;
    }
    const opps = opponents;
    const all = getGoalValueData();
    const seasonPlayers = Object.keys(seasonData).length ? Object.keys(seasonData) : selectedPlayers.map(p=>p.name);
    seasonPlayers.forEach(name => {
      if (!all[name] || !Array.isArray(all[name])) {
        all[name] = opps.map(()=>0);
      } else {
        while (all[name].length < opps.length) all[name].push(0);
        if (all[name].length > opps.length) all[name] = all[name].slice(0, opps.length);
      }
    });
    setGoalValueData(all);
    const bottom = getGoalValueBottom();
    if (bottom.length !== opps.length) {
      const newB = opps.map((_,i) => (typeof bottom[i] !== "undefined" ? bottom[i] : 0));
      setGoalValueBottom(newB);
    }
    return all;
  }

  function escapeHtml(s) {
    return String(s || "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  }

  function computeValueForPlayer(name) {
    const data = getGoalValueData();
    const bottom = getGoalValueBottom();
    const vals = (data[name] && Array.isArray(data[name])) ? data[name] : [];
    let sum = 0;
    for (let i = 0; i < bottom.length; i++) {
      const cell = Number(vals[i] || 0);
      const w = Number(bottom[i] || 0);
      sum += cell * w;
    }
    return sum;
  }

  function formatValueNumber(v) {
    if (Math.abs(v - Math.round(v)) < 0.0001) return String(Math.round(v));
    return String(Number(v.toFixed(1)));
  }

  function getGoalValueOpponentsSafe() {
    const opp = getGoalValueOpponents();
    const arr = Array.isArray(opp) ? opp.slice(0,19) : [];
    while (arr.length < 19) arr.push(`Opponent ${arr.length+1}`);
    return arr;
  }

  // --- Updated: renderGoalValuePage using click/dblclick/touch for goal cells ---
  function renderGoalValuePage() {
    if (!goalValueContainer) return;
    goalValueContainer.innerHTML = "";

    const opponents = getGoalValueOpponents();
    ensureGoalValueDataForSeason();
    const goalData = getGoalValueData();
    const bottom = getGoalValueBottom();

    const playerNames = Object.keys(seasonData).length ? Object.keys(seasonData).sort() : selectedPlayers.map(p=>p.name);

    const table = document.createElement("table");
    table.className = "goalvalue-table";
    table.style.width = "100%";
    table.style.borderCollapse = "collapse";
    table.style.borderRadius = "8px";
    table.style.overflow = "hidden";

    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");

    const thPlayer = document.createElement("th");
    thPlayer.style.textAlign = "center";
    thPlayer.style.padding = "8px 6px";
    thPlayer.style.borderBottom = "2px solid #333";
    thPlayer.textContent = "Spieler";
    headerRow.appendChild(thPlayer);

    opponents.forEach((op, idx) => {
      const th = document.createElement("th");
      th.style.padding = "6px";
      th.style.borderBottom = "2px solid #333";
      th.style.textAlign = "center";
      const input = document.createElement("input");
      input.type = "text";
      input.value = op;
      input.className = "goalvalue-title-input";
      input.style.width = "100%";
      input.style.boxSizing = "border-box";
      input.style.textAlign = "center";
      input.addEventListener("change", () => {
        const arr = getGoalValueOpponents();
        arr[idx] = input.value || `Opponent ${idx+1}`;
        setGoalValueOpponents(arr);
        ensureGoalValueDataForSeason();
        renderGoalValuePage();
      });
      th.appendChild(input);
      headerRow.appendChild(th);
    });

    const thValue = document.createElement("th");
    thValue.style.padding = "6px";
    thValue.style.borderBottom = "2px solid #333";
    thValue.style.textAlign = "center";
    thValue.textContent = "Value";
    headerRow.appendChild(thValue);

    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    const valueCellMap = {};

    // For each player, render a row. For opponent columns, render clickable cells (increment on click, decrement on dblclick / double-tap)
    playerNames.forEach(name => {
      const row = document.createElement("tr");
      row.style.borderBottom = "1px solid #333";

      const tdName = document.createElement("td");
      tdName.textContent = name;
      tdName.style.textAlign = "left";
      tdName.style.padding = "6px";
      tdName.style.fontWeight = "700";
      row.appendChild(tdName);

      const playerVals = (goalData[name] && Array.isArray(goalData[name])) ? goalData[name] : opponents.map(()=>0);
      while (playerVals.length < opponents.length) playerVals.push(0);

      opponents.forEach((op, idx) => {
        const td = document.createElement("td");
        td.style.padding = "6px";
        td.style.textAlign = "center";
        td.style.cursor = "pointer";
        td.dataset.player = name;
        td.dataset.opp = String(idx);
        const cellVal = Number(playerVals[idx] || 0);
        td.textContent = String(cellVal);

        // interaction: click -> +1 (single click), dblclick -> -1
        let clickTimeout = null;
        td.addEventListener("click", () => {
          if (clickTimeout) clearTimeout(clickTimeout);
          clickTimeout = setTimeout(() => {
            // single click -> increment
            const all = getGoalValueData();
            if (!all[name]) all[name] = opponents.map(()=>0);
            all[name][idx] = Math.max(0, (Number(all[name][idx]||0) + 1));
            setGoalValueData(all);
            td.textContent = String(all[name][idx]);
            const valCell = valueCellMap[name];
            if (valCell) valCell.textContent = formatValueNumber(computeValueForPlayer(name));
            clickTimeout = null;
          }, 200);
        });
        td.addEventListener("dblclick", (e) => {
          e.preventDefault();
          if (clickTimeout) { clearTimeout(clickTimeout); clickTimeout = null; }
          const all = getGoalValueData();
          if (!all[name]) all[name] = opponents.map(()=>0);
          all[name][idx] = Math.max(0, (Number(all[name][idx]||0) - 1));
          setGoalValueData(all);
          td.textContent = String(all[name][idx]);
          const valCell = valueCellMap[name];
          if (valCell) valCell.textContent = formatValueNumber(computeValueForPlayer(name));
        });

        // touch: implement double-tap detection similar to time buttons
        let lastTap = 0;
        td.addEventListener("touchstart", (e) => {
          const now = Date.now();
          const diff = now - lastTap;
          if (diff < 300) {
            e.preventDefault();
            if (clickTimeout) { clearTimeout(clickTimeout); clickTimeout = null; }
            // double-tap -> decrement
            const all = getGoalValueData();
            if (!all[name]) all[name] = opponents.map(()=>0);
            all[name][idx] = Math.max(0, (Number(all[name][idx]||0) - 1));
            setGoalValueData(all);
            td.textContent = String(all[name][idx]);
            const valCell = valueCellMap[name];
            if (valCell) valCell.textContent = formatValueNumber(computeValueForPlayer(name));
            lastTap = 0;
          } else {
            lastTap = now;
            setTimeout(() => {
              if (lastTap !== 0) {
                // single tap -> increment
                const all = getGoalValueData();
                if (!all[name]) all[name] = opponents.map(()=>0);
                all[name][idx] = Math.max(0, (Number(all[name][idx]||0) + 1));
                setGoalValueData(all);
                td.textContent = String(all[name][idx]);
                const valCell = valueCellMap[name];
                if (valCell) valCell.textContent = formatValueNumber(computeValueForPlayer(name));
                lastTap = 0;
              }
            }, 300);
          }
        }, { passive: true });

        row.appendChild(td);
      });

      const tdValue = document.createElement("td");
      tdValue.style.padding = "6px";
      tdValue.style.textAlign = "center";
      const computed = computeValueForPlayer(name);
      tdValue.textContent = formatValueNumber(computed);
      row.appendChild(tdValue);
      valueCellMap[name] = tdValue;

      tbody.appendChild(row);
    });

    // bottom row: keep selects for scale (user can still edit weights)
    const bottomRow = document.createElement("tr");
    bottomRow.style.background = "rgba(0,0,0,0.05)";
    const bottomLabel = document.createElement("td");
    bottomLabel.style.padding = "6px";
    bottomLabel.style.fontWeight = "700";
    bottomLabel.style.textAlign = "center";
    bottomLabel.textContent = "Goal Value";
    bottomRow.appendChild(bottomLabel);

    const goalValueOptions = [];
    for (let v=0; v<=10; v++) goalValueOptions.push((v*0.5).toFixed(1));

    const bottomStored = getGoalValueBottom();
    while (bottomStored.length < opponents.length) bottomStored.push(0);
    if (bottomStored.length > opponents.length) bottomStored.length = opponents.length;
    setGoalValueBottom(bottomStored);

    opponents.forEach((op, idx) => {
      const td = document.createElement("td");
      td.style.padding = "6px";
      td.style.textAlign = "center";
      const sel = document.createElement("select");
      sel.style.width = "80px";
      goalValueOptions.forEach(opt => {
        const o = document.createElement("option");
        o.value = opt;
        o.textContent = opt;
        sel.appendChild(o);
      });
      const b = getGoalValueBottom();
      if (b && typeof b[idx] !== "undefined") sel.value = String(b[idx]);
      sel.addEventListener("change", () => {
        const arr = getGoalValueBottom();
        arr[idx] = Number(sel.value);
        setGoalValueBottom(arr);
        Object.keys(valueCellMap).forEach(playerName => {
          const el = valueCellMap[playerName];
          if (el) el.textContent = formatValueNumber(computeValueForPlayer(playerName));
        });
      });
      td.appendChild(sel);
      bottomRow.appendChild(td);
    });

    const tdEmptyForValue = document.createElement("td");
    tdEmptyForValue.style.padding = "6px";
    tdEmptyForValue.textContent = "";
    bottomRow.appendChild(tdEmptyForValue);

    tbody.appendChild(bottomRow);
    table.appendChild(tbody);
    goalValueContainer.appendChild(table);
  }

  function resetGoalValuePage() {
    if (!confirm("⚠️ Goal Value zurücksetzen? Alle Spielerwerte auf 0 und Skalen auf 0 setzen.")) return;
    const opponents = getGoalValueOpponents();
    const playerNames = Object.keys(seasonData).length ? Object.keys(seasonData) : selectedPlayers.map(p=>p.name);
    const newData = {};
    playerNames.forEach(n => newData[n] = opponents.map(()=>0));
    setGoalValueData(newData);
    setGoalValueBottom(opponents.map(()=>0));
    renderGoalValuePage();
    alert("Goal Value zurückgezet.");
  }

  // --- Final init and restore state on load ---
  seasonData = JSON.parse(localStorage.getItem("seasonData")) || seasonData || {};

  renderPlayerSelection();

  const lastPage = localStorage.getItem("currentPage") || (selectedPlayers.length ? "stats" : "selection");
  if (lastPage === "stats") {
    showPageRef("stats");
    renderStatsTable();
    updateIceTimeColors();
  } else if (lastPage === "season") {
    showPageRef("season");
    renderSeasonTable();
  } else if (lastPage === "seasonMap") {
    showPageRef("seasonMap");
    renderSeasonMapPage();
  } else if (lastPage === "goalValue") {
    showPageRef("goalValue");
    renderGoalValuePage();
  } else {
    showPageRef("selection");
  }

  // initial timer display
  updateTimerDisplay();

  // Save to localStorage on unload
  window.addEventListener("beforeunload", () => {
    try {
      localStorage.setItem("statsData", JSON.stringify(statsData));
      localStorage.setItem("selectedPlayers", JSON.stringify(selectedPlayers));
      localStorage.setItem("playerTimes", JSON.stringify(playerTimes));
      localStorage.setItem("timerSeconds", String(timerSeconds));
      localStorage.setItem("seasonData", JSON.stringify(seasonData));
      localStorage.setItem("goalValueOpponents", JSON.stringify(getGoalValueOpponents()));
      localStorage.setItem("goalValueData", JSON.stringify(getGoalValueData()));
      localStorage.setItem("goalValueBottom", JSON.stringify(getGoalValueBottom()));
    } catch (e) {
      // ignore
    }
  });
});
