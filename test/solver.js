// Beam search over macro-actions (hold an input for K ticks). Returns a valid clearing input sequence or null.
var M = require('../src/engine.js');
var ACTS = [0, M.IN.R, M.IN.L, M.IN.R | M.IN.J, M.IN.L | M.IN.J, M.IN.J];
function solve(map, K, maxLayers, W) {
  K = K || 4; maxLayers = maxLayers || 300; W = W || 1500;
  var gi = -1; for (var i = 0; i < map.length; i++) if (map[i] === M.TILE.GL) gi = i;
  var gx = (gi % M.COLS) * M.T + 512, gy = ((gi / M.COLS) | 0) * M.T + 512;
  function hh(w) { return Math.abs(w.x + 320 - gx) + Math.abs(w.y + 400 - gy) * 0.5; }
  var start = new M.World(map), seen = new Set([start.key()]);
  var layer = [{ w: start, path: null }];
  for (var d = 0; d < maxLayers && layer.length; d++) {
    var next = [];
    for (var n of layer) for (var a of ACTS) {
      var w = n.w.clone(), res = 0, used = 0;
      for (var k = 0; k < K; k++) { res = w.step(a); used++; if (res) break; }
      if (res === 1) continue;
      var path = { a: a, n: used, prev: n.path };
      if (res === 2) { var seq = []; for (var p = path; p; p = p.prev) seq.push(p); seq.reverse(); var inputs = [];
        seq.forEach(function (s) { for (var j = 0; j < s.n; j++) inputs.push(s.a); }); return Uint8Array.from(inputs); }
      var key = w.key(); if (seen.has(key)) continue; seen.add(key); next.push({ w: w, path: path, h: hh(w) });
    }
    if (next.length > W) { next.sort(function (x, y) { return x.h - y.h; }); next.length = W; }
    layer = next;
  }
  return null;
}
module.exports = solve;
