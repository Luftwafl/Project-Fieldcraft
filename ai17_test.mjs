import {open} from './lib.mjs';
const res=[];const ok=(n,c,x='')=>{res.push(!!c);console.log((c?'PASS ':'FAIL ')+n+(x?'  ['+x+']':''))};
const {b,p,errs}=await open({ctx:{viewport:{width:640,height:360}}});
await p.click('#s-home .nav [data-go=mode]');await p.click('#pveBtn');await p.click('[data-f=nato]');await p.click('#bDeploy');
await p.waitForFunction(()=>__fc.W.act==='ready',null,{timeout:40000});
await p.evaluate(()=>__fc.setLocked(true));
// ---------- A. ten simulated minutes, player at base: opposing NPCs fight, patrols travel, holds happen, lifecycle holds ----------
await p.evaluate(()=>{const C=__fc.CH;window.__L={base:{nato:{x:-235,z:140},wp:{x:235,z:-140}},maxFromBase:{},holdSeen:0,maxSusp:0,susp:{},dup:0,maxAlive:{},sh0:C.stats.soldierHits,sk0:C.stats.skirms||0,resp0:C.stats.respawns,k0:C.stats.soldierKills};});
for(let k=0;k<12;k++){await p.evaluate(()=>{const C=__fc.CH,L=window.__L;
  for(let i=0;i<200;i++){__fc.updateChars(.5);
   if(i%4===0){for(const c of C.all){if(c.kind!=='soldier'||c.state==='dead'||!c.route)continue;const d=Math.hypot(c.x-L.base[c.team].x,c.z-L.base[c.team].z);const k2=c.team+c.squad;L.maxFromBase[k2]=Math.max(L.maxFromBase[k2]||0,d);if(c.pause>30)L.holdSeen++}
    for(const c of C.all){if(c.kind!=='soldier'||c.state==='dead')continue;if(c.state==='suspicious'){L.susp[c.__k]=(L.susp[c.__k]||0)+2;if(L.susp[c.__k]>L.maxSusp)L.maxSusp=L.susp[c.__k]}else if(c.__k)L.susp[c.__k]=0}
    const keys=C.all.filter(c=>c.kind==='soldier'&&c.state!=='dead').map(c=>c.team+':'+c.squad+':'+c.sIdx);L.dup=Math.max(L.dup,keys.length-new Set(keys).size);
    for(const t of['nato','wp']){const n=C.all.filter(c=>c.kind==='soldier'&&c.team===t&&c.state!=='dead').length;L.maxAlive[t]=Math.max(L.maxAlive[t]||0,n)}}}
  // tag suspicious counters per object
  for(const c of C.all)if(!c.__k)c.__k=Math.random();
  });}
const A=await p.evaluate(()=>{const C=__fc.CH,L=window.__L;return {skirms:(C.stats.skirms||0)-L.sk0,hits:C.stats.soldierHits-L.sh0,respawns:C.stats.respawns-L.resp0,kills:C.stats.soldierKills-L.k0,
 maxFromBase:Object.fromEntries(Object.entries(L.maxFromBase).map(([k,v])=>[k,Math.round(v)])),holdSeen:L.holdSeen,maxSuspSec:L.maxSusp,dup:L.dup,maxAlive:L.maxAlive,t:__fc.CH.clock}});
console.log('LONG '+JSON.stringify(A));
ok('opposing NPCs fight each other away from the player (distant skirmishes and hits)',A.skirms>0&&A.hits>0,JSON.stringify(A));
ok('kills and respawns both happen during ten minutes',A.kills>0&&A.respawns>0,JSON.stringify(A));
ok('every leader leaves its base (more than 150 m away at some point)',Object.values(A.maxFromBase).every(v=>v>150),JSON.stringify(A.maxFromBase));
ok('squads hold at village objectives for 30 s or more (clear tasks)',A.holdSeen>0,'samples='+A.holdSeen);
ok('no soldier stays suspicious for more than 60 s (no idle investigation loop)',A.maxSuspSec<=60,'max='+A.maxSuspSec+' s');
ok('team sizes never exceed 8 and no slot is duplicated over ten minutes',A.maxAlive.nato<=8&&A.maxAlive.wp<=8&&A.dup===0,JSON.stringify({ma:A.maxAlive,dup:A.dup}));
// ---------- B. two opposing soldiers at 40 m, the player at 150 m (reduced tier): they engage each other ----------
const B=await p.evaluate(()=>{const C=__fc.CH,P=__fc.P;P.hp=100000;P.stance='stand';
 const alive=t=>C.all.filter(c=>c.kind==='soldier'&&c.team===t&&c.state!=='dead');
 const A=alive('nato')[0],Bs=alive('wp')[0];
 for(const o of alive('nato').concat(alive('wp')))if(o!==A&&o!==Bs){o.x=-600;o.z=-600;}
 let spot=null;for(let k=0;k<72&&!spot;k++){const a=k*5*Math.PI/180,x=A.x+Math.sin(a)*150,z=A.z+Math.cos(a)*150;if(__fc.clearPoint(x,z))spot={x,z}}
 if(!spot)return {ok:false};P.x=spot.x;P.z=spot.z;P.y=__fc.H(P.x,P.z);
 Bs.x=A.x+40;Bs.z=A.z;Bs.target=null;Bs.state='patrol';Bs.aw=0;A.target=null;A.state='patrol';A.aw=0;A.skirm=null;Bs.skirm=null;A.hp=Bs.hp=100000;
 const hpA=A.hp,hpB=Bs.hp;let seen=false,engaged=false;
 for(let i=0;i<120;i++){__fc.updateChars(.5);if(A.state!=='patrol'||Bs.state!=='patrol')seen=true;if(A.state==='engaged'||Bs.state==='engaged')engaged=true}
 /* damage taken by this pair only (distant skirmish hits are not counted here) */
 return {ok:true,tier:A.tier,dmgA:+(hpA-A.hp).toFixed(1),dmgB:+(hpB-Bs.hp).toFixed(1),seen,engaged,states:[A.state,Bs.state]}});
ok('reduced-tier opposing soldiers notice each other and engage (40 m, 150 m from the player)',B.ok&&B.seen&&B.engaged&&(B.dmgA+B.dmgB)>0,JSON.stringify(B));
// ---------- C. gunfire is heard: an enemy 40 m away with a wall between goes suspicious and looks toward the shot ----------
const Cc=await p.evaluate(()=>{const C=__fc.CH,P=__fc.P;P.hp=100000;const alive=t=>C.all.filter(c=>c.kind==='soldier'&&c.team===t&&c.state!=='dead');
 const A=alive('nato')[0],Bs=alive('wp')[0];for(const o of alive('nato').concat(alive('wp')))if(o!==A&&o!==Bs){o.x=-600;o.z=-600}
 A.x=Bs.x+40;A.z=Bs.z;A.target=null;A.state='patrol';A.aw=0;Bs.target=null;Bs.state='patrol';Bs.aw=0;Bs.lkp=null;Bs.invT=0;
 let s=null;for(let k=0;k<72&&!s;k++){const a=k*5*Math.PI/180,x=Bs.x+Math.sin(a)*200,z=Bs.z+Math.cos(a)*200;if(__fc.clearPoint(x,z))s={x,z}}
 P.x=s.x;P.z=s.z;P.y=__fc.H(P.x,P.z);
 const wall={x0:Bs.x+14,x1:Bs.x+19,z0:Bs.z-40,z1:Bs.z+40,top:__fc.H(Bs.x,Bs.z)+4};__fc.boxes.push(wall);
 __fc.fire(A,'player');
 let t=0;while(t<3&&Bs.state==='patrol'){__fc.updateChars(.25);t+=.25}
 const heard={state:Bs.state,t,lkpNearShot:Bs.lkp?Math.hypot(Bs.lkp.x-A.x,Bs.lkp.z-A.z):null,targetNone:!Bs.target};
 let back=0;while(back<60&&Bs.state!=='patrol'){__fc.updateChars(.5);back+=.5}
 const at=__fc.boxes.indexOf(wall);if(at>=0)__fc.boxes.splice(at,1);
 return {heard,backToPatrolS:back,final:Bs.state}});
ok('gunfire within 60 m is heard: the listener goes suspicious within 3 s, behind a wall, without seeing the shooter',Cc.heard.state==='suspicious'&&Cc.heard.targetNone,JSON.stringify(Cc));
ok('the listener finds nothing and returns to routine within 60 s',Cc.final==='patrol',JSON.stringify(Cc));
ok('no page errors',errs.filter(e=>!/proxy|net::|favicon|Failed to load/i.test(e)).length===0,errs.slice(0,3).join(' | '));
console.log(res.filter(Boolean).length+'/'+res.length);
await b.close();
