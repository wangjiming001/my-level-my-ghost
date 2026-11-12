const M=require('../src/engine'),L=require('../src/levels');
function play(i,jumps,hold=20){let w=new M.World(M.parseRows(L[i].rows)),inputs=[];for(let t=0;t<600;t++){let a=2;if(jumps.some(j=>t>=j&&t<j+hold))a|=4;inputs.push(a);w.step(a);if(w.dead||w.won)break;}return{w,inputs};}
function routeMap(map){const w=new M.World(map),inputs=[],gates=[];
 for(const p of w.pits){if(p.front)continue;if(p.kind===M.TILE.OPEN)gates.push(p.left-M.T);else if(p.kind===M.TILE.SHIFT)gates.push(p.left-1.3*M.T);else if(p.kind===M.TILE.CHASE)gates.push(p.left-.5*M.T);else if(p.kind===M.TILE.RELAY)gates.push((w.exitColumn-2)*M.T-.6*M.T);}
 let next=0,left=0;
 for(let t=0;t<600;t++){if(!left&&next<gates.length&&w.grounded&&w.x>=gates[next]){left=10;next++;}const a=2|(left>0?4:0);if(left)left--;inputs.push(a);w.step(a);if(w.dead||w.won)break;}
 if(!w.won)throw Error('authored spatial route failed');return{w,inputs,gates};}
function route(i){return routeMap(M.parseRows(L[i].rows));}
module.exports={play,route,routeMap};
if(require.main===module)for(let i=0;i<5;i++){const r=route(i);console.log(i,r.w.tick,M.inputsToEvents(r.inputs));}
