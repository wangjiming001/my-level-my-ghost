/* Placeholder geometric art. Every sprite is one function so it can be swapped for Kenney CC0 images later
   (keep the same signature: draw into g at x,y with tile size s). Render-only: nothing here touches physics. */
var ART = (function () {
  'use strict';
  var C = { bg: '#1b1d2b', grid: 'rgba(255,255,255,0.05)', gnd: '#efe3c8', gndSide: '#d9c9a6', spike: '#ff5d73', goal: '#5ef0c0', start: '#6a6f8f', hero: '#ff7a59', ghost: 'rgba(235,240,255,0.42)', ink: '#2a1410', crack: '#b0563f' };
  function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r); g.lineTo(x + w, y + h - r * 0.3);
    g.quadraticCurveTo(x + w, y + h, x + w - r * 0.3, y + h); g.lineTo(x + r * 0.3, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r * 0.3); g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath(); }
  var A = {
    C: C,
    bg: function (g, w, h, s, cols, rows) { g.fillStyle = C.bg; g.fillRect(0, 0, w, h); g.fillStyle = C.grid;
      for (var c = 1; c < cols; c++) for (var r = 1; r < rows; r++) g.fillRect(c * s - 1, r * s - 1, 2, 2); },
    ground: function (g, x, y, s, alpha) { g.globalAlpha = alpha === undefined ? 1 : alpha; g.fillStyle = C.gnd; g.fillRect(x, y, s, s);
      g.fillStyle = C.gndSide; g.fillRect(x, y + s * 0.82, s, s * 0.18); g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = Math.max(1, s * 0.03); g.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1); g.globalAlpha = 1; },
    crack: function (g, x, y, s) { g.strokeStyle = C.crack; g.lineWidth = s * 0.06; g.beginPath(); g.moveTo(x + s * .2, y + s * .15); g.lineTo(x + s * .45, y + s * .5); g.lineTo(x + s * .3, y + s * .85); g.moveTo(x + s * .45, y + s * .5); g.lineTo(x + s * .8, y + s * .4); g.stroke(); },
    arrow: function (g, x, y, s) { g.fillStyle = C.crack; g.beginPath(); g.moveTo(x + s * .3, y + s * .35); g.lineTo(x + s * .7, y + s * .35); g.lineTo(x + s * .5, y + s * .7); g.fill(); },
    spike: function (g, x, y, s, color, dashed) { g.fillStyle = color || C.spike; g.strokeStyle = color || C.spike;
      for (var k = 0; k < 2; k++) { var bx = x + s * (0.12 + k * 0.38), w = s * 0.38; g.beginPath(); g.moveTo(bx, y + s); g.lineTo(bx + w / 2, y + s * 0.42); g.lineTo(bx + w, y + s); g.closePath();
        if (dashed) { if (g.setLineDash) g.setLineDash([s * 0.08, s * 0.06]); g.lineWidth = Math.max(1, s * 0.05); g.stroke(); if (g.setLineDash) g.setLineDash([]); } else g.fill(); } },
    goal: function (g, x, y, s, t) { var cx = x + s / 2, cy = y + s / 2, p = 0.5 + 0.5 * Math.sin(t / 10); g.strokeStyle = C.goal; g.lineWidth = s * 0.08;
      g.beginPath(); g.arc(cx, cy, s * (0.30 + 0.04 * p), 0, Math.PI * 2); g.stroke(); g.globalAlpha = 0.35 + 0.3 * p; g.beginPath(); g.arc(cx, cy, s * 0.16, 0, Math.PI * 2); g.fillStyle = C.goal; g.fill(); g.globalAlpha = 1; },
    start: function (g, x, y, s) { g.fillStyle = C.start; g.fillRect(x + s * 0.2, y + s * 0.88, s * 0.6, s * 0.12); },
    // hero / ghost. o: {color, eyes:'dot'|'x'|'wide'|'closed', lx, ly (look -1..1), mouth:'none'|'o'|'grin', sx, sy (squash), rot}
    hero: function (g, x, y, w, h, o) {
      o = o || {}; var sx = o.sx || 1, sy = o.sy || 1, cx = x + w / 2, by = y + h;
      g.save(); g.translate(cx, by - h / 2); if (o.rot) g.rotate(o.rot); g.scale(sx, sy); g.translate(-w / 2, -h / 2);
      g.fillStyle = o.color || C.hero; rr(g, 0, 0, w, h, w * 0.26); g.fill();
      var ink = o.ink || C.ink, lx = (o.lx || 0) * w * 0.1, ly = (o.ly || 0) * h * 0.06, ex1 = w * 0.32 + lx, ex2 = w * 0.68 + lx, ey = h * 0.32 + ly, er = w * 0.085;
      g.fillStyle = ink; g.strokeStyle = ink; g.lineWidth = Math.max(1, w * 0.07); g.lineCap = 'round';
      if (o.eyes === 'x') { [ex1, ex2].forEach(function (ex) { g.beginPath(); g.moveTo(ex - er * 1.3, ey - er * 1.3); g.lineTo(ex + er * 1.3, ey + er * 1.3); g.moveTo(ex + er * 1.3, ey - er * 1.3); g.lineTo(ex - er * 1.3, ey + er * 1.3); g.stroke(); }); }
      else if (o.eyes === 'wide') { [ex1, ex2].forEach(function (ex) { g.fillStyle = '#fff'; g.beginPath(); g.arc(ex, ey, er * 2, 0, 7); g.fill(); g.fillStyle = ink; g.beginPath(); g.arc(ex, ey, er * 0.8, 0, 7); g.fill(); }); }
      else if (o.eyes === 'closed') { [ex1, ex2].forEach(function (ex) { g.beginPath(); g.moveTo(ex - er, ey); g.lineTo(ex + er, ey); g.stroke(); }); }
      else { g.beginPath(); g.arc(ex1, ey, er, 0, 7); g.arc(ex2, ey, er, 0, 7); g.fill(); }
      if (o.mouth === 'o') { g.beginPath(); g.ellipse ? g.ellipse(w * 0.5 + lx, h * 0.62, w * 0.11, h * 0.1, 0, 0, 7) : g.arc(w * 0.5, h * 0.62, w * 0.1, 0, 7); g.fillStyle = ink; g.fill(); }
      else if (o.mouth === 'grin') { g.beginPath(); g.arc(w * 0.5 + lx, h * 0.5, w * 0.16, 0.2, Math.PI - 0.2); g.stroke(); }
      g.restore();
    },
    // smug face pasted on a trap that just killed you
    trapFace: function (g, cx, cy, s, t) {
      var b = Math.sin(t * 0.5) * s * 0.03; g.save(); g.translate(cx, cy + b); g.fillStyle = '#2a1410'; g.strokeStyle = '#2a1410'; g.lineWidth = s * 0.06; g.lineCap = 'round';
      // half-lidded eyes
      [-1, 1].forEach(function (d) { g.beginPath(); g.arc(d * s * 0.17, -s * 0.05, s * 0.07, 0, Math.PI); g.fill(); g.beginPath(); g.moveTo(d * s * 0.17 - s * 0.1, -s * 0.07); g.lineTo(d * s * 0.17 + s * 0.1, -s * 0.07); g.stroke(); });
      g.beginPath(); g.moveTo(-s * 0.15, s * 0.14); g.quadraticCurveTo(s * 0.05, s * 0.26, s * 0.2, s * 0.08); g.stroke(); // smirk
      g.restore();
    },
    skull: function (g, cx, cy, r) {
      g.save(); g.translate(cx, cy); g.fillStyle = '#fff'; g.strokeStyle = '#1b1d2b'; g.lineWidth = r * 0.12;
      g.beginPath(); g.arc(0, -r * 0.15, r * 0.75, 0, 7); g.fill(); g.stroke(); g.fillRect(-r * 0.42, r * 0.3, r * 0.84, r * 0.45);
      g.fillStyle = '#1b1d2b'; g.beginPath(); g.arc(-r * 0.3, -r * 0.15, r * 0.2, 0, 7); g.arc(r * 0.3, -r * 0.15, r * 0.2, 0, 7); g.fill();
      g.fillRect(-r * 0.05, r * 0.32, r * 0.1, r * 0.4); g.fillRect(-r * 0.3, r * 0.32, r * 0.08, r * 0.4); g.fillRect(r * 0.22, r * 0.32, r * 0.08, r * 0.4); g.restore();
    },
    bubble: function (g, x, y, text, fs, maxW) {
      g.save(); g.font = 'bold ' + fs + 'px -apple-system,"PingFang SC",sans-serif'; var w = g.measureText(text).width + fs * 1.1, h = fs * 1.8;
      var bx = Math.max(4, Math.min(maxW - w - 4, x - w / 2)), by = Math.max(4, y - h - fs * 0.6);
      g.fillStyle = '#fff'; rr(g, bx, by, w, h, fs * 0.6); g.fill();
      var tx = Math.max(bx + fs, Math.min(bx + w - fs, x)); g.beginPath(); g.moveTo(tx - fs * 0.4, by + h - 1); g.lineTo(tx, by + h + fs * 0.6); g.lineTo(tx + fs * 0.4, by + h - 1); g.fill();
      g.fillStyle = '#1b1d2b'; g.textBaseline = 'middle'; g.fillText(text, bx + fs * 0.55, by + h / 2 + 1); g.restore();
    }
  };
  return A;
})();
