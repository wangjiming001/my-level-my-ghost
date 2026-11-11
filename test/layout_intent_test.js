// The opening chapter varies the player's expectation, not jump precision.
const assert=require('assert'),M=require('../src/engine'),L=require('../src/levels'),fixtures=require('./mechanic_fixtures.json');
const hold=(a,n)=>Array(n).fill(a);
function play(i,seq){const w=new M.World(M.parseRows(L[i].rows));for(const a of seq){w.step(a);if(w.dead||w.won)break}return w}
function win(i,seq){const w=play(i,seq);assert(w.won,L[i].name+' learned route');assert(M.utf8len(M.encodeSnapshot(w.map,seq.slice(0,w.tick)))<=2048);return w}
for(let i=0;i<5;i++)assert(play(i,hold(2,300)).dead,'blind run interrupted in '+i);
// One late surprise. 40 ticks (0.67 s) of tested takeoff flexibility.
for(const t of [104,112,120,128,136,144])win(0,hold(2,t).concat(hold(6,20),hold(2,240)));
// A second trap after the first: early and late approaches both work.
assert.equal(play(1,hold(2,40).concat(hold(6,20),hold(2,240))).cause,'collapse');
for(const t of [32,40,48,56])for(const total of [112,120,128])win(1,hold(2,t).concat(hold(6,20),hold(2,total-t-20),hold(6,20),hold(2,240)));
// Actual moving/expanding terrain, not fixed-cell substitutes.
for(const t of [60,68,76,84,92,100])win(2,hold(2,t).concat(hold(6,20),hold(2,240)));
for(const t of [16,20,24,28,32,36,40])win(3,hold(2,t).concat(hold(6,20),hold(2,240)));
// Keep the approved fifth-level surprise; remove the precision spike added in v11.
assert(!L[4].rows.join('').includes('^'),'no extra visible spike');
assert.equal(play(4,hold(2,52).concat(hold(6,20),hold(2,240))).cause,'hidden');
for(const t of [52,56,60,64,68,72,76])win(4,hold(2,t).concat(hold(6,20),hold(2,128-t-20),hold(6,20),hold(2,240)));
for(const pause of [30,90,180])for(const runup of [24,28,32])win(4,hold(2,52).concat(hold(6,20),hold(2,28),hold(0,pause),hold(2,runup),hold(6,20),hold(2,240)));
// Retain regression coverage of advanced mechanics outside the opening chapter.
assert(require('./falling_block_route_test').run(M.parseRows(fixtures.block)).w.won);
console.log('PASS: five expectation reversals; blind/learned route pairs; broad takeoff windows; fifth-level pause and ordinary jump; <=2KB');
