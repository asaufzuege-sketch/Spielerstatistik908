// season_map_momentum.js (robust - reads DOM OR localStorage fallback)
// - Chronologisches mapping: per period UI order [19-15,14-10,9-5,4-0] -> reversed -> [4-0,...,19-15]
// - WINDOW minutes (representative): P1:4,9,14,19 | P2:24,29,34,39 | P3:44,49,54,59
// - If DOM timebox missing or empty, read localStorage key 'seasonMapTimeData' (export from Goal Map writes this).
// - Smooth area chart, full width 0..60min, ticks every 5min.
// - Exposes window.renderSeasonMomentumGraphic() and window._seasonMomentum_readPeriods() for debugging.

(function () {
  const SVG_W = 900;
  const SVG_H = 220;
  const MARGIN = { left: 32, right: 32, top: 20, bottom: 36 };
  const TOP_GUIDE_Y = 28;
  const MIDLINE_Y = 120;
  const BOTTOM_GUIDE_Y = 196;
  const MAX_DISPLAY = 6; // adjust if you expect larger numbers

  // Chronological minute mapping (representative minute for each bucket)
  const WINDOW_MINUTES = [4,9,14,19,24,29,34,39,44,49,54,59];

  function getSeasonMapRoot() {
    return document.getElementById('seasonMapPage') || document.body;
  }

  function getTimeBoxElement() {
    const candidates = ['seasonMapTimeTrackingBox', 'seasonTimeTrackingBox', 'timeTrackingBox'];
    for (const id of candidates) {
      const el = document.getElementById(id);
      if (el) return el;
    }
    return null;
  }

  function hideTimeBox() {
    const tb = getTimeBoxElement();
    if (tb) tb.style.display = 'none';
  }

  // Helper: attempt to read seasonMapTimeData from localStorage (fallback)
  function readFromLocalStorageFallback() {
    try {
      const raw = localStorage.getItem('seasonMapTimeData') || localStorage.getItem('timeData') || null;
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (!obj || typeof obj !== 'object') return null;
      // obj keys: e.g. p1, p2, p3 or sp1...
      const keys = Object.keys(obj).sort(); // stable order
      const periods = [];
      for (let k = 0; k < keys.length && periods.length < 3; k++) {
        const arr = Array.isArray(obj[keys[k]]) ? obj[keys[k]] : [];
        // If arr contains numbers for top-row then bottom-row (maybe 8 entries)
        let scored = [], conceded = [];
        if (arr.length >= 8) {
          scored = arr.slice(0,4).map(v => Number(v||0) || 0);
          conceded = arr.slice(4,8).map(v => Number(v||0) || 0);
        } else if (arr.length >= 4) {
          scored = arr.slice(0,4).map(v => Number(v||0) || 0);
          conceded = [0,0,0,0];
        } else {
          scored = [0,0,0,0];
          conceded = [0,0,0,0];
        }
        // reverse UI order -> chronological order
        periods.push({ scored: scored.slice().reverse(), conceded: conceded.slice().reverse() });
      }
      while (periods.length < 3) periods.push({ scored: [0,0,0,0], conceded: [0,0,0,0] });
      console.debug('[momentum] readFromLocalStorageFallback -> periods keys:', keys, 'periods:', periods);
      return periods.slice(0,3);
    } catch (e) {
      console.warn('[momentum] localStorage parse failed', e);
      return null;
    }
  }

  // Read periods from DOM timebox (preferred)
  function readPeriodsFromDOM() {
    const box = getTimeBoxElement();
    if (!box) return null;
    const periodEls = Array.from(box.querySelectorAll('.period'));
    if (!periodEls.length) return null;

    const periods = [];
    for (let i = 0; i < periodEls.length && periods.length < 3; i++) {
      const pEl = periodEls[i];
      const topBtns = Array.from(pEl.querySelectorAll('.period-buttons.top-row .time-btn'));
      const bottomBtns = Array.from(pEl.querySelectorAll('.period-buttons.bottom-row .time-btn'));
      let scored = [], conceded = [];
      if (topBtns.length >= 4 && bottomBtns.length >= 4) {
        scored = topBtns.slice(0,4).map(b => Number(b.textContent || 0) || 0);
        conceded = bottomBtns.slice(0,4).map(b => Number(b.textContent || 0) || 0);
      } else {
        const allBtns = Array.from(pEl.querySelectorAll('.time-btn'));
        if (allBtns.length >= 8) {
          scored = allBtns.slice(0,4).map(b => Number(b.textContent || 0) || 0);
          conceded = allBtns.slice(4,8).map(b => Number(b.textContent || 0) || 0);
        } else if (allBtns.length >= 4) {
          scored = allBtns.slice(0,4).map(b => Number(b.textContent || 0) || 0);
          conceded = [0,0,0,0];
        } else {
          scored = [0,0,0,0];
          conceded = [0,0,0,0];
        }
      }
      // reverse UI order to chronological
      periods.push({ scored: scored.slice().reverse(), conceded: conceded.slice().reverse() });
    }
    while (periods.length < 3) periods.push({ scored: [0,0,0,0], conceded: [0,0,0,0] });

    console.debug('[momentum] readPeriodsFromDOM -> periods:', periods);
    return periods.slice(0,3);
  }

  // Unified read: prefer DOM, otherwise localStorage
  function readPeriods() {
    const dom = readPeriodsFromDOM();
    if (dom && dom.length) {
      // check if dom contains non-zero values — if all zeros, prefer localStorage if present
      const flatVals = dom.flatMap(p => p.scored.concat(p.conceded));
      const hasNonZero = flatVals.some(v => Number(v)||0);
      if (hasNonZero) return dom;
      const fromLS = readFromLocalStorageFallback();
      if (fromLS) return fromLS;
      return dom;
    }
    const fromLS = readFromLocalStorageFallback();
    if (fromLS) return fromLS;
    // fallback zeros
    return [{ scored:[0,0,0,0], conceded:[0,0,0,0] }, { scored:[0,0,0,0], conceded:[0,0,0,0] }, { scored:[0,0,0,0], conceded:[0,0,0,0] }];
  }

  // build 12 values (scored - conceded) in chronological order
  function build12Values(periods) {
    const vals = [];
    for (let p = 0; p < 3; p++) {
      const period = periods[p] || { scored:[0,0,0,0], conceded:[0,0,0,0] };
      for (let b = 0; b < 4; b++) {
        const s = Number(period.scored[b] || 0) || 0;
        const c = Number(period.conceded[b] || 0) || 0;
        vals.push(s - c);
      }
    }
    return vals;
  }

  // Catmull-Rom to bezier for smooth curves
  function catmullRom2bezier(points) {
    if (!points || points.length === 0) return '';
    if (points.length === 1) return `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
    if (points.length === 2) return `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)} L ${points[1].x.toFixed(2)} ${points[1].y.toFixed(2)}`;
    const p = [];
    p.push(points[0]);
    for (let i=0;i<points.length;i++) p.push(points[i]);
    p.push(points[points.length-1]);
    let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
    for (let i=1;i<p.length-2;i++) {
      const p0 = p[i-1], p1 = p[i], p2 = p[i+1], p3 = p[i+2];
      const b1x = p1.x + (p2.x - p0.x)/6;
      const b1y = p1.y + (p2.y - p0.y)/6;
      const b2x = p2.x - (p3.x - p1.x)/6;
      const b2y = p2.y - (p3.y - p1.y)/6;
      d += ` C ${b1x.toFixed(2)} ${b1y.toFixed(2)}, ${b2x.toFixed(2)} ${b2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
    }
    return d;
  }

  function minuteToX(minute) {
    const usableW = SVG_W - MARGIN.left - MARGIN.right;
    const m = Math.max(0, Math.min(60, minute));
    return MARGIN.left + (m/60) * usableW;
  }
  function valueToY(v, maxScale) {
    const t = v / maxScale;
    const topSpace = MIDLINE_Y - TOP_GUIDE_Y;
    return MIDLINE_Y - t*topSpace;
  }

  // Render chart
  function renderSeasonMomentumGraphic() {
    const root = getSeasonMapRoot();
    if (!root) return;
    hideTimeBox();

    let container = root.querySelector('#seasonMapMomentumContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'seasonMapMomentumContainer';
      container.style.marginTop = '12px';
      container.style.padding = '8px 12px';
      container.style.boxSizing = 'border-box';
      root.appendChild(container);
    }
    container.innerHTML = '';

    const periods = readPeriods();
    console.debug('[momentum] periods used for rendering:', periods);

    const values12 = build12Values(periods);
    console.debug('[momentum] computed values12:', values12);

    const absMax = Math.max(1, ...values12.map(v => Math.abs(v)));
    const maxScale = Math.max(absMax, MAX_DISPLAY);

    const points = WINDOW_MINUTES.map((minute, idx) => {
      const x = minuteToX(minute);
      const y = valueToY(values12[idx] || 0, maxScale);
      return { x, y, v: values12[idx] || 0, minute, idx };
    });

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width','100%');
    svg.setAttribute('viewBox', `0 0 ${SVG_W} ${SVG_H}`);
    svg.setAttribute('preserveAspectRatio','xMidYMid meet');
    svg.style.display = 'block';

    const createLine = (x1,x2,y,stroke,sw) => {
      const l = document.createElementNS(svgNS,'line');
      l.setAttribute('x1', x1); l.setAttribute('x2', x2);
      l.setAttribute('y1', y); l.setAttribute('y2', y);
      l.setAttribute('stroke', stroke); l.setAttribute('stroke-width', sw);
      return l;
    };
    svg.appendChild(createLine(MARGIN.left, SVG_W - MARGIN.right, TOP_GUIDE_Y, '#d6d6d6', 2));
    svg.appendChild(createLine(MARGIN.left, SVG_W - MARGIN.right, MIDLINE_Y, '#7a7a7a', 3));
    svg.appendChild(createLine(MARGIN.left, SVG_W - MARGIN.right, BOTTOM_GUIDE_Y, '#d6d6d6', 2));

    const posPts = points.map(p => ({ x: p.x, y: p.v > 0 ? p.y : MIDLINE_Y }));
    const negPts = points.map(p => ({ x: p.x, y: p.v < 0 ? p.y : MIDLINE_Y }));

    const posD = catmullRom2bezier(posPts);
    const negD = catmullRom2bezier(negPts);

    if (values12.some(v => v > 0)) {
      const closed = posD + ` L ${points[points.length-1].x.toFixed(2)} ${MIDLINE_Y.toFixed(2)} L ${points[0].x.toFixed(2)} ${MIDLINE_Y.toFixed(2)} Z`;
      const pathPos = document.createElementNS(svgNS,'path');
      pathPos.setAttribute('d', closed);
      pathPos.setAttribute('fill', '#1fb256');
      pathPos.setAttribute('stroke', '#7a7a7a');
      pathPos.setAttribute('stroke-width', '0.9');
      pathPos.setAttribute('stroke-linejoin', 'round');
      svg.appendChild(pathPos);
    }
    if (values12.some(v => v < 0)) {
      const closed = negD + ` L ${points[points.length-1].x.toFixed(2)} ${MIDLINE_Y.toFixed(2)} L ${points[0].x.toFixed(2)} ${MIDLINE_Y.toFixed(2)} Z`;
      const pathNeg = document.createElementNS(svgNS,'path');
      pathNeg.setAttribute('d', closed);
      pathNeg.setAttribute('fill', '#f07d7d');
      pathNeg.setAttribute('stroke', '#7a7a7a');
      pathNeg.setAttribute('stroke-width', '0.9');
      pathNeg.setAttribute('stroke-linejoin', 'round');
      svg.appendChild(pathNeg);
    }

    const outlineD = catmullRom2bezier(points);
    const outline = document.createElementNS(svgNS,'path');
    outline.setAttribute('d', outlineD);
    outline.setAttribute('fill', 'none');
    outline.setAttribute('stroke', '#666');
    outline.setAttribute('stroke-width', '2.2');
    outline.setAttribute('stroke-linejoin', 'round');
    outline.setAttribute('stroke-linecap', 'round');
    svg.appendChild(outline);

    // ticks every 5 minutes
    for (let t=0;t<=60;t+=5) {
      const x = minuteToX(t);
      const tick = document.createElementNS(svgNS,'line');
      tick.setAttribute('x1', x); tick.setAttribute('x2', x);
      tick.setAttribute('y1', TOP_GUIDE_Y - 8); tick.setAttribute('y2', TOP_GUIDE_Y + 8);
      tick.setAttribute('stroke', '#444'); tick.setAttribute('stroke-width', '1');
      svg.appendChild(tick);
      const txt = document.createElementNS(svgNS,'text');
      txt.setAttribute('x', x); txt.setAttribute('y', TOP_GUIDE_Y - 12);
      txt.setAttribute('text-anchor', 'middle'); txt.setAttribute('font-family', 'Segoe UI, Roboto');
      txt.setAttribute('font-size', '12'); txt.setAttribute('fill', '#111');
      txt.textContent = String(t);
      svg.appendChild(txt);
    }

    // right scale labels
    const labelGroup = document.createElementNS(svgNS,'g');
    labelGroup.setAttribute('transform', `translate(${SVG_W - 18},0)`);
    const maxLabel = Math.ceil(maxScale);
    for (let l = maxLabel; l >= -maxLabel; l--) {
      const y = valueToY(l, maxScale);
      const tEl = document.createElementNS(svgNS,'text');
      tEl.setAttribute('x', 0); tEl.setAttribute('y', y + 4);
      tEl.setAttribute('text-anchor', 'start'); tEl.setAttribute('font-family', 'Segoe UI, Roboto');
      tEl.setAttribute('font-size', '11'); tEl.setAttribute('fill', '#222');
      tEl.textContent = String(l);
      labelGroup.appendChild(tEl);
    }
    svg.appendChild(labelGroup);

    // axis labels
    const axisLabel = document.createElementNS(svgNS,'text');
    axisLabel.setAttribute('x', (SVG_W/2).toFixed(0)); axisLabel.setAttribute('y', (SVG_H - 6).toFixed(0));
    axisLabel.setAttribute('text-anchor', 'middle'); axisLabel.setAttribute('font-family', 'Segoe UI, Roboto');
    axisLabel.setAttribute('font-weight', '700'); axisLabel.setAttribute('font-size', '16'); axisLabel.setAttribute('fill', '#111');
    axisLabel.textContent = 'Gameplay';
    svg.appendChild(axisLabel);

    const leftLabel = document.createElementNS(svgNS,'text');
    leftLabel.setAttribute('x', '6'); leftLabel.setAttribute('y', (MIDLINE_Y + 4).toFixed(0));
    leftLabel.setAttribute('text-anchor', 'start'); leftLabel.setAttribute('font-family', 'Segoe UI, Roboto');
    leftLabel.setAttribute('font-weight', '700'); leftLabel.setAttribute('font-size', '14'); leftLabel.setAttribute('fill', '#111');
    leftLabel.textContent = 'Momentum';
    svg.appendChild(leftLabel);

    container.appendChild(svg);

    console.info('[momentum] rendered full-width chart; values:', values12, 'maxScale:', maxScale);
  }

  // Observe changes and re-render
  function setupAutoUpdate() {
    const tb = getTimeBoxElement();
    if (!tb) {
      const root = getSeasonMapRoot();
      const mo = new MutationObserver(() => {
        if (getTimeBoxElement()) {
          mo.disconnect();
          setupAutoUpdate();
          renderSeasonMomentumGraphic();
        }
      });
      mo.observe(root, { childList: true, subtree: true });
      return;
    }

    hideTimeBox();
    renderSeasonMomentumGraphic();

    const mo = new MutationObserver((muts) => {
      let changed = false;
      for (const m of muts) {
        if (m.type === 'characterData' || m.type === 'childList' || m.type === 'attributes') { changed = true; break; }
      }
      if (changed) {
        if (setupAutoUpdate._timer) clearTimeout(setupAutoUpdate._timer);
        setupAutoUpdate._timer = setTimeout(() => renderSeasonMomentumGraphic(), 120);
      }
    });
    mo.observe(tb, { subtree: true, characterData: true, childList: true, attributes: true });

    tb.addEventListener('click', (e) => {
      if (e.target && e.target.classList && e.target.classList.contains('time-btn')) {
        setTimeout(() => renderSeasonMomentumGraphic(), 120);
      }
    }, true);
  }

  // exports for debugging
  window.renderSeasonMomentumGraphic = renderSeasonMomentumGraphic;
  window._seasonMomentum_readPeriods = readPeriods;
  window._seasonMomentum_build12 = build12Values;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupAutoUpdate);
  } else {
    setupAutoUpdate();
  }
})();
