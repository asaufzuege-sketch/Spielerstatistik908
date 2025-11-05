// season_map_momentum.js (Spikes-Version)
// - Statt Badge-Kreise werden jetzt "Spitzen" (Dreiecke) gezeichnet, die angeben, wo Momentum hoch war.
// - Time-Box auf der Season-Map wird ausgeblendet (sichtbar bleibt nur noch das Diagramm).
// - Rest wie zuvor: liest die periodischen Werte (scored/conceded), baut Momentum-Kurve und glättet sie,
//   zeichnet gefüllte Bereiche (grün/rot) und zusätzlich spitze Indikatoren über/unter der Baseline.
// - Exportiert window.renderSeasonMomentumGraphic() zur manuellen Ausführung/debug.
//
// Einbau:
// 1) Datei season_map_momentum.js 1:1 ersetzen/hochladen (z. B. public/js/season_map_momentum.js).
// 2) Seite neu laden; das Script versteckt die Season-Map Timebox und zeigt das Diagramm an.
// 3) Falls du die Timebox nicht ausblenden willst, entferne oder kommentiere das line: hideTimeBox().

(function () {
  const BUCKET_LABELS = [
    {label: "19-15", mid: 17},
    {label: "14-10", mid: 12},
    {label: "9-5",   mid: 7},
    {label: "4-0",   mid: 2}
  ];

  const SVG_W = 900;
  const SVG_H = 220;
  const MARGIN = { left: 44, right: 44, top: 18, bottom: 36 };
  const TOP_GUIDE_Y = 22;
  const MIDLINE_Y = 96;
  const BOTTOM_GUIDE_Y = 188;
  const MAX_GOALS_DISPLAY = 5;

  // spike visuals
  const SPIKE_BASE_PX = 8;     // half base width of spike triangle (in SVG units)
  const SPIKE_MIN_THRESHOLD = 0.5; // only draw spikes if abs(momentum) > threshold (after smoothing)

  function getSeasonMapRoot() {
    return document.getElementById('seasonMapPage') || document.body;
  }

  function getTimeBoxElement() {
    const candidates = ['seasonTimeTrackingBox', 'seasonMapTimeTrackingBox', 'timeTrackingBox'];
    for (const id of candidates) {
      const el = document.getElementById(id);
      if (el) return el;
    }
    return null;
  }

  function hideTimeBox() {
    const tb = getTimeBoxElement();
    if (tb) {
      try { tb.style.display = 'none'; } catch (e) {}
    }
  }

  function readTimeBoxData() {
    const box = getTimeBoxElement();
    const periods = [];
    if (!box) return periods;

    const periodEls = Array.from(box.querySelectorAll('.period'));
    periodEls.forEach((periodEl) => {
      const topBtns = Array.from(periodEl.querySelectorAll('.period-buttons.top-row .time-btn'));
      const bottomBtns = Array.from(periodEl.querySelectorAll('.period-buttons.bottom-row .time-btn'));
      let scored = [], conceded = [];
      if (topBtns.length >= 4 && bottomBtns.length >= 4) {
        scored = topBtns.slice(0,4).map(b => Number(b.textContent || 0) || 0);
        conceded = bottomBtns.slice(0,4).map(b => Number(b.textContent || 0) || 0);
      } else {
        const allBtns = Array.from(periodEl.querySelectorAll('.time-btn'));
        if (allBtns.length >= 8) {
          scored = allBtns.slice(0,4).map(b => Number(b.textContent || 0) || 0);
          conceded = allBtns.slice(4,8).map(b => Number(b.textContent || 0) || 0);
        } else if (allBtns.length > 0) {
          scored = allBtns.slice(0,4).map(b => Number(b.textContent || 0) || 0);
          conceded = [0,0,0,0];
        } else {
          scored = [0,0,0,0];
          conceded = [0,0,0,0];
        }
      }
      periods.push({ scored, conceded });
    });

    // fallback: if no period elements, try flat reading
    if (periods.length === 0) {
      const boxBtns = Array.from((box && box.querySelectorAll) ? box.querySelectorAll('.time-btn') : []);
      if (boxBtns.length >= 4) {
        const scored = boxBtns.slice(0,4).map(b => Number(b.textContent || 0) || 0);
        periods.push({ scored, conceded: [0,0,0,0] });
      }
    }

    // ensure exactly 3 periods
    while (periods.length < 3) periods.push({ scored: [0,0,0,0], conceded: [0,0,0,0] });
    if (periods.length > 3) periods.splice(3);

    return periods;
  }

  function buildMomentumFromTimeBoxes(periods) {
    const minutes = new Array(61).fill(0);
    for (let p = 0; p < 3; p++) {
      const period = periods[p] || { scored: [0,0,0,0], conceded: [0,0,0,0] };
      for (let b = 0; b < BUCKET_LABELS.length; b++) {
        const midLocal = BUCKET_LABELS[b].mid;
        const globalMin = Math.round(p * 20 + midLocal);
        const scored = Number((period.scored && period.scored[b]) || 0) || 0;
        const conceded = Number((period.conceded && period.conceded[b]) || 0) || 0;
        minutes[Math.max(0, Math.min(60, globalMin))] += (scored - conceded);
      }
    }

    // smoothing: moving average
    const smoothPasses = 6;
    const kernel = [0.25, 0.5, 0.25];
    let cur = minutes.slice();
    for (let pass = 0; pass < smoothPasses; pass++) {
      const next = cur.slice();
      for (let i = 1; i < cur.length - 1; i++) {
        next[i] = cur[i - 1] * kernel[0] + cur[i] * kernel[1] + cur[i + 1] * kernel[2];
      }
      cur = next;
    }
    return cur.map(v => Math.max(-MAX_GOALS_DISPLAY, Math.min(MAX_GOALS_DISPLAY, v)));
  }

  // draw triangular spike (upwards if val>0, downwards if val<0) centered at x, height proportional to |val|
  function createSpikePolygon(svgNS, x, baselineY, val, yForMomentum) {
    const sign = val >= 0 ? 1 : -1;
    const absVal = Math.abs(val);
    // calculate spike height (map absVal from 0..MAX_GOALS_DISPLAY to 0..(some px height range))
    const maxSpikeHeight = Math.max(18, (MIDLINE_Y - TOP_GUIDE_Y) - 6); // ensure visually contained
    const h = Math.max(6, (absVal / MAX_GOALS_DISPLAY) * maxSpikeHeight);
    // spike base width based on spacing between minutes:
    // estimate pixel per minute
    const usableW = SVG_W - MARGIN.left - MARGIN.right;
    const pxPerMin = usableW / 60;
    const baseHalf = Math.max(2, Math.min(SPIKE_BASE_PX, pxPerMin * 0.45));

    // triangle points: left base, tip, right base
    const tipY = baselineY - sign * h;
    const p1 = `${(x - baseHalf).toFixed(2)} ${baselineY.toFixed(2)}`;
    const p2 = `${x.toFixed(2)} ${tipY.toFixed(2)}`;
    const p3 = `${(x + baseHalf).toFixed(2)} ${baselineY.toFixed(2)}`;
    return `M ${p1} L ${p2} L ${p3} Z`;
  }

  function renderSeasonMomentumGraphic() {
    const root = getSeasonMapRoot();
    if (!root) return;

    // hide the time box on the season map (per your request)
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

    const periods = readTimeBoxData();
    const momentum = buildMomentumFromTimeBoxes(periods);

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('viewBox', `0 0 ${SVG_W} ${SVG_H}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    // guides
    const topLine = document.createElementNS(svgNS, 'line');
    topLine.setAttribute('x1', MARGIN.left);
    topLine.setAttribute('x2', SVG_W - MARGIN.right);
    topLine.setAttribute('y1', TOP_GUIDE_Y);
    topLine.setAttribute('y2', TOP_GUIDE_Y);
    topLine.setAttribute('stroke', '#d6d6d6');
    topLine.setAttribute('stroke-width', '2');
    svg.appendChild(topLine);

    const midLine = document.createElementNS(svgNS, 'line');
    midLine.setAttribute('x1', MARGIN.left);
    midLine.setAttribute('x2', SVG_W - MARGIN.right);
    midLine.setAttribute('y1', MIDLINE_Y);
    midLine.setAttribute('y2', MIDLINE_Y);
    midLine.setAttribute('stroke', '#7a7a7a');
    midLine.setAttribute('stroke-width', '3');
    svg.appendChild(midLine);

    const bottomLine = document.createElementNS(svgNS, 'line');
    bottomLine.setAttribute('x1', MARGIN.left);
    bottomLine.setAttribute('x2', SVG_W - MARGIN.right);
    bottomLine.setAttribute('y1', BOTTOM_GUIDE_Y);
    bottomLine.setAttribute('y2', BOTTOM_GUIDE_Y);
    bottomLine.setAttribute('stroke', '#d6d6d6');
    bottomLine.setAttribute('stroke-width', '2');
    svg.appendChild(bottomLine);

    const xForMinute = (m) => MARGIN.left + (m / 60) * (SVG_W - MARGIN.left - MARGIN.right);
    const yForMomentum = (val) => {
      const t = (val + MAX_GOALS_DISPLAY) / (2 * MAX_GOALS_DISPLAY);
      return BOTTOM_GUIDE_Y - t * (BOTTOM_GUIDE_Y - TOP_GUIDE_Y);
    };

    // build points for outline
    const points = momentum.map((v, i) => ({ x: xForMinute(i), y: yForMomentum(v), val: v, minute: i }));

    // create filled area segments (green above baseline, red below)
    const segments = [];
    let curSign = Math.sign(points[0].val) >= 0 ? 1 : -1;
    let curPts = [points[0]];
    for (let i = 1; i < points.length; i++) {
      const p = points[i];
      const s = Math.sign(p.val) >= 0 ? 1 : -1;
      if (s === curSign || p.val === 0) {
        curPts.push(p);
      } else {
        const prev = points[i - 1];
        const denom = Math.abs(prev.val) + Math.abs(p.val) || 1;
        const tZero = Math.abs(prev.val) / denom;
        const zx = prev.x + (p.x - prev.x) * tZero;
        const zy = yForMomentum(0);
        curPts.push({ x: zx, y: zy, val: 0, minute: null });
        segments.push({ sign: curSign, pts: curPts });
        curSign = s;
        curPts = [{ x: zx, y: zy, val: 0, minute: null }, p];
      }
    }
    segments.push({ sign: curSign, pts: curPts });

    const areasG = document.createElementNS(svgNS, 'g');
    segments.forEach(seg => {
      const dParts = [];
      seg.pts.forEach((pt, idx) => dParts.push((idx === 0 ? 'M ' : 'L ') + pt.x.toFixed(2) + ' ' + pt.y.toFixed(2)));
      const last = seg.pts[seg.pts.length - 1];
      const first = seg.pts[0];
      dParts.push('L ' + last.x.toFixed(2) + ' ' + MIDLINE_Y.toFixed(2));
      dParts.push('L ' + first.x.toFixed(2) + ' ' + MIDLINE_Y.toFixed(2));
      dParts.push('Z');
      const path = document.createElementNS(svgNS, 'path');
      path.setAttribute('d', dParts.join(' '));
      path.setAttribute('fill', seg.sign > 0 ? '#1fb256' : '#f07d7d');
      path.setAttribute('stroke', '#7a7a7a');
      path.setAttribute('stroke-width', '0.9');
      path.setAttribute('stroke-linejoin', 'round');
      areasG.appendChild(path);
    });
    svg.appendChild(areasG);

    // outline of curve
    const outlinePath = document.createElementNS(svgNS, 'path');
    outlinePath.setAttribute('d', points.map((pt, idx) => (idx === 0 ? 'M ' : 'L ') + pt.x.toFixed(2) + ' ' + pt.y.toFixed(2)).join(' '));
    outlinePath.setAttribute('fill', 'none');
    outlinePath.setAttribute('stroke', '#666');
    outlinePath.setAttribute('stroke-width', '2.2');
    outlinePath.setAttribute('stroke-linejoin', 'round');
    outlinePath.setAttribute('stroke-linecap', 'round');
    svg.appendChild(outlinePath);

    // draw spikes (triangles) at minutes where abs(momentum) > threshold
    const spikesG = document.createElementNS(svgNS, 'g');
    spikesG.setAttribute('id', 'season-map-momentum-spikes');
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      if (Math.abs(p.val) >= SPIKE_MIN_THRESHOLD) {
        const triD = createSpikePolygon(svgNS, p.x, MIDLINE_Y, p.val, yForMomentum);
        const tri = document.createElementNS(svgNS, 'path');
        tri.setAttribute('d', triD);
        tri.setAttribute('fill', p.val >= 0 ? '#0a8f45' : '#c84b4b'); // darker fill for spike
        tri.setAttribute('stroke', p.val >= 0 ? '#066231' : '#6d2a2a');
        tri.setAttribute('stroke-width', '0.7');
        spikesG.appendChild(tri);
      }
    }
    svg.appendChild(spikesG);

    // X ticks and labels
    const tickVals = [0,10,15,20,25,30,35,40,45,50,55,60];
    tickVals.forEach(t => {
      const x = xForMinute(t);
      const tick = document.createElementNS(svgNS, 'line');
      tick.setAttribute('x1', x); tick.setAttribute('x2', x);
      tick.setAttribute('y1', TOP_GUIDE_Y - 8); tick.setAttribute('y2', TOP_GUIDE_Y + 8);
      tick.setAttribute('stroke', '#444'); tick.setAttribute('stroke-width', '1');
      svg.appendChild(tick);
      const txt = document.createElementNS(svgNS, 'text');
      txt.setAttribute('x', x); txt.setAttribute('y', TOP_GUIDE_Y - 12);
      txt.setAttribute('text-anchor', 'middle'); txt.setAttribute('font-family', 'Segoe UI, Roboto');
      txt.setAttribute('font-size', '12'); txt.setAttribute('fill', '#111'); txt.textContent = String(t);
      svg.appendChild(txt);
    });

    // Right-side Y labels for scale
    const yLabels = [5,4,3,2,1,0,-1,-2,-3,-4,-5];
    const yGroup = document.createElementNS(svgNS, 'g');
    yGroup.setAttribute('transform', `translate(${SVG_W - 18},0)`);
    yLabels.forEach(l => {
      const yPos = yForMomentum(l);
      const tEl = document.createElementNS(svgNS, 'text');
      tEl.setAttribute('x', 0); tEl.setAttribute('y', yPos + 4);
      tEl.setAttribute('text-anchor', 'start'); tEl.setAttribute('font-family', 'Segoe UI, Roboto');
      tEl.setAttribute('font-size', '12'); tEl.setAttribute('fill', '#222'); tEl.textContent = String(l);
      yGroup.appendChild(tEl);
    });
    svg.appendChild(yGroup);

    // axis and label
    const axisLabel = document.createElementNS(svgNS, 'text');
    axisLabel.setAttribute('x', (SVG_W / 2).toFixed(0)); axisLabel.setAttribute('y', (SVG_H - 6).toFixed(0));
    axisLabel.setAttribute('text-anchor', 'middle'); axisLabel.setAttribute('font-family', 'Segoe UI, Roboto');
    axisLabel.setAttribute('font-weight', '700'); axisLabel.setAttribute('font-size', '16'); axisLabel.setAttribute('fill', '#111');
    axisLabel.textContent = 'Gameplay';
    svg.appendChild(axisLabel);

    const leftLabel = document.createElementNS(svgNS, 'text');
    leftLabel.setAttribute('x', '6'); leftLabel.setAttribute('y', (MIDLINE_Y + 4).toFixed(0));
    leftLabel.setAttribute('text-anchor', 'start'); leftLabel.setAttribute('font-family', 'Segoe UI, Roboto');
    leftLabel.setAttribute('font-weight', '700'); leftLabel.setAttribute('font-size', '14'); leftLabel.setAttribute('fill', '#111');
    leftLabel.textContent = 'Momentum';
    svg.appendChild(leftLabel);

    container.appendChild(svg);

    console.info('[momentum-spikes] rendered SVG with periods:', periods);
  }

  // Auto update behavior: observe changes and re-render
  function setupAutoUpdate() {
    const timeBox = getTimeBoxElement();
    if (!timeBox) {
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

    // hide the timebox immediately (per user instruction)
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

    mo.observe(timeBox, { subtree: true, characterData: true, childList: true, attributes: true });

    timeBox.addEventListener('click', (e) => {
      if (e.target && e.target.classList && e.target.classList.contains('time-btn')) {
        setTimeout(() => renderSeasonMomentumGraphic(), 80);
      }
    }, true);
  }

  // expose for debugging
  window.renderSeasonMomentumGraphic = renderSeasonMomentumGraphic;
  window._seasonMomentumDebug_readTimeBoxData = readTimeBoxData;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupAutoUpdate);
  } else {
    setupAutoUpdate();
  }

})();
