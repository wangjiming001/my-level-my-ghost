const M=require('../src/engine.js'),L=require('../src/levels.js');
function run(map,options={}){const w=new M.World(map),seq=[],phases=[];function steps(name,a,n){let from=seq.length;for(let i=0;i<n&&!w.dead&&!w.won;i++){seq.push(a);w.step(a)}phases.push({name,from,to:seq.length,x:w.x/M.T,feet:(w.y+M.PH)/M.T,ground:w.grounded,block:w.blocks[0].st,dead:w.dead,won:w.won})}function until(name,a,fn,max){let n=0,from=seq.length;while(!fn()&&n++<max&&!w.dead&&!w.won){seq.push(a);w.step(a)}phases.push({name,from,to:seq.length,x:w.x/M.T,feet:(w.y+M.PH)/M.T,ground:w.grounded,block:w.blocks[0].st,dead:w.dead,won:w.won})}
steps('settle',0,2);steps('run to step',2,12);steps('jump onto low step',6,20);until('land on low step',2,()=>w.grounded,25);steps('release jump',0,2);steps('jump onto upper platform',6,24);until('land on platform',2,()=>w.grounded,25);until('approach to trigger stone',2,()=>w.blocks[0].st===1||w.blocks[0].st===4,50);steps('reaction',2,options.delay||0);until('retreat to safety',1,()=>w.x<=5*M.T,45);until('wait for stone to stop',0,()=>w.blocks[0].st===2,45);steps('jump onto stone',6,20);until('land on stone',0,()=>w.grounded,45);steps('release jump',0,2);steps('jump to exit',6,36);until('finish',2,()=>w.won,60);
return{phases,seq,w};}
if(require.main===module){
 const assert=require('assert');
 for(const delay of [0,4,8,12]) { const r=run(M.parseRows(L[2].rows),{delay}); assert(r.w.won&&!r.w.dead,'clear after '+delay+' ticks reaction'); assert(r.phases.some(p=>p.block===2),'wait for stone landing'); }
 const old=M.decodeSnapshot(require('./v4_snapshot_fixture.json'));const bad=run(old.map,{delay:0});assert(bad.w.dead&&bad.w.cause==='block','regression: old indicated retreat route was unsafe');
 const w=new M.World(M.parseRows(L[2].rows));w.x=6*M.T-M.PW+120;w.y=4*M.T-M.PH;w.grounded=true;w.step(0);assert.equal(w.blocks[0].st,4);assert.equal(w.blocks[0].warn,M.BLOCK_WARN);
 for(let i=0;i<M.BLOCK_WARN-1;i++){w.step(0);assert.equal(w.blocks[0].st,4)}w.step(0);assert.equal(w.blocks[0].st,1);
 assert.equal(w.clone().rulesVersion,5);w.reset();assert.equal(w.blocks[0].st,0);assert.equal(w.blocks[0].warn,0);
 console.log('PASS: simple bait/retreat/wait/jump route with 0-200ms reaction; warning duration; reset; unsafe old route reproduced');
}module.exports={run};
