// season_map_momentum.js
// Adds a momentum + goals visualization to the Season Map page.
// - Reads the time-box buttons inside #seasonTimeTrackingBox (periods + top/bottom time-btns).
// - Interprets top-row buttons as "scored" (green) and bottom-row as "conceded" (red).
// - Maps period buckets to gameplay minutes (P1:0-20, P2:20-40, P3:40-60) using bucket midpoints:
//     ["19-15","14-10","9-5","4-0"] -> midpoints [17,12,7,2] (per period offset applied).
// - Builds a minute-resolution momentum array (scored - conceded), smooths it and draws an area chart:
//     positive areas filled green, negative areas filled red (preserving baseline at momentum=0).
// - Draws small goal badges (numbered) at their bucket x positions: green above baseline for scored,
//   red below baseline for conceded, stacked when counts >1.
// - Appends the graphic to the #seasonMapPage below the existing elements. Automatically updates
//   when the time-box values change or when the Season Map page is rendered.
//
// Usage:
// - Include this script on the page (add <script src="season_map_momentum.js"></script> before </body>).
// - The code will auto-run and create/refresh a SVG with id "seasonMapMomentumSvg" in #seasonMapPage.
//
// Note: This code assumes the season time-tracking HTML structure similar to your app:
//   #seasonTimeTrackingBox .period elements each with two rows of .time-btn (top-row and bottom-row)
//
// Author: Copied/Adapted for your app

(function () {
  const BUCKET_LABELS = [
    {label: "19-15", mid: 17},
    {label: "14-10", mid: 12},
    {label: "9-5",   mid: 7},
    {label: "4-0",   mid: 2}
  ];

  // svg dimensions and layout constants
  const SVG_W = 900;
  const SVG_H = 220;
  const MARGIN = { left: 44, right: 44, top: 18, bottom: 36 };
  const TOP_GUIDE_Y = 22;
  const MIDLINE_Y = 96;   // baseline (momentum = 0)
  const BOTTOM_GUIDE_Y = 188;
  const MAX_GOALS_DISPLAY = 5; // scale for vertical goal badge stacking

  // find the season map container
  function getSeasonMapRoot() {
    return document.getElementById('seasonMapPage') || document.body;
  }

  // read time box data from the season map time box
  // returns array periods[], each { scored: [4 buckets], conceded: [4 buckets] }
  function readTimeBoxData() {
    const box = document.getElementById('seasonTimeTrackingBox');
    const periods = [];
    if (!box) return periods;

    // periods in DOM may be multiple .period elements (data-period="sp1"...)
    const periodEls = Array.from(box.querySelectorAll('.period'));
    periodEls.forEach((periodEl, pIdx) => {
      // top row and bottom row
      const topBtns = Array.from(periodEl.querySelectorAll('.period-buttons.top-row .time-btn'));
      const bottomBtns = Array.from(periodEl.querySelectorAll('.period-buttons.bottom-row .time-btn'));
      // fallback: if top/bottom grouping not present, read first 4 as scored, next 4 as conceded
      let scored = [], conceded = [];
      if (topBtns.length >= 4 && bottomBtns.length >= 4) {
        scored = topBtns.slice(0,4).map(b => Number(b.textContent || 0) || 0);
        conceded = bottomBtns.slice(0,4).map(b => Number(b.textContent || 0) || 0);
      } else {
        // try all time-btns
        const allBtns = Array.from(periodEl.querySelectorAll('.time-btn'));
        if (allBtns.length >= 8) {
          scored = allBtns.slice(0,4).map(b => Number(b.textContent || 0) || 0);
          conceded = allBtns.slice(4,8).map(b => Number(b.textContent || 0) || 0);
        } else if (allBtns.length > 0) {
          // If only 4 buttons exist, assume they are "scored", and conceded zero
          scored = allBtns.slice(0,4).map(b => Number(b.textContent || 0) || 0);
          conceded = [0,0,0,0];
        } else {
          scored = [0,0,0,0];
          conceded = [0,0,0,0];
        }
      }
      periods.push({ scored, conceded });
    });

    // if no periods found, create 3 empty periods (sp1..sp3)
    if (periods.length === 0) {
      periods.push({ scored: [0,0,0,0], conceded: [0,0,0,0] });
      periods.push({ scored: [0,0,0,0], conceded: [0,0,0,0] });
      periods.push({ scored: [0,0,0,0], conceded: [0,0,0,0] });
    }

    // ensure exactly 3 periods
    while (periods.length < 3) periods.push({ scored: [0,0,0,0], conceded: [0,0,0,0] });
    if (periods.length > 3) periods.splice(3);

    return periods;
  }

  // build minute-resolution momentum array (0..60 minutes)
  function buildMomentumFromTimeBoxes(periods) {
    const minutes = new Array(61).fill(0); // indices 0..60
    // for each period (0..2) and each bucket (0..3), add scored-conceded at bucket midpoint minute
    for (let p = 0; p < 3; p++) {
      const period = periods[p] || { scored: [0,0,0,0], conceded: [0,0,0,0] };
      for (let b = 0; b < BUCKET_LABELS.length; b++) {
        const midLocal = BUCKET_LABELS[b].mid; // e.g. 17,12,7,2
        const globalMin = Math.round(p * 20 + midLocal); // map to 0..60
        const scored = Number((period.scored && period.scored[b]) || 0) || 0;
        const conceded = Number((period.conceded && period.conceded[b]) || 0) || 0;
        minutes[ Math.max(0, Math.min(60, globalMin)) ] += (scored - conceded);
      }
    }
    // simple smoothing: apply moving average kernel multiple passes
    const smoothPasses = 6;
    const kernel = [0.25, 0.5, 0.25];
    let cur = minutes.slice();
    for (let pass=0; pass<smoothPasses; pass++) {
      const next = cur.slice();
      for (let i=1;i<cur.length-1;i++) {
        next[i] = cur[i-1]*kernel[0] + cur[i]*kernel[1] + cur[i+1]*kernel[2];
      }
      cur = next;
    }
    // clamp to +/- MAX_GOALS_DISPLAY
    const clamped = cur.map(v => Math.max(-MAX_GOALS_DISPLAY, Math.min(MAX_GOALS_DISPLAY, v)));
    return clamped;
  }

  // create or update SVG element
  function renderSeasonMomentumGraphic() {
    const root = getSeasonMapRoot();
    if (!root) return;

    // ensure container
    let container = root.querySelector('#seasonMapMomentumContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'seasonMapMomentumContainer';
      container.style.marginTop = '12px';
      container.style.padding = '8px 12px';
      container.style.boxSizing = 'border-box';
      // insert at bottom of season map page
      root.appendChild(container);
    }
    container.innerHTML = ''; // clear

    // read time box values
    const periods = readTimeBoxData();
    const momentum = buildMomentumFromTimeBoxes(periods);

    // create svg
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width','100%');
    svg.setAttribute('viewBox', `0 0 ${SVG_W} ${SVG_H}`);
    svg.setAttribute('preserveAspectRatio','xMidYMid meet');
    svg.style.display = 'block';
    svg.style.maxWidth = '100%';

    // background guides
    const gGuides = document.createElementNS(svgNS,'g');
    // top guide
    const topLine = document.createElementNS(svgNS,'line');
    topLine.setAttribute('x1', MARGIN.left);
    topLine.setAttribute('x2', SVG_W - MARGIN.right);
    topLine.setAttribute('y1', TOP_GUIDE_Y);
    topLine.setAttribute('y2', TOP_GUIDE_Y);
    topLine.setAttribute('stroke','#d6d6d6');
    topLine.setAttribute('stroke-width','2');
    gGuides.appendChild(topLine);
    // midline
    const midLine = document.createElementNS(svgNS,'line');
    midLine.setAttribute('x1', MARGIN.left);
    midLine.setAttribute('x2', SVG_W - MARGIN.right);
    midLine.setAttribute('y1', MIDLINE_Y);
    midLine.setAttribute('y2', MIDLINE_Y);
    midLine.setAttribute('stroke','#7a7a7a');
    midLine.setAttribute('stroke-width','3');
    gGuides.appendChild(midLine);
    // bottom guide
    const bottomLine = document.createElementNS(svgNS,'line');
    bottomLine.setAttribute('x1', MARGIN.left);
    bottomLine.setAttribute('x2', SVG_W - MARGIN.right);
    bottomLine.setAttribute('y1', BOTTOM_GUIDE_Y);
    bottomLine.setAttribute('y2', BOTTOM_GUIDE_Y);
    bottomLine.setAttribute('stroke','#d6d6d6');
    bottomLine.setAttribute('stroke-width','2');
    gGuides.appendChild(bottomLine);

    svg.appendChild(gGuides);

    // helper maps
    const xForMinute = (m) => {
      const usableW = SVG_W - MARGIN.left - MARGIN.right;
      return MARGIN.left + (m / 60) * usableW;
    };
    const yForMomentum = (val) => {
      // maps -MAX..+MAX -> BOTTOM_GUIDE_Y..TOP_GUIDE_Y
      const t = (val + MAX_GOALS_DISPLAY) / (2*MAX_GOALS_DISPLAY); // 0..1
      return BOTTOM_GUIDE_Y - t * (BOTTOM_GUIDE_Y - TOP_GUIDE_Y);
    };

    // Create positive and negative area polygons by slicing contiguous sign segments
    const points = momentum.map((v, i) => ({ x: xForMinute(i), y: yForMomentum(v), val: v, minute: i }));

    // Build segments by sign
    const segments = [];
    let curSign = Math.sign(points[0].val) >= 0 ? 1 : -1; // treat zero as positive segment for continuity
    let curPts = [points[0]];
    for (let i=1;i<points.length;i++) {
      const p = points[i];
      const s = Math.sign(p.val) >= 0 ? 1 : -1;
      if (s === curSign || p.val === 0) {
        curPts.push(p);
      } else {
        // crossing, insert zero crossing point linearly between prev and this
        const prev = points[i-1];
        // linear ratio from prev.val to p.val to reach zero
        const denom = Math.abs(prev.val) + Math.abs(p.val) || 1;
        const tZero = Math.abs(prev.val) / denom;
        const zx = prev.x + (p.x - prev.x) * tZero;
        const zy = yForMomentum(0);
        curPts.push({ x: zx, y: zy, val: 0, minute: null });
        segments.push({ sign: curSign, pts: curPts });
        // start next segment with zero point and current
        curSign = s;
        curPts = [{ x: zx, y: zy, val: 0, minute: null }, p];
      }
    }
    segments.push({ sign: curSign, pts: curPts });

    const areasG = document.createElementNS(svgNS,'g');
    areasG.setAttribute('id','season-map-momentum-areas');

    segments.forEach(seg => {
      // build polygon path: curve pts then down to baseline and back to start
      const dParts = [];
      seg.pts.forEach((pt, idx) => {
        dParts.push((idx === 0 ? 'M ' : 'L ') + pt.x.toFixed(2) + ' ' + pt.y.toFixed(2));
      });
      const last = seg.pts[seg.pts.length-1];
      const first = seg.pts[0];
      // line down to baseline (midline Y)
      dParts.push('L ' + last.x.toFixed(2) + ' ' + MIDLINE_Y.toFixed(2));
      dParts.push('L ' + first.x.toFixed(2) + ' ' + MIDLINE_Y.toFixed(2));
      dParts.push('Z');
      const path = document.createElementNS(svgNS,'path');
      path.setAttribute('d', dParts.join(' '));
      path.setAttribute('fill', seg.sign > 0 ? '#1fb256' : '#f07d7d');
      path.setAttribute('stroke', '#7a7a7a');
      path.setAttribute('stroke-width', '0.9');
      path.setAttribute('stroke-linejoin', 'round');
      areasG.appendChild(path);
    });

    svg.appendChild(areasG);

    // Outline stroke of the full curve
    const outlinePath = document.createElementNS(svgNS,'path');
    const outlineD = points.map((pt, idx) => (idx === 0 ? 'M ' : 'L ') + pt.x.toFixed(2) + ' ' + pt.y.toFixed(2)).join(' ');
    outlinePath.setAttribute('d', outlineD);
    outlinePath.setAttribute('fill', 'none');
    outlinePath.setAttribute('stroke', '#666');
    outlinePath.setAttribute('stroke-width','2.2');
    outlinePath.setAttribute('stroke-linejoin','round');
    outlinePath.setAttribute('stroke-linecap','round');
    svg.appendChild(outlinePath);

    // X axis ticks (0,10,15,20,...60) - place numbers above top guide
    const tickVals = [0,10,15,20,25,30,35,40,45,50,55,60];
    tickVals.forEach(t => {
      const x = xForMinute(t);
      // small tick
      const tick = document.createElementNS(svgNS,'line');
      tick.setAttribute('x1', x);
      tick.setAttribute('x2', x);
      tick.setAttribute('y1', TOP_GUIDE_Y - 8);
      tick.setAttribute('y2', TOP_GUIDE_Y + 8);
      tick.setAttribute('stroke','#444');
      tick.setAttribute('stroke-width','1');
      svg.appendChild(tick);
      // number above
      const txt = document.createElementNS(svgNS,'text');
      txt.setAttribute('x', x);
      txt.setAttribute('y', TOP_GUIDE_Y - 12);
      txt.setAttribute('text-anchor', 'middle');
      txt.setAttribute('font-family', 'Segoe UI, Roboto, Arial');
      txt.setAttribute('font-size','12');
      txt.setAttribute('fill','#111');
      txt.textContent = String(t);
      svg.appendChild(txt);
    });

    // right side y labels 0..5 and -1..-5 (for goal counts)
    const yLabelGroup = document.createElementNS(svgNS,'g');
    yLabelGroup.setAttribute('transform', `translate(${SVG_W - 18},0)`);
    const yLabels = [5,4,3,2,1,0,-1,-2,-3,-4,-5];
    // map label positions linearly between TOP_GUIDE_Y and BOTTOM_GUIDE_Y for +/-5 scale
    yLabels.forEach((lab, idx) => {
      // compute y for label value lab
      const yPos = lab >= 0
        ? yForMomentum(lab)
        : yForMomentum(lab); // same mapping; we just display ticks
      const tEl = document.createElementNS(svgNS,'text');
      tEl.setAttribute('x', 0);
      tEl.setAttribute('y', yPos + 4); // +4 for alignment
      tEl.setAttribute('text-anchor','start');
      tEl.setAttribute('font-family', 'Segoe UI, Roboto, Arial');
      tEl.setAttribute('font-size','12');
      tEl.setAttribute('fill','#222');
      tEl.textContent = String(lab);
      yLabelGroup.appendChild(tEl);
    });
    svg.appendChild(yLabelGroup);

    // draw goal badges (stacked) at bucket midpoints
    // For each period p and bucket b, if scored>0 draw green badges stacked upward from baseline at that minute's x,
    // if conceded>0 draw red badges stacked downward from baseline.
    const badgesG = document.createElementNS(svgNS,'g');
    badgesG.setAttribute('id','seasonMapGoalBadges');
    for (let p = 0; p < 3; p++) {
      const period = periods[p] || { scored: [0,0,0,0], conceded: [0,0,0,0] };
      for (let b = 0; b < BUCKET_LABELS.length; b++) {
        const midLocal = BUCKET_LABELS[b].mid;
        const globalMin = Math.round(p * 20 + midLocal);
        const x = xForMinute(globalMin);
        const scored = Number(period.scored[b] || 0) || 0;
        const conceded = Number(period.conceded[b] || 0) || 0;
        // draw scored badges (stack up)
        for (let s = 0; s < scored; s++) {
          const radius = 12;
          const gap = 4;
          // stack offset: first badge sits just above baseline with small gap
          const y = MIDLINE_Y - (radius*2 + gap) * (s + 0.5) - 6; // -6 to offset a bit
          const circle = document.createElementNS(svgNS,'circle');
          circle.setAttribute('cx', x.toFixed(2));
          circle.setAttribute('cy', y.toFixed(2));
          circle.setAttribute('r', String(radius));
          circle.setAttribute('fill', '#1fb256');
          circle.setAttribute('stroke', '#0f6b3a');
          circle.setAttribute('stroke-width', '1');
          badgesG.appendChild(circle);
          // number label inside circle (only on top-most if multiple to keep clarity)
          if (s === Math.floor(scored/2)) {
            const txt = document.createElementNS(svgNS,'text');
            txt.setAttribute('x', x.toFixed(2));
            txt.setAttribute('y', (y+4).toFixed(2));
            txt.setAttribute('text-anchor','middle');
            txt.setAttribute('font-family','Segoe UI, Roboto');
            txt.setAttribute('font-size','12');
            txt.setAttribute('fill','#fff');
            txt.textContent = String(scored);
            badgesG.appendChild(txt);
          }
        }
        // draw conceded badges (stack down)
        for (let c = 0; c < conceded; c++) {
          const radius = 12;
          const gap = 4;
          const y = MIDLINE_Y + (radius*2 + gap) * (c + 0.5) + 6;
          const circle = document.createElementNS(svgNS,'circle');
          circle.setAttribute('cx', x.toFixed(2));
          circle.setAttribute('cy', y.toFixed(2));
          circle.setAttribute('r', String(radius));
          circle.setAttribute('fill', '#f07d7d');
          circle.setAttribute('stroke', '#8a3b3b');
          circle.setAttribute('stroke-width', '1');
          badgesG.appendChild(circle);
          if (c === Math.floor(conceded/2)) {
            const txt = document.createElementNS(svgNS,'text');
            txt.setAttribute('x', x.toFixed(2));
            txt.setAttribute('y', (y+4).toFixed(2));
            txt.setAttribute('text-anchor','middle');
            txt.setAttribute('font-family','Segoe UI, Roboto');
            txt.setAttribute('font-size','12');
            txt.setAttribute('fill','#fff');
            txt.textContent = String(conceded);
            badgesG.appendChild(txt);
          }
        }
      }
    }
    svg.appendChild(badgesG);

    // bottom axis label (Gameplay)
    const axisLabel = document.createElementNS(svgNS,'text');
    axisLabel.setAttribute('x', (SVG_W / 2).toFixed(0));
    axisLabel.setAttribute('y', (SVG_H - 6).toFixed(0));
    axisLabel.setAttribute('text-anchor','middle');
    axisLabel.setAttribute('font-family','Segoe UI, Roboto');
    axisLabel.setAttribute('font-weight','700');
    axisLabel.setAttribute('font-size','16');
    axisLabel.setAttribute('fill','#111');
    axisLabel.textContent = 'Gameplay';
    svg.appendChild(axisLabel);

    // left label Momentum
    const leftLabel = document.createElementNS(svgNS,'text');
    leftLabel.setAttribute('x', '6');
    leftLabel.setAttribute('y', (MIDLINE_Y+4).toFixed(0));
    leftLabel.setAttribute('text-anchor','start');
    leftLabel.setAttribute('font-family','Segoe UI, Roboto');
    leftLabel.setAttribute('font-weight','700');
    leftLabel.setAttribute('font-size','14');
    leftLabel.setAttribute('fill','#111');
    leftLabel.textContent = 'Momentum';
    svg.appendChild(leftLabel);

    // attach the svg to container
    container.appendChild(svg);
  }

  // monitor changes to the season time box to refresh the graphic
  function setupAutoUpdate() {
    const timeBox = document.getElementById('seasonTimeTrackingBox');
    if (!timeBox) {
      // if not present now, try again later when season map page rendered
      // Attach to seasonMapPage mutation observer to detect later insertion
      const root = getSeasonMapRoot();
      const mo = new MutationObserver((mutations) => {
        if (document.getElementById('seasonTimeTrackingBox')) {
          mo.disconnect();
          setupAutoUpdate(); // re-run now that box exists
          // initial render
          renderSeasonMomentumGraphic();
        }
      });
      mo.observe(root, { childList: true, subtree: true });
      return;
    }

    // initial render
    renderSeasonMomentumGraphic();

    // listen to changes inside the box (button text changes)
    const mo = new MutationObserver((muts) => {
      let changed = false;
      for (const m of muts) {
        if (m.type === 'characterData' || m.type === 'childList' || m.type === 'attributes') {
          changed = true; break;
        }
      }
      if (changed) {
        // throttle updates slightly
        if (setupAutoUpdate._timer) clearTimeout(setupAutoUpdate._timer);
        setupAutoUpdate._timer = setTimeout(() => {
          renderSeasonMomentumGraphic();
        }, 120);
      }
    });

    mo.observe(timeBox, { subtree: true, characterData: true, childList: true, attributes: true });

    // also attach click handlers to time-btns so immediate changes update
    timeBox.addEventListener('click', (e) => {
      if (e.target && e.target.classList && e.target.classList.contains('time-btn')) {
        setTimeout(() => renderSeasonMomentumGraphic(), 80);
      }
    }, true);
  }

  // auto-init when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setupAutoUpdate());
  } else {
    setupAutoUpdate();
  }

})();
