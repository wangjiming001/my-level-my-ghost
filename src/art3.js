/* Original procedural stickman concept 06 + environment art: Pixel Adventure 1 (Pixel Frog, CC0) packed into one atlas (see CREDITS).
   A few Kenney emotes/faces remain for death-comedy overlays. Render-only. */
var ART3 = (function () {
  'use strict';
  var heroImg = new Image(), heroLoaded = false, heroTint = null;
  var img = new Image(), bg = new Image(), ok = 0, R = ATLAS.r, O = ATLAS.o, N = ATLAS.n, B = ATLAS.bear.body, cache = {};
  function ready(cb) {
    function done() { if (++ok === 3) cb(); }
    img.onload = done; bg.onload = done;
    heroImg.onload = function () { heroLoaded = true; done(); };
    heroImg.onerror = function () { done(); };
    heroImg.src = './assets/hero06.png';
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
    // Original concept 06: cheeky stickman. Rendering only; hitbox/physics unchanged.
    bearVector: function (g, x, y, w, h, o) {
      o = o || {};
      var anim = o.anim || 'idle', f = o.f || 0, shocked = anim === 'dead' || anim === 'dizzy';
      var running = anim === 'run', airborne = anim === 'up' || anim === 'fall';
      var swing = running ? Math.sin(f * Math.PI / 6) : 0;
      var bob = running ? Math.abs(Math.sin(f * Math.PI / 6)) * 3 : Math.sin(f * 0.4) * 1.2;
      var color = o.tint ? '#6b729e' : '#252935', face = o.tint ? '#e0e5ff' : '#fffdf8';
      g.save(); g.globalAlpha = o.alpha === undefined ? 1 : o.alpha;
      g.translate(x + w / 2, y + h / 2);
      if (o.rot) g.rotate(o.rot);
      g.scale((o.flip ? -1 : 1) * (o.sx || 1) * w / 78, (o.sy || 1) * h / 120);
      g.translate(0, 60);
      g.strokeStyle = color; g.fillStyle = color; g.lineWidth = 3.5; g.lineCap = 'round'; g.lineJoin = 'round';
      function line(points) { g.beginPath(); g.moveTo(points[0], points[1]); for (var i = 2; i < points.length; i += 2) g.lineTo(points[i], points[i + 1]); g.stroke(); }
      function oval(cx, cy, rx, ry, fill) { g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); g.fillStyle = fill; g.fill(); g.stroke(); }
      // Thin body, bent limbs and big feet. Feet stay anchored to the existing box.
      line([0, -52 + bob, -3, -32, 0, -23]);
      if (shocked) {
        line([-2, -48, -25, -64, -36, -48]); line([2, -48, 27, -29, 35, -48]);
        line([0, -23, -23, -12, -30, -24]); line([0, -23, 16, -11, 27, -1]);
        oval(-32, -24, 8, 4, color); oval(29, -1, 9, 4, color);
      } else if (running || airborne) {
        line([0, -48 + bob, -16, -39 + swing * 12, -23, -53 + swing * 9]);
        line([0, -48 + bob, 17, -37 - swing * 12, 24, -48 - swing * 9]);
        line([0, -23, -15 + swing * 10, -12, -21 + swing * 17, -1 - Math.max(0, swing) * 8]);
        line([0, -23, 14 - swing * 10, -12, 22 - swing * 17, -1 - Math.max(0, -swing) * 8]);
        oval(-21 + swing * 17, -1 - Math.max(0, swing) * 8, 9, 3.5, color);
        oval(22 - swing * 17, -1 - Math.max(0, -swing) * 8, 9, 3.5, color);
      } else {
        // Hands rubbing together, as in concept 06.
        line([-2, -49, -20, -37, 5, -53]); line([2, -49, 17, -37, 5, -53]);
        oval(5, -53, 5, 5, color);
        line([0, -23, -16, -13, -22, -1]); line([0, -23, 17, -12, 24, -1]);
        oval(-23, -1, 10, 3.8, color); oval(25, -1, 10, 3.8, color);
      }
      g.save(); g.translate(running ? 3 : 0, -83 + bob);
      oval(0, 0, 32, 29, face);
      // The signature bent hair, not a separate sprite.
      line([-2, -29, 3, -39, -7, -46, 4, -49]);
      if (shocked) {
        oval(-13, -7, 12, 14, '#fff'); oval(13, -10, 13, 15, '#fff');
        oval(-10, -5, 2.2, 3, color); oval(15, -7, 2.2, 3, color);
        oval(4, 16, 8, 12, color);
        g.save(); g.lineWidth = 1; oval(5, 22, 5, 4, '#f47b8e'); g.restore();
        line([-25, -23, -15, -26]); line([7, -28, 19, -29]);
      } else {
        // Half-lidded side-eye, one raised brow, and a deliberately crooked grin.
        g.fillStyle = '#fff'; g.beginPath(); g.moveTo(-26, -5); g.quadraticCurveTo(-12, 15, -1, -1); g.closePath(); g.fill(); g.stroke();
        g.beginPath(); g.moveTo(4, -1); g.quadraticCurveTo(18, 10, 27, -10); g.closePath(); g.fill(); g.stroke();
        oval(-7, 2, 2.5, 3, color); oval(20, -3, 2.5, 3, color);
        line([-27, -15, -6, -8]);
        g.beginPath(); g.moveTo(7, -17); g.quadraticCurveTo(17, -27, 26, -19); g.stroke();
        g.fillStyle = '#fff'; g.beginPath(); g.moveTo(-7, 14); g.quadraticCurveTo(12, 24, 24, 7); g.quadraticCurveTo(15, 34, -7, 14); g.fill(); g.stroke();
        g.lineWidth = 1.8; line([7, 20, 9, 25]); line([15, 17, 18, 22]);
      }
      g.restore(); g.restore();
    },
    // Image frames preserve the approved artwork; transforms remain render-only.
    bear: function (g, x, y, w, h, o) {
      o = o || {};
      if (!heroLoaded) return A.bearVector(g, x, y, w, h, o);
      var anim = o.anim || 'idle', f = o.f || 0, index = Math.floor(f / 3) % 4;
      if (anim === 'run') index = 4 + Math.floor(f / 2) % 4;
      else if (anim === 'up') index = 8;
      else if (anim === 'fall') index = 9;
      else if (anim === 'dizzy') index = 10;
      else if (anim === 'dead') index = 11;
      var source = heroImg;
      if (o.tint) {
        if (!heroTint) {
          heroTint = document.createElement('canvas'); heroTint.width = 768; heroTint.height = 576;
          var tc = heroTint.getContext('2d'); tc.drawImage(heroImg, 0, 0);
          tc.globalCompositeOperation = 'source-atop'; tc.fillStyle = '#a8b8f5'; tc.fillRect(0, 0, 768, 576);
        }
        source = heroTint;
      }
      var height = h * 1.18, width = height;
      g.save(); g.globalAlpha = o.alpha === undefined ? 1 : o.alpha;
      g.translate(x + w / 2, y + h / 2);
      if (o.rot) g.rotate(o.rot);
      g.scale((o.flip ? -1 : 1) * (o.sx || 1), o.sy || 1);
      g.imageSmoothingEnabled = true;
      g.drawImage(source, (index % 4) * 192, Math.floor(index / 4) * 192, 192, 192, -width / 2, h / 2 - height * 184 / 192, width, height);
      g.restore();
    },
    emote: function (g, name, cx, by, w, alpha) { g.globalAlpha = alpha === undefined ? 1 : alpha; sprFit(g, 'emo_' + name, cx, by, w); g.globalAlpha = 1; },
    face: function (g, name, cx, cy, w) { var r = R['face_' + name]; if (!r) return; var h = w * r[3] / r[2]; spr(g, 'face_' + name, cx - w / 2, cy - h / 2, w, h); },
    particle: function (g, x, y, s, rot) { g.save(); g.translate(x, y); g.rotate(rot || 0); spr(g, 'particle', -s / 2, -s / 2, s, s); g.restore(); }
  };
  return A;
})();
