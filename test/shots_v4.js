const { chromium } = require('playwright-core');
const fs = require('fs');
(async () => {
  fs.mkdirSync('shots_v4', { recursive: true });
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file:///workspace/mlmg/dist/index.html');
  await p.waitForTimeout(500);
  await p.screenshot({ path: 'shots_v4/01_menu.png' });

  // open editor — default should be two-layer
  await p.evaluate(() => { window.__mlmgPause = true; window.__mlmg.openEditor(); window.__mlmg.render(); });
  await p.waitForTimeout(200);
  const ed0 = await p.evaluate(() => {
    const m = window.__mlmg, map = Array.from(m.editor.map), T = m.M.TILE, C = m.M.COLS;
    function row(r) { return map.slice(r * C, r * C + C).map(v => '._^SGCHF t'[v] || '?').join(''); }
    const rows = []; for (let r = 0; r < 8; r++) rows.push(row(r));
    const mid = map.slice(4 * C, 5 * C).filter(v => v === T.GND).length;
    const gnd = map.slice(6 * C, 8 * C).filter(v => v === T.GND).length;
    return { rows, mid, gnd, tpl: m.editor.tpl, pal: Array.from(document.querySelectorAll('#pal button')).map(b => b.textContent.trim()),
      tpls: Array.from(document.querySelectorAll('#tpl button')).map(b => b.textContent.trim()) };
  });
  await p.screenshot({ path: 'shots_v4/02_editor_default_two_layer.png' });

  // apply 直走过
  await p.evaluate(() => { window.__mlmg.applyTemplate('flat', true); window.__mlmg.render(); });
  await p.screenshot({ path: 'shots_v4/03_editor_tpl_flat.png' });
  // apply 终点在上层
  await p.evaluate(() => { window.__mlmg.applyTemplate('up', true); window.__mlmg.render(); });
  await p.screenshot({ path: 'shots_v4/04_editor_tpl_goal_up.png' });
  // back to two-layer
  await p.evaluate(() => { window.__mlmg.applyTemplate('two', true); window.__mlmg.render(); });

  // start/goal cannot be erased by a normal tap
  const erase = await p.evaluate(() => {
    const m = window.__mlmg, T = m.M.TILE;
    let si = -1, gi = -1;
    for (let i = 0; i < m.editor.map.length; i++) { if (m.editor.map[i] === T.ST) si = i; if (m.editor.map[i] === T.GL) gi = i; }
    m.editor.sel = T.E;
    // simulate paint tap on start and goal
    const ev = { preventDefault: function () {}, clientX: 0, clientY: 0 };
    // call paint via a click-like path: use internal by toggling through paint if exposed
    // direct: try to assign empty
    const before = { s: si, g: gi, sv: m.editor.map[si], gv: m.editor.map[gi] };
    // invoke the same guard as paint
    if (m.editor.map[si] === T.ST) { /* would return */ }
    m.editor.sel = T.E;
    // Use a synthetic canvas click at the start cell
    const cv = document.getElementById('cv');
    const r = cv.getBoundingClientRect();
    const sc = si % 12, sr = (si / 12) | 0, gc = gi % 12, gr = (gi / 12) | 0;
    function tap(c, row) {
      const x = r.left + (c + 0.5) * r.width / 12;
      const y = r.top + (row + 0.5) * r.height / 8;
      cv.dispatchEvent(new MouseEvent('mousedown', { clientX: x, clientY: y, bubbles: true }));
      cv.dispatchEvent(new MouseEvent('mouseup', { clientX: x, clientY: y, bubbles: true }));
    }
    m.editor.sel = T.E;
    tap(sc, sr); tap(gc, gr);
    // also try painting ground over them
    m.editor.sel = T.GND;
    tap(sc, sr); tap(gc, gr);
    let si2 = -1, gi2 = -1;
    for (let i = 0; i < m.editor.map.length; i++) { if (m.editor.map[i] === T.ST) si2 = i; if (m.editor.map[i] === T.GL) gi2 = i; }
    return { before, after: { s: si2, g: gi2, sv: m.editor.map[si], gv: m.editor.map[gi] }, startGone: si2 < 0, goalGone: gi2 < 0, countS: m.editor.map.filter(v => v === T.ST).length, countG: m.editor.map.filter(v => v === T.GL).length };
  });
  await p.screenshot({ path: 'shots_v4/05_editor_start_goal_protected.png' });

  // play demo L4 trampoline — stop shortly after bounce so the character is in the air
  await p.evaluate(() => { window.__mlmgPause = true; window.__mlmg.editor.on = false; window.__mlmg.playDemo(3); });
  await p.waitForTimeout(50);
  const bounce = await p.evaluate(() => {
    const m = window.__mlmg, g = m.game, h = m.held, gh = g.ghost;
    let bounced = false, bounceTick = -1, maxRise = 0, y0 = g.world.y;
    for (let i = 0; i < gh.length && !g.done; i++) {
      const s = gh[i];
      h.L = !!(s & 1); h.R = !!(s & 2); h.J = !!(s & 4);
      m.stepGame();
      if (g.world.ev & 32) { bounced = true; bounceTick = g.world.tick; y0 = g.world.y; }
      if (bounced && y0 - g.world.y > maxRise) maxRise = y0 - g.world.y;
      if (bounced && g.world.tick === bounceTick + 18) break;
    }
    h.L = h.R = h.J = false;
    m.render();
    document.getElementById('pTime').textContent = '⏱' + (g.world.tick / 60).toFixed(1) + 's';
    return { bounced, bounceTick, done: g.done, deaths: g.deaths, frames: g.world.tick, y: g.world.y, x: g.world.x, riseTiles: maxRise / m.M.T, editorOn: m.editor.on };
  });
  await p.screenshot({ path: 'shots_v4/06_demo_trampoline_bounce.png' });

  // mid play of L2 (on the upper shelf, heading toward the drop)
  const mid2 = await p.evaluate(() => {
    const m = window.__mlmg; m.playDemo(1);
    const g = m.game, gh = g.ghost, h = m.held;
    const mid = Math.max(0, Math.floor(gh.length * 0.62));
    for (let i = 0; i < mid; i++) { const s = gh[i]; h.L = !!(s & 1); h.R = !!(s & 2); h.J = !!(s & 4); m.stepGame(); }
    h.L = h.R = h.J = false; m.render();
    document.getElementById('pTime').textContent = '⏱' + (g.world.tick / 60).toFixed(1) + 's';
    return { x: g.world.x, y: g.world.y, tick: g.world.tick, done: g.done, editorOn: m.editor.on };
  });
  await p.screenshot({ path: 'shots_v4/07_demo_two_layer_play.png' });

  // L5 death on hidden/spike if rush right
  await p.evaluate(() => {
    const m = window.__mlmg; m.editor.on = false; m.playDemo(4);
    const g = m.game, h = m.held; let n = 0;
    while (!g.dseq && n < 600 && !g.done) { h.R = true; m.stepGame(); n++; }
    h.R = false;
    for (let i = 0; i < 20; i++) m.stepGame();
    m.render();
    return g.dseq && g.dseq.cause;
  }).then(c => console.log('L5 rush cause', c));
  await p.screenshot({ path: 'shots_v4/08_demo_troll_death.png' });

  const buttons = await p.evaluate(() => { const m = window.__mlmg; m.openEditor(); const ids=['eUndo','eClear','eBack','eTest','eExport']; const r={}; ids.forEach(id=>{ const el=document.getElementById(id), b=el.getBoundingClientRect(); r[id]={top:Math.round(b.top),bottom:Math.round(b.bottom),visible:b.bottom<=window.innerHeight && b.width>0}; }); r.vh=window.innerHeight; return r; });
  await p.screenshot({ path: 'shots_v4/02b_editor_full_buttons.png' });
  console.log(JSON.stringify({ errs, ed0, erase, bounce, mid2, buttons }, null, 2));
  await b.close();
})();
