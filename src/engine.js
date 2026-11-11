/* 《我的关，我的影子》 engine: deterministic integer physics + snapshot codec.
   ES2017-safe (no ?. / ??, no modules). */
var MLMG = (function () {
  'use strict';
  var COLS = 12, ROWS = 8, T = 1024;           // 1 tile = 1024 sub-units
  var PW = 640, PH = 800;                      // player box
  // v2 feel: 40% faster run, accel/decel, crisp jump, heavier fall, variable height, coyote + buffer
  var SPEED = 56, ACC_G = 8, DEC_G = 12, ACC_A = 6, DEC_A = 4;
  var JUMPV = 150, G_UP_HOLD = 5, G_UP_REL = 14, G_DOWN = 9, MAXFALL = 220;
  var COYOTE = 6, JBUF = 6;
  var COLLAPSE_DELAY = 14;                     // ticks after first step
  var BLOCK_V0 = 24, BLOCK_G = 6, BLOCK_MAX = 200;
  var MAX_FRAMES = 1200;                       // 20 s @ 60 ticks/s
  var SNAP_VERSION = 4, SNAP_LIMIT = 2048, MAX_TRAPS = 3;
  // tile codes: 0-7 same as v2, 8 = trampoline (v3, 4-bit maps)
  var E = 0, GND = 1, SPK = 2, ST = 3, GL = 4, COL = 5, HID = 6, FALL = 7, TRM = 8;
  var BOUNCE_V = 300; // tuned so a no-hold bounce rises ~3 tiles
  var IN_L = 1, IN_R = 2, IN_J = 4;
  var CH = { '.': E, '#': GND, '^': SPK, 'S': ST, 'G': GL, 'c': COL, 'h': HID, 'f': FALL, 't': TRM };

  function parseRows(rows) {
    var m = new Uint8Array(COLS * ROWS);
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
      var ch = rows[r].charAt(c); if (!(ch in CH)) throw new Error('bad tile ' + ch);
      m[r * COLS + c] = CH[ch];
    }
    return m;
  }
  function isTrap(t) { return t === COL || t === HID || t === FALL; }
  // structural check shared by editor and snapshot loader
  function checkMap(m) {
    if (!m || m.length !== COLS * ROWS) return '地图尺寸不对';
    var s = 0, g = 0, traps = 0;
    for (var i = 0; i < m.length; i++) {
      var t = m[i]; if (t > 8 || t < 0 || (t | 0) !== t) return '格子类型非法';
      if (t === ST) s++; if (t === GL) g++; if (isTrap(t)) traps++;
    }
    if (s !== 1) return '需要且只能有 1 个起点';
    if (g !== 1) return '需要且只能有 1 个终点';
    if (traps > MAX_TRAPS) return '恶搞机关最多 ' + MAX_TRAPS + ' 个';
    return null;
  }

  function World(map) { this.map = map; this.rulesVersion = map.rulesVersion || SNAP_VERSION; this.reset(); }
  World.prototype.reset = function () {
    var m = this.map, i;
    this.tick = 0; this.cause = ''; this.killer = -1; this.lastCol = -1; this.ev = 0; this.face = 1; this.coyote = 0; this.jbuf = 0; this.dead = false; this.won = false; this.grounded = false;
    this.vx = 0; this.vy = 0; this.prevJ = false; this.jumpHeld = false; this.sprung = false;
    this.collapse = new Int16Array(COLS * ROWS); // 0 intact, >0 countdown, -1 gone
    this.hidden = new Uint8Array(COLS * ROWS);   // 1 = popped
    this.blocks = [];
    for (i = 0; i < m.length; i++) {
      if (m[i] === ST) { var c = i % COLS, r = (i / COLS) | 0;
        this.x = c * T + ((T - PW) >> 1); this.y = r * T + T - PH; }
      if (m[i] === FALL) this.blocks.push({ c: i % COLS, y: ((i / COLS) | 0) * T, vy: 0, st: 0 }); // st 0 idle,1 falling,2 landed,3 gone
    }
  };
  World.prototype.solid = function (c, r, skip) {
    if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return false;
    var i = r * COLS + c, t = this.map[i];
    if (t === GND || t === TRM) return true;
    if (t === COL && this.collapse[i] !== -1) return true;
    for (var k = 0; k < this.blocks.length; k++) {
      var b = this.blocks[k];
      if (b !== skip && (b.st === 0 || b.st === 2) && b.c === c && b.y === r * T) return true;
    }
    return false;
  };
  function fdiv(a) { return Math.floor(a / T); }
  function overlap(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }
  // returns 0 running, 1 died this tick, 2 won this tick
  World.prototype.step = function (inp) {
    if (this.dead || this.won) return 0;
    var L = (inp & IN_L) !== 0, R = (inp & IN_R) !== 0, J = (inp & IN_J) !== 0;
    var c, r, c0, c1, r0, r1, i, k;
    this.ev = 0; // render-only event bits: 1 jump, 2 land, 4 collapse start, 8 spike pop, 16 block fall
    var target = (R ? SPEED : 0) - (L ? SPEED : 0), wasG = this.grounded;
    var acc = wasG ? (target === 0 || (target > 0) !== (this.vx > 0) && this.vx !== 0 ? DEC_G : ACC_G) : (target === 0 ? DEC_A : ACC_A);
    if (this.vx < target) this.vx = Math.min(target, this.vx + acc); else if (this.vx > target) this.vx = Math.max(target, this.vx - acc);
    if (target !== 0) this.face = target > 0 ? 1 : -1;
    if (wasG) this.coyote = COYOTE; else if (this.coyote > 0) this.coyote--;
    if (J && !this.prevJ) this.jbuf = JBUF; else if (this.jbuf > 0) this.jbuf--;
    this.prevJ = J;
    if (this.jbuf > 0 && (wasG || this.coyote > 0)) { this.vy = -JUMPV; this.jbuf = 0; this.coyote = 0; this.grounded = false; this.sprung = false; this.ev |= 1; }
    if (this.sprung && this.vy >= 0) this.sprung = false;
    this.vy += this.vy < 0 ? (this.sprung ? G_UP_REL : (J ? G_UP_HOLD : G_UP_REL)) : G_DOWN; if (this.vy > MAXFALL) this.vy = MAXFALL;
    // X
    this.x += this.vx;
    if (this.x < 0) this.x = 0;
    if (this.x + PW > COLS * T) this.x = COLS * T - PW;
    r0 = fdiv(this.y); r1 = fdiv(this.y + PH - 1);
    if (this.vx > 0) { c = fdiv(this.x + PW - 1);
      for (r = r0; r <= r1; r++) if (this.solid(c, r)) { this.x = c * T - PW; break; }
    } else if (this.vx < 0) { c = fdiv(this.x);
      for (r = r0; r <= r1; r++) if (this.solid(c, r)) { this.x = (c + 1) * T; break; }
    }
    // Y
    this.y += this.vy; this.grounded = false;
    if (this.y < 0) { this.y = 0; if (this.vy < 0) this.vy = 0; }
    c0 = fdiv(this.x); c1 = fdiv(this.x + PW - 1);
    if (this.vy > 0) { r = fdiv(this.y + PH - 1);
      var hit = false, bounce = false;
      for (c = c0; c <= c1; c++) if (this.solid(c, r)) { hit = true; if (c >= 0 && c < COLS && r >= 0 && r < ROWS && this.map[r * COLS + c] === TRM) bounce = true; }
      if (hit) {
        this.y = r * T - PH;
        if (bounce && !wasG) { this.vy = -BOUNCE_V; this.grounded = false; this.sprung = true; this.ev |= 32; }
        else { if (!wasG) this.ev |= 2; this.vy = 0; this.grounded = true; this.sprung = false; }
      }
    } else if (this.vy < 0) { r = fdiv(this.y);
      for (c = c0; c <= c1; c++) if (this.solid(c, r)) { this.y = (r + 1) * T; this.vy = 0; break; }
    }
    // collapse floors: trigger when standing on them
    if (this.grounded) { r = fdiv(this.y + PH);
      if (r >= 0 && r < ROWS) for (c = c0; c <= c1; c++) { i = r * COLS + c;
        if (this.map[i] === COL && this.collapse[i] === 0) { this.collapse[i] = COLLAPSE_DELAY; this.ev |= 4; } if (this.map[i] === COL) this.lastCol = i; }
    }
    for (i = 0; i < this.collapse.length; i++) if (this.collapse[i] > 0) { this.collapse[i]--; if (this.collapse[i] === 0) this.collapse[i] = -1; }
    // hidden spikes pop when player approaches near floor level
    for (i = 0; i < this.map.length; i++) if (this.map[i] === HID && !this.hidden[i]) {
      c = i % COLS; r = (i / COLS) | 0;
      var nearSpike = this.rulesVersion < 4
        ? this.x < c * T + T + 384 && this.x + PW > c * T - 384 && this.y + PH > r * T - T && this.y < r * T + T
        : this.x < c * T + T + 64 && this.x + PW > c * T - 64 && this.y + PH > r * T + 480 && this.y < r * T + T;
      if (nearSpike) { this.hidden[i] = 1; this.ev |= 8; }
    }
    // falling blocks
    for (k = 0; k < this.blocks.length; k++) { var b = this.blocks[k];
      if (b.st === 0) {
        var underBlock = this.rulesVersion < 4
          ? this.x < b.c * T + T + T && this.x + PW > b.c * T - T && this.y > b.y
          : this.x < b.c * T + T - 96 && this.x + PW > b.c * T + 96 && this.y > b.y + T;
        if (underBlock) { b.st = 1; b.vy = BLOCK_V0; this.ev |= 16; }
      } else if (b.st === 1) {
        var ny = b.y + b.vy; b.vy += BLOCK_G; if (b.vy > BLOCK_MAX) b.vy = BLOCK_MAX;
        var br = fdiv(ny + T - 1);
        if (br >= ROWS) { if (ny > ROWS * T) b.st = 3; b.y = ny; }
        else if (this.solid(b.c, br, b) && ny + T > br * T) { b.y = (br - 1) * T; b.st = 2; b.vy = 0; }
        else b.y = ny;
      }
    }
    this.tick++;
    // death
    if (this.y >= ROWS * T) { this.dead = true; this.cause = 'fall'; this.killer = (this.lastCol >= 0 && this.collapse[this.lastCol] === -1) ? this.lastCol : -1; if (this.killer >= 0) this.cause = 'collapse'; return 1; }
    c0 = fdiv(this.x); c1 = fdiv(this.x + PW - 1); r0 = fdiv(this.y); r1 = fdiv(this.y + PH - 1);
    for (r = r0; r <= r1; r++) for (c = c0; c <= c1; c++) {
      if (c < 0 || c >= COLS || r < 0 || r >= ROWS) continue;
      i = r * COLS + c;
      if ((this.map[i] === SPK || (this.map[i] === HID && this.hidden[i])) &&
          overlap(this.x, this.y, PW, PH, c * T + 160, r * T + 480, T - 320, T - 480)) { this.dead = true; this.cause = this.map[i] === HID ? 'hidden' : 'spike'; this.killer = i; return 1; }
    }
    for (k = 0; k < this.blocks.length; k++) { b = this.blocks[k];
      if (b.st === 1 && overlap(this.x, this.y, PW, PH, b.c * T + 32, b.y, T - 64, T)) { this.dead = true; this.cause = 'block'; this.killer = 1000 + k; return 1; }
    }
    for (r = r0; r <= r1; r++) for (c = c0; c <= c1; c++) {
      if (c < 0 || c >= COLS || r < 0 || r >= ROWS) continue;
      if (this.map[r * COLS + c] === GL && overlap(this.x, this.y, PW, PH, c * T + 256, r * T, T - 512, T)) { this.won = true; return 2; }
    }
    return 0;
  };
  World.prototype.clone = function () {
    var w = Object.create(World.prototype);
    w.map = this.map; w.rulesVersion = this.rulesVersion; w.tick = this.tick; w.cause = this.cause; w.killer = this.killer; w.lastCol = this.lastCol; w.ev = this.ev; w.face = this.face; w.coyote = this.coyote; w.jbuf = this.jbuf; w.dead = this.dead; w.won = this.won; w.grounded = this.grounded;
    w.vx = this.vx; w.vy = this.vy; w.x = this.x; w.y = this.y; w.prevJ = this.prevJ; w.jumpHeld = this.jumpHeld; w.sprung = this.sprung;
    w.collapse = new Int16Array(this.collapse); w.hidden = new Uint8Array(this.hidden);
    w.blocks = this.blocks.map(function (b) { return { c: b.c, y: b.y, vy: b.vy, st: b.st }; });
    return w;
  };
  World.prototype.key = function () {
    var s = this.rulesVersion + ':' + (this.x >> 6) + ',' + (this.y >> 6) + ',' + (this.vy >> 3) + ',' + (this.vx >> 3) + ',' + (this.grounded ? 1 : 0) + (this.coyote > 0 ? 1 : 0) + (this.jbuf > 0 ? 1 : 0) + (this.prevJ ? 1 : 0);
    for (var i = 0; i < this.collapse.length; i++) if (this.collapse[i]) s += ',c' + i + ':' + (this.collapse[i] > 0 ? this.collapse[i] >> 2 : -1);
    for (i = 0; i < this.hidden.length; i++) if (this.hidden[i]) s += ',h' + i;
    for (i = 0; i < this.blocks.length; i++) s += ',b' + this.blocks[i].st + ':' + (this.blocks[i].y >> 6);
    return s;
  };

  // ---------- inputs <-> run-length change events ----------
  function inputsToEvents(inputs) { // [{d: frames since prev event, s: state}]
    var ev = [], prev = -1, last = 0;
    for (var f = 0; f < inputs.length; f++) if (inputs[f] !== prev) { ev.push({ d: f - last, s: inputs[f] }); prev = inputs[f]; last = f; }
    return ev;
  }
  function eventsToInputs(ev, frames) {
    var out = new Uint8Array(frames), f = 0, s = 0, k = 0, next = ev.length ? ev[0].d : frames + 1;
    for (f = 0; f < frames; f++) {
      while (k < ev.length && f === next) { s = ev[k].s; k++; next = k < ev.length ? next + ev[k].d : frames + 1; }
      out[f] = s;
    }
    return out;
  }
  // ---------- base64 (no btoa dependency for node/old webviews) ----------
  var B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  var B64R = {}; for (var q = 0; q < 64; q++) B64R[B64.charAt(q)] = q;
  function b64enc(bytes) {
    var s = '', i, n;
    for (i = 0; i + 2 < bytes.length; i += 3) { n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
      s += B64.charAt(n >> 18 & 63) + B64.charAt(n >> 12 & 63) + B64.charAt(n >> 6 & 63) + B64.charAt(n & 63); }
    var rem = bytes.length - i;
    if (rem === 1) { n = bytes[i] << 16; s += B64.charAt(n >> 18 & 63) + B64.charAt(n >> 12 & 63) + '=='; }
    else if (rem === 2) { n = (bytes[i] << 16) | (bytes[i + 1] << 8); s += B64.charAt(n >> 18 & 63) + B64.charAt(n >> 12 & 63) + B64.charAt(n >> 6 & 63) + '='; }
    return s;
  }
  function b64dec(s) {
    if (typeof s !== 'string' || s.length % 4 !== 0 || !/^[A-Za-z0-9+\/]*={0,2}$/.test(s)) throw new Error('base64 格式错误');
    var pad = s.charAt(s.length - 1) === '=' ? (s.charAt(s.length - 2) === '=' ? 2 : 1) : 0;
    var out = new Uint8Array(s.length / 4 * 3 - pad), o = 0;
    for (var i = 0; i < s.length; i += 4) {
      var n = (B64R[s.charAt(i)] << 18) | (B64R[s.charAt(i + 1)] << 12) | ((B64R[s.charAt(i + 2)] || 0) << 6) | (B64R[s.charAt(i + 3)] || 0);
      if (o < out.length) out[o++] = n >> 16 & 255; if (o < out.length) out[o++] = n >> 8 & 255; if (o < out.length) out[o++] = n & 255;
    }
    return out;
  }
  function packMapBits(m, bits) {
    var out = new Uint8Array(Math.ceil(m.length * bits / 8)), bit = 0;
    for (var i = 0; i < m.length; i++) for (var b = bits - 1; b >= 0; b--) { if ((m[i] >> b) & 1) out[bit >> 3] |= 128 >> (bit & 7); bit++; }
    return out;
  }
  function unpackMapBits(bytes, bits) {
    var n = COLS * ROWS; if (bytes.length !== Math.ceil(n * bits / 8)) throw new Error('地图长度不对');
    var m = new Uint8Array(n), bit = 0;
    for (var i = 0; i < n; i++) { var v = 0; for (var b = 0; b < bits; b++) { v = (v << 1) | ((bytes[bit >> 3] >> (7 - (bit & 7))) & 1); bit++; } m[i] = v; }
    return m;
  }
  function packMap(m) { return packMapBits(m, 4); } // v3 encoder: 4 bits -> 48 bytes
  function unpackMap(bytes) { return unpackMapBits(bytes, 4); }
  function packMap3(m) { return packMapBits(m, 3); }
  function unpackMap3(bytes) { return unpackMapBits(bytes, 3); }
  function packEvents(ev) { // varint(d*8 + s)
    var out = [];
    for (var i = 0; i < ev.length; i++) { var v = ev[i].d * 8 + ev[i].s;
      while (v >= 128) { out.push((v & 127) | 128); v = Math.floor(v / 128); } out.push(v); }
    return new Uint8Array(out);
  }
  function unpackEvents(bytes, frames) {
    var ev = [], i = 0, total = 0;
    while (i < bytes.length) {
      var v = 0, mul = 1, n = 0, byte;
      do { if (i >= bytes.length || n >= 3) throw new Error('影子数据损坏'); byte = bytes[i++]; v += (byte & 127) * mul; mul *= 128; n++; } while (byte & 128);
      var d = Math.floor(v / 8), s = v % 8;
      if (ev.length === 0 ? d !== 0 : d < 1) throw new Error('影子时间轴非法');
      total += d; if (total >= frames) throw new Error('影子超出帧数');
      if (ev.length > MAX_FRAMES) throw new Error('影子事件过多');
      ev.push({ d: d, s: s });
    }
    if (!ev.length) throw new Error('影子为空');
    return ev;
  }
  function checksum(str) { // FNV-1a, corruption check only (NOT tamper-proof)
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h.toString(36);
  }
  function utf8len(s) { var n = 0; for (var i = 0; i < s.length; i++) { var c = s.charCodeAt(i);
    if (c < 0x80) n += 1; else if (c < 0x800) n += 2; else if (c >= 0xd800 && c < 0xdc00) { n += 4; i++; } else n += 3; } return n; }

  function encodeSnapshot(map, inputs) {
    var version = map.rulesVersion || SNAP_VERSION;
    var m = b64enc(version === 2 ? packMap3(map) : packMap(map)), g = b64enc(packEvents(inputsToEvents(inputs))), f = inputs.length;
    var obj = { v: version, m: m, g: g, f: f, c: checksum(version + '|' + m + '|' + g + '|' + f) };
    return JSON.stringify(obj);
  }
  // Simulate inputs from reset; return {result:'win'|'dead'|'timeout', frame, x, y}
  function simulate(map, inputs) {
    var w = new World(map);
    for (var f = 0; f < inputs.length; f++) {
      var e = w.step(inputs[f]);
      if (e === 1) return { result: 'dead', frame: w.tick, x: w.x, y: w.y };
      if (e === 2) return { result: 'win', frame: w.tick, x: w.x, y: w.y };
    }
    return { result: 'timeout', frame: w.tick, x: w.x, y: w.y };
  }
  // Strict decode + verification. Throws Error with Chinese message on any problem.
  function decodeSnapshot(text) {
    if (typeof text !== 'string') throw new Error('快照不是文本');
    if (text.length > SNAP_LIMIT || utf8len(text) > SNAP_LIMIT) throw new Error('快照超过 2048 字节');
    var o; try { o = JSON.parse(text); } catch (e) { throw new Error('快照不是合法 JSON'); }
    if (!o || typeof o !== 'object' || Array.isArray(o)) throw new Error('快照结构不对');
    var keys = Object.keys(o).sort().join(',');
    if (keys !== 'c,f,g,m,v') throw new Error('快照字段不对');
    if (o.v === 1) throw new Error('这是第一版的快照，物理手感已更新，旧关卡影子无法回放');
    if (o.v !== 2 && o.v !== 3 && o.v !== 4) throw new Error('快照版本不支持');
    if (typeof o.m !== 'string') throw new Error('地图编码长度不对');
    if (o.v === 2 && o.m.length !== 48) throw new Error('地图编码长度不对');
    if (o.v >= 3 && o.m.length !== 64) throw new Error('地图编码长度不对');
    if (typeof o.g !== 'string' || o.g.length === 0 || o.g.length > 1700) throw new Error('影子编码长度不对');
    if (typeof o.f !== 'number' || (o.f | 0) !== o.f || o.f < 1 || o.f > MAX_FRAMES) throw new Error('帧数超出范围');
    if (o.c !== checksum(o.v + '|' + o.m + '|' + o.g + '|' + o.f)) throw new Error('校验和不匹配（数据损坏）');
    var map = o.v === 2 ? unpackMap3(b64dec(o.m)) : unpackMap(b64dec(o.m));
    map.rulesVersion = o.v;
    var err = checkMap(map); if (err) throw new Error(err);
    var ev = unpackEvents(b64dec(o.g), o.f);
    var inputs = eventsToInputs(ev, o.f);
    var res = simulate(map, inputs);
    if (res.result !== 'win' || res.frame !== o.f) throw new Error('影子回放没有在第 ' + o.f + ' 帧到达终点（' + res.result + '@' + res.frame + '），拒绝加载');
    return { map: map, inputs: inputs, frames: o.f, version: o.v };
  }
  // base64url wrapper of JSON for URL hash
  function toUtf8(s) { return unescape(encodeURIComponent(s)); }
  function hashEncode(json) { var b = toUtf8(json), a = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i);
    return b64enc(a).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function hashDecode(h) { if (typeof h !== 'string' || h.length > 2800 || !/^[A-Za-z0-9_-]*$/.test(h)) throw new Error('链接数据格式错误');
    var s = h.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '=';
    var a = b64dec(s), str = ''; for (var i = 0; i < a.length; i++) str += String.fromCharCode(a[i]);
    try { return decodeURIComponent(escape(str)); } catch (e) { throw new Error('链接数据编码错误'); } }

  return {
    VERSION: SNAP_VERSION, SPEED: SPEED, JUMPV: JUMPV, BOUNCE_V: BOUNCE_V, COLS: COLS, ROWS: ROWS, T: T, PW: PW, PH: PH, MAX_FRAMES: MAX_FRAMES, SNAP_LIMIT: SNAP_LIMIT, MAX_TRAPS: MAX_TRAPS,
    TILE: { E: E, GND: GND, SPK: SPK, ST: ST, GL: GL, COL: COL, HID: HID, FALL: FALL, TRM: TRM }, IN: { L: IN_L, R: IN_R, J: IN_J },
    World: World, parseRows: parseRows, checkMap: checkMap, isTrap: isTrap, simulate: simulate,
    inputsToEvents: inputsToEvents, eventsToInputs: eventsToInputs, packMap: packMap, unpackMap: unpackMap, packMap3: packMap3, unpackMap3: unpackMap3, packMapBits: packMapBits, unpackMapBits: unpackMapBits,
    packEvents: packEvents, b64enc: b64enc, b64dec: b64dec, encodeSnapshot: encodeSnapshot, decodeSnapshot: decodeSnapshot,
    utf8len: utf8len, checksum: checksum, hashEncode: hashEncode, hashDecode: hashDecode
  };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = MLMG;
