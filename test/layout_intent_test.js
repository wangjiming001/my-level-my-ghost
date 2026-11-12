const assert=require('assert'),M=require('../src/engine'),R=require('./v17_routes'),L=require('../src/levels');
for(let i=0;i<5;i++){
 assert.equal(M.checkMap(M.parseRows(L[i].rows)),null);assert(R.play(i,[]).w.dead,'blind run '+i);
 const r=R.route(i);assert(r.w.won);const json=M.encodeSnapshot(r.w.map,r.inputs);assert(M.utf8len(json)<=2048);assert.equal(M.decodeSnapshot(json).version,11);
 let tick=0,jumps=[];for(const e of M.inputsToEvents(r.inputs)){tick+=e.d;if(e.s&4)jumps.push(tick);}
 for(const d of [-8,-4,0,4,8,12]){assert(R.play(i,jumps.map(t=>t+d),10).w.won,'wide known takeoff '+i+':'+d);}
 const clone=new M.World(r.w.map);for(const a of r.inputs.slice(0,60))clone.step(a);const copy=clone.clone();for(const a of r.inputs.slice(60)){assert.equal(clone.step(a),copy.step(a));assert.equal(clone.key(),copy.key());}
 clone.reset();assert.equal(clone.key(),new M.World(clone.map).key());
}
assert(!L[4].rows.join('').includes('h'));assert.equal(M.parseRows(L[4].rows)[72],M.TILE.RELAY);
console.log('PASS v17: 5 blind/known route pairs, 30 short-tap variants, deterministic clone/reset, <=2KB');
