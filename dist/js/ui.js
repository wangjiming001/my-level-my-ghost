(function () {
  'use strict';
  var M = MLMG, TL = M.TILE, COLS = M.COLS, ROWS = M.ROWS, T = M.T, C = ART.C;
  var LEVELS = MLMG_LEVELS, DEMO_GHOSTS = (typeof MLMG_DEMO_GHOSTS !== 'undefined') ? MLMG_DEMO_GHOSTS : [];
  function $(id) { return document.getElementById(id); }
  function show(id) { $('toast').classList.remove('on'); var s = document.querySelectorAll('.scr'); for (var i = 0; i < s.length; i++) s[i].classList.remove('on'); $(id).classList.add('on'); if (id === 'sPlay') resize(); }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem('mlmg_' + k); localStorage.setItem('mlmg_' + k, v); } catch (e) { return null; } }

  // ---------------- sound (WebAudio synth, render-only) ----------------
  var AC = null, muted = store('mute') === '1';
  function ac() { if (!AC) { var K = window.AudioContext || window.webkitAudioContext; if (!K) return null; try { AC = new K(); } catch (e) { return null; } }
    if (AC.state === 'suspended' && AC.resume) AC.resume(); return AC; }
  function tone(f0, f1, dur, type, vol, delay) {
    if (muted) return; var a = ac(); if (!a) return; var t0 = a.currentTime + (delay || 0), o = a.createOscillator(), gn = a.createGain();
    o.type = type || 'square'; o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t0 + dur);
    gn.gain.setValueAtTime(vol || 0.08, t0); gn.gain.exponentialRampToValueAtTime(0.0008, t0 + dur); o.connect(gn); gn.connect(a.destination); o.start(t0); o.stop(t0 + dur + 0.02);
  }
  function noise(dur, vol, delay) {
    if (muted) return; var a = ac(); if (!a) return; var n = Math.floor(a.sampleRate * dur), buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n); var src = a.createBufferSource(), gn = a.createGain(); src.buffer = buf; gn.gain.value = vol || 0.1;
    src.connect(gn); gn.connect(a.destination); src.start(a.currentTime + (delay || 0));
  }
  var SFX = {
    jump: function () { tone(380, 820, 0.1, 'square', 0.05); },
    land: function () { tone(150, 70, 0.06, 'sine', 0.09); },
    click: function () { tone(1400, 900, 0.04, 'square', 0.025); },
    death: function () { noise(0.12, 0.18); tone(520, 900, 0.08, 'sine', 0.12, 0.02); tone(900, 110, 0.32, 'sine', 0.12, 0.1); },
    taunt: function () { tone(660, 520, 0.09, 'triangle', 0.07, 0.0); tone(620, 480, 0.09, 'triangle', 0.07, 0.12); tone(560, 300, 0.22, 'triangle', 0.07, 0.24); },
    win: function () { [523, 659, 784, 1046].forEach(function (f, i) { tone(f, f, 0.14, 'square', 0.05, i * 0.08); }); },
    bounce: function () { tone(280, 640, 0.14, 'square', 0.07); tone(520, 880, 0.16, 'triangle', 0.05, 0.05); }
  };
  document.addEventListener('touchstart', function () { if (!muted) ac(); }, { passive: true });
  document.addEventListener('mousedown', function () { if (!muted) ac(); });
  function setMute(m) { muted = m; store('mute', m ? '1' : '0'); $('pMute').textContent = m ? '🔇' : '🔊'; }
  $('pMute').onclick = function () { setMute(!muted); if (!muted) SFX.click(); }; setMute(muted);

  // ---------------- canvas ----------------
  var cv = $('cv'), ctx = cv.getContext('2d'), cssW = 360, scale = 1, dpr = 1;
  var viewCols = COLS, viewRows = ROWS, camX = 0, camY = 0;
  function resize() {
    var wrap = $('stageWrap'); cssW = Math.max(200, wrap.clientWidth - 12); dpr = Math.min(window.devicePixelRatio || 1, 3);
    viewCols = COLS; viewRows = ROWS;
    var cssH = Math.round(cssW * viewRows / viewCols); cv.style.height = cssH + 'px'; cv.width = Math.round(cssW * dpr); cv.height = Math.round(cssH * dpr); scale = cv.width / (viewCols * T);
  }
  function applyCamera(w) {
    camX = 0; camY = 0;
    // The whole map stays fixed; character animation and reaction inset remain.
  }
  function drawReaction(g) {
    if (!g.dseq || g.dseq.phase !== 'hit') return;
    var size = Math.min(cssW * 0.3, 112) * dpr, px = cv.width - size - 10 * dpr, py = 10 * dpr;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#fff6e6'; ctx.strokeStyle = '#40312a'; ctx.lineWidth = 3 * dpr;
    ctx.fillRect(px, py, size, size); ctx.strokeRect(px, py, size, size);
    ctx.beginPath(); ctx.rect(px + 3 * dpr, py + 3 * dpr, size - 6 * dpr, size - 6 * dpr); ctx.clip();
    ART3.bear(ctx, px + size * 0.03, py + size * 0.23, size * 0.94, size * 1.4, { anim: 'dizzy', f: g.dseq.t });
    ctx.restore();
  }
  window.addEventListener('resize', resize);
  var goneAt = {}, popAt = {};
  function blockCell(map, k) { var n = 0; for (var i = 0; i < map.length; i++) if (map[i] === TL.FALL) { if (n === k) return i; n++; } return -1; }
  // view: 'play' (traps disguised) | 'edit' (traps marked) | 'card' (disguised except reveal{cell:true})
  function solidLook(map, c, r) { if (c < 0 || c >= COLS) return true; if (r < 0 || r >= ROWS) return false; var t = map[r * COLS + c]; return t === TL.GND || t === TL.COL || t === TL.FALL || t === TL.TRM || t === TL.SHIFT || t === TL.CHASE || t === TL.OPEN || t === TL.RELAY; }
  function variant(map, c, r) { if (solidLook(map, c, r - 1)) return 'D'; var l = solidLook(map, c - 1, r), rr = solidLook(map, c + 1, r), below = solidLook(map, c, r + 1);
    if (!l && !below) return 'L'; if (!rr && !below) return 'R'; return 'M'; }
  var crumbs = [];
  // view: 'play' (traps disguised) | 'edit' (traps marked) | 'card' (disguised except reveal{cell:true})
  function drawMap(g, map, sc, world, view, t, reveal) {
    var s = T * sc, i, c, r, x, y, tt, ceilingRows = 0;
    // Full solid rows at the top form a ceiling, using earth rather than an upward grass surface.
    for (var crw = 0; crw < ROWS; crw++) {
      var full = true; for (var ccw = 0; ccw < COLS; ccw++) if (map[crw * COLS + ccw] !== TL.GND) full = false;
      if (!full) break; ceilingRows++;
    }
    ART3.bg(g, COLS * s, ROWS * s, t);
    // Conceal the empty shaft below an intact false floor during play/cards.
    // It is decorative earth only; disappears with its supporting trap.
    if (view !== 'edit') for (var ci = 0; ci < map.length; ci++) if (map[ci] === TL.COL && !(reveal && reveal[ci]) && (!world || world.collapse[ci] >= 0)) {
      var cc = ci % COLS, cr = (ci / COLS) | 0;
      for (var rr = cr + 1; rr < ROWS && map[rr * COLS + cc] === TL.E; rr++) ART3.tile(g, 'g', 'D', cc * s, rr * s, s);
    }
    for (i = 0; i < map.length; i++) {
      tt = map[i]; c = i % COLS; r = (i / COLS) | 0; x = c * s; y = r * s;
      var rv = reveal && reveal[i], v = variant(map, c, r);
      if (tt === TL.GND || tt === TL.SHIFT || tt === TL.CHASE || tt === TL.OPEN || tt === TL.RELAY) ART3.tile(g, 'g', r < ceilingRows ? 'D' : v, x, y, s);
      else if (tt === TL.SPK) ART3.spike(g, x, y, s);
      else if (tt === TL.ST) { ART3.start(g, x, y, s); if (view === 'edit') ART3.bear(g, x + s * 0.19, y + s * 0.22, s * 0.62, s * 0.78, { anim: 'idle', alpha: 0.6 }); }
      else if (tt === TL.GL) ART3.goal(g, x, y, s, t);
      else if (tt === TL.COL) {
        var st = world ? world.collapse[i] : 0;
        if (st === -1) { var gt = goneAt[i] === undefined ? (goneAt[i] = t) : goneAt[i], dt = t - gt;
          if (dt < 40) { ART3.tile(g, 'b', v, x, y + dt * dt * s * 0.004, s, 1 - dt / 40); for (var q = 0; q < 4; q++) ART3.particle(g, x + s * (0.2 + q * 0.2), y + s * 0.9 + dt * dt * s * (0.003 + q * 0.0015), s * 0.22, dt * 0.2 * (q % 2 ? 1 : -1)); } }
        else if (st > 0) { ART3.tile(g, 'b', v, x + Math.sin(t * 2.3) * s * 0.05, y, s); }
        else { ART3.tile(g, (view === 'edit' || rv) ? 'b' : 'g', v, x, y, s); }
      } else if (tt === TL.HID) {
        if (world && world.hidden[i]) { var pt = popAt[i] === undefined ? (popAt[i] = t) : popAt[i], k = Math.min(1, (t - pt) / 4); g.save(); g.beginPath(); g.rect(x, y, s, s); g.clip(); g.translate(0, (1 - k) * s * 0.6); ART3.spike(g, x, y, s); g.restore(); }
        else if (rv) ART3.spike(g, x, y, s); else if (view === 'edit') ART3.spike(g, x, y, s, 0.35);
      } else if (tt === TL.TRM) {
        ART3.tramp(g, x, y, s, t, !!(world && world.sprung && world.grounded === false));
      }
    }
    // Render the same exact moving intervals used by terrain collision.
    var pits = world ? world.pits : null;
    if (!pits) { pits = []; for (var pi = 0; pi < map.length; pi++) if (map[pi] === TL.SHIFT || map[pi] === TL.CHASE || map[pi] === TL.OPEN || map[pi] === TL.RELAY) { pits = new M.World(map).pits; break; } }
    for (var pk = 0; pk < pits.length; pk++) { var pit = pits[pk];
      if (pit.right > pit.left) { g.save(); g.beginPath(); g.rect(pit.left * sc, pit.row * s, (pit.right - pit.left) * sc, (ROWS - pit.row) * s); g.clip(); ART3.bg(g, COLS * s, ROWS * s, t); g.restore(); }
      if (view === 'edit') { g.fillStyle = '#ff7026'; g.font = 'bold ' + Math.round(s * 0.45) + 'px sans-serif'; g.fillText(pit.kind === TL.SHIFT ? '←' : '↔', (pit.cell % COLS) * s, (pit.row + 0.7) * s); }
    }
    if (world) for (var b = 0; b < world.blocks.length; b++) { var bl = world.blocks[b]; if (bl.st !== 3) { var bc = blockCell(map, b), bx = bl.c * s, byy = bl.y * sc;
      if (bl.st === 0 && view === 'play' && !(reveal && reveal[bc])) ART3.tile(g, 'g', variant(map, bl.c, (bc / COLS) | 0), bx, byy, s);
      else { ART3.block(g, bx + (bl.st === 4 ? Math.sin(bl.warn * 2) * s * 0.05 : 0), byy, s); if (bl.st === 4) ART3.emote(g, 'exclamation', bx + s / 2, byy, s * 0.4); if (bl.st === 1) ART3.face(g, 'f', bx + s / 2, byy + s * 0.6, s * 0.55); else if (bl.st === 2) ART3.face(g, 'h', bx + s / 2, byy + s * 0.6, s * 0.55); } } }
    else for (i = 0; i < map.length; i++) if (map[i] === TL.FALL) { c = i % COLS; r = (i / COLS) | 0;
      if (view === 'edit' || (reveal && reveal[i])) { ART3.block(g, c * s, r * s, s); ART3.face(g, 'f', c * s + s / 2, r * s + s * 0.6, s * 0.55); }
      else ART3.tile(g, 'g', variant(map, c, r), c * s, r * s, s); }
  }

  // ---------------- input ----------------
  // A short tap produces 10 recorded jump ticks; holding still controls full height.
  var held = { L: false, R: false, J: false }, jLatch = 0;
  function anyPress() { if (game && game.dseq && game.dseq.phase !== 'hit') skipDeath(); }
  function bindBtn(id, key) {
    var el = $(id);
    function down(e) { e.preventDefault(); if (!held[key] && key === 'J') jLatch = 10; held[key] = true; el.classList.add('down'); anyPress(); }
    function up(e) { e.preventDefault(); held[key] = false; el.classList.remove('down'); }
    el.addEventListener('touchstart', down, { passive: false }); el.addEventListener('touchend', up, { passive: false }); el.addEventListener('touchcancel', up, { passive: false });
    el.addEventListener('mousedown', down); el.addEventListener('mouseup', up); el.addEventListener('mouseleave', function (e) { if (held[key]) up(e); });
  }
  bindBtn('bL', 'L'); bindBtn('bR', 'R'); bindBtn('bJ', 'J');
  var KEYS = { ArrowLeft: 'L', a: 'L', A: 'L', ArrowRight: 'R', d: 'R', D: 'R', ' ': 'J', ArrowUp: 'J', w: 'J', W: 'J' };
  document.addEventListener('keydown', function (e) { var k = KEYS[e.key]; if (k && game) { e.preventDefault(); if (e.repeat) return; if (k === 'J' && !held.J) jLatch = 10; held[k] = true; $('b' + k).classList.add('down'); anyPress(); } });
  document.addEventListener('keyup', function (e) { var k = KEYS[e.key]; if (k) { held[k] = false; $('b' + k).classList.remove('down'); } });
  function sampleInput() { var s = (held.L ? M.IN.L : 0) | (held.R ? M.IN.R : 0) | ((held.J || jLatch > 0) ? M.IN.J : 0); if (jLatch > 0) jLatch--; return s; }
  function clearInput() { held.L = held.R = held.J = false; jLatch = 0; ['bL', 'bR', 'bJ'].forEach(function (b) { $(b).classList.remove('down'); }); }

  var toastTimer = 0, appToastTimer = 0;
  function toast(msg, ms) { var t = $('toast'); if (!t) return; t.textContent = msg; t.classList.add('on'); clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('on'); }, ms || 900); }
  function appToast(msg, ms) {
    var t = $('appToast');
    if (!t) { toast(msg, ms); return; }
    t.textContent = msg; t.classList.add('on');
    clearTimeout(appToastTimer);
    appToastTimer = setTimeout(function () { t.classList.remove('on'); }, ms || 2200);
  }
  function formatXhsError(err) {
    if (!err) return '未知错误';
    var msg = err.errMsg || err.message || String(err);
    if (err.errCode != null && String(err.errCode) !== '') msg += '（errCode ' + err.errCode + '）';
    return msg;
  }

  // ---------------- death comedy (render-only; physics world is frozen while it plays) ----------------
  var TAUNT = {
    collapse: ['地板：拜拜～', '我只是看起来很结实', '踩我？想多了', '落地就塌，惊不惊喜'],
    hidden: ['惊喜吗？', '我一直都在哦', '平地？骗你的', '就等你来'],
    block: ['你以为过去了？', '抬头看看嘛', '砸中了！', '我等你好久了'],
    spike: ['我这么明显…', '看到了还撞？', '扎心了吧'],
    fall: ['下面没有路哦', '自由落体～']
  };
  var HIT = 4, RAG = 12, REPLAY = 32;
  function onDeath(g) {
    var w = g.world, cause = w.cause, kc = w.killer, kx, ky;
    if (kc >= 1000) { var bk = w.blocks[kc - 1000]; kx = (bk.c * T + T / 2); ky = bk.y + T / 2; g.reveal[blockCell(g.map, kc - 1000)] = true; }
    else if (kc >= 0) { kx = (kc % COLS) * T + T / 2; ky = ((kc / COLS) | 0) * T + T / 2; g.reveal[kc] = true; }
    var lines = TAUNT[cause] || TAUNT.fall, px = w.x + M.PW / 2, py = Math.min(w.y + M.PH / 2, ROWS * T - 400);
    g.deathsAt.push([px, py]);
    // build replay frames by deterministic re-simulation of this attempt's inputs
    var rw = new M.World(g.map), n = g.rec.length, from = Math.max(0, n - 72), frames = [];
    for (var f = 0; f < n; f++) { if (f >= from) frames.push(rw.clone()); rw.step(g.rec[f]); }
    frames.push(rw.clone());
    g.dseq = { phase: 'hit', t: 0, cause: cause, kx: kx, ky: ky, hasKiller: kc >= 0, taunt: lines[g.deaths % lines.length], px: px, py: py,
      rag: { x: w.x, y: Math.min(w.y, ROWS * T - M.PH), vx: (w.face > 0 ? -1 : 1) * (34 + (g.deaths % 3) * 10), vy: cause === 'fall' || cause === 'collapse' ? -230 : -190, rot: 0, vr: (w.face > 0 ? -0.32 : 0.32) },
      pieces: [], frames: frames, squash: cause === 'block' };
    g.shake = 14; SFX.death(); if (window.XHS && XHS.vibrate) XHS.vibrate('heavy');
    updStat(); var dc = $('pDeaths'), bd = $('bigD'); dc.classList.remove('bump'); bd.classList.remove('bump'); void dc.offsetWidth; dc.classList.add('bump'); bd.classList.add('bump');
    if (g.deaths === 3) setInfo('提示：' + g.hint);
  }
  function stepDeath(g) {
    var d = g.dseq; d.t++;
    if (d.phase === 'hit') { if (d.t >= HIT) { d.phase = 'rag'; d.t = 0; if (d.hasKiller) SFX.taunt();
        if (d.cause === 'spike' || d.cause === 'hidden' || d.cause === 'block') for (var i = 0; i < 6; i++) d.pieces.push({ x: d.rag.x + (i % 3) * 200, y: d.rag.y + ((i / 3) | 0) * 300, vx: (i % 3 - 1) * 30 + (i * 7 % 11) - 5, vy: -90 - (i * 13 % 50), r: 0, vr: (i % 2 ? 0.3 : -0.3) }); } return; }
    if (d.phase === 'rag') { var r = d.rag; r.x += r.vx; r.y += r.vy; r.vy += 9; r.rot += r.vr;
      for (var k = 0; k < d.pieces.length; k++) { var p = d.pieces[k]; p.x += p.vx; p.y += p.vy; p.vy += 9; p.r += p.vr; }
      if (d.t >= RAG) respawn(g); return; }
    if (d.phase === 'replay' && d.t >= REPLAY) respawn(g);
  }
  function respawn(g) { g.world.reset(); g.rec = []; g.dseq = null; goneAt = {}; popAt = {}; g.spawnT = 10; }
  function skipDeath() { var g = game; if (g && g.dseq && g.dseq.phase !== 'hit') respawn(g); }

  // ---------------- game ----------------
  var game = null;
  function trapHint(map) { var h = [];
    for (var i = 0; i < map.length; i++) { if (map[i] === TL.COL && h.indexOf('有的地板踩上去会塌') < 0) h.push('有的地板踩上去会塌');
      if (map[i] === TL.SHIFT) h.push((map.rulesVersion || M.VERSION) >= 9 ? '坑会向左靠近，提前跳过变化的位置' : '坑的位置会变化'); if (map[i] === TL.CHASE) h.push('先跳，再继续跑，别停在扩大的坑前');
      if (map[i] === TL.HID && h.indexOf('平地上有藏起来的刺') < 0) h.push('平地上有藏起来的刺'); if (map[i] === TL.FALL && h.indexOf('有方块会从上面掉下来') < 0) h.push('有方块会从上面掉下来'); }
    return h.length ? h.join('；') + '。' : '这关没有恶搞机关。'; }
  function startPlay(opts) {
    goneAt = {}; popAt = {}; clearInput();
    game = { map: opts.map, mode: opts.mode, title: opts.title, world: new M.World(opts.map), ghost: opts.ghost || null, gworld: opts.ghost ? new M.World(opts.map) : null,
      ghostLabel: opts.ghostLabel || '作者', levelIdx: opts.levelIdx, hint: opts.hint || trapHint(opts.map), snapshot: opts.snapshot || null,
      tick: 0, deaths: 0, rec: [], done: false, gDone: false, dseq: null, shake: 0, reveal: {}, deathsAt: [], squash: 0, spawnT: 10 };
    $('pTitle').textContent = opts.title; editor.on = false; $('sPlay').classList.remove('editing'); $('edit').classList.remove('on'); $('pad').style.display = 'flex';
    $('legend').innerHTML = opts.mode === 'demo' ? '<span>先自己试试；翻车 3 次后出现示范影子</span><span>翻车后快速重来</span>' : game.ghost ? '<span><i style="background:' + C.hero + '"></i>你</span><span><i style="background:#c8cde0;opacity:.6"></i>' + game.ghostLabel + '的影子</span><span>翻车后快速重来，可点任意键跳过动作</span>' : '<span>翻车后快速重来，可点任意键跳过动作</span>';
    setInfo(opts.mode === 'demo' ? '先自己找路，到达<b>终点旗</b>就算赢。' : opts.mode === 'record' ? '先自己通关一次：<b>这次干净通关的操作会被录成影子</b>。死了从头录，最长 20 秒。' : (game.ghost ? '和' + game.ghostLabel + '的影子同时起跑，到达<b>终点旗</b>就算赢。' : '到达<b>终点旗</b>就算赢。'));
    show('sPlay'); updStat();
  }
  function setInfo(h) { $('info').innerHTML = h; }
  function updStat() { if (!game) return; $('pDeaths').textContent = '💀' + game.deaths; $('bigD').innerHTML = game.deaths ? '💀<b>×' + game.deaths + '</b>' : ''; $('pTime').textContent = '⏱' + ((game.mode === 'record' ? game.world.tick : game.tick) / 60).toFixed(1) + 's'; }
  function stepGame() {
    var g = game; if (!g || g.done) return;
    var inp = sampleInput(), w = g.world;
    if (g.dseq) stepDeath(g);
    else {
      g.rec.push(inp);
      var ev = w.step(inp);
      if (w.ev & 1) { SFX.jump(); g.squash = -6; } if (w.ev & 2) { SFX.land(); g.squash = 6; } if (w.ev & 32) { SFX.bounce(); g.squash = -8; } if (w.ev & 220) SFX.click();
      if (ev === 1) { g.deaths++; onDeath(g); }
      else if (ev === 2) { finish(); return; }
      else if (g.mode === 'record' && w.tick >= M.MAX_FRAMES) { toast('超过 20 秒，重来'); respawn(g); }
    }
    if (g.gworld && !g.gDone) { var gi = g.gworld.tick < g.ghost.length ? g.ghost[g.gworld.tick] : 0; if (g.gworld.step(gi) === 2) g.gDone = true; }
    if (g.shake > 0) g.shake--; if (g.squash > 0) g.squash--; else if (g.squash < 0) g.squash++; if (g.spawnT > 0) g.spawnT--;
    g.tick++;
  }
  function finish() {
    var g = game; g.done = true; clearInput(); SFX.win();
    if (g.mode === 'record') {
      var inputs = Uint8Array.from ? Uint8Array.from(g.rec) : new Uint8Array(g.rec), chk = M.simulate(g.map, inputs);
      if (chk.result !== 'win' || chk.frame !== inputs.length) { toast('回放校验失败，请重试', 1500); setTimeout(function () { startPlay({ map: g.map, mode: 'record', title: g.title }); }, 1200); return; }
      editor.rec = inputs; editor.recMap = M.packMap(g.map).join(','); editor.recDeaths = g.deathsAt.slice(); editor.recReveal = g.reveal;
      savePromoMap(g.map, g.reveal);
      toast('录制成功 ' + (inputs.length / 60).toFixed(2) + ' 秒', 1200); setTimeout(openExport, 900); return;
    }
    toast('通关！', 800); setTimeout(showResult, 700);
  }
  function fmt(t) { return (t / 60).toFixed(2) + ' 秒'; }

  // ---------------- result card (also the share / comment image) ----------------
  function drawCard(map, deathsAt, reveal, title, lines, foot) {
    var W = 720, H = 920, c = document.createElement('canvas'); c.width = W; c.height = H; var g = c.getContext('2d');
    g.fillStyle = '#fff6e6'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#5a3d22'; g.font = 'bold 36px -apple-system,"PingFang SC",sans-serif'; g.textBaseline = 'alphabetic'; g.fillText('我的关，我的影子', 28, 56);
    g.fillStyle = '#8a7358'; g.font = '26px -apple-system,"PingFang SC",sans-serif'; g.fillText(title || '', 28, 96);
    var sc = W / (COLS * T); g.save(); g.translate(0, 120); drawMap(g, map, sc, null, 'card', 0, reveal);
    for (var i = 0; i < deathsAt.length; i++) { var d = deathsAt[i]; ART.skull(g, d[0] * sc + ((i * 37) % 21 - 10), Math.min(d[1] * sc, 470) + ((i * 53) % 17 - 8), 20); }
    g.restore();
    var y0 = 120 + 480 + 30; ART3.bear(g, 22, y0 + 18, 72, 90, { anim: 'dead', f: 9 }); ART3.emote(g, 'swirl', 66, y0 + 40, 46);
    g.fillStyle = '#ff7a59'; g.font = '900 108px -apple-system,"PingFang SC",sans-serif'; g.fillText('× ' + deathsAt.length, 165, y0 + 100);
    g.fillStyle = '#5a3d22'; g.font = 'bold 34px -apple-system,"PingFang SC",sans-serif';
    for (i = 0; i < lines.length; i++) { g.fillStyle = i === 0 ? '#5a3d22' : '#2e8b12'; g.fillText(lines[i], 28, y0 + 170 + i * 48); }
    g.fillStyle = '#e8590c'; g.font = 'bold 30px -apple-system,"PingFang SC",sans-serif'; g.fillText(foot, 28, H - 30);
    try { return c.toDataURL('image/png'); } catch (e) { return ''; }
  }
  var NOTE = {
    TITLE: '造关坑人，留影子等人翻车',
    SLOGAN: '造关坑人，留影子等人翻车',
    HINT: '打开笔记里的小工具来玩',
    CONTENT: '自己出坑关，自己先通关，把影子留给下一个人追。\n\n打开这篇笔记里的小工具就能玩：先挑战示范关，或自己造一关。想让别人来跑你的关，请从挂着本工具的笔记里打开，再把关卡发到评论。\n\n#我的关我的影子'
  };
  function wrapText(g, text, x, y, maxW, lineH, maxLines) {
    var chars = String(text || '').split(''), line = '', lines = [], i, ch, trial;
    for (i = 0; i < chars.length; i++) {
      ch = chars[i];
      if (ch === '\n') { lines.push(line); line = ''; continue; }
      trial = line + ch;
      if (g.measureText(trial).width > maxW && line) { lines.push(line); line = ch; }
      else line = trial;
    }
    if (line) lines.push(line);
    if (maxLines && lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
      var last = lines[maxLines - 1];
      while (last.length && g.measureText(last + '…').width > maxW) last = last.slice(0, -1);
      lines[maxLines - 1] = last + '…';
    }
    for (i = 0; i < lines.length; i++) g.fillText(lines[i], x, y + i * lineH);
    return lines.length;
  }
  function drawShareNoteCard(opts) {
    opts = opts || {};
    var W = 1080, H = 1440, pad = 56, mapW = W - pad * 2, tile = mapW / COLS, mapH = tile * ROWS;
    var c = document.createElement('canvas'); c.width = W; c.height = H; var g = c.getContext('2d');
    var grd = g.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, '#bfe9ff'); grd.addColorStop(0.42, '#e8f7ff'); grd.addColorStop(1, '#fdf3dc');
    g.fillStyle = grd; g.fillRect(0, 0, W, H);
    g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    g.fillStyle = '#5a3d22'; g.font = 'bold 64px -apple-system,"PingFang SC","Hiragino Sans GB","Noto Sans CJK SC",sans-serif';
    g.fillText('我的关，我的影子', W / 2, 110);
    var y = 150, hasMap = !!(opts.map && opts.map.length);
    if (hasMap) {
      g.save();
      g.beginPath();
      if (g.roundRect) g.roundRect(pad, y, mapW, mapH, 24); else g.rect(pad, y, mapW, mapH);
      g.clip();
      g.translate(pad, y);
      drawMap(g, opts.map, tile / T, null, 'card', 0, opts.reveal || {});
      g.restore();
      g.strokeStyle = '#5a3d22'; g.lineWidth = 8;
      g.beginPath();
      if (g.roundRect) g.roundRect(pad, y, mapW, mapH, 24); else g.rect(pad, y, mapW, mapH);
      g.stroke();
      y = y + mapH + 36;
    } else {
      // decorative PA1 strip, not a playable level
      var i, ts = (W - pad * 2) / 12, groundY = 420;
      for (i = 0; i < 12; i++) ART3.tile(g, 'g', i === 0 ? 'L' : i === 11 ? 'R' : 'M', pad + i * ts, groundY, ts);
      ART3.spike(g, pad + ts * 3.1, groundY - ts * 0.7, ts * 0.85);
      ART3.goal(g, pad + ts * 8.8, groundY - ts * 1.15, ts * 1.2, 0);
      ART3.start(g, pad + ts * 0.15, groundY - ts * 0.55, ts * 0.9);
      ART3.bear(g, pad + ts * 1.6, groundY - 176, 140, 176, { anim: 'idle', f: 0 });
      ART3.bear(g, pad + ts * 6.2, groundY - 176, 140, 176, { anim: 'run', f: 3, alpha: 0.75, tint: 'rgba(150,170,255,0.55)' });
      ART3.emote(g, 'laugh', pad + ts * 3.4, groundY - 170, 70);
      y = groundY + ts + 90;
    }
    if (hasMap) {
      ART3.bear(g, 250, y, 140, 176, { anim: 'idle', f: 0 });
      ART3.bear(g, 690, y, 140, 176, { anim: 'run', f: 3, alpha: 0.75, tint: 'rgba(150,170,255,0.55)' });
      ART3.emote(g, 'laugh', 390, y + 20, 70);
      y += 250;
    }
    g.fillStyle = '#e8590c'; g.font = '900 56px -apple-system,"PingFang SC","Hiragino Sans GB","Noto Sans CJK SC",sans-serif';
    y += wrapText(g, opts.line || NOTE.SLOGAN, W / 2, y, mapW, 72, 3) * 72;
    g.fillStyle = '#7d6a55'; g.font = 'bold 36px -apple-system,"PingFang SC","Hiragino Sans GB","Noto Sans CJK SC",sans-serif';
    g.fillText(opts.hint || NOTE.HINT, W / 2, H - 64);
    try { return c.toDataURL('image/jpeg', 0.9); } catch (e) { return ''; }
  }
  function showResult() {
    var g = game, my = g.tick, gf = g.ghost ? g.ghost.length : 0, d = Math.abs(my - gf) / 60, vs = '';
    if (g.ghost) vs = my < gf ? '比' + g.ghostLabel + '快 ' + d.toFixed(1) + ' 秒' : (my > gf ? '比' + g.ghostLabel + '慢 ' + d.toFixed(1) + ' 秒' : '和' + g.ghostLabel + '一样快');
    $('rVs').textContent = vs; $('rVs').style.color = my < gf ? '#5ef0c0' : '#ffd6c9';
    $('rBig').textContent = g.deaths === 0 ? '一命通关！' : '死了 ' + g.deaths + ' 次，终于过了';
    $('rCard').src = drawCard(g.map, g.deathsAt, g.reveal, g.mode === 'demo' ? '示范关「' + g.title + '」' : g.title,
      ['用时 ' + fmt(my) + (g.ghost ? ' · ' + g.ghostLabel + ' ' + fmt(gf) : ''), vs], '看着很简单？点我来追影子');
    var skulls = ''; for (var i = 0; i < Math.min(g.deaths, 10); i++) skulls += '💀'; if (g.deaths > 10) skulls += '×' + g.deaths;
    var share = '《我的关，我的影子》' + (g.mode === 'demo' ? '示范关「' + g.title + '」' : '') + ' ' + (skulls || '✨') + '🏁 ' + fmt(my).replace(' ', '') + (vs ? '（' + vs + '）' : '');
    $('rShare').textContent = share; $('rShare').setAttribute('data-t', share);
    $('rNext').style.display = (g.mode === 'demo' && g.levelIdx < LEVELS.length - 1) ? '' : 'none'; $('rMsg').textContent = '';
    if (g.mode === 'demo') { var best = +store('best_rules_v11_layout_v17_' + g.levelIdx) || 0; if (!best || my < best) store('best_rules_v11_layout_v17_' + g.levelIdx, String(my)); }
    show('sResult');
  }

  // ---------------- loop: logic fixed 60 ticks/s, rendering free ----------------
  var acc = 0, last = 0, rt = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    if (!last) last = now; var dt = Math.min(100, now - last); last = now; rt++;
    if ($('sPlay').classList.contains('on')) {
      if (game && !editor.on && !window.__mlmgPause) { acc += dt; var n = 0; while (acc >= 1000 / 60 && n < 6) { stepGame(); acc -= 1000 / 60; n++; } if (n === 6) acc = 0; updStat(); }
      render();
    } else acc = 0;
  }
  function bearState(w, f) {
    var o = { flip: w.face < 0, f: f };
    if (!w.grounded) { if (w.vy < 0) { o.anim = 'up'; o.f = 0; } else { o.anim = 'fall'; o.f = 0; } }
    else if (Math.abs(w.vx) > 8) { o.anim = 'run'; o.f = (f / 3) | 0; o.runPhase = (w.face < 0 ? -w.x : w.x) / ART3.runStride(M.PH) * Math.PI * 2; } else { o.anim = 'idle'; o.f = (f / 7) | 0; }
    return o;
  }
  function heroOpts(w, g) {
    var o = bearState(w, rt), q = g ? g.squash : 0;
    if (!w.grounded) o.f = 0;
    if (q > 0) { o.sx = 1 + q * 0.035; o.sy = 1 - q * 0.035; } else if (q < 0) { o.sx = 1 + q * 0.025; o.sy = 1 - q * 0.03; }
    if (g && g.spawnT > 0) { var k = 1 - g.spawnT / 10; o.sx = (o.sx || 1) * k; o.sy = (o.sy || 1) * k; }
    return o;
  }
  var JUMPV0 = M.JUMPV;
  function hb(w) { return [w.x * scale, w.y * scale, M.PW * scale, M.PH * scale]; }
  function render() {
    var s = T * scale;
    if (editor.on) { ctx.setTransform(1, 0, 0, 1, 0, 0); drawMap(ctx, editor.map, scale, null, 'edit', rt); drawGridLines(); return; }
    var g = game; if (!g) return; var d = g.dseq;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (g.shake > 0) { var a = g.shake * s * 0.012; ctx.translate((Math.random() * 2 - 1) * a, (Math.random() * 2 - 1) * a); }
    if (d && d.phase === 'replay') { renderReplay(g, d); return; }
    applyCamera(g.world);
    drawMap(ctx, g.map, scale, g.world, 'play', rt);
    if (g.gworld && !g.gDone && (g.mode !== 'demo' || g.deaths >= 3)) { var gw = g.gworld, gb = hb(gw), go = bearState(gw, g.tick); go.alpha = 0.5; go.tint = 'rgba(150,170,255,0.55)'; ART3.bear(ctx, gb[0], gb[1], gb[2], gb[3], go); }
    var w = g.world, p = hb(w);
    if (!d) { ART3.bear(ctx, p[0], p[1], p[2], p[3], heroOpts(w, g)); if (w.vy > 150 && !w.grounded) ART3.emote(ctx, 'drops', p[0] + p[2] * 1.05, p[1] + s * 0.05, s * 0.5); }
    else if (d.phase === 'hit') { ctx.fillStyle = 'rgba(255,255,255,' + (d.t < 2 ? 0.55 : 0) + ')'; ctx.fillRect(0, 0, COLS * s, ROWS * s);
      var rp = [d.rag.x * scale, d.rag.y * scale]; ART3.bear(ctx, rp[0], rp[1], p[2], p[3], { anim: 'dizzy', f: 0, flip: w.face < 0, sx: d.squash ? 1.45 : 1.12, sy: d.squash ? 0.45 : 0.92 });
      ART3.emote(ctx, 'exclamation', rp[0] + p[2] * 0.5, rp[1] - s * 0.05, s * 0.55); }
    else if (d.phase === 'rag') {
      for (var k = 0; k < d.pieces.length; k++) { var pc = d.pieces[k]; ART3.particle(ctx, pc.x * scale, pc.y * scale, s * 0.3, pc.r); }
      var rx = d.rag.x * scale, ry = d.rag.y * scale;
      ART3.bear(ctx, rx, ry, p[2], p[3], { anim: 'dead', f: Math.min(9, d.t >> 1), rot: d.rag.rot, flip: w.face < 0 });
      ART3.emote(ctx, d.t % 16 < 8 ? 'swirl' : 'stars', rx + p[2] * 0.5, ry - s * 0.05, s * 0.55);
    }
    if (d) drawTaunt(g, d);
    else drawTension(g);
    drawReaction(g);
  }
  function drawTaunt(g, d) {
    if (!d.hasKiller || d.phase === 'hit') return; var s = T * scale, kx = d.kx * scale, ky = Math.min(d.ky * scale, ROWS * s - s * 0.5), t = d.phase === 'rag' ? d.t : RAG + d.t;
    var pop = Math.min(1, t / 6), wob = Math.sin(t * 0.6) * 0.12 * Math.max(0, 1 - t / 50), hop = -Math.abs(Math.sin(t * 0.35)) * s * 0.12;
    ctx.save(); ctx.translate(kx, ky + hop); ctx.rotate(wob); ctx.scale(0.7 + 0.3 * pop, 0.7 + 0.3 * pop);
    if (d.cause === 'collapse') { ART3.tile(ctx, 'b', 'M', -s / 2, -s / 2, s); ART3.face(ctx, 'h', 0, s * 0.12, s * 0.75); }
    else if (d.cause === 'block') { ART3.face(ctx, 'h', 0, s * 0.1, s * 0.75); }
    else { ART3.face(ctx, 'h', 0, s * 0.3, s * 0.6); }
    ctx.restore();
    ART3.emote(ctx, 'laugh', kx + s * 0.55, ky - s * 0.35 + hop, s * 0.6 * pop);
    ART.bubble(ctx, kx, ky - s * 0.95, d.taunt, Math.round(s * 0.4), COLS * s);
  }
  function drawTension(g) {
    var w = g.world, gi = -1; for (var i = 0; i < g.map.length; i++) if (g.map[i] === TL.GL) { gi = i; break; }
    var dx = (w.x + M.PW / 2 - ((gi % COLS) * T + T / 2)) / T, dy = (w.y + M.PH / 2 - (((gi / COLS) | 0) * T + T / 2)) / T, dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 3.5) return; var s = T * scale, W = COLS * s, H = ROWS * s;
    var beat = Math.pow(Math.max(0, Math.sin(g.tick * 0.22)), 6), a = (1 - dist / 3.5) * (0.12 + 0.28 * beat);
    var grd = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, W * 0.75); grd.addColorStop(0, 'rgba(255,40,70,0)'); grd.addColorStop(1, 'rgba(255,40,70,' + a.toFixed(3) + ')');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);
  }
  function renderReplay(g, d) {
    var n = d.frames.length, f = d.t, idx;
    if (n >= 72) idx = f < 20 ? f * 3 : Math.min(n - 1, 60 + (f - 20)); else idx = Math.min(n - 1, Math.round(f / (REPLAY - 1) * (n - 1)));
    var w = d.frames[idx], s = T * scale, saveG = goneAt, saveP = popAt; goneAt = {}; popAt = {};
    applyCamera(w);
    drawMap(ctx, g.map, scale, w, 'play', rt); goneAt = saveG; popAt = saveP;
    var p = hb(w), o = bearState(w, w.tick); if (idx >= n - 1) { o.anim = 'dizzy'; o.f = 2; } ART3.bear(ctx, p[0], p[1], p[2], p[3], o);
    ctx.fillStyle = 'rgba(40,60,120,0.25)'; ctx.fillRect(0, 0, COLS * s, ROWS * s);
    ctx.fillStyle = 'rgba(255,255,255,0.08)'; for (var y = (rt * 3) % 8; y < ROWS * s; y += 8 * dpr) ctx.fillRect(0, y, COLS * s, dpr);
    ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = s * 0.06; ctx.font = 'bold ' + Math.round(s * 0.36) + 'px sans-serif'; ctx.strokeText('◀◀ 回放：你是怎么死的', camX + s * 0.25, camY + s * 0.55); ctx.fillText('◀◀ 回放：你是怎么死的', camX + s * 0.25, camY + s * 0.55);
    ctx.fillStyle = '#ff5d73'; ctx.beginPath(); ctx.arc(camX + cv.width - s * 0.45, camY + s * 0.42, s * 0.12, 0, 7); if (rt % 30 < 18) ctx.fill();
    drawTaunt(g, d);
  }
  function drawGridLines() { var s = T * scale; ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1;
    for (var c = 0; c <= COLS; c++) { ctx.beginPath(); ctx.moveTo(c * s, 0); ctx.lineTo(c * s, ROWS * s); ctx.stroke(); }
    for (var r = 0; r <= ROWS; r++) { ctx.beginPath(); ctx.moveTo(0, r * s); ctx.lineTo(COLS * s, r * s); ctx.stroke(); }
    if (editor.moving && editor.hover >= 0) {
      var hc = editor.hover % COLS, hr = (editor.hover / COLS) | 0;
      ctx.strokeStyle = '#ff8c1a'; ctx.lineWidth = 3; ctx.strokeRect(hc * s + 2, hr * s + 2, s - 4, s - 4);
    }
  }

  // ---------------- editor ----------------
  var PAL = [[TL.GND, '地面'], [TL.E, '擦除'], [TL.SPK, '尖刺'], [TL.HID, '隐刺'], [TL.FALL, '砸块'], [TL.TRM, '弹跳']];
  var TEMPLATES = (typeof MLMG_TEMPLATES !== 'undefined') ? MLMG_TEMPLATES : [];
  var editor = { on: false, map: null, sel: TL.GND, rec: null, recMap: null, recDeaths: [], recReveal: {}, painting: false, lastCell: -1, tpl: 'two', undo: null, holdTimer: 0, moving: 0, holdFrom: -1, hover: -1 };
  function rowsToMap(rows) { return M.parseRows(rows); }
  function templateById(id) { for (var i = 0; i < TEMPLATES.length; i++) if (TEMPLATES[i].id === id) return TEMPLATES[i]; return TEMPLATES[1] || TEMPLATES[0]; }
  function defaultMap() { var t = templateById(editor.tpl || 'two'); return rowsToMap(t.rows); }
  function loadEditorMap() {
    var s = store('editor_v4');
    if (s) {
      var a = s.split(',').map(Number);
      if (a.length === COLS * ROWS && a.every(function (v) { return v >= 0 && v <= 10 && (v | 0) === v; })) return new Uint8Array(a);
    }
    return defaultMap();
  }
  function saveEditorMap() { store('editor_v4', Array.prototype.join.call(editor.map, ',')); store('editor_tpl', editor.tpl || 'two'); }
  function pushUndo() { editor.undo = new Uint8Array(editor.map); }
  function applyTemplate(id, force) {
    var t = templateById(id); if (!t) return;
    if (!force && editor.map && trapCount(editor.map) > 0) {
      if (!window.confirm('已经放了机关，要换成「' + t.name + '」开局吗？')) return;
    }
    pushUndo();
    editor.tpl = t.id; editor.map = rowsToMap(t.rows); editor.rec = null; saveEditorMap(); buildTemplates(); editMsg();
  }
  function buildTemplates() {
    var box = $('tpl'); if (!box) return; box.innerHTML = '';
    TEMPLATES.forEach(function (t) {
      var b = document.createElement('button'); b.type = 'button'; b.textContent = t.name;
      if (t.id === editor.tpl) b.classList.add('sel');
      b.addEventListener('click', function () { applyTemplate(t.id, false); });
      box.appendChild(b);
    });
  }
  function buildPalette() {
    var pal = $('pal'); pal.innerHTML = '';
    PAL.forEach(function (p) {
      var b = document.createElement('button'), c = document.createElement('canvas'); c.width = 72; c.height = 72; var g = c.getContext('2d');
      g.fillStyle = '#bfe9ff'; g.fillRect(0, 0, 72, 72);
      if (p[0] === TL.GND) ART3.tile(g, 'g', 'M', 8, 8, 56);
      else if (p[0] === TL.SPK) ART3.spike(g, 8, 8, 56);
      else if (p[0] === TL.HID) { ART3.spike(g, 8, 8, 56, 0.4); ART3.emote(g, 'question', 36, 42, 30); }
      else if (p[0] === TL.FALL) { ART3.block(g, 8, 8, 56); ART3.face(g, 'f', 36, 44, 32); }
      else if (p[0] === TL.TRM) ART3.tramp(g, 8, 8, 56, 0, false);
      else { g.strokeStyle = '#888'; g.lineWidth = 4; g.beginPath(); g.moveTo(18, 18); g.lineTo(54, 54); g.moveTo(54, 18); g.lineTo(18, 54); g.stroke(); }
      b.type = 'button'; b.appendChild(c); b.appendChild(document.createTextNode(p[1])); if (p[0] === editor.sel) b.classList.add('sel');
      b.addEventListener('click', function () { editor.sel = p[0]; var all = pal.querySelectorAll('button'); for (var i = 0; i < all.length; i++) all[i].classList.remove('sel'); b.classList.add('sel'); });
      pal.appendChild(b);
    });
  }
  function trapCount(m) { var n = 0; for (var i = 0; i < m.length; i++) if (M.isTrap(m[i])) n++; return n; }
  function editMsg(extra) {
    var e = M.checkMap(editor.map), n = trapCount(editor.map), recOk = editor.rec && editor.recMap === M.packMap(editor.map).join(',');
    $('editMsg').innerHTML = '恶搞机关 <b>' + n + '/' + M.MAX_TRAPS + '</b>（弹跳不算） · ' + (e ? '<span style="color:#ff8a8a">' + e + '</span>' : (recOk ? '<span style="color:#5ef0c0">已录好影子 ' + (editor.rec.length / 60).toFixed(2) + ' 秒</span>' : '可以试玩了')) + (extra ? ' · ' + extra : '');
    $('eExport').disabled = !recOk; $('eTest').disabled = !!e;
    if ($('eUndo')) $('eUndo').disabled = !editor.undo;
  }
  function openEditor() {
    game = null; editor.on = true;
    if (!editor.tpl) editor.tpl = store('editor_tpl') || 'two';
    if (!editor.map) editor.map = loadEditorMap();
    $('pTitle').textContent = '出一关'; $('pDeaths').textContent = ''; $('bigD').innerHTML = ''; $('pTime').textContent = ''; $('legend').innerHTML = '';
    setInfo('选开局，点格子改路。起点终点点不掉，长按再拖到空格。机关最多 3 个。<b>必须自己通关一次</b>才能导出。');
    $('edit').classList.add('on'); $('sPlay').classList.add('editing'); $('pad').style.display = 'none'; buildTemplates(); buildPalette(); show('sPlay'); editMsg();
  }
  function cellFromEvent(e) {
    var t = (e && e.changedTouches && e.changedTouches[0]) || (e && e.touches && e.touches[0]) || e;
    if (!t || t.clientX === undefined) return -1;
    var r = cv.getBoundingClientRect(), x = (t.clientX - r.left) / r.width * COLS, y = (t.clientY - r.top) / r.height * ROWS;
    if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return -1; return (y | 0) * COLS + (x | 0);
  }
  function clearHold() { if (editor.holdTimer) { clearTimeout(editor.holdTimer); editor.holdTimer = 0; } }
  function dropStartGoal(i) {
    var typ = editor.moving, from = editor.holdFrom, m = editor.map;
    editor.moving = 0; editor.hover = -1;
    if (i < 0 || from < 0) return;
    if (i === from) return;
    var dest = m[i];
    if (dest === typ) return;
    if (dest === TL.ST || dest === TL.GL) { pushUndo(); m[from] = dest; m[i] = typ; saveEditorMap(); editMsg(); return; }
    if (dest === TL.E) { pushUndo(); m[from] = TL.E; m[i] = typ; saveEditorMap(); editMsg(); return; }
    toast('放到空格子上，或与起点/终点互换');
  }
  function paint(i, first) {
    if (i < 0 || (!first && i === editor.lastCell)) return;
    editor.lastCell = i; var m = editor.map, sel = editor.sel;
    if (m[i] === TL.ST || m[i] === TL.GL) return; // 普通点按不能抹掉起点/终点
    if (!first && M.isTrap(sel)) return;
    if (M.isTrap(sel) && !M.isTrap(m[i]) && trapCount(m) >= M.MAX_TRAPS) { editMsg('<span style="color:#ff8a8a">机关已满 3 个</span>'); toast('机关最多 3 个'); return; }
    if (first && m[i] === sel && sel !== TL.E) sel = TL.E;
    if (first) pushUndo();
    m[i] = sel; saveEditorMap(); editMsg();
  }
  function cvDown(e) {
    if (game && game.dseq) { anyPress(); return; }
    if (!editor.on) return;
    e.preventDefault();
    var i = cellFromEvent(e);
    if (editor.moving) { dropStartGoal(i); return; }
    if (i >= 0 && (editor.map[i] === TL.ST || editor.map[i] === TL.GL)) {
      editor.painting = false; editor.holdFrom = i; editor.hover = i;
      clearHold();
      editor.holdTimer = setTimeout(function () {
        editor.moving = editor.map[editor.holdFrom];
        toast('松手放到空格子，移动起点或终点');
      }, 400);
      return;
    }
    editor.painting = true; editor.lastCell = -1; paint(i, true);
  }
  function edMove(e) {
    if (!editor.on) return;
    var i = cellFromEvent(e);
    if (editor.moving || editor.holdTimer) { editor.hover = i; e.preventDefault(); return; }
    if (!editor.painting) return;
    e.preventDefault(); paint(i, false);
  }
  function edUp(e) {
    var i = e ? cellFromEvent(e) : editor.hover;
    if (i < 0) i = editor.hover;
    if (editor.moving) dropStartGoal(i);
    clearHold();
    editor.painting = false;
    editor.hover = -1;
  }
  cv.addEventListener('touchstart', cvDown, { passive: false }); cv.addEventListener('touchmove', edMove, { passive: false }); cv.addEventListener('touchend', edUp);
  cv.addEventListener('mousedown', cvDown); cv.addEventListener('mousemove', edMove); window.addEventListener('mouseup', edUp);
  $('eClear').onclick = function () { pushUndo(); editor.map = defaultMap(); editor.rec = null; saveEditorMap(); editMsg(); };
  if ($('eUndo')) $('eUndo').onclick = function () {
    if (!editor.undo) return;
    var cur = new Uint8Array(editor.map); editor.map = editor.undo; editor.undo = cur; editor.rec = null; saveEditorMap(); editMsg();
  };
  $('eBack').onclick = function () { editor.on = false; $('sPlay').classList.remove('editing'); show('sMenu'); };
  $('eTest').onclick = function () { if (M.checkMap(editor.map)) return; editor.on = false; startPlay({ map: new Uint8Array(editor.map), mode: 'record', title: '录制影子' }); };
  $('eExport').onclick = function () { editor.on = false; openExport(); };

  // ---------------- export ----------------
  var exportJson = '';
  function openExport() {
    var map = editor.map, rec = editor.rec; exportJson = M.encodeSnapshot(map, rec);
    var bytes = M.utf8len(exportJson), ev = M.inputsToEvents(rec).length;
    $('xJson').value = exportJson; $('xBytes').textContent = bytes + ' / ' + M.SNAP_LIMIT + ' 字节';
    $('xBar').style.width = Math.min(100, bytes / M.SNAP_LIMIT * 100) + '%'; $('xBar').style.background = bytes > M.SNAP_LIMIT ? '#ff5d73' : '#5ef0c0';
    $('xMeta').textContent = '快照 v' + M.VERSION + ' · 地图 48 字节(4bit×96格) · 影子 ' + ev + ' 次按键变化 · ' + rec.length + ' 帧(' + (rec.length / 60).toFixed(2) + '秒)';
    var dd = editor.recDeaths || [];
    $('prevImg').src = drawCard(map, dd, editor.recReveal || {}, '作者出的坑关', ['作者用时 ' + fmt(rec.length) + (dd.length ? ' · 出关时自己死了 ' + dd.length + ' 次' : '')], '看着很简单？点我来追我的影子');
    $('xLinkTxt').style.display = 'none'; $('xMsg').textContent = ''; show('sExport');
  }
  function savePromoMap(map, reveal) {
    try {
      var packed = M.b64enc(M.packMap(map)), rev = [], i;
      if (reveal) { for (i in reveal) { if (reveal[i]) rev.push(+i); } }
      store('promo_map', JSON.stringify({ m: packed, r: rev }));
    } catch (e) {}
  }
  function loadPromoMap() {
    try {
      var raw = store('promo_map'); if (!raw) return null;
      var o = JSON.parse(raw); if (!o || !o.m) return null;
      var map = M.unpackMap(M.b64dec(o.m)), reveal = {}, i;
      for (i = 0; i < (o.r || []).length; i++) reveal[o.r[i]] = true;
      return { map: map, reveal: reveal };
    } catch (e) { return null; }
  }
  var PENDING_KEY = 'mlmg_pending_share_v1', pendingShare = null, postingPending = false;
  function updatePendingShare() {
    $('pendingShare').style.display = pendingShare ? '' : 'none';
    $('pendingTitle').textContent = pendingShare ? pendingShare.title : '';
  }
  function validPending(data) {
    if (!data || data.v !== 1 || typeof data.title !== 'string') return null;
    try { M.decodeSnapshot(data.snapshot); return data; } catch (e) { return null; }
  }
  function restorePendingShare() {
    if (!window.XHS) return;
    XHS.getLocalData(PENDING_KEY).then(function (data) {
      pendingShare = validPending(data); updatePendingShare();
    }).catch(function () { /* 保持首页可用 */ });
  }
  function postPendingShare() {
    if (!pendingShare || postingPending) return;
    var el = $('pendingMsg'), saved = pendingShare;
    if (!window.XHS || !XHS.canComment()) { setNoteMsg(el, false, '请从要发评论的笔记进入小工具，客户端需 9.49+'); return; }
    if (!window.confirm('请确认你已从目标笔记打开小工具。将把「' + saved.title + '」发到当前笔记的评论区，是否继续？')) return;
    postingPending = true; $('pendingPost').disabled = true; $('pendingClear').disabled = true;
    Promise.resolve().then(function () {
      var d = M.decodeSnapshot(saved.snapshot);
      var image = drawCard(d.map, [], {}, saved.title, ['影子用时 ' + fmt(d.inputs.length)], '点评论关卡卡片，挑战同一关');
      return XHS.postComment({ content: '来挑战这一关，追上我的影子！', snapshot: saved.snapshot, dataUrl: image, saveToAlbum: false });
    }).then(function (r) {
      setNoteMsg(el, !!(r && r.routed), r && r.routed ? '已打开评论框，请确认发送。待分享关卡继续保留，发完后可手动清除。' : '未能打开评论框，关卡仍已保留，请重试。');
    }).catch(function (err) {
      setNoteMsg(el, false, '打开评论失败：' + formatXhsError(err));
    }).then(function () { postingPending = false; $('pendingPost').disabled = false; $('pendingClear').disabled = false; });
  }
  $('pendingPost').onclick = postPendingShare;
  $('pendingClear').onclick = function () {
    if (!pendingShare || postingPending) return;
    if (!window.confirm('清除这条待分享记录？不会删除已经发布的笔记或评论。')) return;
    $('pendingClear').disabled = true;
    XHS.setLocalData(PENDING_KEY, null).then(function (ok) {
      $('pendingClear').disabled = false;
      if (!ok) { setNoteMsg($('pendingMsg'), false, '清除未成功，请重试'); return; }
      pendingShare = null; updatePendingShare();
    });
  };
  var postingNote = false;
  function setNoteMsg(el, ok, text) {
    if (el) { el.className = ok ? 'ok' : 'err'; el.textContent = text; }
    appToast(text, ok ? 2200 : 2800);
  }
  function setNoteBusy(busy) {
    postingNote = busy;
    ['mNote', 'rNote', 'xNote'].forEach(function (id) { var b = $(id); if (b) b.disabled = busy; });
  }
  // 首页分享游戏，结算页分享本次成绩；postNote 不携带关卡快照。
  function publishNote(source) {
    if (postingNote) return;
    var result = source === 'result', exporting = source === 'export', el = $(result ? 'rMsg' : exporting ? 'xMsg' : 'mMsg');
    if (!window.XHS || typeof XHS.canPostNote !== 'function' || !XHS.canPostNote()) {
      setNoteMsg(el, false, '请在小红书 App 里打开小工具');
      return;
    }
    setNoteBusy(true);
    setNoteMsg(el, true, '正在生成分享图…');
    var dataUrl = '', title = NOTE.TITLE, content = NOTE.CONTENT, draft = null;
    try {
      if (exporting) {
        dataUrl = $('prevImg').src;
        title = '我造了一关，来追我的影子';
        content = '自己造关，自己先通关！我会把关卡卡片发到本篇评论，点评论卡片就能挑战同一关。\n\n#我的关我的影子';
        draft = { v: 1, title: '我创造的关卡', snapshot: exportJson };
      } else if (result) {
        dataUrl = $('rCard').src;
        if (dataUrl.indexOf('data:image/') !== 0) dataUrl = '';
        title = '我的关，我的影子｜通关成绩';
        content = $('rShare').getAttribute('data-t') + '\n\n我会把这一关的关卡卡片发到本篇评论，点评论卡片就能挑战同一关！\n\n#我的关我的影子';
        draft = { v: 1, title: game.mode === 'demo' ? '示范关「' + game.title + '」' : game.title, snapshot: M.encodeSnapshot(game.map, game.rec) };
      } else {
        var promo = loadPromoMap();
        dataUrl = drawShareNoteCard({ map: promo && promo.map, reveal: promo && promo.reveal, line: NOTE.SLOGAN, hint: NOTE.HINT });
      }
    }
    catch (e) { dataUrl = ''; }
    if (!dataUrl) { setNoteBusy(false); setNoteMsg(el, false, '分享图生成失败'); return; }
    Promise.resolve().then(function () {
      if (!draft) return true;
      if (!validPending(draft)) throw new Error('关卡回放校验失败，无法保存待分享关卡');
      return XHS.setLocalData(PENDING_KEY, draft).then(function (ok) {
        if (!ok) throw new Error('关卡保存失败，请重试后再发布笔记');
        pendingShare = draft; updatePendingShare();
      });
    }).then(function () {
      return XHS.postNote({ title: title, content: content, dataUrl: dataUrl, pageType: 'photo_publish' });
    }).then(function () {
      setNoteBusy(false);
      setNoteMsg(el, true, draft ? '关卡已保存。发布笔记后，从新笔记重新打开小工具，在首页把关卡发到评论。' : '已打开发布笔记页。唤起成功不代表笔记已过审。');
    }).catch(function (err) {
      setNoteBusy(false);
      setNoteMsg(el, false, '发布失败：' + formatXhsError(err));
    });
  }
  function postLevelComment() {
    var snapshot = exportJson, el = $('xMsg');
    var dataUrl = ($('prevImg') && $('prevImg').src && $('prevImg').src.indexOf('data:') === 0) ? $('prevImg').src : '';
    if (!window.XHS || !XHS.canComment()) { setNoteMsg(el, false, '当前不在小红书小工具环境，或客户端低于 9.49'); return; }
    if (!snapshot) { setNoteMsg(el, false, '还没有可发送的关卡快照'); return; }
    setNoteMsg(el, true, '正在准备评论图片…');
    XHS.postComment({ content: '看着很简单？来追我的影子', snapshot: snapshot, dataUrl: dataUrl, saveToAlbum: false }).then(function (r) {
      setNoteMsg(el, true, '已唤起评论框（routed 不代表已发布）：' + JSON.stringify(r));
    }).catch(function (err) {
      setNoteMsg(el, false, '唤起失败：' + formatXhsError(err));
    });
  }
  function copyText(txt, okEl) {
    var boxes = document.querySelectorAll('textarea, #rShare');
    var i, el, shown = false;
    for (i = 0; i < boxes.length; i++) {
      el = boxes[i];
      if (el.tagName === 'TEXTAREA' && el.value === txt && el.offsetParent !== null) { try { el.focus(); el.select(); } catch (e) {} shown = true; break; }
      if (el.id === 'rShare' && el.getAttribute('data-t') === txt && el.offsetParent !== null) {
        try { var range = document.createRange(); range.selectNodeContents(el); var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range); } catch (e2) {}
        shown = true; break;
      }
    }
    okEl.className = 'ok';
    okEl.textContent = '容器不能自动写入剪贴板。请长按上方文字，选择「复制」。';
  }
  $('xCopy').onclick = function () { copyText(exportJson, $('xMsg')); };
  $('xLink').onclick = function () { var link = location.href.split('#')[0] + '#s=' + M.hashEncode(exportJson); var t = $('xLinkTxt'); t.value = link; t.style.display = 'block'; copyText(link, $('xMsg'));
    if (location.protocol === 'file:') $('xMsg').textContent += '（本地文件打开的链接只在本机有效，放到网上才能分享）'; };
  $('xSelf').onclick = function () { startChallenge(exportJson, '自己'); };
  $('xBack').onclick = function () { openEditor(); };
  // 在线文档 3.9：评论媒体须是 writeTempFile 句柄；routed 不代表已发布。需从挂着本工具的笔记里打开。
  $('xXhs').onclick = function () { postLevelComment(); };
  // 在线文档 3.3 / 3.5：postNote 携带图文，不携带关卡快照。
  $('xNote').onclick = function () { publishNote('export'); };
  if ($('mNote')) $('mNote').onclick = function () { publishNote(); };

  // ---------------- import / challenge ----------------
  function startChallenge(json, who) {
    var d; try { d = M.decodeSnapshot(json); } catch (e) { $('iMsg').textContent = '加载失败：' + e.message; show('sImport'); return false; }
    startPlay({ map: d.map, mode: 'challenge', title: who === '自己' ? '挑战自己的影子' : '挑战作者', ghost: d.inputs, ghostLabel: who || '作者', snapshot: json }); return true;
  }
  $('iGo').onclick = function () { $('iMsg').textContent = ''; var v = $('iJson').value.trim(); if (!v) { $('iMsg').textContent = '先粘贴快照'; return; } startChallenge(v, '作者'); };
  $('iBack').onclick = function () { show('sMenu'); };
  function launchDebug() {
    if (!window.XHS) { if ($('iDbg')) $('iDbg').textContent = '平台模块未加载'; if ($('dbgOut')) $('dbgOut').textContent = '平台模块未加载'; return; }
    XHS.collectDebug(function (text, found, opt, info) {
      if ($('iDbg')) $('iDbg').textContent = text;
      if ($('dbgOut')) $('dbgOut').textContent = text;
      if (info) XHS.applyWindowInfo(info);
    });
  }

  // ---------------- menu / levels / result ----------------
  $('mDemo').onclick = function () { buildLevels(); show('sLevels'); };
  $('mEdit').onclick = function () { openEditor(); };
  $('mImport').onclick = function () { $('iMsg').textContent = ''; launchDebug(); show('sImport'); };
  $('lvBack').onclick = function () { show('sMenu'); };
  $('pBack').onclick = function () { var g = game; game = null; clearInput();
    if (editor.on) { editor.on = false; show('sMenu'); } else if (g && g.mode === 'record') openEditor(); else if (g && g.mode === 'demo') { buildLevels(); show('sLevels'); } else show('sMenu'); };
  function playDemo(i) { var gh = DEMO_GHOSTS[i] ? M.decodeSnapshot(DEMO_GHOSTS[i]) : null;
    startPlay({ map: M.parseRows(LEVELS[i].rows), mode: 'demo', title: 'v17协调跑姿 · ' + LEVELS[i].name, ghost: gh ? gh.inputs : null, ghostLabel: 'AI示范', levelIdx: i, hint: LEVELS[i].hint }); }
  function buildLevels() { var list = $('lvlList'); list.innerHTML = '';
    LEVELS.forEach(function (l, i) { var b = document.createElement('button'), best = +store('best_rules_v11_layout_v17_' + i) || 0;
      b.innerHTML = '<span>' + (i + 1) + '. ' + l.name + '</span><span class="small">' + (best ? '最好 ' + (best / 60).toFixed(2) + 's' : '未通关') + '</span>';
      b.onclick = function () { playDemo(i); }; list.appendChild(b); }); }
  $('rAgain').onclick = function () { var g = game; if (!g) return show('sMenu'); if (g.mode === 'demo') playDemo(g.levelIdx); else startChallenge(g.snapshot, g.ghostLabel); };
  $('rNext').onclick = function () { if (game && game.mode === 'demo') playDemo(game.levelIdx + 1); };
  $('rMake').onclick = function () { editor.map = defaultMap(); editor.rec = null; openEditor(); };
  $('rMenu').onclick = function () { game = null; show('sMenu'); };
  $('rNote').onclick = function () { publishNote('result'); };

  function drawLogo() { var g = $('logo').getContext('2d'); g.clearRect(0, 0, 240, 120); for (var i = 0; i < 8; i++) ART3.tile(g, 'g', i === 0 ? 'L' : i === 7 ? 'R' : 'M', i * 30, 90, 30);
    ART3.bear(g, 118, 44, 36, 46, { anim: 'run', f: 4, alpha: 0.5, tint: 'rgba(150,170,255,0.55)' }); ART3.bear(g, 66, 40, 36, 50, { anim: 'dead', f: 3, rot: -0.3 }); ART3.emote(g, 'swirl', 84, 40, 26); ART3.goal(g, 190, 52, 40, 0); ART3.spike(g, 152, 60, 30); }

  window.__mlmg = { M: M, startChallenge: startChallenge, playDemo: playDemo, openEditor: openEditor, openExport: openExport, showResult: showResult, editor: editor, applyTemplate: applyTemplate, drawShareNoteCard: drawShareNoteCard, publishNote: publishNote, NOTE: NOTE, get game() { return game; }, stepGame: stepGame, render: render, held: held, skipDeath: skipDeath };
  if (window.XHS && XHS.detectFlexGap) XHS.detectFlexGap();
  resize(); ART3.ready(function () { drawLogo(); requestAnimationFrame(frame); });
  function tryStartFromText(raw, source) {
    if (!raw) return false;
    try {
      var json = raw;
      if (typeof raw === 'string' && raw.charAt(0) !== '{') json = M.hashDecode(raw);
      startChallenge(json, '作者');
      return true;
    } catch (e) { if ($('iMsg')) $('iMsg').textContent = (source || '启动参数') + '里的关卡打不开：' + e.message; return false; }
  }
  restorePendingShare();
  launchDebug();
  var started = false, h = location.hash, q = (window.XHS && XHS.collectSearch) ? XHS.collectSearch() : {};
  if (h.indexOf('#s=') === 0) started = tryStartFromText(h.slice(3), '链接 hash');
  if (!started && q.s) started = tryStartFromText(q.s, 'URL query');
  if (window.XHS) XHS.collectDebug(function (text, found) {
    if ($('dbgOut')) $('dbgOut').textContent = text;
    if ($('iDbg')) $('iDbg').textContent = text;
    if (!started) {
      var snap = XHS.firstSnapshot(found);
      if (snap) tryStartFromText(snap, '启动参数快照字段');
    }
  });
  if ($('dbgRefresh')) $('dbgRefresh').addEventListener('click', function () { launchDebug(); });
})();
