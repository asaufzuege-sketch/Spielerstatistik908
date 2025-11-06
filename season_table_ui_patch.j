// season_table_ui_patch.js
//  - verschiebt 'MVP Points' und 'MVP' Spalten ans Ende der Season-Tabelle (MVP als letzte Spalte)
//  - sorgt dafür, dass Goal-Value-Tabellen gestreift sind und per click/dblclick editierbar sind
//  - integriert Änderungen zurück in vorhandene <select> (dispatches 'change')
//  - Fügt behavior per DOMContentLoaded hinzu; kann auch manuell durch Aufruf initSeasonTableUI() angestoßen werden

(function () {
  'use strict';

  // --- Konfiguration: passe Selektoren an deine App falls nötig ---
  const seasonTableSelectors = [
    '#seasonTable',       // mögliche id
    '.season-table',      // mögliche klasse
    'table.season',       // generisch
    'table[data-role="season-table"]',
    'table'               // fallback: erste table auf Seite (Vorsicht)
  ];

  // Goal value tables: ermittelt Tabellen, die <select> mit goal-Optionen enthalten
  const goalValueTableSelectors = [
    '#goalValues',        // falls id
    '.goal-values',       // falls klasse
    'table[data-role="goal-values"]',
    'table'               // fallback: wir filtern später nach select-Inhalt
  ];

  // Header-Namen zum Suchen (groß/kleinschreibung ignoriert)
  const MVP_POINTS_HEADER = 'mvp points';
  const MVP_HEADER = 'mvp';

  // --- Hilfsfunktionen ---
  function findElement(selectors) {
    for (const sel of selectors) {
      try {
        const el = document.querySelector(sel);
        if (el) return el;
      } catch (e) { continue; }
    }
    return null;
  }

  function findAllTables() {
    return Array.from(document.querySelectorAll('table'));
  }

  function textTrimLower(el) {
    return (el && el.textContent || '').trim().toLowerCase();
  }

  // Verschiebe Spalte mit headerText (case-insensitive) ans Ende; wirkt auf header row + alle tbody/tr
  function moveColumnToEnd(table, headerTextsInOrder) {
    const thead = table.tHead;
    if (!thead) return;
    const headerRow = thead.rows[0];
    if (!headerRow) return;

    // Build header cell index map
    const headers = Array.from(headerRow.cells);
    // find indices for each desired header (match by headerTextsInOrder sequentially)
    const indices = [];
    for (const headerText of headerTextsInOrder) {
      let idx = -1;
      for (let i = 0; i < headers.length; i++) {
        if (textTrimLower(headers[i]) === headerText.toLowerCase()) { idx = i; break; }
      }
      if (idx >= 0) indices.push(idx);
      else {
        // try partial match (header contains)
        for (let i = 0; i < headers.length; i++) {
          if (textTrimLower(headers[i]).includes(headerText.toLowerCase())) { idx = i; break; }
        }
        if (idx >= 0) indices.push(idx);
      }
    }

    // If none found -> try more relaxed matching
    if (!indices.length) return;

    // We will move columns in the order given so final order is preserved (first move MVP Points, then MVP)
    // Because moving changes indices, compute by header element reference rather than index.
    for (const headerText of headerTextsInOrder) {
      // find header cell element by matching text
      const hdrCell = headers.find(h => textTrimLower(h).includes(headerText.toLowerCase()));
      if (!hdrCell) continue;
      // append header cell to end of header row
      headerRow.appendChild(hdrCell);

      // compute the index of the moved column in original rows (we can detect by matching data-col attribute if present;
      // fallback: use cell position in the header row's current children lengths minus 1 = new index; but simpler:
      // we will find the cell in each body row with a matching data-col or by position of original header index - however DOM mutation changed header positions
      // so we use a robust method: detect original header text content to identify the column's position in the old header list.
    }

    // After reordering header cells, reconstruct a mapping from header text -> new header order
    const newHeaders = Array.from(headerRow.cells);
    const headerTexts = newHeaders.map(h => textTrimLower(h));

    // Now re-order body cells row-by-row so that columns align with headerRow order
    const tbody = table.tBodies[0];
    if (!tbody) return;
    for (const row of Array.from(tbody.rows)) {
      // Build a map of headerText -> cell (try data-col or aria-label or title, else fallback to index mapping)
      const cellMap = {};
      // If cells have data attributes mapping to header, use them
      Array.from(row.cells).forEach((cell, i) => {
        const tag = (cell.getAttribute('data-col') || cell.getAttribute('aria-label') || cell.getAttribute('title') || '').trim().toLowerCase();
        if (tag) cellMap[tag] = cell;
        else {
          // fallback: assign by position to an 'index-N' placeholder
          cellMap[`index-${i}`] = cell;
        }
      });

      // If the number of cells equals number of headers we can re-order by index mapping
      if (row.cells.length === newHeaders.length) {
        // simple move: append each cell in the header order by taking current cells by index
        // (we assume header order corresponds to desired column order already)
        const curCells = Array.from(row.cells);
        for (let i = 0; i < newHeaders.length; i++) {
          // append the cell matching original header position i
          // If existing number of cells equals headers, just append in current order adjusted by header repositioning
          row.appendChild(curCells[i]);
        }
      } else {
        // fallback: do nothing; difficult to reliably remap if column counts differ
      }
    }
  }

  // Simpler robust approach: identify header index of MVP Points and MVP (using original header row), then for each row move the TD at that index to end.
  function moveColumnsByText(table, headerTextsInOrder) {
    const thead = table.tHead;
    if (!thead) return;
    const headerRow = thead.rows[0];
    if (!headerRow) return;

    // snapshot of header text at start
    const headerCells = Array.from(headerRow.cells);
    const headerTexts = headerCells.map(h => textTrimLower(h));

    // find indices
    const indices = [];
    for (const headerText of headerTextsInOrder) {
      let idx = headerTexts.indexOf(headerText.toLowerCase());
      if (idx === -1) {
        // try contains
        idx = headerTexts.findIndex(ht => ht.includes(headerText.toLowerCase()));
      }
      if (idx >= 0) indices.push(idx);
    }
    if (!indices.length) return;

    // For each index (in ascending order), move the header cell and move each row's cell at that index to the end.
    // Important: when we move a earlier index to the end, indices of subsequent columns shift left by 1.
    indices.forEach((origIndex, shiftCount) => {
      // compute current index considering previous moves: if we've moved k columns already and the origIndex > movedIndex then index decreases by number of moved columns left of it
      // Simpler: always search header cell by matching header text (more robust)
      const headerText = headerTextsInOrder[shiftCount].toLowerCase();
      // find header cell element dynamically
      const hdr = Array.from(headerRow.cells).find(h => textTrimLower(h).includes(headerText));
      if (!hdr) return;
      headerRow.appendChild(hdr); // move header to end

      // determine original index by comparing with snapshot headerCells: find index in snapshot whose text contains headerText
      let snapIdx = headerCells.findIndex(h => textTrimLower(h).includes(headerText));
      if (snapIdx === -1) {
        // fallback: try current index of moved header among headerRow.children (last)
        snapIdx = headerRow.cells.length - 1;
      }

      // For each body row, move the corresponding cell (use snapIdx or best-effort)
      const tbody = table.tBodies[0];
      if (!tbody) return;
      for (const row of Array.from(tbody.rows)) {
        // if row has cell at snapIdx, append it to the row (move to end)
        if (row.cells.length > snapIdx) {
          row.appendChild(row.cells[snapIdx]);
        } else {
          // fallback: try to find a cell with attribute/data mapping to header text
          const candidate = Array.from(row.cells).find(c => {
            const meta = (c.getAttribute('data-col') || c.getAttribute('aria-label') || c.getAttribute('title') || '').toLowerCase();
            return meta && meta.includes(headerText);
          });
          if (candidate) row.appendChild(candidate);
        }
      }
    });
  }

  // Find all goal-value tables heuristically: table containing at least one <select> with numeric options
  function findGoalValueTables() {
    const tables = findAllTables();
    return tables.filter(tbl => {
      const selects = tbl.querySelectorAll('select');
      if (!selects.length) return false;
      // check if at least one select option value looks numeric (or small ints)
      for (const s of selects) {
        const opts = Array.from(s.options).map(o => o.value.trim());
        if (opts.some(v => /^-?\d+$/.test(v))) return true;
      }
      return false;
    });
  }

  // Apply striped styling class for goal tables (adds .goal-value-table class)
  function styleGoalTables() {
    const goalTables = findGoalValueTables();
    for (const t of goalTables) {
      t.classList.add('goal-value-table');
      // also add a class for editable cells (used by event delegation)
      t.querySelectorAll('td').forEach(td => td.classList.add('goal-value-cell'));
    }
  }

  // Attach click/dblclick handlers to goal tables to allow click/dblclick editing
  function enableGoalValueClickEdit() {
    const goalTables = findGoalValueTables();
    for (const table of goalTables) {
      // delegate events from table
      table.addEventListener('click', (ev) => {
        const td = ev.target.closest('td');
        if (!td || !table.contains(td)) return;
        // find select inside cell
        const sel = td.querySelector('select');
        // also support direct numeric spans
        if (sel) {
          cycleSelectValue(sel);
          // update visible UI (if there is a span representation)
          updateDisplaySpanForSelect(sel);
        } else {
          // if no select, but cell contains numeric text, increment by 1 on click
          const num = parseInt(td.textContent.trim());
          if (!Number.isNaN(num)) {
            const newVal = num + 1;
            setCellNumericValue(td, newVal);
          }
        }
      });

      table.addEventListener('dblclick', (ev) => {
        const td = ev.target.closest('td');
        if (!td || !table.contains(td)) return;
        ev.preventDefault();
        // find select inside cell
        const sel = td.querySelector('select');
        openInlineNumberEditor(td, sel);
      });
    }
  }

  // cycle select to next option (wrap-around) and dispatch change
  function cycleSelectValue(selectEl) {
    try {
      const opts = Array.from(selectEl.options);
      if (!opts.length) return;
      const curIndex = selectEl.selectedIndex;
      const nextIndex = (curIndex + 1) % opts.length;
      selectEl.selectedIndex = nextIndex;
      // dispatch change
      selectEl.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (e) {
      console.warn('cycleSelectValue error', e);
    }
  }

  // Update a possible visible span representation next to select (if you choose to show)
  function updateDisplaySpanForSelect(selectEl) {
    // If there's a sibling .goal-display span, update its text
    const td = selectEl.closest('td');
    if (!td) return;
    const span = td.querySelector('.goal-display');
    if (span) span.textContent = selectEl.value;
  }

  // inline numeric editor (dblclick) - creates <input type=number>, writes back to select or cell on blur/enter
  function openInlineNumberEditor(td, selectEl) {
    // avoid opening multiple editors
    if (td.querySelector('input.goal-inline-editor')) return;

    const currentVal = selectEl ? selectEl.value : td.textContent.trim();
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'goal-inline-editor';
    input.value = String(currentVal || 0);
    input.style.minWidth = '40px';
    input.style.fontSize = '13px';
    input.style.boxSizing = 'border-box';

    // hide select (but keep it to update)
    if (selectEl) selectEl.style.display = 'none';

    // clear cell content visually and add input
    // but preserve also any other UI if necessary
    if (!selectEl) {
      // when no select, hide existing content
      td._oldText = td.textContent;
      td.textContent = '';
    }
    td.appendChild(input);
    input.focus();
    input.select();

    function commit() {
      let newVal = input.value;
      if (newVal === '') newVal = '0';
      // if select exists and has matching option, set it; else add or set select.value
      if (selectEl) {
        // try to set exact match; if no match add new option (so value persists)
        const matchOpt = Array.from(selectEl.options).find(o => o.value === String(newVal));
        if (matchOpt) {
          selectEl.value = String(newVal);
        } else {
          // add option
          const opt = document.createElement('option');
          opt.value = String(newVal);
          opt.text = String(newVal);
          selectEl.add(opt);
          selectEl.value = String(newVal);
        }
        selectEl.style.display = '';
        selectEl.dispatchEvent(new Event('change', { bubbles: true }));
        // update any display span
        updateDisplaySpanForSelect(selectEl);
      } else {
        // write back into td
        td.textContent = String(newVal);
      }
      // cleanup
      input.remove();
    }

    function cancel() {
      if (selectEl) selectEl.style.display = '';
      else if (td._oldText) td.textContent = td._oldText;
      input.remove();
    }

    input.addEventListener('blur', () => commit());
    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        commit();
      } else if (ev.key === 'Escape') {
        ev.preventDefault();
        cancel();
      }
    });
  }

  // if cell has only numeric text and we want to set via click increment
  function setCellNumericValue(td, newVal) {
    // If there's a select near by in DOM model, try to find and set it
    const selectEl = td.querySelector('select') || td.closest('tr')?.querySelector('select');
    if (selectEl) {
      // try to select matching option or add one
      const matchOpt = Array.from(selectEl.options).find(o => o.value === String(newVal));
      if (matchOpt) {
        selectEl.value = String(newVal);
      } else {
        const opt = document.createElement('option');
        opt.value = String(newVal);
        opt.text = String(newVal);
        selectEl.add(opt);
        selectEl.value = String(newVal);
      }
      selectEl.dispatchEvent(new Event('change', { bubbles: true }));
      updateDisplaySpanForSelect(selectEl);
    } else {
      td.textContent = String(newVal);
    }
  }

  // Initialize: move MVP columns then style goal tables and enable click/dblclick editing
  function initSeasonTableUI() {
    // find season table
    let table = null;
    for (const sel of seasonTableSelectors) {
      try {
        const t = document.querySelector(sel);
        if (t && t.tagName && t.tagName.toLowerCase() === 'table') { table = t; break; }
      } catch (e) {}
    }
    if (!table) {
      // fallback: try to heuristically find table that has headers containing 'season' or 'team' and 'mvp'
      const allTables = findAllTables();
      for (const t of allTables) {
        const th = t.tHead && t.tHead.rows[0];
        if (!th) continue;
        const headerText = Array.from(th.cells).map(c => textTrimLower(c)).join(' ');
        if (headerText.includes('mvp') || headerText.includes('season')) { table = t; break; }
      }
    }

    if (table) {
      try {
        // move "MVP Points" then "MVP" (so MVP is last)
        moveColumnsByText(table, ['MVP Points', 'MVP']);
      } catch (e) {
        console.warn('moveColumnsByText failed', e);
      }
    } else {
      console.warn('season table not found by selectors; skip column move');
    }

    try {
      styleGoalTables();
      enableGoalValueClickEdit();
    } catch (e) {
      console.warn('goal table styling/handlers failed', e);
    }
  }

  // auto init after DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSeasonTableUI);
  } else {
    setTimeout(initSeasonTableUI, 40);
  }

  // expose for manual use
  window.initSeasonTableUI = initSeasonTableUI;
  window._seasonTableMoveCols = moveColumnsByText;
  window._seasonGoalEnableEdit = enableGoalValueClickEdit;
})();
