/* v4 art: Pixel Adventure 1 (Pixel Frog, CC0) packed into one atlas (see CREDITS).
   A few Kenney emotes/faces remain for death-comedy overlays. Render-only. */
var ART3 = (function () {
  'use strict';
  var img = new Image(), bg = new Image(), ok = 0, R = ATLAS.r, O = ATLAS.o, N = ATLAS.n, B = ATLAS.bear.body, cache = {};
  function ready(cb) {
    function done() { if (++ok === 2) cb(); }
    img.onload = done; bg.onload = done;
    img.src = ATLAS.atlasSrc || ATLAS.img || './assets/atlas.png';
    bg.src = ATLAS.bgSrc || ATLAS.bg || './assets/bg.jpg';
  }
  function spr(g, name, x, y, w, h) { var r = R[name]; if (!r) return; g.drawImage(img, r[0], r[1], r[2], r[3], x, y, w, h); }
  function sprFit(g, name, cx, by, w) { var r = R[name]; if (!r) return; var h = w * r[3] / r[2]; spr(g, name, cx - w / 2, by - h, w, h); }
  function tinted(name, color) {
    var k = name + color; if (cache[k]) return cache[k]; var r = R[name], c = document.createElement('canvas'); c.width = r[2]; c.height = r[3];
    var g = c.getContext('2d'); g.drawImage(img, r[0], r[1], r[2], r[3], 0, 0, r[2], r[3]); g.globalCompositeOperation = 'source-atop'; g.fillStyle = color; g.fillRect(0, 0, r[2], r[3]);
    cache[k] = c; return c;
  }
  var A = {
    ready: ready,
    bg: function (g, W, H, t) {
      g.drawImage(bg, 0, 0, W, H);
    },
    tile: function (g, kind, v, x, y, s, alpha) {
      g.globalAlpha = alpha === undefined ? 1 : alpha;
      var name = v === 'D' ? (kind === 'b' ? 'bdirt' : 'dirt') : (kind === 'b' ? 'bt' : 'gt') + v;
      spr(g, name, Math.floor(x), Math.floor(y), Math.ceil(s) + 1, Math.ceil(s) + 1); g.globalAlpha = 1;
    },
    spike: function (g, x, y, s, alpha) { var r = R.spikes, w = s * 0.92, h = w * r[3] / r[2]; g.globalAlpha = alpha === undefined ? 1 : alpha;
      spr(g, 'spikes', x + (s - w) / 2, y + s - h, w, h); g.globalAlpha = 1; },
    tramp: function (g, x, y, s, t, bouncing) {
      var name = bouncing ? ((t % 10 < 5) ? 'tramp2' : 'tramp1') : 'tramp0';
      var r = R[name] || R.tramp0, w = s * 0.95, h = w * r[3] / r[2];
      spr(g, name, x + (s - w) / 2, y + s - h, w, h);
    },
    block: function (g, x, y, s, alpha) {
      g.globalAlpha = alpha === undefined ? 1 : alpha;
      var r = R.block, w = s * 0.92, h = w * r[3] / r[2];
      spr(g, 'block', x + (s - w) / 2, y + (s - h) / 2, w, h); g.globalAlpha = 1;
    },
    goal: function (g, x, y, s, t) {
      var p = Math.sin(t / 10), name = (t % 24 < 16) ? 'goal0' : 'goal1';
      var r = R[name], w = s * 1.05, h = w * r[3] / r[2];
      spr(g, name, x + (s - w) / 2, y + s - h + p * s * 0.04, w, h);
    },
    start: function (g, x, y, s) {
      g.globalAlpha = 0.95; sprFit(g, 'start', x + s * 0.5, y + s, s * 0.7); g.globalAlpha = 1;
    },
    // Mask Dude in hitbox (x,y,w,h px). o: {anim, f, flip, alpha, tint, rot, sx, sy}
    bear: function (g, x, y, w, h, o) {
      var anim = o.anim || 'idle', n = N[anim] || 1, fi = ((o.f || 0) % n + n) % n, name = anim + fi, r = R[name], off = O[name];
      if (!r) { name = anim + '0'; r = R[name]; off = O[name]; }
      if (!r) return;
      // Fit slightly taller than the hitbox but still under a 1-tile walk-under gap (224/800 clearance).
      var k = 1.08 * h / (B[3] - B[1]), cx = x + w / 2, by = y + h, bcx = (B[0] + B[2]) / 2;
      g.save(); g.globalAlpha = o.alpha === undefined ? 1 : o.alpha; g.translate(cx, by - h / 2);
      if (o.rot) g.rotate(o.rot); g.scale((o.flip ? -1 : 1) * (o.sx || 1), o.sy || 1); g.translate(0, h / 2);
      var dx = (off[0] - bcx) * k, dy = (off[1] - B[3]) * k;
      if (o.tint) g.drawImage(tinted(name, o.tint), dx, dy, r[2] * k, r[3] * k); else g.drawImage(img, r[0], r[1], r[2], r[3], dx, dy, r[2] * k, r[3] * k);
      g.restore();
    },
    emote: function (g, name, cx, by, w, alpha) { g.globalAlpha = alpha === undefined ? 1 : alpha; sprFit(g, 'emo_' + name, cx, by, w); g.globalAlpha = 1; },
    face: function (g, name, cx, cy, w) { var r = R['face_' + name]; if (!r) return; var h = w * r[3] / r[2]; spr(g, 'face_' + name, cx - w / 2, cy - h / 2, w, h); },
    particle: function (g, x, y, s, rot) { g.save(); g.translate(x, y); g.rotate(rot || 0); spr(g, 'particle', -s / 2, -s / 2, s, s); g.restore(); }
  };
  return A;
})();
