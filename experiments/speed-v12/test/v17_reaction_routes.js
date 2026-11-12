const M=require('../src/engine'),L=require('../src/levels');
// Delay is counted after the first visible changing frame. 0 means input on the next tick.
function reactionRoute(i,delay,version,guideOnly){
 const map=version===10?M.decodeSnapshot(require('./v10_snapshot_fixtures.json')[i]).map:M.parseRows(L[i].rows);
 const w=new M.World(map),inputs=[];const index=guideOnly?0:i===4?1:i===1?1:0;
 let trigger=null,react=null,loss=null,jump=null,atTrigger=null;
 for(let t=0;t<600;t++){
  let a=2;
  if(i===1&&!guideOnly&&t>=51&&t<61)a|=4;
  if(react!==null&&t>=react&&t<react+10)a|=4;
  const before=w.pits[index].st;w.step(a);inputs.push(a);
  if(before===0&&w.pits[index].st>0&&trigger===null){trigger=t;react=t+1+delay;atTrigger={rear:w.x,front:w.x+M.PW,pitLeft:w.pits[index].left,pitRight:w.pits[index].right,grounded:w.grounded};}
  if(trigger!==null&&loss===null&&!w.grounded&&!(w.ev&1))loss=t;
  if(trigger!==null&&jump===null&&(w.ev&1))jump=t;
  if(w.dead||w.won)break;
 }
 return{w,inputs,trigger,react,loss,jump,atTrigger};
}
module.exports={reactionRoute};
