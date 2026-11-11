const M=require('../src/engine');
// Knowledge route: safely trigger the landing trap, then jump its final position.
function baitRoute(map,approachTicks=52,takeoff=4.4){const w=new M.World(map),inputs=[],phases=[];
 function step(name,a,n){const from=inputs.length;for(let i=0;i<n&&!w.dead&&!w.won;i++){inputs.push(a);w.step(a)}phases.push({name,from,to:inputs.length})}
 function until(name,a,fn,n){const from=inputs.length;for(let i=0;i<n&&!fn()&&!w.dead&&!w.won;i++){inputs.push(a);w.step(a)}phases.push({name,from,to:inputs.length})}
 step('approach',2,approachTicks);step('brake on safe ground',0,8);step('bait with vertical jump',4,20);until('land on safe ground',0,()=>w.grounded,70);until('approach final pit',2,()=>w.x>=takeoff*M.T,90);step('ordinary jump across final pit',6,20);until('finish',2,()=>w.won,240);return{w,inputs,phases};}
module.exports={baitRoute};
