/* 小红书小工具平台适配：以在线文档（2026-11-10）window.xhs.miniTool 为准。ES2017。 */
var XHS = (function () {
  'use strict';
  function mini() { return window.xhs && window.xhs.miniTool ? window.xhs.miniTool : null; }
  function fn(name) { var m = mini(); return m && typeof m[name] === 'function' ? m[name].bind(m) : null; }
  function readBuildVersion(launchOptions) {
    var env = launchOptions && launchOptions.miniToolEnv;
    return Number(env && env.buildVersion) || 0;
  }
  function getClientVersion(buildVersion) { return Math.floor(buildVersion / 1000); }
  function isClientVersionAtLeast(buildVersion, min) { return getClientVersion(buildVersion) >= min; }
  function getBuildVersion() {
    var xhs = window.xhs, sync = readBuildVersion(xhs && xhs.launchOptions);
    if (sync) return Promise.resolve(sync);
    var g = fn('getLaunchOptions');
    if (!g) return Promise.resolve(0);
    return g().then(function (o) { return readBuildVersion(o); }).catch(function () { return 0; });
  }
  function safeJSON(obj) {
    var seen = [];
    try {
      return JSON.stringify(obj, function (k, v) {
        if (typeof v === 'function') return '[Function]';
        if (v && typeof v === 'object') {
          if (seen.indexOf(v) >= 0) return '[Circular]';
          seen.push(v);
        }
        if (typeof v === 'undefined') return '[undefined]';
        return v;
      }, 2);
    } catch (e) { return '[stringify failed: ' + e.message + ']'; }
  }
  function listKeys(obj, prefix) {
    if (!obj || typeof obj !== 'object') return [];
    var out = [], k;
    try { for (k in obj) { if (Object.prototype.hasOwnProperty.call(obj, k)) out.push((prefix || '') + k + ': ' + (typeof obj[k])); } } catch (e) { out.push('keys error: ' + e.message); }
    return out;
  }
  function collectSearch() {
    var q = {}, s = location.search.replace(/^\?/, '');
    if (!s) return q;
    s.split('&').forEach(function (pair) {
      var i = pair.indexOf('='), k = i < 0 ? pair : pair.slice(0, i), v = i < 0 ? '' : pair.slice(i + 1);
      try { q[decodeURIComponent(k)] = decodeURIComponent(v); } catch (e) { q[k] = v; }
    });
    return q;
  }
  function looksLikeSnapshot(s) {
    if (typeof s !== 'string') return false;
    var t = s.trim();
    if (t.charAt(0) === '{' && t.indexOf('"v"') >= 0 && t.indexOf('"m"') >= 0 && t.indexOf('"g"') >= 0) return true;
    return false;
  }
  function walkForSnapshot(obj, path, out, depth) {
    if (out.length >= 8 || depth > 6 || obj == null) return;
    if (typeof obj === 'string') {
      if (looksLikeSnapshot(obj)) out.push({ path: path, value: obj });
      return;
    }
    if (typeof obj !== 'object') return;
    var k, keys;
    try { keys = Object.keys(obj); } catch (e) { return; }
    for (var i = 0; i < keys.length; i++) {
      k = keys[i];
      walkForSnapshot(obj[k], path ? path + '.' + k : k, out, depth + 1);
    }
  }
  function getLaunchOptionsSafe() {
    var g = fn('getLaunchOptions');
    if (!g) return Promise.resolve(null);
    return g().then(function (o) { return o; }).catch(function (e) { return { _error: String(e && (e.errMsg || e.message) || e) }; });
  }
  function collectDebug(done) {
    var lines = [];
    lines.push('time: ' + new Date().toISOString());
    lines.push('href: ' + location.href);
    lines.push('origin: ' + location.origin);
    lines.push('pathname: ' + location.pathname);
    lines.push('search: ' + location.search);
    lines.push('hash: ' + location.hash);
    lines.push('query parsed: ' + safeJSON(collectSearch()));
    lines.push('referrer: ' + (document.referrer || '(empty)'));
    var xhs = window.xhs;
    lines.push('window.xhs: ' + (xhs ? 'present, type=' + typeof xhs : 'undefined（普通浏览器或未注入）'));
    if (xhs) {
      lines.push('xhs keys: ' + listKeys(xhs).join(', '));
      if (xhs.miniTool) lines.push('xhs.miniTool keys: ' + listKeys(xhs.miniTool).join(', '));
      if (xhs.AI) lines.push('xhs.AI keys: ' + listKeys(xhs.AI).join(', '));
      lines.push('xhs.launchOptions (sync):\n' + safeJSON(xhs.launchOptions));
    }
    getLaunchOptionsSafe().then(function (opt) {
      lines.push('miniTool.getLaunchOptions (async):\n' + safeJSON(opt));
      var found = [];
      walkForSnapshot(xhs && xhs.launchOptions, 'xhs.launchOptions', found, 0);
      walkForSnapshot(opt, 'getLaunchOptions', found, 0);
      walkForSnapshot(collectSearch(), 'query', found, 0);
      if (location.hash.indexOf('#s=') === 0) found.push({ path: 'location.hash#s', value: '(hash payload, not raw JSON)' });
      lines.push('possible snapshot fields: ' + (found.length ? found.map(function (f) { return f.path + ' (' + (typeof f.value === 'string' ? f.value.length : '?') + ' chars)'; }).join('; ') : '(none found)'));
      var gi = fn('getWindowInfo');
      if (!gi) { if (done) done(lines.join('\n'), found, opt); return; }
      gi().then(function (info) {
        lines.push('getWindowInfo:\n' + safeJSON(info));
        if (done) done(lines.join('\n'), found, opt, info);
      }).catch(function (e) {
        lines.push('getWindowInfo failed: ' + (e && (e.errMsg || e.message)));
        if (done) done(lines.join('\n'), found, opt);
      });
    });
  }
  function firstSnapshot(found) {
    var i;
    for (i = 0; i < (found || []).length; i++) if (looksLikeSnapshot(found[i].value)) return found[i].value;
    return null;
  }
  var STORAGE_MIN = 9460;
  function setLocalData(key, data) {
    var serialized;
    try { serialized = JSON.stringify(data); } catch (e) { return Promise.resolve(false); }
    try { localStorage.setItem(key, serialized); } catch (e) { /* 容器不保证 localStorage */ }
    return getBuildVersion().then(function (bv) {
      var set = fn('setStorage');
      if (isClientVersionAtLeast(bv, STORAGE_MIN) && set) {
        return set({ key: key, data: serialized }).then(function () { return true; }).catch(function () { return false; });
      }
      try { localStorage.setItem(key, serialized); return true; } catch (e) { return false; }
    });
  }
  function getLocalData(key) {
    return getBuildVersion().then(function (bv) {
      var get = fn('getStorage');
      if (isClientVersionAtLeast(bv, STORAGE_MIN) && get) {
        return get({ key: key }).then(function (res) {
          if (!res || res.data == null) return null;
          try { return JSON.parse(res.data); } catch (e) { return null; }
        }).catch(function () { return readLs(key); });
      }
      return readLs(key);
    });
  }
  function readLs(key) {
    try { var s = localStorage.getItem(key); return s == null ? null : JSON.parse(s); } catch (e) { return null; }
  }
  function vibrate(type) {
    var v = fn('vibrateShort');
    if (!v) return;
    try {
      var p = v({ type: type || 'medium' });
      if (p && typeof p.catch === 'function') p.catch(function () {});
    } catch (e) {}
  }
  function canComment() {
    var mt = mini();
    return !!(mt && typeof mt.interactionOpenApi === 'function');
  }
  function canPostNote() {
    var mt = mini();
    return !!(mt && typeof mt.postNote === 'function');
  }
  function clipChars(s, n) {
    s = s == null ? '' : String(s);
    return s.length > n ? s.slice(0, n) : s;
  }
  function postNote(opts) {
    var api = fn('postNote');
    if (!api) return Promise.reject(new Error('请在小红书 App 里打开小工具'));
    opts = opts || {};
    var title = clipChars(opts.title, 20);
    var content = clipChars(opts.content, 1000);
    if (!opts.dataUrl) return Promise.reject(new Error('缺少分享图'));
    return writeTemp(opts.dataUrl).then(function (res) {
      var path = res && res.filePath;
      if (!path) return Promise.reject(new Error('writeTempFile 没有返回 filePath'));
      return api({
        title: title,
        content: content,
        pageType: opts.pageType || 'photo_publish',
        mediaInfo: { image_resources: [{ url: path }] }
      });
    });
  }
  function writeTemp(dataUrl) {
    var w = fn('writeTempFile');
    if (!w) return Promise.reject(new Error('当前环境没有 writeTempFile'));
    return w({ data: dataUrl });
  }
  function postComment(opts) {
    var api = fn('interactionOpenApi');
    if (!api) return Promise.reject(new Error('当前环境没有 interactionOpenApi（需要客户端 9.49+，且在小红书小工具内打开）'));
    var payload = { action: 'post_comment', content: opts.content || '', miniToolSnapshotInfo: opts.snapshot };
    function send(mediaPath) {
      if (mediaPath) payload.media_bean = [{ media_type: 'image', cover_image_url: mediaPath }];
      return api({ payload: payload, saveToAlbum: opts.saveToAlbum === true });
    }
    if (!opts.dataUrl) return send(null);
    return writeTemp(opts.dataUrl).then(function (res) {
      var path = res && res.filePath;
      if (!path) return Promise.reject(new Error('writeTempFile 没有返回 filePath'));
      return send(path);
    });
  }
  function detectFlexGap() {
    try {
      var flex = document.createElement('div');
      flex.style.position = 'absolute'; flex.style.visibility = 'hidden';
      flex.style.display = 'flex'; flex.style.flexDirection = 'column'; flex.style.rowGap = '1px';
      flex.appendChild(document.createElement('div')); flex.appendChild(document.createElement('div'));
      document.body.appendChild(flex);
      var ok = flex.scrollHeight === 1;
      flex.parentNode.removeChild(flex);
      if (ok) document.documentElement.className += (document.documentElement.className ? ' ' : '') + 'supports-flex-gap';
    } catch (e) {}
  }
  function applyWindowInfo(info) {
    if (!info) return;
    var root = document.documentElement, app = document.getElementById('app');
    if (info.safeArea) {
      if (info.safeArea.top) root.style.setProperty('--safe-top', info.safeArea.top + 'px');
      if (info.safeArea.bottom) root.style.setProperty('--safe-bottom', info.safeArea.bottom + 'px');
    }
    var btns = info.menuButtons || {}, top = 0, k, b;
    ['back', 'me', 'share'].forEach(function (name) {
      b = btns[name];
      if (b && typeof b.bottom === 'number' && b.bottom > top) top = b.bottom;
    });
    if (top && app) app.style.paddingTop = Math.max(0, top + 6) + 'px';
  }
  return {
    mini: mini, fn: fn, getBuildVersion: getBuildVersion, isClientVersionAtLeast: isClientVersionAtLeast,
    collectDebug: collectDebug, firstSnapshot: firstSnapshot, looksLikeSnapshot: looksLikeSnapshot,
    setLocalData: setLocalData, getLocalData: getLocalData, vibrate: vibrate,
    canComment: canComment, postComment: postComment, canPostNote: canPostNote, postNote: postNote, clipChars: clipChars,
    detectFlexGap: detectFlexGap, applyWindowInfo: applyWindowInfo,
    collectSearch: collectSearch
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = XHS;
