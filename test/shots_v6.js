const { chromium } = require('playwright-core');
const fs = require('fs');
(async () => {
  fs.mkdirSync('shots_v6', { recursive: true });
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  p.on('console', m => { if (m.type() === 'error' && m.text().indexOf('404') < 0 && m.text().indexOf('File not found') < 0) errs.push(m.text()); });
  await p.goto('http://127.0.0.1:8766/index.html');
  await p.waitForFunction(() => window.__mlmg && window.__mlmg.drawShareNoteCard);
  await p.waitForTimeout(400);

  const home = await p.evaluate(() => {
    const note = document.getElementById('mNote');
    const r = note && note.getBoundingClientRect();
    return {
      text: note && note.textContent,
      visible: !!(r && r.height > 0),
      hasXNote: !!document.getElementById('xNote'),
      hasRNote: !!document.getElementById('rNote')
    };
  });
  await p.evaluate(() => { var t = document.getElementById('appToast'); if (t) t.classList.remove('on'); });
  await p.screenshot({ path: 'shots_v6/01_home.png' });

  const card = await p.evaluate(() => {
    const m = window.__mlmg;
    const dataUrl = m.drawShareNoteCard({ line: m.NOTE.SLOGAN, hint: m.NOTE.HINT });
    return { ok: dataUrl.indexOf('data:image/jpeg') === 0, dataUrl: dataUrl };
  });
  if (!card.ok) throw new Error('promo card failed');
  fs.writeFileSync('shots_v6/00_promo_card.jpg', Buffer.from(card.dataUrl.split(',')[1], 'base64'));

  // mock xhs on home, click share, ensure postNote is used and has no snapshot
  const homePost = await p.evaluate(async () => {
    const calls = { temp: [], note: [], comment: [] };
    window.xhs = {
      miniTool: {
        writeTempFile: function (opts) { calls.temp.push({ hasData: !!(opts && opts.data) }); return Promise.resolve({ filePath: '/tmp/promo.jpg' }); },
        postNote: function (opts) { calls.note.push(JSON.parse(JSON.stringify(opts))); return Promise.resolve({ errMsg: 'postNote:ok' }); },
        interactionOpenApi: function () { calls.comment.push(1); return Promise.resolve({ routed: true }); }
      }
    };
    const btn = document.getElementById('mNote');
    btn.click();
    await new Promise(function (r) { setTimeout(r, 200); });
    const note = calls.note[0] || null;
    return {
      postNoteCalls: calls.note.length,
      commentCalls: calls.comment.length,
      title: note && note.title,
      content: note && note.content,
      pageType: note && note.pageType,
      filePath: note && note.mediaInfo && note.mediaInfo.image_resources && note.mediaInfo.image_resources[0].url,
      hasSnapshot: !!(note && (note.miniToolSnapshotInfo || (note.content && (note.content.indexOf('"v":') >= 0 || note.content.indexOf('miniToolSnapshotInfo') >= 0))))
    };
  });

  const exportInfo = await p.evaluate(() => {
    const m = window.__mlmg;
    const snap = MLMG_DEMO_GHOSTS[1];
    const d = m.M.decodeSnapshot(snap);
    m.editor.map = d.map;
    m.editor.rec = d.inputs;
    m.editor.recDeaths = [];
    m.editor.recReveal = {};
    m.openExport();
    const comment = document.getElementById('xXhs');
    comment && comment.scrollIntoView({ block: 'center' });
    return {
      noteBtn: !!document.getElementById('xNote'),
      commentText: comment && comment.textContent,
      commentPri: comment && comment.className.indexOf('pri') >= 0,
      hint: document.querySelector('#sExport .small:last-of-type') && document.querySelector('#sExport .col > .small:nth-last-child(2)').textContent,
      copyPri: document.getElementById('xCopy').className.indexOf('pri') >= 0,
      selfText: document.getElementById('xSelf') && document.getElementById('xSelf').textContent
    };
  });
  await p.evaluate(() => {
    var t = document.getElementById('appToast'); if (t) t.classList.remove('on');
    var btn = document.getElementById('xXhs'); if (btn) btn.scrollIntoView({ block: 'center' });
  });
  await p.waitForTimeout(250);
  await p.screenshot({ path: 'shots_v6/02_export.png' });

  const exportClick = await p.evaluate(async () => {
    const calls = { note: [], comment: [] };
    window.xhs = {
      miniTool: {
        writeTempFile: function (opts) { return Promise.resolve({ filePath: '/tmp/c.jpg' }); },
        postNote: function (opts) { calls.note.push(opts); return Promise.resolve({ errMsg: 'postNote:ok' }); },
        interactionOpenApi: function (opts) { calls.comment.push(opts); return Promise.resolve({ routed: true }); }
      }
    };
    document.getElementById('xXhs').click();
    await new Promise(function (r) { setTimeout(r, 200); });
    const c = calls.comment[0];
    return {
      postNoteCalls: calls.note.length,
      commentCalls: calls.comment.length,
      hasSnapshot: !!(c && c.payload && c.payload.miniToolSnapshotInfo)
    };
  });

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
    m.showResult();
    return {
      noteBtn: !!document.getElementById('rNote'),
      commentBtn: !!document.getElementById('rXhs'),
      copy: !!(document.getElementById('rCopy') && document.getElementById('rCopy').getBoundingClientRect().height > 0),
      make: document.getElementById('rMake') && document.getElementById('rMake').textContent,
      rBig: document.getElementById('rBig') && document.getElementById('rBig').textContent
    };
  });
  await p.evaluate(() => { var t = document.getElementById('appToast'); if (t) t.classList.remove('on'); });
  await p.waitForTimeout(200);
  await p.screenshot({ path: 'shots_v6/03_result.png' });

  const resultClick = await p.evaluate(async () => {
    const calls = { note: 0 };
    window.xhs = { miniTool: { postNote: function () { calls.note++; return Promise.resolve({}); } } };
    const make = document.getElementById('rMake');
    make.click();
    await new Promise(function (r) { setTimeout(r, 50); });
    return { postNoteCalls: calls.note, onEditor: document.getElementById('sPlay').classList.contains('on') && window.__mlmg.editor.on };
  });

  console.log(JSON.stringify({ home, homePost, exportInfo, exportClick, resultInfo, resultClick, errs }, null, 2));
  const real = errs.filter(e => e.indexOf('404') < 0 && e.indexOf('File not found') < 0);
  if (real.length) { console.error('page errors', real); process.exit(1); }
  if (!home.visible || home.text.indexOf('分享这个游戏到笔记') < 0) { console.error('home button missing', home); process.exit(1); }
  if (home.hasXNote || home.hasRNote || exportInfo.noteBtn || resultInfo.noteBtn || resultInfo.commentBtn) {
    console.error('unexpected note buttons', { home, exportInfo, resultInfo }); process.exit(1);
  }
  if (homePost.postNoteCalls !== 1 || homePost.hasSnapshot || homePost.commentCalls !== 0) {
    console.error('home postNote unexpected', homePost); process.exit(1);
  }
  if (exportClick.postNoteCalls !== 0 || !exportClick.hasSnapshot) {
    console.error('export should comment not postNote', exportClick); process.exit(1);
  }
  if (!resultClick.onEditor || resultClick.postNoteCalls !== 0) {
    console.error('我也造一关 should open editor, not postNote', resultClick); process.exit(1);
  }
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
