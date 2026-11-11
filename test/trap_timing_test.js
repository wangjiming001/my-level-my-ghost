var assert = require('assert'), M = require('../src/engine.js');
function map(rows) { return M.parseRows(rows); }
var hiddenMap = map(['............','............','............','............','............','S.....h....G','############','############']);
function hiddenWorld(version) { var m = new Uint8Array(hiddenMap); if (version) m.rulesVersion = version; var w = new M.World(m); w.y = 6 * M.T - M.PH; w.grounded = true; return w; }
var w = hiddenWorld(); w.x = 6 * M.T - M.PW - 200; w.step(0);
assert.equal(w.hidden[66], 0, 'v4 spike stays hidden 200 units before tile');
var old = hiddenWorld(3); old.x = 6 * M.T - M.PW - 200; old.step(0); assert.equal(old.hidden[66], 1, 'legacy threshold remains unchanged');
w.x = 6 * M.T - M.PW - 65; w.step(0); assert.equal(w.hidden[66], 0);
w.x = 6 * M.T - M.PW - 63; w.step(0); assert.equal(w.hidden[66], 1); assert(!w.dead, 'activation leaves approach space before damage');
w.reset(); assert.equal(w.hidden[66], 0); assert.equal(w.rulesVersion, M.VERSION);
w = hiddenWorld(); w.x = 6 * M.T; w.y = 5 * M.T + 380 - M.PH; w.grounded = false; w.step(0); assert.equal(w.hidden[66], 0, 'jumping well above spikes does not reveal them');
var blockMap = map(['............','............','......f.....','............','............','S..........G','############','############']);
function blockWorld(version) { var m = new Uint8Array(blockMap); if (version) m.rulesVersion = version; var w = new M.World(m); w.y = 6 * M.T - M.PH; w.grounded = true; return w; }
w = blockWorld(); w.x = 6 * M.T - M.PW - 300; w.step(0); assert.equal(w.blocks[0].st, 0, 'v4 block waits until player is underneath');
old = blockWorld(3); old.x = 6 * M.T - M.PW - 300; old.step(0); assert.equal(old.blocks[0].st, 1);
w.x = 6 * M.T + 96 - M.PW + 1; w.step(0); assert.equal(w.blocks[0].st, 1);
var copy = w.clone(); assert.equal(copy.rulesVersion, M.VERSION); assert.equal(copy.key(), w.key()); for (var i=0;i<35;i++) { assert.equal(copy.step(M.IN.L),w.step(M.IN.L)); assert.equal(copy.key(),w.key()); }
w.reset(); assert.equal(w.blocks[0].st, 0);
var saved = require('./v3_snapshot_fixture.json'), d = M.decodeSnapshot(saved);
assert.equal(d.version, 3); assert.equal(d.map.rulesVersion, 3);
assert.equal(M.simulate(d.map,d.inputs).result,'win');
assert.equal(JSON.parse(M.encodeSnapshot(d.map,d.inputs)).v,3,'resharing old map keeps its rules');
assert.equal(M.decodeSnapshot(require('./v2_snapshot_fixture.json')).version,2);
assert.equal(M.decodeSnapshot(require('./v4_snapshot_fixture.json')).version,4);
assert.equal(M.decodeSnapshot(require('./v5_snapshot_fixture.json')).version,5);
require('./v7_snapshot_fixtures.json').forEach(function (json) { assert.equal(M.decodeSnapshot(json).version,7); });
require('../src/demo_ghosts.json').forEach(function (json) { var a=M.decodeSnapshot(json); assert.equal(a.version,M.VERSION); assert(M.utf8len(json)<=2048); });
assert.equal(M.decodeSnapshot(require('./v6_snapshot_fixture.json')).version,6);
console.log('PASS: close-only spike/block triggers, airborne exclusion, reset/clone determinism, v2-v8 compatibility');
