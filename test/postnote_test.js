var fs = require('fs'), path = require('path');
var pass = 0, fail = 0;
function ok(c, msg) { if (c) pass++; else { fail++; console.log('  FAIL: ' + msg); } }

function loadXHS(miniTool) {
  var plat = path.resolve(__dirname, '../src/platform.js');
  delete require.cache[require.resolve(plat)];
  global.window = { xhs: miniTool ? { miniTool: miniTool } : undefined };
  global.document = {
    documentElement: { className: '', style: { setProperty: function () {} } },
    getElementById: function () { return { style: {} }; },
    createElement: function () { return { style: {}, appendChild: function () {}, scrollHeight: 0 }; },
    body: { appendChild: function () {} }
  };
  global.location = { search: '', href: 'http://local/index.html', origin: 'http://local', pathname: '/index.html', hash: '', protocol: 'http:' };
  return require(plat);
}

var TITLE = '造关坑人，留影子等人翻车';
var CONTENT = '自己出坑关，自己先通关，把影子留给下一个人追。\n\n打开这篇笔记里的小工具就能玩：先挑战示范关，或自己造一关。想让别人来跑你的关，请从挂着本工具的笔记里打开，再把关卡发到评论。\n\n#我的关我的影子';

console.log('== 4. 页面结构：postNote 支持首页与结算页 ==');
(function () {
  var html = fs.readFileSync(path.resolve(__dirname, '../src/template_v4.html'), 'utf8');
  var ui = fs.readFileSync(path.resolve(__dirname, '../src/ui_v3.js'), 'utf8');
  function hasId(id) { return html.indexOf('id="' + id + '"') >= 0; }
  var menuSlice = html.slice(html.indexOf('id="sMenu"'), html.indexOf('id="sLevels"'));
  var exportSlice = html.slice(html.indexOf('id="sExport"'), html.indexOf('id="sImport"'));
  var resultSlice = html.slice(html.indexOf('id="sResult"'));
  ok(menuSlice.indexOf('id="mNote"') >= 0 && menuSlice.indexOf('分享这个游戏到笔记') >= 0, 'home has 分享这个游戏到笔记');
  ok(exportSlice.indexOf('id="xNote"') < 0 && resultSlice.indexOf('id="rNote"') >= 0 && resultSlice.indexOf('id="rXhs"') < 0, 'export keeps comments and result has note button');
  ok(exportSlice.indexOf('id="xXhs"') >= 0 && exportSlice.indexOf('把关卡发到评论') >= 0, 'export primary is 把关卡发到评论');
  ok(exportSlice.indexOf('需从挂着本工具的笔记里打开') >= 0, 'export has host-note hint');
  ok(resultSlice.indexOf('我也造一关') >= 0 && resultSlice.indexOf('id="rNote"') >= 0 && resultSlice.indexOf('发布笔记') >= 0 && resultSlice.indexOf('id="rCopy"') < 0, 'result offers 发布笔记 and 我也造一关');
  ok(exportSlice.indexOf('class="pri" id="xXhs"') >= 0 || /id="xXhs"[^>]*class="[^"]*pri/.test(exportSlice) || /class="pri" id="xXhs"/.test(exportSlice), 'comment button is primary');
  ok(exportSlice.indexOf('class="pri" id="xCopy"') < 0, 'copy is not primary');
  ok(ui.indexOf("publishNote('export')") < 0 && ui.indexOf('publishNote("export")') < 0, 'ui does not call publishNote from export');
  ok(ui.indexOf("publishNote('result')") >= 0, 'ui publishes note from result');
  ok(/\$\('mNote'\)\)\s*\$\('mNote'\)\.onclick\s*=\s*function\s*\(\)\s*\{\s*publishNote\(\)/.test(ui) || ui.indexOf("$('mNote').onclick = function () { publishNote(); }") >= 0, 'home note binding preserved');
  ok(ui.indexOf('miniToolSnapshotInfo') < 0 || ui.indexOf('XHS.postNote') >= 0, 'postNote path exists');
  ok(ui.indexOf('NOTE.CONTENT') >= 0 && ui.indexOf('snapshot: exportJson') < 0 && ui.indexOf('snapshot: g && g.snapshot') < 0, 'postNote helper does not pass snapshot');
})();

console.log('== 5. postNote 载荷（仅推广游戏，不含快照） ==');
(function () {
  var XHS = loadXHS(null);
  ok(!XHS.canPostNote(), 'missing xhs => canPostNote false');
  return XHS.postNote({ title: TITLE, content: CONTENT, dataUrl: 'data:image/jpeg;base64,xx' }).then(function () {
    ok(false, 'missing postNote should reject');
  }).catch(function (err) {
    ok(err && err.message === '请在小红书 App 里打开小工具', 'missing postNote toast text: ' + (err && err.message));
  });
})().then(function () {
  var calls = { temp: [], note: [] };
  var XHS = loadXHS({
    writeTempFile: function (opts) { calls.temp.push(opts); return Promise.resolve({ filePath: '/tmp/mlmg-promo.jpg' }); },
    postNote: function (opts) { calls.note.push(opts); return Promise.resolve({ errMsg: 'postNote:ok' }); }
  });
  ok(XHS.canPostNote(), 'postNote present => canPostNote true');
  var dataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
  return XHS.postNote({ title: TITLE, content: CONTENT, dataUrl: dataUrl, pageType: 'photo_publish' }).then(function (res) {
    ok(res && res.errMsg === 'postNote:ok', 'resolves when APIs succeed');
    ok(calls.temp.length === 1 && calls.temp[0].data === dataUrl, 'writeTempFile got jpeg data URL');
    ok(calls.note.length === 1, 'postNote called once');
    var p = calls.note[0];
    ok(p.title === TITLE && p.title.length <= 20, 'title intact and ≤20');
    ok(p.content === CONTENT && p.content.length <= 1000, 'content intact and ≤1000');
    ok(p.pageType === 'photo_publish', 'pageType is photo_publish');
    ok(p.mediaInfo && p.mediaInfo.image_resources && p.mediaInfo.image_resources[0].url === '/tmp/mlmg-promo.jpg', 'image url is writeTempFile filePath');
    ok(p.content.indexOf('miniToolSnapshotInfo') < 0 && p.content.indexOf('"v":') < 0 && p.content.indexOf('"m":') < 0, 'content has no snapshot JSON');
    ok(!p.miniToolSnapshotInfo && !(p.mediaInfo && p.mediaInfo.miniToolSnapshotInfo), 'payload has no snapshot field');
  });
}).then(function () {
  var XHS = loadXHS({
    writeTempFile: function () { return Promise.resolve({ filePath: '/tmp/a.jpg' }); },
    postNote: function (opts) {
      ok(opts.title.length === 20, 'overlong title clipped to 20, got ' + opts.title.length);
      ok(opts.content.length === 1000, 'overlong content clipped to 1000, got ' + opts.content.length);
      return Promise.resolve({ errMsg: 'postNote:ok' });
    }
  });
  var longTitle = '一二三四五六七八九十一二三四五六七八九十超出';
  var longContent = '';
  for (var i = 0; i < 1200; i++) longContent += '字';
  return XHS.postNote({ title: longTitle, content: longContent, dataUrl: 'data:image/jpeg;base64,xx' });
}).then(function () {
  var err = { errMsg: 'postNote:fail denied', errCode: 10001 };
  var XHS = loadXHS({
    writeTempFile: function () { return Promise.resolve({ filePath: '/tmp/a.jpg' }); },
    postNote: function () { return Promise.reject(err); }
  });
  return XHS.postNote({ title: 't', content: 'c', dataUrl: 'data:image/jpeg;base64,xx' }).then(function () {
    ok(false, 'failed postNote should reject');
  }).catch(function (e) {
    ok(e === err && e.errCode === 10001, 'failure keeps errCode');
  });
}).then(function () {
  console.log('\npostNote 结果: ' + pass + ' 通过, ' + fail + ' 失败');
  process.exit(fail ? 1 : 0);
}).catch(function (e) {
  console.log('  FAIL: unexpected ' + (e && e.stack || e));
  process.exit(1);
});
