const assert=require('assert'),M=require('../src/engine'),L=require('../src/levels'),R=require('./v17_routes');
require('./dynamic_pit_v8_test');
function w(i){return new M.World(M.parseRows(L[i].rows));}
// Thresholds are rear support-edge gates, independent of the visual character size.
let a=w(0);a.x=M.supportGate(8*M.T,2)-1;a.stepPits();assert.equal(a.pits[0].st,0);a.x++;a.stepPits();assert.equal(a.pits[0].right,9*M.T);
a=w(1);a.x=M.supportGate(7*M.T,16);a.stepPits();assert.equal(a.pits[0].st,2);assert.equal(a.pits[1].st,0);a.x=M.supportGate(10*M.T,2);a.stepPits();assert.equal(a.pits[1].st,2);assert.equal(a.pits[0].st,2);
a=w(2);a.x=M.supportGate(6*M.T,2,M.SPEED+128);a.stepPits();assert.equal(a.pits[0].left,6*M.T-128);for(let t=0;t<20;t++)a.stepPits();assert.equal(a.pits[0].left,4*M.T);assert.equal(a.pits[0].right,6*M.T);
a=w(3);a.x=M.supportGate(M.T,2);a.stepPits();a.x=3*M.T;for(let t=0;t<180;t++)a.stepPits();assert.equal(a.pits[0].right,2*M.T);a.x=M.chaseGate(2*M.T,8*M.T,10);a.stepPits();assert.equal(a.pits[0].right,2*M.T+84);for(let t=0;t<150;t++)a.stepPits();assert.equal(a.pits[0].right,8*M.T);
a=w(4);a.x=3*M.T;for(let t=0;t<100;t++)a.stepPits();assert.equal(a.pits[0].right,6*M.T);a.x=M.supportGate(9*M.T,2);a.stepPits();assert.equal(a.pits[0].right,5.5*M.T);assert.equal(a.pits[1].left-a.pits[0].right,4*M.T);a.stepPits();assert.equal(a.pits[0].right,5*M.T);assert.equal(a.pits[1].left,9*M.T);
for(const version of [8,9,10])for(const json of require('./v'+version+'_snapshot_fixtures.json')){const d=M.decodeSnapshot(json);assert.equal(d.version,version);assert.equal(M.simulate(d.map,d.inputs).result,'win');}
console.log('PASS v11: support-edge gates, translated pit, progress chase, 2tick linked platform, v8-v10 compatibility');
