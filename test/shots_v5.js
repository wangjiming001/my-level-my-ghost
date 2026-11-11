const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
(async () => {
  fs.mkdirSync('shots_v5', { recursive: true });
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  p.on('console', m => { if (m.type() === 'error' && m.text().indexOf('favicon.ico') < 0) errs.push(m.text()); });
  await p.goto('http://127.0.0.1:8765/index.html');
  await p.waitForFunction(() => window.__mlmg && window.__mlmg.drawShareNoteCard);
  await p.waitForTimeout(400);

  const exportInfo = await p.evaluate(() => {
    const m = window.__mlmg;
    const snap = (typeof MLMG_DEMO_GHOSTS !== 'undefined' && MLMG_DEMO_GHOSTS[1]) ? MLMG_DEMO_GHOSTS[1] : null;
    if (!snap) return { error: 'no demo ghost' };
    const d = m.M.decodeSnapshot(snap);
    m.editor.map = d.map;
    m.editor.rec = d.inputs;
    m.editor.recDeaths = [];
    m.editor.recReveal = {};
    m.openExport();
    const note = document.getElementById('xNote');
    const comment = document.getElementById('xXhs');
    return {
      noteText: note && note.textContent,
      commentText: comment && comment.textContent,
      noteVisible: !!(note && note.getBoundingClientRect().height > 0),
      title: document.getElementById('xMeta') && document.getElementById('xMeta').textContent
    };
  });
  await p.evaluate(() => {
    var el = document.getElementById('xNote');
    if (el) el.scrollIntoView({ block: 'center' });
  });
  await p.waitForTimeout(200);
  await p.screenshot({ path: 'shots_v5/01_export_note_button.png' });

  const card = await p.evaluate(() => {
    const m = window.__mlmg;
    const dataUrl = m.drawShareNoteCard({
      map: m.editor.map,
      deathsAt: [],
      reveal: {},
      timeLine: '作者用时 ' + (m.editor.rec.length / 60).toFixed(2) + ' 秒',
      line: m.NOTE.LINE_OWN,
      hint: m.NOTE.HINT
    });
    return { dataUrl: dataUrl, prefix: dataUrl.slice(0, 30), len: dataUrl.length, isJpeg: dataUrl.indexOf('data:image/jpeg') === 0 };
  });
  if (!card.dataUrl || !card.isJpeg) throw new Error('share card failed: ' + JSON.stringify({ prefix: card.prefix, len: card.len, isJpeg: card.isJpeg }));
  fs.writeFileSync('shots_v5/02_share_card.jpg', Buffer.from(card.dataUrl.split(',')[1], 'base64'));

  const resultInfo = await p.evaluate(() => {
    const m = window.__mlmg;
    const snap = MLMG_DEMO_GHOSTS[0];
    const d = m.M.decodeSnapshot(snap);
    m.startChallenge(snap, '作者');
    const g = m.game, h = m.held, inputs = d.inputs;
    window.__mlmgPause = true;
    for (let i = 0; i < inputs.length && !g.done; i++) {
      const s = inputs[i];
      h.L = !!(s & 1); h.R = !!(s & 2); h.J = !!(s & 4);
      m.stepGame();
    }
    h.L = h.R = h.J = false;
    if (typeof m.showResult === 'function') m.showResult();
    const note = document.getElementById('rNote');
    const comment = document.getElementById('rXhs');
    return {
      done: g.done, deaths: g.deaths, tick: g.tick,
      noteText: note && note.textContent,
      commentShown: comment && comment.style.display !== 'none',
      rBig: document.getElementById('rBig') && document.getElementById('rBig').textContent
    };
  });
  await p.waitForTimeout(200);
  await p.screenshot({ path: 'shots_v5/03_result_note_button.png', fullPage: true });

  console.log(JSON.stringify({ errs, exportInfo, resultInfo, card: { prefix: card.prefix, len: card.len, isJpeg: card.isJpeg, bytes: fs.statSync('shots_v5/02_share_card.jpg').size } }, null, 2));
  var real = errs.filter(function (e) { return e.indexOf('404') < 0 && e.indexOf('File not found') < 0; });
  if (real.length) {
    console.error('page errors', real);
    process.exit(1);
  }
  if (!exportInfo.noteVisible || exportInfo.noteText.indexOf('发成笔记') < 0) {
    console.error('export button missing', exportInfo);
    process.exit(1);
  }
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
