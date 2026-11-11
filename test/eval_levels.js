var M = require('../src/engine.js'), solve = require('./solver.js');
module.exports = function evalLevel(rows) {
  var m = M.parseRows(rows), err = M.checkMap(m); if (err) return { err: err };
  var opt = solve(m, 4, 300), coarse = solve(m, 8, 160);
  var naive = [];
  naive.push(M.simulate(m, new Uint8Array(1200).fill(2)).result[0]);
  [8, 12, 16, 20, 26, 32, 40].forEach(function (N) { var a = new Uint8Array(1200); for (var f = 0; f < 1200; f++) a[f] = 2 | ((f % N) < N / 2 ? 4 : 0); naive.push(M.simulate(m, a).result[0]); });
  return { opt: opt ? (opt.length / 60).toFixed(2) : 'NO', coarse: coarse ? (coarse.length / 60).toFixed(2) : 'NO', naive: naive.join('') };
};
if (require.main === module) {
  var L = require(process.argv[2] ? require('path').resolve(process.argv[2]) : '../src/levels.js');
  L.forEach(function (l, i) { var t = Date.now(); console.log(i + 1, l.name, JSON.stringify(module.exports(l.rows)), (Date.now() - t) + 'ms'); });
}
