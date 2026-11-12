/* v17: enclosed rooms and tighter approach/chase timing; rule v11. */
var MLMG_TEMPLATES = [
  { id: 'flat', name: '直走过', rows: [
    '............',
    '............',
    '............',
    '............',
    '....####....',
    'S.........G.',
    '############',
    '############'] },
  { id: 'two', name: '上下两层', rows: [
    '............',
    '............',
    '............',
    '............',
    '....########',
    'S..........G',
    '############',
    '############'] },
  { id: 'up', name: '终点在上层', rows: [
    '............',
    '............',
    '............',
    '..........G.',
    '....########',
    'S...........',
    '############',
    '############'] }
];
// Build room geometry from named positions. Rule-v11 gates derive from these markers and the exit.
function MLMG_BUILD_ROOM(spec) {
  if (!spec || !Number.isInteger(spec.start) || !Number.isInteger(spec.exit) || spec.start < 0 || spec.start >= 12 || spec.exit < 0 || spec.exit >= 12 || spec.start === spec.exit || !Array.isArray(spec.traps) || spec.traps.length > 3) throw new Error('房间参数不合法');
  var occupied = {};
  spec.traps.forEach(function (p) { if (!p || !Number.isInteger(p.column) || p.column < 0 || p.column >= 12 || ['o', 'm', 'e', 'p'].indexOf(p.tile) < 0 || occupied[p.column]) throw new Error('机关位置不合法'); occupied[p.column] = true; });
  var rows = [], r, c;
  for (r = 0; r < 8; r++) { var row = []; for (c = 0; c < 12; c++) row.push(r < 2 || r >= 6 ? '#' : '.'); rows.push(row); }
  rows[5][spec.start] = 'S'; rows[5][spec.exit] = 'G';
  spec.traps.forEach(function (p) { rows[6][p.column] = p.tile; });
  return rows.map(function (row) { return row.join(''); });
}
var MLMG_ROOM_SPECS = [
  { start: 1, exit: 10, traps: [{ column: 8, tile: 'o' }] },
  { start: 2, exit: 11, traps: [{ column: 7, tile: 'o' }, { column: 10, tile: 'o' }] },
  { start: 1, exit: 8, traps: [{ column: 6, tile: 'm' }] },
  { start: 0, exit: 9, traps: [{ column: 1, tile: 'e' }] },
  { start: 0, exit: 11, traps: [{ column: 0, tile: 'p' }] }
];
var MLMG_LEVELS = [
  { name: '房间 1', hint: '门前的路会变化；记住位置，提前跳。' },
  { name: '房间 2', hint: '越过第一处后，留意下一步；中间可以落脚。' },
  { name: '房间 3', hint: '坑会靠向起跳位置，提前跳过去。' },
  { name: '房间 4', hint: '越过小坑后继续前进，到出口稳地就安全。' },
  { name: '房间 5', hint: '逃离身后的变化后，前面的地面还会变。' }
];
MLMG_LEVELS.forEach(function (room, i) { room.rows = MLMG_BUILD_ROOM(MLMG_ROOM_SPECS[i]); });
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MLMG_LEVELS;
  module.exports.templates = MLMG_TEMPLATES;
  module.exports.buildRoom = MLMG_BUILD_ROOM;
  module.exports.roomSpecs = MLMG_ROOM_SPECS;
}
