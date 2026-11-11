const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file:///workspace/mlmg/prototype.html'); await p.waitForTimeout(300);
  await p.screenshot({ path: 'shots/1_menu.png' });
  await p.click('#mDemo'); await p.waitForTimeout(200); await p.screenshot({ path: 'shots/2_levels.png' });
  // gameplay: level 5, hold right ~1.1s so player & ghost both visible
  await p.evaluate(() => window.__mlmg.playDemo(4)); await p.waitForTimeout(100);
  await p.keyboard.down('ArrowRight'); await p.waitForTimeout(700); await p.keyboard.up('ArrowRight');
  await p.screenshot({ path: 'shots/3_play_ghost.png' });
  // die on purpose then screenshot death toast
  await p.keyboard.down('ArrowRight'); await p.waitForTimeout(500); await p.keyboard.up('ArrowRight'); await p.waitForTimeout(120);
  await p.screenshot({ path: 'shots/4_death.png' });
  // editor with traps
  await p.evaluate(() => { localStorage.clear(); window.__mlmg.editor.map = null; window.__mlmg.openEditor(); }); await p.waitForTimeout(200);
  const box = await p.locator('#cv').boundingBox(); const cw = box.width / 12, ch = box.height / 8;
  const tapCell = async (c, r) => p.mouse.click(box.x + (c + .5) * cw, box.y + (r + .5) * ch);
  await p.click('#pal button:nth-child(6)'); await tapCell(5, 6);
  await p.click('#pal button:nth-child(7)'); await tapCell(8, 5);
  await p.click('#pal button:nth-child(8)'); await tapCell(3, 2);
  await p.click('#pal button:nth-child(3)'); await tapCell(6, 5);
  await p.click('#pal button:nth-child(6)'); await tapCell(1, 6); // 4th trap -> should refuse
  const trapMsg = await p.textContent('#editMsg');
  await p.click('#pal button:nth-child(2)');
  await p.waitForTimeout(1000); await p.screenshot({ path: 'shots/5_editor.png' });
  // record: drive a solver solution for the editor map through real input path
  const sol = await p.evaluate(() => { const M = window.__mlmg.M; return null; });
  await p.evaluate(() => window.__mlmg.editor.map.join(',')).then(s => require('fs').writeFileSync('/tmp/edmap.txt', s));
  const M = require('../src/engine.js'), solve = require('./solver.js');
  const map = new Uint8Array(require('fs').readFileSync('/tmp/edmap.txt', 'utf8').split(',').map(Number));
  const inputs = Array.from(solve(map, 4, 300) || []);
  await p.click('#eTest'); await p.waitForTimeout(100);
  const rec = await p.evaluate((inputs) => { const h = window.__mlmg.held, g = window.__mlmg.game; g.done = false;
    // pause rAF-driven stepping by marking editor? we drive synchronously within one task, rAF can't interleave
    g.world.reset(); g.rec = [];
    for (const s of inputs) { h.L = !!(s & 1); h.R = !!(s & 2); h.J = !!(s & 4); window.__mlmg.stepGame(); if (g.done) break; }
    h.L = h.R = h.J = false; return { done: g.done, ticks: g.world.tick };
  }, inputs);
  await p.waitForTimeout(1300); await p.screenshot({ path: 'shots/6_export.png' });
  const bytes = await p.textContent('#xBytes'); const json = await p.inputValue('#xJson');
  // challenge own ghost: die once then follow ghost path
  await p.click('#xSelf'); await p.waitForTimeout(50);
  const res = await p.evaluate((inputs) => { const h = window.__mlmg.held, g = window.__mlmg.game;
    let n = 0; while (!g.world.dead && n < 600) { h.R = true; window.__mlmg.stepGame(); n++; } h.R = false;
    while (g.world.dead) window.__mlmg.stepGame();
    for (const s of inputs) { h.L = !!(s & 1); h.R = !!(s & 2); h.J = !!(s & 4); window.__mlmg.stepGame(); if (g.done) break; }
    h.L = h.R = h.J = false; return { done: g.done, deaths: g.deaths, tick: g.tick };
  }, inputs);
  await p.waitForTimeout(1200); await p.screenshot({ path: 'shots/7_result.png' });
  // 3 deaths -> hint shown
  await p.evaluate(() => window.__mlmg.playDemo(1));
  const hint = await p.evaluate(() => { const h = window.__mlmg.held, g = window.__mlmg.game; let n = 0;
    while (g.deaths < 3 && n < 3000) { h.R = !g.world.dead; window.__mlmg.stepGame(); n++; } h.R = false; return document.getElementById('info').textContent; });
  await p.waitForTimeout(300); await p.screenshot({ path: 'shots/10_hint_after_3_deaths.png' });
  const vs = await p.textContent('#rVs');
  // URL hash load
  const hash = M.hashEncode(json);
  const p2 = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  p2.on('pageerror', e => errs.push('p2 ' + e.message));
  await p2.goto('file:///workspace/mlmg/prototype.html#s=' + hash); await p2.waitForTimeout(400);
  const t2 = await p2.textContent('#pTitle'); await p2.screenshot({ path: 'shots/8_hash_challenge.png' });
  await p2.goto('file:///workspace/mlmg/prototype.html#s=AAAA' + hash.slice(4, 30)); await p2.reload(); await p2.waitForTimeout(300);
  const e2 = await p2.textContent('#iMsg'); await p2.screenshot({ path: 'shots/9_bad_link.png' });
  // layout checks
  await p.evaluate(() => window.__mlmg.playDemo(0)); await p.waitForTimeout(150);
  const lay = await p.evaluate(() => { const r = id => document.getElementById(id).getBoundingClientRect(); return { cv: r('cv'), bL: r('bL'), bJ: r('bJ'), vh: innerHeight }; });
  console.log(JSON.stringify({ hint, errs, trapMsg, inputsLen: inputs.length, rec, bytes, jsonLen: json.length, res, vs, t2, e2, lay }, null, 1));
  await b.close();
})();
