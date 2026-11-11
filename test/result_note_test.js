const assert = require('assert');
const path = require('path');
const { chromium } = require('playwright-core');
(async () => {
  const server = require('http').createServer((req, res) => {
    const file = path.join(path.resolve('dist'), new URL(req.url, 'http://localhost').pathname);
    require('fs').readFile(file.endsWith('/') ? file + 'index.html' : file, (err, data) => {
      res.statusCode = err ? 404 : 200; res.end(err ? '' : data);
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] }).catch(e => { server.close(); throw e; });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto('http://127.0.0.1:' + server.address().port + '/index.html');
    await page.waitForFunction(() => window.__mlmg);
    const result = await page.evaluate(async () => {
      window.__mlmgPause = true;
      const m = window.__mlmg;
      m.playDemo(0);
      const inputs = m.M.decodeSnapshot(MLMG_DEMO_GHOSTS[0]).inputs;
      for (const s of inputs) {
        m.held.L = !!(s & 1); m.held.R = !!(s & 2); m.held.J = !!(s & 4);
        m.stepGame();
      }
      m.showResult();
      const calls = { temp: [], note: [], comment: 0 };
      let finish;
      window.xhs = { miniTool: {
        writeTempFile: opts => { calls.temp.push(opts.data); return Promise.resolve({ filePath: 'mock-result-image' }); },
        postNote: opts => { calls.note.push(opts); return new Promise(resolve => { finish = resolve; }); },
        interactionOpenApi: () => { calls.comment++; return Promise.resolve({ routed: true }); }
      } };
      const btn = document.getElementById('rNote');
      const card = document.getElementById('rCard').src;
      const score = document.getElementById('rShare').getAttribute('data-t');
      btn.click(); btn.click();
      await new Promise(r => setTimeout(r, 30));
      const busy = btn.disabled;
      finish({ errMsg: 'postNote:ok' });
      await new Promise(r => setTimeout(r, 30));
      const successMsg = document.getElementById('rMsg').textContent;
      window.xhs.miniTool.postNote = () => Promise.reject({ errMsg: 'cancelled' });
      btn.click();
      await new Promise(r => setTimeout(r, 30));
      const failed = { enabled: !btn.disabled, message: document.getElementById('rMsg').textContent };
      window.xhs = undefined;
      btn.click();
      return { calls, card, score, busy, successMsg, failed, missing: document.getElementById('rMsg').textContent, label: btn.textContent };
    });
    assert.equal(result.label, '发布笔记');
    assert.equal(result.calls.note.length, 1, 'double tap must not publish twice');
    assert.equal(result.calls.comment, 0);
    assert.equal(result.calls.temp[0], result.card, 'must share current result card');
    const note = result.calls.note[0];
    assert(note.content.includes(result.score));
    assert(note.content.includes('示范关'));
    assert(note.title.length <= 20 && note.content.length <= 1000);
    assert.equal(note.mediaInfo.image_resources[0].url, 'mock-result-image');
    assert(!note.miniToolSnapshotInfo);
    assert(result.busy && result.failed.enabled);
    assert(result.successMsg.includes('关卡已保存'));
    assert(result.failed.message.includes('cancelled'));
    assert(result.missing.includes('小红书 App'));
    assert.deepEqual(errors, []);
    // A fresh WebView must recover the pending snapshot, not require a new run.
    await page.reload();
    await page.waitForFunction(() => document.getElementById('pendingShare').style.display !== 'none');
    const restored = await page.evaluate(async () => {
      window.confirm = () => true;
      const calls = [];
      window.xhs = { miniTool: {
        writeTempFile: () => Promise.resolve({ filePath: 'mock-pending-image' }),
        interactionOpenApi: opts => { calls.push(opts); return Promise.resolve({ routed: true }); }
      } };
      const button = document.getElementById('pendingPost');
      button.click(); button.click();
      await new Promise(r => setTimeout(r, 30));
      const snapshot = calls[0].payload.miniToolSnapshotInfo;
      const decoded = MLMG.decodeSnapshot(snapshot);
      const retained = !!JSON.parse(localStorage.getItem('mlmg_pending_share_v1'));
      const msg = document.getElementById('pendingMsg').textContent;
      document.getElementById('pendingClear').click();
      await new Promise(r => setTimeout(r, 30));
      return { count: calls.length, cells: Array.from(decoded.map), expected: Array.from(MLMG.parseRows(MLMG_LEVELS[0].rows)), retained, msg, cleared: document.getElementById('pendingShare').style.display === 'none' };
    });
    assert.equal(restored.count, 1);
    assert.deepEqual(restored.cells, restored.expected);
    assert(restored.retained && restored.cleared);
    assert(restored.msg.includes('请确认发送'));
    await page.reload();
    await page.waitForFunction(() => window.__mlmg);
    assert.equal(await page.locator('#pendingShare').isVisible(), false);
    await page.screenshot({ path: '/workspace/redapp-skill-audit/result-note-preview.png', fullPage: true });
    console.log('PASS: result note, persistence across reload, same-level comment snapshot, duplicate prevention, explicit cleanup');
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
