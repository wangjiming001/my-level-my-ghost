const M=require('../src/engine'),L=require('../src/levels');
function play(i,jumps,hold=20){let w=new M.World(M.parseRows(L[i].rows)),inputs=[];for(let t=0;t<600;t++){let a=2;if(jumps.some(j=>t>=j&&t<j+hold))a|=4;inputs.push(a);w.step(a);if(w.dead||w.won)break;}return{w,inputs};}
function route(i){const jumps=[[134],[80,134],[60],[12],[152]][i];const r=play(i,jumps,10);if(!r.w.won)throw Error('authored route failed '+i);return r;}
module.exports={play,route};
if(require.main===module){for(let i=0;i<5;i++){let r=route(i);console.log(i,r.w.won,r.w.tick,M.inputsToEvents(r.inputs));}}
