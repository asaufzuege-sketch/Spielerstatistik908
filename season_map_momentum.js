// season_map_momentum.js (updated: minute-based full-width mapping, 12 windows at 5min steps)
// - Maps the 12 windows to exact minute midpoints across a full 0..60 minute timeline (fills full chart width).
// - Windows (left-to-right):  P1: 4-0(mid2), 9-5(mid7), 14-10(mid12), 19-15(mid17),
//                                P2: 24-20(mid22), 29-25(mid27), 34-30(mid32), 39-35(mid37),
//                                P3: 44-40(mid42), 49-45(mid47), 54-50(mid52), 59-55(mid57).
//   (These are the global midpoints used as minutes: [2,7,12,17,22,27,32,37,42,47,52,57])
// - Draws ticks every 5 minutes (0,5,10,...,60) across the full usable width.
// - Smooths the curve (Catmull-Rom to Bezier) and fills positive (green) and negative (red) areas.
// - Hides the timebox on the season map (scriptually). Auto-updates on time-box changes.
// - Use this file to replace the previous season_map_momentum.js 1:1.

(function () {
  // 12 window minute midpoints (ascending)
  const WINDOW_MINUTES = [2,7,12,17,22,27,32,37,42,47,52,57];

  // SVG layout constants
  const SVG_W = 900;
  const SVG_H = 220;
  const MARGIN = { left: 32, right: 32, top: 20, bottom: 36 };
  const TOP_GUIDE_Y = 28;
  const MIDLINE_Y = 120;
  const BOTTOM_GUIDE_Y = 196;
  const MAX_DISPLAY = 6; // clamp scale for display (adjust if you expect bigger values)

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

  // Read periods from season map time tracking box
  function readPeriodsFromTimebox() {
    const box = getTimeBoxElement();
    const periods = [];
    if (!box) {
      // return zeros if timebox missing
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
      periods.push({ scored, conceded });
    }

    while (periods.length < 3) periods.push({ scored: [0,0,0,0], conceded: [0,0,0,0] });
    return periods.slice(0,3);
  }

  // Build 12 window values (scored - conceded) in the ascending minute order
  function build12Values(periods) {
    const vals = [];
    for (let p = 0; p < 3; p++) {
      const period = periods[p] || { scored: [0,0,0,0], conceded: [0,0,0,0] };
      // bucket order should correspond to minutes [2,7,12,17] per period (low->high)
      for (let b = 0; b < 4; b++) {
        const s = Number(period.scored[b] || 0) || 0;
        const c = Number(period.conceded[b] || 0) || 0;
        vals.push(s - c);
      }
    }
    return vals;
  }

  // Catmull-Rom -> cubic Bezier conversion (returns SVG path starting with M)
  function catmullRom2bezier(points) {
    if (!points || points.length === 0) return '';
    if (points.length === 1) return `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
    if (points.length === 2) return `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)} L ${points[1].x.toFixed(2)} ${points[1].y.toFixed(2)}`;

    const p = [];
    p.push(points[0]);
    for (let i = 0; i < points.length; i++) p.push(points[i]);
    p.push(points[points.length - 1]);

    let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
    for (let i = 1; i < p.length - 2; i++) {
      const p0 = p[i - 1], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2];
      const b1x = p1.x + (p2.x - p0.x) / 6;
      const b1y = p1.y + (p2.y - p0.y) / 6;
      const b2x = p2.x - (p3.x - p1.x) / 6;
      const b2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${b1x.toFixed(2)} ${b1y.toFixed(2)}, ${b2x.toFixed(2)} ${b2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
    }
    return d;
  }

  function minuteToX(minute) {
    const usableW = SVG_W - MARGIN.left - MARGIN.right;
    const clamped = Math.max(0, Math.min(60, minute));
    return MARGIN.left + (clamped / 60) * usableW;
  }

  function valueToY(v, maxScale) {
    const t = v / maxScale; // -1..1
    const topSpace = MIDLINE_Y - TOP_GUIDE_Y;
    return MIDLINE_Y - t * topSpace;
  }

  // main renderer
  function renderSeasonMomentumGraphic() {
    const root = getSeasonMapRoot();
    if (!root) return;

    // hide time box as requested
    hideTimeBox();

    // container
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

    // read data and compute values
    const periods = readPeriodsFromTimebox();
    const values12 = build12Values(periods);

    // determine display scale
    const absMax = Math.max(1, ...values12.map(x => Math.abs(x)));
    const maxScale = Math.max(absMax, MAX_DISPLAY);

    // compute points based on minute midpoints
    const points = WINDOW_MINUTES.map((minute, idx) => {
      const x = minuteToX(minute);
      const y = valueToY(values12[idx] || 0, maxScale);
      return { x, y, v: values12[idx] || 0, minute, idx };
    });

    // create svg
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('viewBox', `0 0 ${SVG_W} ${SVG_H}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.style.display = 'block';

    // guide lines
    const createLine = (x1,x2,y1,y2,stroke,sw) => {
      const l = document.createElementNS(svgNS,'line');
      l.setAttribute('x1', x1); l.setAttribute('x2', x2);
      l.setAttribute('y1', y1); l.setAttribute('y2', y2);
      l.setAttribute('stroke', stroke); l.setAttribute('stroke-width', sw);
      return l;
    };
    svg.appendChild(createLine(MARGIN.left, SVG_W - MARGIN.right, TOP_GUIDE_Y, TOP_GUIDE_Y, '#d6d6d6', 2));
    svg.appendChild(createLine(MARGIN.left, SVG_W - MARGIN.right, MIDLINE_Y, MIDLINE_Y, '#7a7a7a', 3));
    svg.appendChild(createLine(MARGIN.left, SVG_W - MARGIN.right, BOTTOM_GUIDE_Y, BOTTOM_GUIDE_Y, '#d6d6d6', 2));

    // build pos/neg arrays (y replaced by MIDLINE for opposite sign)
    const posPts = points.map(p => ({ x: p.x, y: p.v > 0 ? p.y : MIDLINE_Y }));
    const negPts = points.map(p => ({ x: p.x, y: p.v < 0 ? p.y : MIDLINE_Y }));

    // smooth paths
    const posD = catmullRom2bezier(posPts);
    const negD = catmullRom2bezier(negPts);

    // draw positive area
    if (values12.some(v => v > 0)) {
      const closed = posD + ` L ${points[points.length - 1].x.toFixed(2)} ${MIDLINE_Y.toFixed(2)} L ${points[0].x.toFixed(2)} ${MIDLINE_Y.toFixed(2)} Z`;
      const pathPos = document.createElementNS(svgNS, 'path');
      pathPos.setAttribute('d', closed);
      pathPos.setAttribute('fill', '#1fb256');
      pathPos.setAttribute('stroke', '#7a7a7a');
      pathPos.setAttribute('stroke-width', '0.9');
      pathPos.setAttribute('stroke-linejoin', 'round');
      svg.appendChild(pathPos);
    }

    // draw negative area
    if (values12.some(v => v < 0)) {
      const closed = negD + ` L ${points[points.length - 1].x.toFixed(2)} ${MIDLINE_Y.toFixed(2)} L ${points[0].x.toFixed(2)} ${MIDLINE_Y.toFixed(2)} Z`;
      const pathNeg = document.createElementNS(svgNS, 'path');
      pathNeg.setAttribute('d', closed);
      pathNeg.setAttribute('fill', '#f07d7d');
      pathNeg.setAttribute('stroke', '#7a7a7a');
      pathNeg.setAttribute('stroke-width', '0.9');
      pathNeg.setAttribute('stroke-linejoin', 'round');
      svg.appendChild(pathNeg);
    }

    // outline curve
    const outlineD = catmullRom2bezier(points);
    const outline = document.createElementNS(svgNS,'path');
    outline.setAttribute('d', outlineD);
    outline.setAttribute('fill', 'none');
    outline.setAttribute('stroke', '#666');
    outline.setAttribute('stroke-width', '2.2');
    outline.setAttribute('stroke-linejoin', 'round');
    outline.setAttribute('stroke-linecap', 'round');
    svg.appendChild(outline);

    // ticks every 5 minutes across full width (0..60)
    for (let t = 0; t <= 60; t += 5) {
      const x = minuteToX(t);
      const tick = document.createElementNS(svgNS,'line');
      tick.setAttribute('x1', x); tick.setAttribute('x2', x);
      tick.setAttribute('y1', TOP_GUIDE_Y - 8); tick.setAttribute('y2', TOP_GUIDE_Y + 8);
      tick.setAttribute('stroke', '#444'); tick.setAttribute('stroke-width', '1');
      svg.appendChild(tick);
      const txt = document.createElementNS(svgNS,'text');
      txt.setAttribute('x', x); txt.setAttribute('y', TOP_GUIDE_Y - 12);
      txt.setAttribute('text-anchor', 'middle');
      txt.setAttribute('font-family', 'Segoe UI, Roboto, Arial');
      txt.setAttribute('font-size', '12');
      txt.setAttribute('fill', '#111');
      txt.textContent = String(t);
      svg.appendChild(txt);
    }

    // right-side labels (scale)
    const labelGroup = document.createElementNS(svgNS,'g');
    labelGroup.setAttribute('transform', `translate(${SVG_W - 18},0)`);
    const maxLabel = Math.ceil(maxScale);
    for (let l = maxLabel; l >= -maxLabel; l--) {
      const y = valueToY(l, maxScale);
      const tEl = document.createElementNS(svgNS,'text');
      tEl.setAttribute('x', 0); tEl.setAttribute('y', y + 4);
      tEl.setAttribute('text-anchor', 'start');
      tEl.setAttribute('font-family', 'Segoe UI, Roboto, Arial');
      tEl.setAttribute('font-size', '11');
      tEl.setAttribute('fill', '#222');
      tEl.textContent = String(l);
      labelGroup.appendChild(tEl);
    }
    svg.appendChild(labelGroup);

    // axis label and left label
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

    // append SVG to container
    container.appendChild(svg);

    console.info('[momentum-12-window] rendered; values:', values12, 'maxScale:', maxScale);
  }

  // auto update: observe timebox and re-render on changes
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

    // hide timebox (per user)
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

    tb.addEventListener('click', (e) => {
      if (e.target && e.target.classList && e.target.classList.contains('time-btn')) {
        setTimeout(() => renderSeasonMomentumGraphic(), 100);
      }
    }, true);
  }

  // expose for debug
  window.renderSeasonMomentumGraphic = renderSeasonMomentumGraphic;
  window._seasonMomentum12_readPeriods = readPeriodsFromTimebox;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupAutoUpdate);
  } else {
    setupAutoUpdate();
  }
})();
