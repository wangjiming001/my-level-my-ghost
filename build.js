var fs = require('fs'), M = require('./src/engine.js'), L = require('./src/levels.js'), solve = require('./test/solver.js'), acorn = require('acorn');
var ghosts = L.map(function (l, i) { var m = M.parseRows(l.rows), s = solve(m, 4, 250, 800); if (!s) throw new Error('unsolved ' + i); var j = M.encodeSnapshot(m, s); M.decodeSnapshot(j); return j; });
fs.writeFileSync('src/demo_ghosts.json', JSON.stringify(ghosts));
var parts = { ENGINE: fs.readFileSync('src/engine.js', 'utf8'), ART: fs.readFileSync('src/art.js', 'utf8'), LEVELS: fs.readFileSync('src/levels.js', 'utf8'),
  DEMOGHOSTS: 'var MLMG_DEMO_GHOSTS = ' + JSON.stringify(ghosts) + ';', UI: fs.readFileSync('src/ui.js', 'utf8') };
for (var k in parts) acorn.parse(parts[k], { ecmaVersion: 2017 }); // old-WebView syntax guard
var html = fs.readFileSync('src/template.html', 'utf8').replace('/*CSS*/', function () { return fs.readFileSync('src/style.css', 'utf8'); });
for (k in parts) html = html.replace('/*' + k + '*/', function () { return parts[k]; });
if (/<script[^>]+src=|<link[^>]+href=|https?:\/\//.test(html)) console.warn('WARNING: external reference found');
fs.writeFileSync('prototype_v2.html', html); console.log('built prototype_v2.html', html.length, 'bytes');
