// Authored control plans verify the intended deception, beyond solver reachability.
const assert=require('assert'),M=require('../src/engine'),L=require('../src/levels'),ghosts=require('../src/demo_ghosts.json');
const hold=(a,n)=>Array(n).fill(a);
function play(i,seq){const w=new M.World(M.parseRows(L[i].rows));let ev=0;for(const a of seq){w.step(a);ev|=w.ev;if(w.dead||w.won)break}return{w,ev}}
function win(i,seq){const r=play(i,seq);assert(r.w.won,L[i].name+' learned route');assert(M.utf8len(M.encodeSnapshot(r.w.map,seq.slice(0,r.w.tick)))<=2048);return r}
// Flat-looking finish: running dies; a broad 12-tick takeoff window clears it.
assert.equal(play(0,hold(2,300)).w.cause,'hidden');
for(const t of [104,108,112,116])win(0,hold(2,t).concat(hold(6,20),hold(2,240)));
// A bridge is not a resting place: walking loses support; jumping from firm land works.
assert.equal(play(1,hold(2,300)).w.cause,'collapse');
for(const t of [68,76,84])win(1,hold(2,t).concat(hold(6,20),hold(2,240)));
// Falling block: first impact, safe edge bait, full learned route are paired separately.
const bait=require('./falling_block_route_test').run(M.parseRows(L[2].rows));assert(bait.w.won);
// Spring must actually launch the proof route; removing it makes the same route fail.
const d=M.decodeSnapshot(ghosts[3]),spring=play(3,d.inputs);assert(spring.w.won&&(spring.ev&32));
const noSpring=new Uint8Array(d.map);for(let i=0;i<noSpring.length;i++)if(noSpring[i]===M.TILE.TRM)noSpring[i]=M.TILE.E;
assert.notEqual(M.simulate(noSpring,d.inputs).result,'win');
// The visible nearby landing is lethal, unlike the intended upper platform.
const wrong=new M.World(M.parseRows(L[3].rows));wrong.x=7*M.T+200;wrong.y=4*M.T-M.PH;for(let k=0;k<80&&!wrong.dead;k++)wrong.step(0);assert.equal(wrong.cause,'spike');
// Beating the bridge alone does not beat the finish trap. Two separate jumps do.
const firstOnly=play(4,hold(2,52).concat(hold(6,20),hold(2,240)));assert.equal(firstOnly.w.cause,'hidden');
for(const [t,gap] of [[52,52],[52,56],[56,48],[56,52]])win(4,hold(2,t).concat(hold(6,20),hold(2,gap),hold(6,20),hold(2,240)));
console.log('PASS: finish surprise, collapse crossing, block bait, required spring, two-jump landing reversal; forgiving input windows; <=2KB');
