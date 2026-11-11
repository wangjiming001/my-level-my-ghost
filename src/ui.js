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
    win: function () { [523, 659, 784, 1046].forEach(function (f, i) { tone(f, f, 0.14, 'square', 0.05, i * 0.08); }); }
  };
  document.addEventListener('touchstart', function () { if (!muted) ac(); }, { passive: true });
  document.addEventListener('mousedown', function () { if (!muted) ac(); });
  function setMute(m) { muted = m; store('mute', m ? '1' : '0'); $('pMute').textContent = m ? '🔇' : '🔊'; }
  $('pMute').onclick = function () { setMute(!muted); if (!muted) SFX.click(); }; setMute(muted);

  // ---------------- canvas ----------------
  var cv = $('cv'), ctx = cv.getContext('2d'), cssW = 360, scale = 1, dpr = 1;
  function resize() {
    var wrap = $('stageWrap'); cssW = Math.max(200, wrap.clientWidth - 12); dpr = Math.min(window.devicePixelRatio || 1, 3);
    var cssH = Math.round(cssW * ROWS / COLS); cv.style.height = cssH + 'px'; cv.width = Math.round(cssW * dpr); cv.height = Math.round(cssH * dpr); scale = cv.width / (COLS * T);
  }
  window.addEventListener('resize', resize);
  var goneAt = {}, popAt = {};
  function blockCell(map, k) { var n = 0; for (var i = 0; i < map.length; i++) if (map[i] === TL.FALL) { if (n === k) return i; n++; } return -1; }
  // view: 'play' (traps disguised) | 'edit' (traps marked) | 'card' (disguised except reveal{cell:true})
  function drawMap(g, map, sc, world, view, t, reveal) {
    var s = T * sc, i, c, r, x, y, tt;
    ART.bg(g, COLS * s, ROWS * s, s, COLS, ROWS);
    for (i = 0; i < map.length; i++) {
      tt = map[i]; c = i % COLS; r = (i / COLS) | 0; x = c * s; y = r * s;
      var rv = reveal && reveal[i];
      if (tt === TL.GND) ART.ground(g, x, y, s);
      else if (tt === TL.SPK) ART.spike(g, x, y, s);
      else if (tt === TL.ST) { ART.start(g, x, y, s); if (view === 'edit') { g.globalAlpha = 0.45; ART.hero(g, x + s * 0.19, y + s * 0.22, s * 0.62, s * 0.78, {}); g.globalAlpha = 1; } }
      else if (tt === TL.GL) ART.goal(g, x, y, s, t);
      else if (tt === TL.COL) {
        var st = world ? world.collapse[i] : 0;
        if (st === -1) { var gt = goneAt[i] === undefined ? (goneAt[i] = t) : goneAt[i], dt = t - gt; if (dt < 40) ART.ground(g, x, y + dt * dt * s * 0.004, s, 1 - dt / 40); }
        else { var sh = st > 0 ? Math.sin(t * 2.3) * s * 0.05 : 0; ART.ground(g, x + sh, y, s); if (view === 'edit' || rv) ART.crack(g, x, y, s); }
      } else if (tt === TL.HID) {
        if (world && world.hidden[i]) { var pt = popAt[i] === undefined ? (popAt[i] = t) : popAt[i], k = Math.min(1, (t - pt) / 4); g.save(); g.translate(0, (1 - k) * s * 0.6); ART.spike(g, x, y, s); g.restore(); }
        else if (rv) ART.spike(g, x, y, s); else if (view === 'edit') ART.spike(g, x, y, s, '#ff9fae', true);
      }
    }
    if (world) for (var b = 0; b < world.blocks.length; b++) { var bl = world.blocks[b]; if (bl.st !== 3) ART.ground(g, bl.c * s, bl.y * sc, s); }
    else for (i = 0; i < map.length; i++) if (map[i] === TL.FALL) { c = i % COLS; r = (i / COLS) | 0; ART.ground(g, c * s, r * s, s); if (view === 'edit' || (reveal && reveal[i])) ART.arrow(g, c * s, r * s, s); }
  }

  // ---------------- input ----------------
  var held = { L: false, R: false, J: false }, jLatch = 0;
  function anyPress() { if (game && game.dseq && game.dseq.phase !== 'hit') skipDeath(); }
  function bindBtn(id, key) {
    var el = $(id);
    function down(e) { e.preventDefault(); if (!held[key] && key === 'J') jLatch = 2; held[key] = true; el.classList.add('down'); anyPress(); }
    function up(e) { e.preventDefault(); held[key] = false; el.classList.remove('down'); }
    el.addEventListener('touchstart', down, { passive: false }); el.addEventListener('touchend', up, { passive: false }); el.addEventListener('touchcancel', up, { passive: false });
    el.addEventListener('mousedown', down); el.addEventListener('mouseup', up); el.addEventListener('mouseleave', function (e) { if (held[key]) up(e); });
  }
  bindBtn('bL', 'L'); bindBtn('bR', 'R'); bindBtn('bJ', 'J');
  var KEYS = { ArrowLeft: 'L', a: 'L', A: 'L', ArrowRight: 'R', d: 'R', D: 'R', ' ': 'J', ArrowUp: 'J', w: 'J', W: 'J' };
  document.addEventListener('keydown', function (e) { var k = KEYS[e.key]; if (k && game) { e.preventDefault(); if (e.repeat) return; if (k === 'J' && !held.J) jLatch = 2; held[k] = true; $('b' + k).classList.add('down'); anyPress(); } });
  document.addEventListener('keyup', function (e) { var k = KEYS[e.key]; if (k) { held[k] = false; $('b' + k).classList.remove('down'); } });
  function sampleInput() { var s = (held.L ? M.IN.L : 0) | (held.R ? M.IN.R : 0) | ((held.J || jLatch > 0) ? M.IN.J : 0); if (jLatch > 0) jLatch--; return s; }
  function clearInput() { held.L = held.R = held.J = false; jLatch = 0; ['bL', 'bR', 'bJ'].forEach(function (b) { $(b).classList.remove('down'); }); }

  var toastTimer = 0;
  function toast(msg, ms) { var t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('on'); }, ms || 900); }

  // ---------------- death comedy (render-only; physics world is frozen while it plays) ----------------
  var TAUNT = {
    collapse: ['地板：拜拜～', '我只是看起来很结实', '踩我？想多了', '落地就塌，惊不惊喜'],
    hidden: ['惊喜吗？', '我一直都在哦', '平地？骗你的', '就等你来'],
    block: ['你以为过去了？', '抬头看看嘛', '砸中了！', '我等你好久了'],
    spike: ['我这么明显…', '看到了还撞？', '扎心了吧'],
    fall: ['下面没有路哦', '自由落体～']
  };
  var HIT = 9, RAG = 30, REPLAY = 32;
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
    g.shake = 14; SFX.death(); if (navigator.vibrate) try { navigator.vibrate([30, 40, 60]); } catch (e) {}
    updStat(); var dc = $('pDeaths'), bd = $('bigD'); dc.classList.remove('bump'); bd.classList.remove('bump'); void dc.offsetWidth; dc.classList.add('bump'); bd.classList.add('bump');
    if (g.deaths === 3) setInfo('提示：' + g.hint);
  }
  function stepDeath(g) {
    var d = g.dseq; d.t++;
    if (d.phase === 'hit') { if (d.t >= HIT) { d.phase = 'rag'; d.t = 0; if (d.hasKiller) SFX.taunt();
        if (d.cause === 'spike' || d.cause === 'hidden' || d.cause === 'block') for (var i = 0; i < 6; i++) d.pieces.push({ x: d.rag.x + (i % 3) * 200, y: d.rag.y + ((i / 3) | 0) * 300, vx: (i % 3 - 1) * 30 + (i * 7 % 11) - 5, vy: -90 - (i * 13 % 50), r: 0, vr: (i % 2 ? 0.3 : -0.3) }); } return; }
    if (d.phase === 'rag') { var r = d.rag; r.x += r.vx; r.y += r.vy; r.vy += 9; r.rot += r.vr;
      for (var k = 0; k < d.pieces.length; k++) { var p = d.pieces[k]; p.x += p.vx; p.y += p.vy; p.vy += 9; p.r += p.vr; }
      if (d.t >= RAG) { d.phase = 'replay'; d.t = 0; } return; }
    if (d.phase === 'replay' && d.t >= REPLAY) respawn(g);
  }
  function respawn(g) { g.world.reset(); g.rec = []; g.dseq = null; goneAt = {}; popAt = {}; g.spawnT = 10; }
  function skipDeath() { var g = game; if (g && g.dseq && g.dseq.phase !== 'hit') respawn(g); }

  // ---------------- game ----------------
  var game = null;
  function trapHint(map) { var h = [];
    for (var i = 0; i < map.length; i++) { if (map[i] === TL.COL && h.indexOf('有的地板踩上去会塌') < 0) h.push('有的地板踩上去会塌');
      if (map[i] === TL.HID && h.indexOf('平地上有藏起来的刺') < 0) h.push('平地上有藏起来的刺'); if (map[i] === TL.FALL && h.indexOf('有方块会从上面掉下来') < 0) h.push('有方块会从上面掉下来'); }
    return h.length ? h.join('；') + '。' : '这关没有恶搞机关。'; }
  function startPlay(opts) {
    goneAt = {}; popAt = {}; clearInput();
    game = { map: opts.map, mode: opts.mode, title: opts.title, world: new M.World(opts.map), ghost: opts.ghost || null, gworld: opts.ghost ? new M.World(opts.map) : null,
      ghostLabel: opts.ghostLabel || '作者', levelIdx: opts.levelIdx, hint: opts.hint || trapHint(opts.map), snapshot: opts.snapshot || null,
      tick: 0, deaths: 0, rec: [], done: false, gDone: false, dseq: null, shake: 0, reveal: {}, deathsAt: [], squash: 0, spawnT: 10 };
    $('pTitle').textContent = opts.title; $('edit').classList.remove('on'); $('pad').style.display = 'flex';
    $('legend').innerHTML = game.ghost ? '<span><i style="background:' + C.hero + '"></i>你</span><span><i style="background:#c8cde0;opacity:.6"></i>' + game.ghostLabel + '的影子</span><span>死了可点任意键跳过回放</span>' : '<span>死了可点任意键跳过回放</span>';
    setInfo(opts.mode === 'record' ? '先自己通关一次：<b>这次干净通关的操作会被录成影子</b>。死了从头录，最长 20 秒。' : (game.ghost ? '和' + game.ghostLabel + '的影子同时起跑，到达<b>绿色圆环</b>就算赢。' : '到达<b>绿色圆环</b>就算赢。'));
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
      if (w.ev & 1) { SFX.jump(); g.squash = -6; } if (w.ev & 2) { SFX.land(); g.squash = 6; } if (w.ev & 28) SFX.click();
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
      toast('录制成功 ' + (inputs.length / 60).toFixed(2) + ' 秒', 1200); setTimeout(openExport, 900); return;
    }
    toast('通关！', 800); setTimeout(showResult, 700);
  }
  function fmt(t) { return (t / 60).toFixed(2) + ' 秒'; }

  // ---------------- result card (also the share / comment image) ----------------
  function drawCard(map, deathsAt, reveal, title, lines, foot) {
    var W = 720, H = 920, c = document.createElement('canvas'); c.width = W; c.height = H; var g = c.getContext('2d');
    g.fillStyle = '#14151f'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#f4efe6'; g.font = 'bold 36px -apple-system,"PingFang SC",sans-serif'; g.textBaseline = 'alphabetic'; g.fillText('我的关，我的影子', 28, 56);
    g.fillStyle = '#a9a6b8'; g.font = '26px -apple-system,"PingFang SC",sans-serif'; g.fillText(title || '', 28, 96);
    var sc = W / (COLS * T); g.save(); g.translate(0, 120); drawMap(g, map, sc, null, 'card', 0, reveal);
    for (var i = 0; i < deathsAt.length; i++) { var d = deathsAt[i]; ART.skull(g, d[0] * sc + ((i * 37) % 21 - 10), Math.min(d[1] * sc, 470) + ((i * 53) % 17 - 8), 20); }
    g.restore();
    var y0 = 120 + 480 + 30; ART.skull(g, 80, y0 + 62, 46);
    g.fillStyle = '#ff7a59'; g.font = '900 108px -apple-system,"PingFang SC",sans-serif'; g.fillText('× ' + deathsAt.length, 140, y0 + 100);
    g.fillStyle = '#f4efe6'; g.font = 'bold 34px -apple-system,"PingFang SC",sans-serif';
    for (i = 0; i < lines.length; i++) { g.fillStyle = i === 0 ? '#f4efe6' : '#5ef0c0'; g.fillText(lines[i], 28, y0 + 170 + i * 48); }
    g.fillStyle = '#ffb199'; g.font = 'bold 30px -apple-system,"PingFang SC",sans-serif'; g.fillText(foot, 28, H - 30);
    try { return c.toDataURL('image/png'); } catch (e) { return ''; }
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
    if (g.mode === 'demo') { var best = +store('best' + g.levelIdx) || 0; if (!best || my < best) store('best' + g.levelIdx, String(my)); }
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
  function heroOpts(w, g, dead) {
    var o = { lx: w.vx > 8 ? 1 : (w.vx < -8 ? -1 : 0), ly: w.vy < -20 ? -1 : (w.vy > 40 ? 1 : 0) };
    if (dead) { o.eyes = 'x'; o.mouth = 'o'; return o; }
    if ((rt % 200) < 7) o.eyes = 'closed';
    if (w.vy > 120) { o.eyes = 'wide'; o.mouth = 'o'; } // falling fast = panic
    var q = g ? g.squash : 0; if (q > 0) { o.sx = 1 + q * 0.04; o.sy = 1 - q * 0.04; } else if (q < 0) { o.sx = 1 + q * 0.03; o.sy = 1 - q * 0.04; }
    if (g && g.spawnT > 0) { var k = 1 - g.spawnT / 10; o.sx = (o.sx || 1) * k; o.sy = (o.sy || 1) * k; }
    return o;
  }
  function render() {
    var s = T * scale;
    if (editor.on) { ctx.setTransform(1, 0, 0, 1, 0, 0); drawMap(ctx, editor.map, scale, null, 'edit', rt); drawGridLines(); return; }
    var g = game; if (!g) return; var d = g.dseq;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (g.shake > 0) { var a = g.shake * s * 0.012; ctx.translate((Math.random() * 2 - 1) * a, (Math.random() * 2 - 1) * a); }
    if (d && d.phase === 'replay') { renderReplay(g, d); return; }
    drawMap(ctx, g.map, scale, g.world, 'play', rt);
    if (g.gworld && !g.gDone) { var gw = g.gworld; ART.hero(ctx, gw.x * scale, gw.y * scale, M.PW * scale, M.PH * scale, { color: C.ghost, ink: 'rgba(20,20,40,0.5)', lx: gw.vx > 8 ? 1 : gw.vx < -8 ? -1 : 0 }); }
    var w = g.world;
    if (!d) ART.hero(ctx, w.x * scale, w.y * scale, M.PW * scale, M.PH * scale, heroOpts(w, g, false));
    else if (d.phase === 'hit') { ctx.fillStyle = 'rgba(255,255,255,' + (d.t < 2 ? 0.5 : 0) + ')'; ctx.fillRect(0, 0, COLS * s, ROWS * s);
      ART.hero(ctx, d.rag.x * scale, d.rag.y * scale, M.PW * scale, M.PH * scale, { eyes: 'x', mouth: 'o', sx: d.squash ? 1.5 : 1.15, sy: d.squash ? 0.35 : 0.9 }); }
    else if (d.phase === 'rag') {
      if (d.pieces.length) for (var k = 0; k < d.pieces.length; k++) { var p = d.pieces[k]; ctx.save(); ctx.translate(p.x * scale, p.y * scale); ctx.rotate(p.r); ctx.fillStyle = C.hero; ctx.fillRect(-s * 0.13, -s * 0.13, s * 0.26, s * 0.26); ctx.restore(); }
      if (!d.squash || d.t < 6) ART.hero(ctx, d.rag.x * scale, d.rag.y * scale, M.PW * scale * (d.pieces.length ? 0.8 : 1), M.PH * scale * (d.pieces.length ? 0.8 : 1), { eyes: 'x', mouth: 'o', rot: d.rag.rot });
    }
    if (d) drawTaunt(g, d);
    else drawTension(g);
  }
  function drawTaunt(g, d) {
    if (!d.hasKiller || d.phase === 'hit') return; var s = T * scale, kx = d.kx * scale, ky = d.ky * scale, t = d.phase === 'rag' ? d.t : RAG + d.t;
    var pop = Math.min(1, t / 6), wob = Math.sin(t * 0.6) * 0.12 * Math.max(0, 1 - t / 50);
    ctx.save(); ctx.translate(kx, Math.min(ky, ROWS * s - s * 0.4)); ctx.rotate(wob); ctx.scale(0.6 + 0.4 * pop + Math.abs(Math.sin(t * 0.5)) * 0.08, 0.6 + 0.4 * pop);
    if (d.cause === 'collapse') { ART.ground(ctx, -s / 2, -s / 2, s); }
    ART.trapFace(ctx, 0, d.cause === 'hidden' || d.cause === 'spike' ? s * 0.22 : 0, s, t); ctx.restore();
    ART.bubble(ctx, kx, Math.min(ky, ROWS * s - s * 0.4) - s * 0.9, d.taunt, Math.round(s * 0.42), COLS * s);
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
    drawMap(ctx, g.map, scale, w, 'play', rt); goneAt = saveG; popAt = saveP;
    ART.hero(ctx, w.x * scale, w.y * scale, M.PW * scale, M.PH * scale, idx >= n - 1 ? { eyes: 'x', mouth: 'o' } : heroOpts(w, null, false));
    ctx.fillStyle = 'rgba(40,60,120,0.22)'; ctx.fillRect(0, 0, COLS * s, ROWS * s);
    ctx.fillStyle = 'rgba(255,255,255,0.06)'; for (var y = (rt * 3) % 8; y < ROWS * s; y += 8 * dpr) ctx.fillRect(0, y, COLS * s, dpr);
    ctx.fillStyle = '#fff'; ctx.font = 'bold ' + Math.round(s * 0.36) + 'px sans-serif'; ctx.fillText('◀◀ 回放：你是怎么死的', s * 0.25, s * 0.55);
    ctx.fillStyle = '#ff5d73'; ctx.beginPath(); ctx.arc(COLS * s - s * 0.45, s * 0.42, s * 0.12, 0, 7); if (rt % 30 < 18) ctx.fill();
    drawTaunt(g, d);
  }
  function drawGridLines() { var s = T * scale; ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1;
    for (var c = 0; c <= COLS; c++) { ctx.beginPath(); ctx.moveTo(c * s, 0); ctx.lineTo(c * s, ROWS * s); ctx.stroke(); }
    for (var r = 0; r <= ROWS; r++) { ctx.beginPath(); ctx.moveTo(0, r * s); ctx.lineTo(COLS * s, r * s); ctx.stroke(); } }

  // ---------------- editor ----------------
  var PAL = [[TL.E, '擦除'], [TL.GND, '地面'], [TL.SPK, '尖刺'], [TL.ST, '起点'], [TL.GL, '终点'], [TL.COL, '塌陷地板'], [TL.HID, '隐藏尖刺'], [TL.FALL, '下落方块']];
  var editor = { on: false, map: null, sel: TL.GND, rec: null, recMap: null, recDeaths: [], recReveal: {}, painting: false, lastCell: -1 };
  function defaultMap() { return M.parseRows(['............', '............', '............', '............', '............', 'S.........G.', '############', '############']); }
  function loadEditorMap() { var s = store('editor'); if (s) { var a = s.split(',').map(Number); if (a.length === COLS * ROWS && a.every(function (v) { return v >= 0 && v <= 7; })) return new Uint8Array(a); } return defaultMap(); }
  function buildPalette() {
    var pal = $('pal'); pal.innerHTML = '';
    PAL.forEach(function (p) {
      var b = document.createElement('button'), c = document.createElement('canvas'); c.width = 60; c.height = 60; var g = c.getContext('2d'); g.fillStyle = C.bg; g.fillRect(0, 0, 60, 60);
      if (p[0] === TL.GND) ART.ground(g, 6, 6, 48); else if (p[0] === TL.SPK) ART.spike(g, 6, 6, 48); else if (p[0] === TL.ST) { ART.start(g, 6, 6, 48); ART.hero(g, 18, 18, 24, 30, {}); }
      else if (p[0] === TL.GL) ART.goal(g, 6, 6, 48, 0); else if (p[0] === TL.HID) ART.spike(g, 6, 6, 48, '#ff9fae', true);
      else if (p[0] === TL.COL) { ART.ground(g, 6, 6, 48); ART.crack(g, 6, 6, 48); } else if (p[0] === TL.FALL) { ART.ground(g, 6, 6, 48); ART.arrow(g, 6, 6, 48); }
      else { g.strokeStyle = '#888'; g.lineWidth = 3; g.beginPath(); g.moveTo(16, 16); g.lineTo(44, 44); g.moveTo(44, 16); g.lineTo(16, 44); g.stroke(); }
      b.appendChild(c); b.appendChild(document.createTextNode(p[1])); if (p[0] === editor.sel) b.classList.add('sel');
      b.addEventListener('click', function () { editor.sel = p[0]; var all = pal.querySelectorAll('button'); for (var i = 0; i < all.length; i++) all[i].classList.remove('sel'); b.classList.add('sel'); });
      pal.appendChild(b);
    });
  }
  function trapCount(m) { var n = 0; for (var i = 0; i < m.length; i++) if (M.isTrap(m[i])) n++; return n; }
  function editMsg(extra) {
    var e = M.checkMap(editor.map), n = trapCount(editor.map), recOk = editor.rec && editor.recMap === M.packMap(editor.map).join(',');
    $('editMsg').innerHTML = '恶搞机关 <b>' + n + '/' + M.MAX_TRAPS + '</b> · ' + (e ? '<span style="color:#ff8a8a">' + e + '</span>' : (recOk ? '<span style="color:#5ef0c0">已录好影子 ' + (editor.rec.length / 60).toFixed(2) + ' 秒</span>' : '可以试玩了')) + (extra ? ' · ' + extra : '');
    $('eExport').disabled = !recOk; $('eTest').disabled = !!e;
  }
  function openEditor() {
    game = null; editor.on = true; if (!editor.map) editor.map = loadEditorMap();
    $('pTitle').textContent = '出一关'; $('pDeaths').textContent = ''; $('bigD').innerHTML = ''; $('pTime').textContent = ''; $('legend').innerHTML = '';
    setInfo('选零件，点格子摆放（可拖动连续画）。机关最多 3 个。<b>摆好后必须自己通关一次</b>才能导出。');
    $('edit').classList.add('on'); $('pad').style.display = 'none'; buildPalette(); show('sPlay'); editMsg();
  }
  function cellFromEvent(e) { var t = e.touches ? e.touches[0] : e; if (!t) return -1; var r = cv.getBoundingClientRect(), x = (t.clientX - r.left) / r.width * COLS, y = (t.clientY - r.top) / r.height * ROWS;
    if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return -1; return (y | 0) * COLS + (x | 0); }
  function paint(i, first) {
    if (i < 0 || (!first && i === editor.lastCell)) return; editor.lastCell = i; var m = editor.map, sel = editor.sel;
    if (!first && (sel === TL.ST || sel === TL.GL || M.isTrap(sel))) return;
    if (sel === TL.ST || sel === TL.GL) for (var k = 0; k < m.length; k++) if (m[k] === sel) m[k] = TL.E;
    if (M.isTrap(sel) && !M.isTrap(m[i]) && trapCount(m) >= M.MAX_TRAPS) { editMsg('<span style="color:#ff8a8a">机关已满 3 个</span>'); toast('机关最多 3 个'); return; }
    if (first && m[i] === sel && sel !== TL.E) sel = TL.E;
    m[i] = sel; store('editor', Array.prototype.join.call(m, ',')); editMsg();
  }
  function cvDown(e) { if (game && game.dseq) { anyPress(); return; } if (!editor.on) return; e.preventDefault(); editor.painting = true; editor.lastCell = -1; paint(cellFromEvent(e), true); }
  function edMove(e) { if (!editor.on || !editor.painting) return; e.preventDefault(); paint(cellFromEvent(e), false); }
  function edUp() { editor.painting = false; }
  cv.addEventListener('touchstart', cvDown, { passive: false }); cv.addEventListener('touchmove', edMove, { passive: false }); cv.addEventListener('touchend', edUp);
  cv.addEventListener('mousedown', cvDown); cv.addEventListener('mousemove', edMove); window.addEventListener('mouseup', edUp);
  $('eClear').onclick = function () { editor.map = defaultMap(); store('editor', Array.prototype.join.call(editor.map, ',')); editMsg(); };
  $('eBack').onclick = function () { editor.on = false; show('sMenu'); };
  $('eTest').onclick = function () { if (M.checkMap(editor.map)) return; editor.on = false; startPlay({ map: new Uint8Array(editor.map), mode: 'record', title: '录制影子' }); };
  $('eExport').onclick = function () { editor.on = false; openExport(); };

  // ---------------- export ----------------
  var exportJson = '';
  function openExport() {
    var map = editor.map, rec = editor.rec; exportJson = M.encodeSnapshot(map, rec);
    var bytes = M.utf8len(exportJson), ev = M.inputsToEvents(rec).length;
    $('xJson').value = exportJson; $('xBytes').textContent = bytes + ' / ' + M.SNAP_LIMIT + ' 字节';
    $('xBar').style.width = Math.min(100, bytes / M.SNAP_LIMIT * 100) + '%'; $('xBar').style.background = bytes > M.SNAP_LIMIT ? '#ff5d73' : '#5ef0c0';
    $('xMeta').textContent = '快照 v' + M.VERSION + ' · 地图 36 字节(3bit×96格) · 影子 ' + ev + ' 次按键变化 · ' + rec.length + ' 帧(' + (rec.length / 60).toFixed(2) + '秒)';
    var dd = editor.recDeaths || [];
    $('prevImg').src = drawCard(map, dd, editor.recReveal || {}, '作者出的坑关', ['作者用时 ' + fmt(rec.length) + (dd.length ? ' · 出关时自己死了 ' + dd.length + ' 次' : '')], '看着很简单？点我来追我的影子');
    $('xLinkTxt').style.display = 'none'; $('xMsg').textContent = '';
    $('xXhs').disabled = !(window.xhs && typeof window.xhs.interactionOpenApi === 'function'); show('sExport');
  }
  function copyText(txt, okEl) {
    function fallback() { var ta = document.createElement('textarea'); ta.value = txt; ta.style.position = 'fixed'; ta.style.top = '-1000px'; document.body.appendChild(ta); ta.select();
      var ok = false; try { ok = document.execCommand('copy'); } catch (e) {} document.body.removeChild(ta); okEl.textContent = ok ? '已复制' : '复制失败，请长按文本框手动复制'; okEl.className = ok ? 'ok' : 'err'; }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(function () { okEl.textContent = '已复制'; okEl.className = 'ok'; }, fallback); else fallback();
  }
  $('xCopy').onclick = function () { copyText(exportJson, $('xMsg')); };
  $('xLink').onclick = function () { var link = location.href.split('#')[0] + '#s=' + M.hashEncode(exportJson); var t = $('xLinkTxt'); t.value = link; t.style.display = 'block'; copyText(link, $('xMsg'));
    if (location.protocol === 'file:') $('xMsg').textContent += '（本地文件打开的链接只在本机有效，放到网上才能分享）'; };
  $('xSelf').onclick = function () { startChallenge(exportJson, '自己'); };
  $('xBack').onclick = function () { openEditor(); };
  $('xXhs').onclick = function () {
    // 字段名待真机确认：文档写评论可带 miniToolSnapshotInfo(≤2KB)；routed 只表示已唤起，不代表已发布
    var x = window.xhs; if (!x || typeof x.interactionOpenApi !== 'function') { $('xMsg').textContent = '当前不在小红书小工具环境'; return; }
    try { x.interactionOpenApi({ type: 'comment', content: '看着很简单？来追我的影子', miniToolSnapshotInfo: exportJson,
        success: function (r) { $('xMsg').className = 'ok'; $('xMsg').textContent = '已唤起评论框（不代表已发布）：' + JSON.stringify(r); },
        fail: function (err) { $('xMsg').className = 'err'; $('xMsg').textContent = '唤起失败：' + JSON.stringify(err); } });
    } catch (e) { $('xMsg').textContent = '调用出错：' + e.message; }
  };

  // ---------------- import / challenge ----------------
  function startChallenge(json, who) {
    var d; try { d = M.decodeSnapshot(json); } catch (e) { $('iMsg').textContent = '加载失败：' + e.message; show('sImport'); return false; }
    startPlay({ map: d.map, mode: 'challenge', title: who === '自己' ? '挑战自己的影子' : '挑战作者', ghost: d.inputs, ghostLabel: who || '作者', snapshot: json }); return true;
  }
  $('iGo').onclick = function () { $('iMsg').textContent = ''; var v = $('iJson').value.trim(); if (!v) { $('iMsg').textContent = '先粘贴快照'; return; } startChallenge(v, '作者'); };
  $('iBack').onclick = function () { show('sMenu'); };
  function launchDebug() {
    var lines = ['href: ' + location.href.slice(0, 300)];
    try { if (window.xhs) { lines.push('xhs keys: ' + Object.keys(window.xhs).join(', '));
      ['getLaunchOptionsSync', 'getEnterOptionsSync'].forEach(function (f) { if (typeof window.xhs[f] === 'function') lines.push(f + ': ' + JSON.stringify(window.xhs[f]())); }); }
      else lines.push('window.xhs: 不存在（普通浏览器）'); } catch (e) { lines.push('err: ' + e.message); }
    $('iDbg').textContent = lines.join('\n');
  }

  // ---------------- menu / levels / result ----------------
  $('mDemo').onclick = function () { buildLevels(); show('sLevels'); };
  $('mEdit').onclick = function () { openEditor(); };
  $('mImport').onclick = function () { $('iMsg').textContent = ''; launchDebug(); show('sImport'); };
  $('lvBack').onclick = function () { show('sMenu'); };
  $('pBack').onclick = function () { var g = game; game = null; clearInput();
    if (editor.on) { editor.on = false; show('sMenu'); } else if (g && g.mode === 'record') openEditor(); else if (g && g.mode === 'demo') { buildLevels(); show('sLevels'); } else show('sMenu'); };
  function playDemo(i) { var gh = DEMO_GHOSTS[i] ? M.decodeSnapshot(DEMO_GHOSTS[i]) : null;
    startPlay({ map: M.parseRows(LEVELS[i].rows), mode: 'demo', title: (i + 1) + '. ' + LEVELS[i].name, ghost: gh ? gh.inputs : null, ghostLabel: 'AI示范', levelIdx: i, hint: LEVELS[i].hint }); }
  function buildLevels() { var list = $('lvlList'); list.innerHTML = '';
    LEVELS.forEach(function (l, i) { var b = document.createElement('button'), best = +store('best' + i) || 0;
      b.innerHTML = '<span>' + (i + 1) + '. ' + l.name + '</span><span class="small">' + (best ? '最好 ' + (best / 60).toFixed(2) + 's' : '未通关') + '</span>';
      b.onclick = function () { playDemo(i); }; list.appendChild(b); }); }
  $('rAgain').onclick = function () { var g = game; if (!g) return show('sMenu'); if (g.mode === 'demo') playDemo(g.levelIdx); else startChallenge(g.snapshot, g.ghostLabel); };
  $('rNext').onclick = function () { if (game && game.mode === 'demo') playDemo(game.levelIdx + 1); };
  $('rMake').onclick = function () { editor.map = defaultMap(); editor.rec = null; openEditor(); };
  $('rMenu').onclick = function () { game = null; show('sMenu'); };
  $('rCopy').onclick = function () { copyText($('rShare').getAttribute('data-t'), $('rMsg')); };

  (function () { var g = $('logo').getContext('2d'); for (var i = 0; i < 8; i++) ART.ground(g, i * 30, 90, 30);
    ART.hero(g, 120, 40, 34, 46, { color: C.ghost, ink: 'rgba(20,20,40,0.5)', lx: 1 }); ART.hero(g, 76, 40, 34, 46, { eyes: 'wide', mouth: 'o', rot: -0.3 }); ART.goal(g, 190, 52, 40, 0); ART.spike(g, 150, 60, 30); })();

  window.__mlmg = { M: M, startChallenge: startChallenge, playDemo: playDemo, openEditor: openEditor, editor: editor, get game() { return game; }, stepGame: stepGame, render: render, held: held, skipDeath: skipDeath };
  resize(); requestAnimationFrame(frame);
  var h = location.hash;
  if (h.indexOf('#s=') === 0) { try { startChallenge(M.hashDecode(h.slice(3)), '作者'); } catch (e) { $('iMsg').textContent = '链接里的关卡打不开：' + e.message; launchDebug(); show('sImport'); } }
})();
