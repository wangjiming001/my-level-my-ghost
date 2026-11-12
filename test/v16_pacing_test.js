const assert=require('assert'),engine=require('../src/engine'),M=Object.assign({},engine,{parseRows:function(rows){const m=engine.parseRows(rows);m.rulesVersion=10;return m;}}),L=require('./v16_levels_fixture.json'),R=require('./v16_routes');
const map=i=>M.parseRows(L[i].rows);
for(let i=0;i<5;i++){const m=map(i);for(let c=0;c<12;c++){assert.equal(m[c],M.TILE.GND);assert.equal(m[12+c],M.TILE.GND);}for(const hold of [10,20,35]){const jumps=[[134],[80,134],[60],[12],[152]][i];assert(R.play(i,jumps,hold).w.won,'ceiling must allow ordinary/held jumps '+i);}}
let w=new M.World(map(3));const proof={speedRatio:84/M.SPEED,pauses:[]};let chase,exit;
for(const a of R.route(3).inputs){w.step(a);if(!chase&&w.pits[0].st===2)chase=w.clone();if(!exit&&w.x+M.PW/2>=9*M.T)exit=w.clone();}assert(w.won);assert(chase);let before=chase.pits[0].right;chase.stepPits();assert.equal(chase.pits[0].right-before,84);proof.exitLeadTiles=(exit.x+M.PW/2-exit.pits[0].right)/M.T;assert(proof.exitLeadTiles>0&&proof.exitLeadTiles<.3);
for(const at of [90,100,110,120,130,140])for(const n of [4,8,12,16]){const seq=R.route(3).inputs.slice();seq.splice(at,0,...Array(n).fill(0));const result=M.simulate(map(3),seq.concat(Array(120).fill(2))).result;assert.equal(result,n<=8?'win':'dead');proof.pauses.push({at,ticks:n,result});}
// Compare unchanged v9 run with v10 on the same flat room: version separation keeps old pacing intact.
const legacy=M.decodeSnapshot(require('./v9_snapshot_fixtures.json')[3]);w=new M.World(legacy.map);let old;
for(const a of legacy.inputs){w.step(a);if(w.x+M.PW/2>=9*M.T){old=(w.x+M.PW/2-w.pits[0].right)/M.T;break;}}assert(old>.65);proof.v15ExitLeadTiles=old;
assert.equal((.8*M.T)/(M.SPEED*60)<.25,true);proof.firstRevealCenterLeadSeconds=.8*M.T/(M.SPEED*60);
console.log('PASS v16 urgency: '+JSON.stringify(proof));
