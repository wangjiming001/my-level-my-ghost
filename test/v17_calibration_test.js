const assert=require('assert'),M=require('../src/engine'),L=require('../src/levels'),R=require('./v17_routes'),{reactionRoute}=require('./v17_reaction_routes');
const evidence={rules:11,fps:60,delayConvention:'0 = next tick after first changing frame',profile:M.CALIBRATION,rooms:[]};
for(let i=0;i<5;i++){
 const room={room:i+1,oldSuccessDelays:[],newSuccessDelays:[]};
 for(let d=0;d<=24;d++)for(const v of [10,11]){const r=reactionRoute(i,d,v);if(r.w.won)(v===10?room.oldSuccessDelays:room.newSuccessDelays).push(d);}
 const late=reactionRoute(i,12,11),old=reactionRoute(i,12,10);assert(old.w.won,'v16 response route baseline');assert(late.w.dead,'12tick late reaction must miss support '+i);assert(reactionRoute(i,0,11).w.won,'instant input is allowed; do not force deaths');
 assert.deepEqual(room.newSuccessDelays,[0,1,2,3,4,5,6]);assert(late.atTrigger.grounded);room.triggerBody=late.atTrigger;room.lossAfterTriggerTicks=late.loss-late.trigger;room.lateResult=late.w.dead?'dead':'win';room.knownFrames=R.route(i).w.tick;evidence.rooms.push(room);
}
// Guide trap remains readable before the surprise; reacting 0.2s later still clears A.
let guide=reactionRoute(1,12,11,true);assert(guide.w.pits[0].st>0);assert(guide.jump!==null);assert(guide.atTrigger.rear<7*M.T-M.PW);assert(guide.w.x>8*M.T,'first opening remains a teaching cue');
// Spatial translation: the same policy and timing profile works at different map coordinates.
const specs=[{start:0,exit:9,traps:[{column:7,tile:'o'}]},{start:1,exit:10,traps:[{column:6,tile:'o'},{column:9,tile:'o'}]},{start:0,exit:7,traps:[{column:5,tile:'m'}]},{start:1,exit:10,traps:[{column:2,tile:'e'}]},{start:0,exit:10,traps:[{column:0,tile:'p'}]}];
for(let i=0;i<5;i++){const map=M.parseRows(L.buildRoom(specs[i]));assert.equal(M.checkMap(map),null);const r=R.routeMap(map);assert(r.w.won);const json=M.encodeSnapshot(map,r.inputs);assert.equal(M.decodeSnapshot(json).version,11);assert(M.utf8len(json)<=2048);if(i<4)assert.equal(r.w.tick,R.route(i).w.tick);}
assert.equal(M.supportGate(8*M.T,2),8*M.T-2*M.SPEED);assert.equal(M.chaseGate(2*M.T,8*M.T,10)+M.T,M.chaseGate(3*M.T,9*M.T,10));
for(const json of require('./v10_snapshot_fixtures.json')){const d=M.decodeSnapshot(json);assert.equal(d.version,10);assert.equal(M.simulate(d.map,d.inputs).result,'win');assert.equal(JSON.parse(M.encodeSnapshot(d.map,d.inputs)).v,10);}
if(process.env.V17_EVIDENCE_OUT)require('fs').writeFileSync(process.env.V17_EVIDENCE_OUT,JSON.stringify(evidence,null,2));
console.log('PASS v17 calibration: 250 reaction-delay comparisons, cue vs surprise, support loss, 5 reused layouts, v10 compatibility');
