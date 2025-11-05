// season_map_momentum.js (12-window smooth area chart)
// - Produces an area chart distributed over 12 time-windows (P1: 4 buckets, P2: 4, P3: 4).
// - Each window's value = scored - conceded from the corresponding time-box bucket.
// - Positive values produce green filled area above baseline, negative values red area below baseline.
// - Smooth curve using Catmull-Rom -> Bezier conversion to produce the "mountain" look.
// - Hides the season Map timebox (per your request) and inserts the SVG under #seasonMapPage.
// - Auto-updates when time-box values change. Exposes window.renderSeasonMomentumGraphic() for manual calls.
//
// Replace existing season_map_momentum.js with this file (1:1).
// Assumes your season time box buckets are arranged as in the app (top row = scored, bottom row = conceded).
// The order of the 12 windows is:
//   P1: [19-15, 14-10, 9-5, 4-0],
//   P2: [19-15, 14-10, 9-5, 4-0],
//   P3: [19-15, 14-10, 9-5, 4-0]

(function () {
  // bucket labels & local midpoints (for reference only)
  const BUCKETS = [
    { label: 'P1 19-15' }, { label: 'P1 14-10' }, { label: 'P1 9-5' }, { label: 'P1 4-0' },
    { label: 'P2 19-15' }, { label: 'P2 14-10' }, { label: 'P2 9-5' }, { label: 'P2 4-0' },
    { label: 'P3 19-15' }, { label: 'P3 14-10' }, { label: 'P3 9-5' }, { label: 'P3 4-0' }
  ];

  // SVG layout
  const SVG_W = 900;
  const SVG_H = 220;
  const MARGIN = { left: 40, right: 40, top: 24, bottom: 36 };
  const TOP_GUIDE_Y = 28;
  const MIDLINE_Y = 120;   // baseline
  const BOTTOM_GUIDE_Y = 196;
  const MAX_DISPLAY = 6;   // maximum absolute value scale (clamped) for display

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

  // hide the timebox (scriptually)
  function hideTimeBox() {
    const tb = getTimeBoxElement();
    if (tb) tb.style.display = 'none';
  }

  // read the time-box values and return 3 periods each with scored[4], conceded[4]
  function readPeriodsFromTimebox() {
    const box = getTimeBoxElement();
    const periods = [];
    if (!box) {
      // nothing found -> return zeroed 3 periods
      for (let i = 0; i < 3; i++) periods.push({ scored: [0,0,0,0], conceded: [0,0,0,0] });
      return periods;
    }

    const periodEls = Array.from(box.querySelectorAll('.period'));
    for (let i = 0; i < periodEls.length && periods.length < 3; i++) {
      const pEl = periodEls[i];
      const topBtns = Array.from(pEl.querySelectorAll('.period-buttons.top-row .time-btn'));
      const bottomBtns = Array.from(pEl.querySelectorAll('.period-buttons.bottom-row .time-btn'));
      let scored = [], conceded = [];
      if (topBtns.length >= 4 && bottomBtns.length >= 4) {
        scored = topBtns.slice(0,4).map(b => Number(b.textContent || 0) || 0);
        conceded = bottomBtns.slice(0,4).map(b => Number(b.textContent || 0) || 0);
      } else {
        // fallback: all .time-btn in the period
        const allBtns = Array.from(pEl.querySelectorAll('.time-btn'));
        if (allBtns.length >= 8) {
          scored = allBtns.slice(0,4).map(b => Number(b.textContent || 0) || 0);
          conceded = allBtns.slice(4,8).map(b => Number(b.textContent || 0) || 0);
        } else if (allBtns.length >= 4) {
          // assume these are scored only
          scored = allBtns.slice(0,4).map(b => Number(b.textContent || 0) || 0);
          conceded = [0,0,0,0];
        } else {
          scored = [0,0,0,0];
          conceded = [0,0,0,0];
        }
      }
      periods.push({ scored, conceded });
    }

    // ensure 3 periods
    while (periods.length < 3) periods.push({ scored: [0,0,0,0], conceded: [0,0,0,0] });
    return periods.slice(0,3);
  }

  // create 12 values array (scored - conceded) in order of BUCKETS
  function build12Values(periods) {
    const vals = [];
    for (let p = 0; p < 3; p++) {
      const period = periods[p] || { scored: [0,0,0,0], conceded: [0,0,0,0] };
      for (let b = 0; b < 4; b++) {
        const s = Number(period.scored[b] || 0) || 0;
        const c = Number(period.conceded[b] || 0) || 0;
        vals.push(s - c);
      }
    }
    return vals;
  }

  // Catmull-Rom to Bezier helper for smooth path across points
  // points: [{x,y},...]
  function catmullRom2bezier(points) {
    // returns an SVG path string starting with M...
    if (!points || points.length === 0) return '';
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
    // if two points, simple line
    if (points.length === 2) return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;

    const cr = [];
    // for endpoints, duplicate
    const p = [];
    p.push(points[0]); // p0' = p0
    for (let i = 0; i < points.length; i++) p.push(points[i]);
    p.push(points[points.length - 1]); // pn' = pn

    // Build bezier segments
    let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
    for (let i = 1; i < p.length - 2; i++) {
      const p0 = p[i - 1];
      const p1 = p[i];
      const p2 = p[i + 1];
      const p3 = p[i + 2];

      // catmull-rom to bezier conversion
      const b1x = p1.x + (p2.x - p0.x) / 6;
      const b1y = p1.y + (p2.y - p0.y) / 6;
      const b2x = p2.x - (p3.x - p1.x) / 6;
      const b2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${b1x.toFixed(2)} ${b1y.toFixed(2)}, ${b2x.toFixed(2)} ${b2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
    }
    return d;
  }

  // main render function
  function renderSeasonMomentumGraphic() {
    const root = getSeasonMapRoot();
    if (!root) return;

    // hide timebox (user requested)
    hideTimeBox();

    // create container
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

    // read data
    const periods = readPeriodsFromTimebox();
    const values12 = build12Values(periods);

    // determine scale: use absolute max or 1 to avoid division by 0
    const absMax = Math.max(1, ...values12.map(v => Math.abs(v)));
    const displayMax = Math.max(absMax, 1, MAX_DISPLAY);
    const maxScale = displayMax; // we map -maxScale..+maxScale to TOP..BOTTOM

    // compute x positions for 12 windows evenly across usable width
    const usableW = SVG_W - MARGIN.left - MARGIN.right;
    const step = usableW / (BUCKETS.length - 1); // spaces between points
    const points = values12.map((v, i) => {
      const x = MARGIN.left + i * step;
      // map value v to y: v/maxScale -> -1..1 ; y = MIDLINE - normalized*(MIDLINE-TOP)
      const t = v / maxScale;
      const topSpace = MIDLINE_Y - TOP_GUIDE_Y;
      const y = MIDLINE_Y - t * topSpace;
      return { x, y, v, i };
    });

    // create SVG
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('viewBox', `0 0 ${SVG_W} ${SVG_H}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.style.display = 'block';

    // background guide lines
    const topLine = document.createElementNS(svgNS, 'line');
    topLine.setAttribute('x1', MARGIN.left); topLine.setAttribute('x2', SVG_W - MARGIN.right);
    topLine.setAttribute('y1', TOP_GUIDE_Y); topLine.setAttribute('y2', TOP_GUIDE_Y);
    topLine.setAttribute('stroke', '#d6d6d6'); topLine.setAttribute('stroke-width', '2');
    svg.appendChild(topLine);

    const midLine = document.createElementNS(svgNS, 'line');
    midLine.setAttribute('x1', MARGIN.left); midLine.setAttribute('x2', SVG_W - MARGIN.right);
    midLine.setAttribute('y1', MIDLINE_Y); midLine.setAttribute('y2', MIDLINE_Y);
    midLine.setAttribute('stroke', '#7a7a7a'); midLine.setAttribute('stroke-width', '3');
    svg.appendChild(midLine);

    const bottomLine = document.createElementNS(svgNS, 'line');
    bottomLine.setAttribute('x1', MARGIN.left); bottomLine.setAttribute('x2', SVG_W - MARGIN.right);
    bottomLine.setAttribute('y1', BOTTOM_GUIDE_Y); bottomLine.setAttribute('y2', BOTTOM_GUIDE_Y);
    bottomLine.setAttribute('stroke', '#d6d6d6'); bottomLine.setAttribute('stroke-width', '2');
    svg.appendChild(bottomLine);

    // Build clipped arrays for positive and negative areas (clip values by sign)
    const posPoints = points.map(p => ({ x: p.x, y: p.v > 0 ? p.y : MIDLINE_Y }));
    const negPoints = points.map(p => ({ x: p.x, y: p.v < 0 ? p.y : MIDLINE_Y }));

    // Build smooth path strings
    const posPathD = catmullRom2bezier(posPoints);
    const negPathD = catmullRom2bezier(negPoints);

    // Create positive area polygon (path + closing to baseline)
    if (values12.some(v => v > 0)) {
      const dClose = posPathD + ` L ${points[points.length - 1].x.toFixed(2)} ${MIDLINE_Y.toFixed(2)} L ${points[0].x.toFixed(2)} ${MIDLINE_Y.toFixed(2)} Z`;
      const pathPos = document.createElementNS(svgNS, 'path');
      pathPos.setAttribute('d', dClose);
      pathPos.setAttribute('fill', '#1fb256');
      pathPos.setAttribute('stroke', '#7a7a7a');
      pathPos.setAttribute('stroke-width', '0.9');
      pathPos.setAttribute('stroke-linejoin', 'round');
      svg.appendChild(pathPos);
    }

    // Create negative area polygon
    if (values12.some(v => v < 0)) {
      const dClose = negPathD + ` L ${points[points.length - 1].x.toFixed(2)} ${MIDLINE_Y.toFixed(2)} L ${points[0].x.toFixed(2)} ${MIDLINE_Y.toFixed(2)} Z`;
      const pathNeg = document.createElementNS(svgNS, 'path');
      pathNeg.setAttribute('d', dClose);
      pathNeg.setAttribute('fill', '#f07d7d');
      pathNeg.setAttribute('stroke', '#7a7a7a');
      pathNeg.setAttribute('stroke-width', '0.9');
      pathNeg.setAttribute('stroke-linejoin', 'round');
      svg.appendChild(pathNeg);
    }

    // Draw smooth outline of actual values (combined curve)
    const outlineD = catmullRom2bezier(points);
    const outline = document.createElementNS(svgNS, 'path');
    outline.setAttribute('d', outlineD);
    outline.setAttribute('fill', 'none');
    outline.setAttribute('stroke', '#666');
    outline.setAttribute('stroke-width', '2.2');
    outline.setAttribute('stroke-linejoin', 'round');
    outline.setAttribute('stroke-linecap', 'round');
    svg.appendChild(outline);

    // X ticks and top numbers (mimicking original style)
    const tickVals = [0,10,15,20,25,30,35,40,45,50,55,60];
    tickVals.forEach(t => {
      // compute x by mapping minutes to the 12 windows positions
      // map t to nearest index in 0..11 proportionally:
      const rel = t / 60;
      const x = MARGIN.left + rel * (SVG_W - MARGIN.left - MARGIN.right);
      const tick = document.createElementNS(svgNS, 'line');
      tick.setAttribute('x1', x); tick.setAttribute('x2', x);
      tick.setAttribute('y1', TOP_GUIDE_Y - 8); tick.setAttribute('y2', TOP_GUIDE_Y + 8);
      tick.setAttribute('stroke', '#444'); tick.setAttribute('stroke-width', '1');
      svg.appendChild(tick);
      const txt = document.createElementNS(svgNS, 'text');
      txt.setAttribute('x', x); txt.setAttribute('y', TOP_GUIDE_Y - 12);
      txt.setAttribute('text-anchor', 'middle');
      txt.setAttribute('font-family', 'Segoe UI, Roboto, Arial');
      txt.setAttribute('font-size', '12');
      txt.setAttribute('fill', '#111');
      txt.textContent = String(t);
      svg.appendChild(txt);
    });

    // Right Y labels for scale (0..max)
    const labelGroup = document.createElementNS(svgNS, 'g');
    labelGroup.setAttribute('transform', `translate(${SVG_W - 18},0)`);
    const maxLabel = Math.ceil(displayMax);
    for (let l = maxLabel; l >= -maxLabel; l--) {
      const y = (function (val) {
        // map val to y using same mapping logic
        const t = val / maxScale;
        const topSpace = MIDLINE_Y - TOP_GUIDE_Y;
        return MIDLINE_Y - t * topSpace;
      })(l);
      const tEl = document.createElementNS(svgNS, 'text');
      tEl.setAttribute('x', 0); tEl.setAttribute('y', y + 4);
      tEl.setAttribute('text-anchor', 'start');
      tEl.setAttribute('font-family', 'Segoe UI, Roboto, Arial');
      tEl.setAttribute('font-size', '11');
      tEl.setAttribute('fill', '#222');
      tEl.textContent = String(l);
      labelGroup.appendChild(tEl);
    }
    svg.appendChild(labelGroup);

    // axis labels
    const axisLabel = document.createElementNS(svgNS, 'text');
    axisLabel.setAttribute('x', (SVG_W / 2).toFixed(0));
    axisLabel.setAttribute('y', (SVG_H - 6).toFixed(0));
    axisLabel.setAttribute('text-anchor', 'middle');
    axisLabel.setAttribute('font-family', 'Segoe UI, Roboto');
    axisLabel.setAttribute('font-weight', '700');
    axisLabel.setAttribute('font-size', '16');
    axisLabel.setAttribute('fill', '#111');
    axisLabel.textContent = 'Gameplay';
    svg.appendChild(axisLabel);

    const leftLabel = document.createElementNS(svgNS, 'text');
    leftLabel.setAttribute('x', '6');
    leftLabel.setAttribute('y', (MIDLINE_Y + 4).toFixed(0));
    leftLabel.setAttribute('text-anchor', 'start');
    leftLabel.setAttribute('font-family', 'Segoe UI, Roboto');
    leftLabel.setAttribute('font-weight', '700');
    leftLabel.setAttribute('font-size', '14');
    leftLabel.setAttribute('fill', '#111');
    leftLabel.textContent = 'Momentum';
    svg.appendChild(leftLabel);

    // append svg
    const wrapper = document.createElement('div');
    wrapper.style.width = '100%';
    wrapper.appendChild(svg);
    container.appendChild(wrapper);

    // small debug
    console.info('[momentum-12] rendered chart with values:', values12, 'scale:', maxScale);
  }

  // watch for changes to time box and re-render
  function setupAutoUpdate() {
    const tb = getTimeBoxElement();
    if (!tb) {
      // wait for season map/timebox to appear
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

    // hide timebox right away
    hideTimeBox();

    // initial render
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

    // also re-render on click (when user adjusts a time-btn)
    tb.addEventListener('click', (e) => {
      if (e.target && e.target.classList && e.target.classList.contains('time-btn')) {
        setTimeout(() => renderSeasonMomentumGraphic(), 100);
      }
    }, true);
  }

  // export for manual calls
  window.renderSeasonMomentumGraphic = renderSeasonMomentumGraphic;
  window._seasonMomentum12_readPeriods = readPeriodsFromTimebox;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupAutoUpdate);
  } else {
    setupAutoUpdate();
  }
})();
