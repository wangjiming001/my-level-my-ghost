const M=require('./src/engine'),L=require('./src/levels'),R=require('./test/v17_routes'),{reactionRoute}=require('./test/v17_reaction_routes'),assert=require('assert');
const result={version:M.VERSION,runSpeed:86,pitWidthsPerSecond:86*60/M.T,rooms:[]};
for(let i=0;i<5;i++){
 let r=R.route(i),events=M.inputsToEvents(r.inputs),clock=0,jumps=[];for(const e of events){clock+=e.d;if(e.s&4)jumps.push(clock)}
 let passed=[];for(let delta=-8;delta<=8;delta+=2){let x=R.play(i,jumps.map(t=>t+delta),10);if(x.w.won)passed.push(delta)}
 let blind=R.play(i,[],10),delay=reactionRoute(i,12,12);assert(blind.w.dead);assert.notEqual(delay.trigger,null);assert(delay.w.dead);assert(passed.length>=7);let copy=new M.World(r.w.map);for(const a of r.inputs.slice(0,40))copy.step(a);let clone=copy.clone();for(const a of r.inputs.slice(40)){assert.equal(copy.step(a),clone.step(a));assert.equal(copy.key(),clone.key())}
 let snap=M.encodeSnapshot(r.w.map,r.inputs),decoded=M.decodeSnapshot(snap);assert.equal(decoded.version,12);assert(M.utf8len(snap)<=2048);result.rooms.push({room:i+1,frames:r.w.tick,jumps,successfulShiftTicks:passed,blind:blind.w.dead?'dead':blind.w.won?'win':'timeout',delayedReaction:delay.w.dead?'dead':delay.w.won?'win':'timeout',snapshotBytes:M.utf8len(snap)});
}
const specs=[{start:0,exit:9,traps:[{column:7,tile:'o'}]},{start:1,exit:10,traps:[{column:6,tile:'o'},{column:9,tile:'o'}]},{start:0,exit:7,traps:[{column:5,tile:'m'}]},{start:1,exit:10,traps:[{column:2,tile:'e'}]},{start:0,exit:10,traps:[{column:0,tile:'p'}]}];result.reuse=specs.map(s=>{try{let m=M.parseRows(L.buildRoom(s));assert.equal(M.checkMap(m),null);return R.routeMap(m).w.won}catch(e){return e.message}});
assert(result.reuse.every(x=>x===true));
for(const j of require('./legacy-v11.json')){const d=M.decodeSnapshot(j);assert.equal(d.version,11);assert.equal(M.simulate(d.map,d.inputs).result,'win')}
console.log(JSON.stringify(result,null,2));
