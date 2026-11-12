var fs = require('fs'), path = require('path');
var M = require('./src/engine.js'), L = require('./src/levels.js'), solve = require('./test/solver.js'), acorn = require('acorn');

var ghosts = L.map(function (l, i) {
  // Beam pruning can miss valid fine-step routes; try a distinct coarse search too.
  var m = M.parseRows(l.rows), authored = M.VERSION >= 9 ? require('./test/v17_routes').route(i).inputs : i === 2 && M.VERSION === 8 ? require('./test/dynamic_pit_routes').baitRoute(m).inputs : null;
  var s = authored || solve(m, 4, 400, 3000) || solve(m, 8, 200, 1500);
  if (!s) throw new Error('unsolved ' + i + ' ' + l.name);
  var j = M.encodeSnapshot(m, s);
  M.decodeSnapshot(j);
  console.log('ghost', i, l.name, s.length + 'f', (s.length / 60).toFixed(2) + 's', M.utf8len(j) + 'B');
  return j;
});
fs.writeFileSync('src/demo_ghosts.json', JSON.stringify(ghosts));
fs.writeFileSync('src/demo_ghosts.js', 'var MLMG_DEMO_GHOSTS = ' + JSON.stringify(ghosts) + ';\n');

var files = {
  'src/engine.js': fs.readFileSync('src/engine.js', 'utf8'),
  'src/art.js': fs.readFileSync('src/art.js', 'utf8'),
  'src/atlas_meta.js': fs.readFileSync('src/atlas_meta.js', 'utf8'),
  'src/art3.js': fs.readFileSync('src/art3.js', 'utf8'),
  'src/levels.js': fs.readFileSync('src/levels.js', 'utf8'),
  'src/demo_ghosts.js': fs.readFileSync('src/demo_ghosts.js', 'utf8'),
  'src/platform.js': fs.readFileSync('src/platform.js', 'utf8'),
  'src/ui_v3.js': fs.readFileSync('src/ui_v3.js', 'utf8'),
  'src/style_v3.css': fs.readFileSync('src/style_v3.css', 'utf8')
};
Object.keys(files).forEach(function (k) {
  if (k.slice(-3) === '.js') acorn.parse(files[k], { ecmaVersion: 2017 });
});
console.log('acorn ES2017 ok');

function rmrf(d) {
  if (!fs.existsSync(d)) return;
  fs.readdirSync(d).forEach(function (f) {
    var p = path.join(d, f);
    if (fs.lstatSync(p).isDirectory()) rmrf(p); else fs.unlinkSync(p);
  });
}
// rebuild dist/ in place but never touch dist-submitted-v1.0.0 or the submitted zip
var dist = 'dist';
['js', 'css', 'assets'].forEach(function (d) {
  var dir = path.join(dist, d);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});
fs.writeFileSync(path.join(dist, 'index.html'), fs.readFileSync('src/template_v4.html'));
fs.writeFileSync(path.join(dist, 'css/style.css'), files['src/style_v3.css']);
fs.writeFileSync(path.join(dist, 'js/engine.js'), files['src/engine.js']);
fs.writeFileSync(path.join(dist, 'js/art.js'), files['src/art.js']);
fs.writeFileSync(path.join(dist, 'js/atlas_meta.js'), files['src/atlas_meta.js']);
fs.writeFileSync(path.join(dist, 'js/art3.js'), files['src/art3.js']);
fs.writeFileSync(path.join(dist, 'js/levels.js'), files['src/levels.js']);
fs.writeFileSync(path.join(dist, 'js/demo_ghosts.js'), files['src/demo_ghosts.js']);
fs.writeFileSync(path.join(dist, 'js/platform.js'), files['src/platform.js']);
fs.writeFileSync(path.join(dist, 'js/ui.js'), files['src/ui_v3.js']);
fs.copyFileSync('assets/atlas.png', path.join(dist, 'assets/atlas.png'));
fs.copyFileSync('assets/bg.jpg', path.join(dist, 'assets/bg.jpg'));
fs.copyFileSync('assets/hero06.png', path.join(dist, 'assets/hero06.png'));
fs.copyFileSync('assets/hero_black.png', path.join(dist, 'assets/hero_black.png'));
console.log('dist written');
