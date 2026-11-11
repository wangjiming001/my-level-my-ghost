const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file:///workspace/mlmg/prototype_v2.html'); await p.waitForTimeout(300);
  await p.screenshot({ path: 'shots/v2_1_menu.png' });
  const drive = async (fn, arg) => p.evaluate(fn, arg);
  // L3: run right into falling block, die
  await drive(() => { window.__mlmgPause = true; window.__mlmg.playDemo(2); });
  await p.waitForTimeout(100);
  await drive(() => { const m = window.__mlmg, h = m.held, g = m.game; let n = 0; while (!g.dseq && n < 600) { h.R = true; m.stepGame(); n++; } h.R = false; for (let i = 0; i < 2; i++) m.stepGame(); m.render(); });
  await p.screenshot({ path: 'shots/v2_2_death_freeze.png' });
  await drive(() => { const m = window.__mlmg; for (let i = 0; i < 16; i++) m.stepGame(); m.render(); });
  await p.screenshot({ path: 'shots/v2_3_ragdoll_taunt.png' });
  await drive(() => { const m = window.__mlmg; for (let i = 0; i < 36; i++) m.stepGame(); m.render(); });
  await p.screenshot({ path: 'shots/v2_4_replay.png' });
  // L1: collapse death taunt
  await drive(() => { const m = window.__mlmg; m.playDemo(0); const h = m.held, g = m.game; let n = 0; while (!g.dseq && n < 600) { h.R = true; h.J = (n >= 47 && n < 77); m.stepGame(); n++; } h.R = h.J = false; for (let i = 0; i < 24; i++) m.stepGame(); m.render(); return g.dseq && g.dseq.cause; }).then(c => console.log('L1 cause', c));
  await p.screenshot({ path: 'shots/v2_5_collapse_taunt.png' });
  // full L5 session: die 3 different ways-ish, then clear with AI ghost inputs
  const res = await drive(() => { const m = window.__mlmg, M = m.M; m.playDemo(4); const g = m.game, h = m.held;
    const ghost = g.ghost; const causes = [];
    const tries = [ (n) => ({ R: true, J: false }), (n) => ({ R: true, J: n >= 22 && n < 52 }), (n) => ({ R: true, J: (n >= 22 && n < 52) || (n >= 102 && n < 132) }) ];
    for (const tr of tries) { let n = 0; while (!g.dseq && n < 900 && !g.done) { const s = tr(n); h.R = s.R; h.J = s.J; m.stepGame(); n++; } causes.push(g.dseq ? g.dseq.cause : 'none'); h.R = h.J = false; while (g.dseq && g.dseq.phase === 'hit') m.stepGame(); m.skipDeath(); }
    m.stepGame(); // respawn tick
    g.world.reset(); g.rec = [];
    for (let i = 0; i < ghost.length && !g.done; i++) { const s = ghost[i]; h.L = !!(s & 1); h.R = !!(s & 2); h.J = !!(s & 4); m.stepGame(); }
    h.L = h.R = h.J = false; return { causes, deaths: g.deaths, done: g.done };
  });
  await p.waitForTimeout(1300); await p.screenshot({ path: 'shots/v2_6_result_card.png', fullPage: false });
  // gameplay frame near goal (tension tint)
  await drive(() => { const m = window.__mlmg; m.playDemo(1); const g = m.game, gh = g.ghost, h = m.held; for (let i = 0; i < gh.length - 25; i++) { const s = gh[i]; h.L = !!(s & 1); h.R = !!(s & 2); h.J = !!(s & 4); m.stepGame(); } h.L = h.R = h.J = false; g.tick = 0; while (Math.pow(Math.max(0, Math.sin(g.tick * 0.22)), 6) < 0.9) g.tick++; m.render(); });
  await p.screenshot({ path: 'shots/v2_7_play_tension.png' });
  const lay = await p.evaluate(() => { const r = id => document.getElementById(id).getBoundingClientRect(); return { cv: [r('cv').top, r('cv').bottom], pad: [r('bL').top, r('bL').bottom, r('bL').width, r('bR').width, r('bJ').width] }; });
  console.log(JSON.stringify({ errs, res, lay }));
  await b.close();
})();
