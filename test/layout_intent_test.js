const assert=require('assert'),M=require('../src/engine'),R=require('./v16_routes'),L=require('../src/levels');
for(let i=0;i<5;i++){
 assert.equal(M.checkMap(M.parseRows(L[i].rows)),null);assert(R.play(i,[]).w.dead,'blind run '+i);
 const r=R.route(i);assert(r.w.won);const json=M.encodeSnapshot(r.w.map,r.inputs);assert(M.utf8len(json)<=2048);assert.equal(M.decodeSnapshot(json).version,10);
}
// Short mobile taps, with broad takeoff windows; no pixel-perfect landing requirement.
for(const t of [122,128,134,140,146])assert(R.play(0,[t],10).w.won);
for(const a of [72,80,88])for(const b of [126,134,142])assert(R.play(1,[a,b],10).w.won);
for(const t of [48,54,60,66,72])assert(R.play(2,[t],10).w.won);
for(const t of [4,8,12,16,20])assert(R.play(3,[t],10).w.won);
for(const t of [140,146,152,158,164])assert(R.play(4,[t],10).w.won);
// Crossing only the first opening does not solve room 2; first opening is retained.
let r=R.play(1,[80],10);assert(r.w.dead);assert.equal(r.w.pits.filter(p=>p.st===2).length,2);
// No hidden spike substitutes for the final sliding platform.
assert(!L[4].rows.join('').includes('h'));assert.equal(M.parseRows(L[4].rows)[72],M.TILE.RELAY);
console.log('PASS v16: 5 blind/known route pairs, 29 short-tap variations, <=2KB validated snapshots');
