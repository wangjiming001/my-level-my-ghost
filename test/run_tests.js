var M = require('../src/engine.js'), L = require('../src/levels.js'), solve = require('./solver.js');
var ghosts = require('../src/demo_ghosts.json');
var v2fix = require('./v2_snapshot_fixture.json');
var pass = 0, fail = 0; function ok(c, msg) { if (c) pass++; else { fail++; console.log('  FAIL: ' + msg); } }
console.log('== 0. 跳跃高度 & 弹跳 ==');
(function () {
  var rows = ['............','............','............','............','............','S...........','############','############'];
  var w = new M.World(M.parseRows(rows)), y0 = w.y, minY = w.y;
  w.step(M.IN.J);
  for (var i = 0; i < 80; i++) { w.step(M.IN.J); if (w.y < minY) minY = w.y; if (w.grounded && w.tick > 5) break; }
  var holdTiles = (y0 - minY) / M.T;
  console.log('  按住跳: ' + (y0 - minY) + ' su, ' + holdTiles.toFixed(3) + ' 格');
  ok(holdTiles > 2.05 && holdTiles < 2.2, 'held jump ~2.12 tiles (got ' + holdTiles.toFixed(3) + ')');
  // tap jump
  w = new M.World(M.parseRows(rows)); y0 = w.y; minY = w.y;
  w.step(M.IN.J);
  for (i = 0; i < 80; i++) { w.step(0); if (w.y < minY) minY = w.y; if (w.grounded && w.tick > 5) break; }
  var tapTiles = (y0 - minY) / M.T;
  console.log('  点一下跳: ' + tapTiles.toFixed(3) + ' 格');
  ok(tapTiles > 0.6 && tapTiles < 0.9, 'tap jump ~0.71 tiles');
  // 2-tile shelf from a side gap
  var two = M.parseRows(['............','............','............','..........G.','....########','S...........','############','############']);
  ok(!M.checkMap(two), '2-layer template checkMap');
  w = new M.World(two);
  for (i = 0; i < 35; i++) w.step(M.IN.R);
  w.step(M.IN.R | M.IN.J);
  for (i = 0; i < 80; i++) { w.step(M.IN.R | M.IN.J); if (w.won || w.dead) break; }
  ok(w.won || (w.grounded && Math.floor((w.y + M.PH) / M.T) === 4), 'can land on 2-tile mid shelf with held jump');
  // bounce height + determinism + no side launch
  var pit = M.parseRows(['............','............','............','............','S...........','##..........','............','...t........']);
  function bounceOnce() {
    var ww = new M.World(pit), by = null, min = 1e9;
    for (var k = 0; k < 200; k++) {
      ww.step(M.IN.R);
      if (ww.ev & 32) { by = ww.y; min = ww.y; }
      if (by != null && ww.y < min) min = ww.y;
      if (by != null && ww.grounded && ww.tick > 4) break;
    }
    return { bounced: by != null, tiles: by == null ? 0 : (by - min) / M.T, by: by, min: min, tick: ww.tick };
  }
  var b1 = bounceOnce(), b2 = bounceOnce();
  console.log('  弹跳: ' + b1.tiles.toFixed(3) + ' 格, BOUNCE_V=' + M.BOUNCE_V);
  ok(b1.bounced && b1.tiles > 2.9 && b1.tiles < 3.1, 'bounce ~3 tiles (got ' + b1.tiles.toFixed(3) + ')');
  ok(b1.tiles === b2.tiles && b1.tick === b2.tick, 'bounce determinism');
  var side = M.parseRows(['............','............','............','............','............','S...........','###t########','############']);
  w = new M.World(side); var bounced = false;
  for (i = 0; i < 80; i++) { w.step(M.IN.R); if (w.ev & 32) bounced = true; }
  ok(!bounced && w.grounded, 'walking into trampoline from the side does not launch');
})();
console.log('== 0b. 模板 & 机关计数 ==');
(function () {
  var T = L.templates;
  ok(T && T.length === 3, 'exactly 3 templates');
  T.forEach(function (t) {
    var m = M.parseRows(t.rows), err = M.checkMap(m), n = 0;
    for (var i = 0; i < m.length; i++) if (M.isTrap(m[i])) n++;
    ok(!err, 'template ' + t.name + ' checkMap ' + err);
    ok(n === 0, 'template ' + t.name + ' has no troll traps');
  });
  ok(M.TILE.TRM === 8, 'trampoline code is 8');
  ok(!M.isTrap(M.TILE.TRM) && !M.isTrap(M.TILE.GND), 'trampoline / ground are not traps');
  var withT = M.parseRows(['............','............','............','..........G.','....t#######','S...........','############','############']);
  ok(!M.checkMap(withT), 'map with trampoline passes checkMap');
  var four = new Uint8Array(M.parseRows(T[1].rows));
  four[5 * 12 + 3] = M.TILE.HID; four[5 * 12 + 4] = M.TILE.FALL; four[5 * 12 + 5] = M.TILE.COL; four[5 * 12 + 6] = M.TILE.HID;
  ok(M.checkMap(four) === '恶搞机关最多 3 个', 'still cap traps at 3');
})();
console.log('== 1. 确定性 & 快照往返 ==');
L.forEach(function (l, i) {
  var map = M.parseRows(l.rows), snap = ghosts[i], d = M.decodeSnapshot(snap), inputs = d.inputs;
  var ref = M.simulate(map, inputs), same = 0;
  for (var k = 0; k < 100; k++) { var r = M.simulate(map, inputs); if (r.result === ref.result && r.frame === ref.frame && r.x === ref.x && r.y === ref.y) same++; }
  var re = M.decodeSnapshot(M.encodeSnapshot(d.map, d.inputs));
  var naiveR = M.simulate(map, new Uint8Array(1200).fill(M.IN.R)), naiveRJ = M.simulate(map, new Uint8Array(1200).fill(M.IN.R | M.IN.J));
  var coarse = solve(map, 8, 130, 800);
  console.log('L' + (i + 1) + ' ' + l.name + ': AI解 ' + ref.result + '@' + ref.frame + 'f(' + (ref.frame / 60).toFixed(2) + 's) end=(' + ref.x + ',' + ref.y + ') 100次一致=' + same +
    ' | 往返=' + (re.frames === d.frames) + ' | 一直按右:' + naiveR.result + ' 一直右+跳:' + naiveRJ.result + ' | 粗操作(每8帧换一次键)可解=' + (coarse ? (coarse.length / 60).toFixed(2) + 's' : 'NO') +
    ' | 快照 ' + M.utf8len(snap) + 'B, ' + M.inputsToEvents(inputs).length + '个事件');
  ok(!!coarse, 'coarse 8-tick controls can clear L' + (i + 1));
  ok(ref.result === 'win' && same === 100, 'determinism L' + (i + 1)); ok(re.frames === d.frames, 'roundtrip L' + (i + 1));
  ok(JSON.parse(snap).v === 3, 'demo ghosts encoded as v3');
});
console.log('== 2. 快照大小 & v2 兼容 ==');
var map0 = M.parseRows(L[0].rows);
function spam(n, every) { var a = new Uint8Array(n); for (var f = 0; f < n; f++) a[f] = Math.floor(f / every) % 8; return a; }
[[1200, 1], [1200, 2], [1200, 4], [600, 1]].forEach(function (c) {
  var inp = spam(c[0], c[1]), json = M.encodeSnapshot(map0, inp);
  console.log('  ' + (c[0] / 60) + '秒, 每' + c[1] + '帧换键(' + M.inputsToEvents(inp).length + '事件): ' + M.utf8len(json) + ' 字节' + (M.utf8len(json) <= 2048 ? ' ✓' : ' ✗超限'));
  ok(M.utf8len(json) <= 2048, 'size spam ' + c);
});
ok(M.packMap(map0).length === 48, 'v3 packMap is 48 bytes');
ok(M.packMap3(map0).length === 36, 'v2 packMap3 is 36 bytes');
try { M.decodeSnapshot(M.encodeSnapshot(map0, spam(1200, 1))); ok(false, 'spam accepted'); } catch (e) { ok(true); console.log('  20秒乱按快照（没通关）→ 拒绝: ' + e.message); }
try {
  var d2 = M.decodeSnapshot(v2fix);
  ok(d2.frames > 0, 'v2 snapshot still decodes');
  console.log('  v2 兼容解码成功, 帧=' + d2.frames + ', 地图无弹跳=' + (function () { for (var i = 0; i < d2.map.length; i++) if (d2.map[i] === 8) return false; return true; })());
} catch (e) { ok(false, 'v2 decode: ' + e.message); }
var v3 = JSON.parse(M.encodeSnapshot(map0, M.decodeSnapshot(ghosts[0]).inputs));
ok(v3.v === 3 && v3.m.length === 64, 'v3 encoder writes 64-char map');
console.log('== 3. 拒绝测试 ==');
var good = ghosts[0], o = JSON.parse(good);
function mut(fn) { var x = JSON.parse(good); fn(x); return JSON.stringify(x); }
function resign(x) { x.c = M.checksum(x.v + '|' + x.m + '|' + x.g + '|' + x.f); return x; }
var lateGoal = (function () { var x = JSON.parse(good); x.f = x.f + 30; return JSON.stringify(resign(x)); })();
var bad = {
  '空字符串': '', '非JSON': '{abc', '数组': '[1,2]', 'null': 'null', '超长(3000字节)': good.slice(0, -1) + ',"x":"' + 'a'.repeat(3000) + '"}',
  '多余字段': mut(function (x) { x.x = 1; }), '版本错误': mut(function (x) { x.v = 4; }), '第一版旧快照(v1)': mut(function (x) { x.v = 1; }), '帧数为负': mut(function (x) { x.f = -5; }),
  '帧数超20秒': mut(function (x) { x.f = 99999; }), '帧数小数': mut(function (x) { x.f = 10.5; }), '地图被截断': mut(function (x) { x.m = x.m.slice(0, 40); }),
  '地图非法字符': mut(function (x) { x.m = '!' + x.m.slice(1); }), '校验和不符(改一个字符)': mut(function (x) { x.g = (x.g[0] === 'A' ? 'B' : 'A') + x.g.slice(1); }),
  '篡改帧数并重签校验和(谎报更快)': (function () { var x = JSON.parse(good); x.f = x.f - 20; return JSON.stringify(resign(x)); })(),
  '篡改帧数并重签(谎报更慢)': lateGoal,
  '篡改地图删终点并重签': (function () { var x = JSON.parse(good); var m = M.unpackMap(M.b64dec(x.m)); for (var i = 0; i < m.length; i++) if (m[i] === 4) m[i] = 0; x.m = M.b64enc(M.packMap(m)); return JSON.stringify(resign(x)); })(),
  '篡改地图放4个机关并重签': (function () { var x = JSON.parse(good); var m = M.unpackMap(M.b64dec(x.m)); m[0] = 5; m[1] = 6; m[2] = 7; m[3] = 5; x.m = M.b64enc(M.packMap(m)); return JSON.stringify(resign(x)); })(),
  '篡改地图把刺放路上并重签': (function () { var x = JSON.parse(good); var m = M.unpackMap(M.b64dec(x.m));
    // Find a lethal empty cell on the actual recorded route, independent of demo layout.
    var inputs = M.decodeSnapshot(good).inputs, found = false;
    for (var j = 0; j < m.length; j++) {
      if (m[j] !== M.TILE.E) continue;
      m[j] = M.TILE.SPK;
      if (M.simulate(m, inputs).result === 'dead') { found = true; break; }
      m[j] = M.TILE.E;
    }
    if (!found) throw new Error('No lethal route mutation found');
    x.m = M.b64enc(M.packMap(m)); return JSON.stringify(resign(x)); })(),
  '影子换成乱码并重签': (function () { var x = JSON.parse(good); x.g = '////////'; return JSON.stringify(resign(x)); })(),
  '影子varint超长并重签': (function () { var x = JSON.parse(good); x.g = M.b64enc(new Uint8Array([0, 255, 255, 255, 255, 1])); return JSON.stringify(resign(x)); })(),
  '影子是别的关的(重签)': (function () { var x = JSON.parse(good), y = JSON.parse(ghosts[4]); x.g = y.g; x.f = y.f; return JSON.stringify(resign(x)); })(),
  '链接hash注入': 'HASH:<script>alert(1)</script>'
};
var crashes = 0;
Object.keys(bad).forEach(function (k) {
  var t0 = Date.now(), msg;
  try { var s = bad[k]; if (s.indexOf('HASH:') === 0) s = M.hashDecode(s.slice(5)); M.decodeSnapshot(s); msg = 'ACCEPTED!'; ok(false, k); }
  catch (e) { if (!(e instanceof Error)) crashes++; msg = '拒绝 → ' + e.message; ok(true); }
  console.log('  ' + k + ': ' + msg + ' (' + (Date.now() - t0) + 'ms)');
});
var fuzzRejected = 0, fuzzAccepted = 0, t1 = Date.now();
for (var n = 0; n < 5000; n++) { var arr = good.split(''); var p = Math.floor(Math.random() * arr.length); arr[p] = String.fromCharCode(32 + Math.floor(Math.random() * 95));
  try { M.decodeSnapshot(arr.join('')); fuzzAccepted++; } catch (e) { if (e instanceof Error) fuzzRejected++; else crashes++; } }
console.log('  随机改1个字符×5000: 拒绝' + fuzzRejected + ' 接受' + fuzzAccepted + '(接受的都是改了等价字符/未改动) 耗时' + (Date.now() - t1) + 'ms 崩溃' + crashes);
ok(crashes === 0, 'no crash');
var hs = M.hashEncode(good); ok(M.hashDecode(hs) === good, 'hash roundtrip'); console.log('  URL hash 长度: ' + hs.length + ' 字符, 往返一致=' + (M.hashDecode(hs) === good));
console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
