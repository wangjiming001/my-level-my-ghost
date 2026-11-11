const assert=require('assert'),M=require('../src/engine'),L=require('../src/levels'),R=require('./v16_routes');
require('./dynamic_pit_v8_test');
const fresh=i=>new M.World(M.parseRows(L[i].rows)),center=(w,x)=>{w.x=x*M.T-M.PW/2;};
// A revealed opening is separate from stepping onto a collapse tile.
let w=fresh(0);center(w,7.1);w.stepPits();assert.equal(w.pits[0].st,0);center(w,7.3);w.stepPits();assert.equal(w.pits[0].right,9*M.T);assert(w.x+M.PW<8*M.T);
w=fresh(1);center(w,5.8);w.stepPits();assert.equal(w.pits[0].st,2);assert.equal(w.pits[1].st,0);center(w,9.2);w.stepPits();assert.equal(w.pits[0].st,2);assert.equal(w.pits[1].st,2);
// One constant-width hole translates left as the player approaches (no jump trigger).
w=fresh(2);center(w,4.7);w.stepPits();assert.equal(w.pits[0].st,0);center(w,4.8);w.stepPits();assert(w.pits[0].left<6*M.T);for(let t=0;t<30;t++)w.stepPits();assert.equal(w.pits[0].left,4*M.T);assert.equal(w.pits[0].right,6*M.T);
// Same small hole stays small while stopped after crossing; further progress starts expansion.
w=fresh(3);center(w,.4);w.stepPits();assert.equal(w.pits[0].right,2*M.T);center(w,3);for(let t=0;t<180;t++)w.stepPits();assert.equal(w.pits[0].right,2*M.T);center(w,4.5);w.stepPits();assert(w.pits[0].right>2*M.T);for(let t=0;t<200;t++)w.stepPits();assert.equal(w.pits[0].right,9*M.T);
// Relay is one moving middle platform: BOTH openings change together; fixed 4T platform width.
w=fresh(4);center(w,2);for(let t=0;t<100;t++)w.stepPits();assert.equal(w.pits[0].right,6*M.T);assert.equal(w.pits[1].left,10*M.T);center(w,8.6);for(let t=0;t<8;t++){w.stepPits();assert.equal(w.pits[1].left-w.pits[0].right,4*M.T);}assert.equal(w.pits[0].right,5*M.T);assert.equal(w.pits[1].left,9*M.T);assert.equal(w.pits[1].right,10*M.T);
// Mid-motion clone, reset, independent state and deterministic continuation.
for(let i=0;i<5;i++){w=fresh(i);const r=R.route(i);for(const a of r.inputs.slice(0,70))w.step(a);let c=w.clone();assert.equal(c.key(),w.key());for(const a of r.inputs.slice(70)){assert.equal(c.step(a),w.step(a));assert.equal(c.key(),w.key());}w.reset();assert.equal(w.key(),fresh(i).key());}
// Old v8 recordings retain the former right-moving trap and physics, including resharing.
for(const json of require('./v8_snapshot_fixtures.json')){const d=M.decodeSnapshot(json);assert.equal(d.version,8);assert.equal(M.simulate(d.map,d.inputs).result,'win');assert.equal(JSON.parse(M.encodeSnapshot(d.map,d.inputs)).v,8);}
console.log('PASS v10: proximity reveals, left translation, progress-gated expansion, linked platform edges, clone/reset, v8 replay');

for(const json of require('./v9_snapshot_fixtures.json')){const d=M.decodeSnapshot(json);assert.equal(d.version,9);assert.equal(M.simulate(d.map,d.inputs).result,'win');assert.equal(JSON.parse(M.encodeSnapshot(d.map,d.inputs)).v,9);}
