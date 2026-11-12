/* Conquest (capture the area) rules. Pure data and functions: used by the browser game (single player)
   and by the multiplayer server, so both follow the same rules. */
const CQ={R:22,CAP_T:12,TICKETS:300,DRAIN:0.5,SWEEP_T:20,TICK:0.25};
/* the three capture points of the urban map (fixed, so the server and every client agree): A residential, B downtown centre, C industrial. Each is 250 m from both bases. */
const CQ_POINTS=[{name:'A',x:-90,z:90},{name:'B',x:0,z:0},{name:'C',x:90,z:-90}];
/* points: [{name,x,z}]. units: [{team:'nato'|'wp',x,z,alive}] */
function cqNew(points){return{points:points.map((p,i)=>({id:i,name:p.name,x:p.x,z:p.z,owner:null,capTeam:null,prog:0})),
 tickets:{nato:CQ.TICKETS,wp:CQ.TICKETS},sweepT:0,over:null,acc:0}}
function cqTick(S,units,dt,ev){
 const held={nato:0,wp:0};
 for(const p of S.points){
  let nat=0,wp=0;
  for(const u of units){if(!u.alive)continue;if(Math.hypot(u.x-p.x,u.z-p.z)>CQ.R)continue;if(u.team==='nato')nat++;else if(u.team==='wp')wp++}
  if(nat>0&&wp===0||wp>0&&nat===0){
   const t=nat>0?'nato':'wp';
   if(p.owner!==t){
    if(p.capTeam!==t){p.capTeam=t;p.prog=0}
    p.prog+=dt/CQ.CAP_T;
    if(p.prog>=1){p.owner=t;p.capTeam=null;p.prog=0;ev.push({type:'capture',point:p.id,name:p.name,team:t})}
   }
  }else if(nat===0&&wp===0){ /* nobody here: a half-finished capture fades */
   if(p.prog>0){p.prog=Math.max(0,p.prog-dt/(CQ.CAP_T*2));if(p.prog===0)p.capTeam=null}
  } /* contested: progress freezes */
  if(p.owner)held[p.owner]++;
 }
 const n=S.points.length;
 for(const t of['nato','wp']){const other=t==='nato'?'wp':'nato';
  const lost=Math.max(0,held[other]-held[t])*CQ.DRAIN*dt;S.tickets[t]=Math.max(0,S.tickets[t]-lost)}
 const sweeper=held.nato===n?'nato':held.wp===n?'wp':null;
 if(sweeper){S.sweepT+=dt;if(S.sweepT>=CQ.SWEEP_T&&!S.over){S.over={winner:sweeper,reason:'sweep'};ev.push({type:'win',team:sweeper,reason:'sweep'})}}
 else S.sweepT=0;
 if(!S.over&&(S.tickets.nato<=0||S.tickets.wp<=0)){
  const w=S.tickets.nato>S.tickets.wp?'nato':S.tickets.wp>S.tickets.nato?'wp':(held.nato>=held.wp?'nato':'wp');
  S.over={winner:w,reason:'tickets'};ev.push({type:'win',team:w,reason:'tickets'})}
 S.held=held;
}
/* advance by real time in fixed steps; returns events */
function cqStep(S,units,dt){const ev=[];if(S.over)return ev;S.acc+=dt;
 while(S.acc>=CQ.TICK&&!S.over){S.acc-=CQ.TICK;cqTick(S,units,CQ.TICK,ev)}
 return ev}
if(typeof module!=='undefined'&&module.exports)module.exports={CQ,CQ_POINTS,cqNew,cqStep,cqTick};
