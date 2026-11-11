const assert=require('assert'),M=require('../src/engine'),L=require('../src/levels');
const h=(a,n)=>Array(n).fill(a);
function play(i,seq){let w=new M.World(M.parseRows(L[i].rows)),jumps=0,positions=[];for(const a of seq){w.step(a);jumps+=!!(w.ev&1);positions.push(w.pits.map(p=>[p.left,p.right,p.st]));if(w.dead||w.won)break}return{w,jumps,positions}}
assert.equal(M.VERSION,7);
const initial=new M.World(M.parseRows(L[2].rows));assert.equal(initial.pits[0].left,6*M.T);assert.equal(initial.pits[0].right,8*M.T);assert.deepEqual(initial.solidSegments(6,6),[]);assert.deepEqual(initial.solidSegments(7,7),[]);assert.deepEqual(initial.solidSegments(5,6),[[5*M.T,6*M.T]]);
// Trigger just outside the original pit; edges move in sub-tile increments.
initial.x=6*M.T-M.T/2-M.PW-1;initial.step(0);assert.equal(initial.pits[0].st,0);initial.x+=2;initial.step(0);assert.equal(initial.pits[0].left,6*M.T-128);assert.deepEqual(initial.solidSegments(5,6),[[5*M.T,6*M.T-128]]);assert.deepEqual(initial.solidSegments(7,6),[[8*M.T-128,8*M.T]]);
// Independent clone, exact pit coordinates in the search key, deterministic continuation.
let clone=initial.clone();assert.equal(clone.key(),initial.key());clone.pits[0].right++;assert.notEqual(clone.key(),initial.key());assert.notEqual(clone.pits[0].right,initial.pits[0].right);clone=initial.clone();for(let t=0;t<50;t++){assert.equal(clone.step(6),initial.step(6));assert.equal(clone.key(),initial.key())}
initial.reset();assert.equal(initial.pits[0].left,6*M.T);assert.equal(initial.pits[0].st,0);
const blind=play(2,h(2,300));assert(blind.w.dead);assert(blind.positions.some(p=>p[0][0]<6*M.T));
for(const t of [60,68,76,84,92,100]){const seq=h(2,t).concat(h(6,20),h(2,260));const r=play(2,seq);assert(r.w.won,'moving pit ordinary jump @'+t);assert.equal(r.jumps,1);assert.equal(r.w.pits[0].left,4*M.T);assert.equal(r.w.pits[0].right,6*M.T);const json=M.encodeSnapshot(r.w.map,seq.slice(0,r.w.tick));const decoded=M.decodeSnapshot(json);assert.equal(decoded.version,7);assert(M.utf8len(json)<=2048);}
assert(play(3,h(2,300)).w.dead,'walking without initial jump must die');
for(const t of [16,20,24,28,32,36,40]){let r=play(3,h(2,t).concat(h(6,20),h(2,260)));assert(r.w.won,'expanding pit one jump + keep running @'+t);assert.equal(r.jumps,1);let widths=r.positions.map(a=>a[0][1]-a[0][0]);assert(widths.some(x=>x>M.T));for(let i=1;i<widths.length;i++)assert(widths[i]>=widths[i-1]);}
const base=play(3,h(2,24).concat(h(6,20),h(2,56))).w;assert(base.grounded&&!base.dead);let stop=base.clone(),run=base.clone();for(let t=0;t<400;t++){stop.step(0);run.step(2)}assert(stop.dead,'stop after landing must get caught');assert(run.won,'same state, keep running reaches exit');assert.equal(stop.pits[0].left,2*M.T);assert(stop.pits[0].right>base.pits[0].right);
const settled=base.clone();for(let i=0;i<500;i++)settled.stepPits();assert.equal(settled.pits[0].right,9*M.T,'exit platform retained after full expansion');assert.deepEqual(settled.solidSegments(9,6),[[9*M.T,10*M.T]]);
// Old snapshots remain old physics and cannot reinterpret new tile IDs.
const old=M.decodeSnapshot(require('./v6_snapshot_fixture.json'));assert.equal(old.version,6);assert.equal(M.simulate(old.map,old.inputs).result,'win');assert.equal(JSON.parse(M.encodeSnapshot(old.map,old.inputs)).v,6);const bad=M.parseRows(L[2].rows);bad.rulesVersion=6;assert.equal(M.checkMap(bad),'格子类型非法');
const unsupported=M.parseRows(L[2].rows);unsupported[2*12+6]=M.TILE.FALL;assert.equal(M.checkMap(unsupported),'动态坑上方暂不支持砸块');
const duplicate=M.parseRows(L[2].rows);duplicate[2*12+3]=M.TILE.CHASE;assert(M.checkMap(duplicate));
console.log('PASS: actual left translation, growing contiguous pit, exact collision segments, blind/run/stop routes, forgiving jumps, clone/reset/search state, v6 compatibility and <=2KB');
