// 0.4.0 pre-release 17 update 3: stairs, breakable glass, ally spawn, truck enter label
import {open} from './lib.mjs';
const out={};let fails=0;
const check=(name,ok,info)=>{out[name]={ok:!!ok,...(info!==undefined?{info}:{})};if(!ok)fails++;};
const {b,p,errs}=await open({ctx:{viewport:{width:960,height:540}}});
await p.click('#s-home .nav [data-go=mode]');await p.click('#pveBtn');await p.click('[data-f=nato]');await p.click('#bDeploy');
await p.waitForTimeout(200);await p.evaluate(()=>__fc.setLocked(true));
await p.waitForFunction(()=>__fc.W.act==='ready',null,{timeout:40000});

// ---- A. stairs: walk from the ground floor up to the first upper walkway
const stairRes=await p.evaluate(()=>{
 const H=__fc.HOUSES,boxes=__fc.boxes,P=__fc.P;
 const cands=H.filter(h=>h.bx>=6||h.bz>=6).filter(h=>Math.max(h.bx,h.bz)>=6).slice(0,400);
 const results=[];
 for(const h of cands){
  const y0=h.y;
  const inside=q=>q.x0>h.x-h.bx/2&&q.x1<h.x+h.bx/2&&q.z0>h.z-h.bz/2&&q.z1<h.z+h.bz/2;
  // stair treads: solid boxes resting on the ground floor, tops rising from 0.3 to 3.4 m
  const treads=boxes.filter(q=>Math.abs(q.bot-y0)<.01&&q.top>y0+.3&&q.top<y0+3.45&&inside(q)&&(q.x1-q.x0<2.2)&&(q.z1-q.z0<2.2));
  if(treads.length<10)continue;
  const low=treads.reduce((a,q)=>q.top<a.top?q:a),high=treads.reduce((a,q)=>q.top>a.top?q:a);
  const cx=(q)=>(q.x0+q.x1)/2,cz=(q)=>(q.z0+q.z1)/2;
  let dx=cx(high)-cx(low),dz=cz(high)-cz(low);const L=Math.hypot(dx,dz)||1;dx/=L;dz/=L;
  // start 1.5 m before the bottom tread
  let x=cx(low)-dx*.5,z=cz(low)-dz*.5;
  if(Math.hypot(x-h.x,z-h.z)>Math.max(h.bx,h.bz))continue;
  P.x=x;P.z=z;P.y=y0;P.vx=P.vz=0;
  let maxY=y0;
  for(let i=0;i<400;i++){
   P.x+=dx*.05;P.z+=dz*.05;
   P.y=__fc.groundAt(P.x,P.z,P.y);__fc.collide();
   maxY=Math.max(maxY,P.y);
   if(P.y>=y0+3.3)break;
  }
  const reached=P.y>=y0+3.3;
  // then walk 2.5 m further on the upper walkway and check we stay up there
  for(let i=0;i<50;i++){P.x+=dx*.05;P.z+=dz*.05;P.y=__fc.groundAt(P.x,P.z,P.y);__fc.collide()}
  results.push({reached,upY:+(P.y-y0).toFixed(2),bx:h.bx,bz:h.bz});
  if(results.length>=12)break;
 }
 return results;
});
check('stairs: found buildings with stairs',stairRes.length>=3,stairRes.length);
check('stairs: player reaches upper walkway in every test building',stairRes.length>0&&stairRes.every(r=>r.reached),stairRes.filter(r=>!r.reached).length+' failed of '+stairRes.length);
check('stairs: walkway holds the player on the upper floor',stairRes.length>0&&stairRes.every(r=>r.upY>3.3),stairRes.slice(0,3));

// ---- B. walls stop walking; the pane mechanism breaks glass
const wallRes=await p.evaluate(()=>{
 const H=__fc.HOUSES,P=__fc.P,h=H.find(h=>h.bx>=10&&h.doorSide===0)||H[0];
 // stand 3 m outside the north wall (away from the door side) and walk into the wall
 P.x=h.x-4;P.z=h.z-h.bz/2-3;P.y=__fc.groundAt(P.x,P.z,0);
 for(let i=0;i<120;i++){P.z+=.05;P.y=__fc.groundAt(P.x,P.z,P.y);__fc.collide()}
 return {stoppedAtWall:P.z<h.z-h.bz/2+.05,z:+P.z.toFixed(2),wallZ:+(h.z-h.bz/2).toFixed(2)};
});
check('walls: walking into a wall stops at the wall',wallRes.stoppedAtWall,wallRes);

const glass=await p.evaluate(()=>{
 const gs=__fc.occluders.filter(m=>m.userData&&m.userData.glass);
 if(!gs.length)return {found:false};
 const g=gs[0];
 const pos=g.geometry.attributes.position;
 let alive=0;for(const m of gs){const q=m.geometry.attributes.position;for(let v=0;v<q.count;v+=36){if(q.getX(v)!==0||q.getZ(v)!==0)alive++}}
 // pane 0: centre and outward normal (its thin axis)
 const c=[0,0,0];for(let v=0;v<36;v++){c[0]+=pos.getX(v);c[1]+=pos.getY(v);c[2]+=pos.getZ(v)}
 const cx=c[0]/36,cy=c[1]/36,cz=c[2]/36;
 const xs=[],zs=[];for(let v=0;v<36;v++){xs.push(pos.getX(v));zs.push(pos.getZ(v))}
 const thinX=Math.max(...xs)-Math.min(...xs)<Math.max(...zs)-Math.min(...zs);
 // outward normal from the building: pick the axis the pane is thin along, sign from the nearest building centre
 const hs=__fc.HOUSES.map(h=>({h,d:Math.hypot(h.x-cx,h.z-cz)})).sort((a,b)=>a.d-b.d)[0].h;
 let nx=0,nz=0;if(thinX)nx=Math.sign(cx-hs.x)||1;else nz=Math.sign(cz-hs.z)||1;
 let panes=0;for(const m of gs)panes+=m.geometry.attributes.position.count/36;return {found:true,panes,alive,cx,cy,cz,nx,nz};
});
check('glass: glass panes exist on the buildings',glass.found&&glass.panes>100,glass.panes);
check('glass: every pane is intact before any shot',glass.found&&glass.alive===glass.panes,glass.alive+'/'+glass.panes);
if(glass.found){
 const shot=await p.evaluate((g)=>{
  const o=[g.cx+g.nx*3,g.cy,g.cz+g.nz*3],d=[-g.nx,0,-g.nz];
  const r=__fc.simulateShot(o,d,'m16a2',2);
  return {hit:r.hit,pen:r.pen};
 },glass);
 const after=await p.evaluate((g)=>{
  const m=__fc.occluders.find(m=>m.userData&&m.userData.glass);
  const pos=m.geometry.attributes.position;let dead=0;for(let v=0;v<pos.count;v+=36){if(pos.getX(v)===0&&pos.getY(v)===0&&pos.getZ(v)===0)dead++}
  return {dead};
 },glass);
 check('glass: a rifle round breaks a pane and goes on',shot.pen>=0&&after.dead>=1,{shot,dead:after.dead});
}

// ---- C. spawn on an ally from the class menu
await p.evaluate(()=>{__fc.playerDied()});
await p.waitForTimeout(300);
await p.click('#dthOk');
await p.waitForTimeout(200);
const allyCount=await p.evaluate(()=>__fc.alList().length);
check('ally: allies are in the field',allyCount>0,allyCount);
await p.click('#bAlly');
await p.waitForTimeout(400);
const screen=await p.evaluate(()=>document.body.dataset.v);
check('ally: the SPAWN ON ALLY screen opens',screen==='ally',screen);
// pick the first ally from the map: compute its canvas position with the same projection
const pick=await p.evaluate(()=>{const cv=document.getElementById('alMap'),r=cv.getBoundingClientRect(),W=cv.clientWidth,Hh=cv.clientHeight,k=Math.min(W,Hh)/(2*__fc.MAP_H/__fc.AL.zoom);
 const o=__fc.alList()[0];return{x:r.left+W/2+(o.x-__fc.AL.cx)*k,y:r.top+Hh/2+(o.z-__fc.AL.cz)*k,ox:o.x,oz:o.z,W,Hh}});
await p.mouse.click(pick.x,pick.y);
await p.waitForTimeout(120);
const sel=await p.evaluate(()=>({label:document.getElementById('alSpawn').textContent,disabled:document.getElementById('alSpawn').disabled}));
check('ally: tapping an ally selects it',!sel.disabled&&sel.label.startsWith('SPAWN ON ALLY'),sel);
await p.mouse.click(pick.x,pick.y);
await p.waitForTimeout(90);
await p.mouse.click(pick.x,pick.y);
await p.waitForTimeout(900);
const spawned=await p.evaluate((o)=>{const P=__fc.P;return{state:__fc.state,d:Math.hypot(P.x-o.ox,P.z-o.oz),view:document.body.dataset.v}},pick);
check('ally: double-tap spawns the player next to the ally',spawned.d<5,spawned);
if(spawned.state==='pause'){await p.click('#pResume');await p.waitForTimeout(200)}
const st=await p.evaluate(()=>__fc.state);check('ally: the game is in play after the spawn',st==='play',st);

// ---- D. truck: the touch Enter button says ENTER TRUCK beside a truck
const truck=await p.evaluate(()=>{__fc.spawnTrucks();const T=__fc.TRUCKS.find(t=>t.g);if(!T)return {found:false};
 const P=__fc.P;P.x=T.x+Math.cos(T.yaw)*2.5;P.z=T.z-Math.sin(T.yaw)*2.5;P.y=__fc.groundAt(P.x,P.z,0);P.stance='stand';
 return {found:true,idx:__fc.truckIdx()};});
check('truck: a spawned truck is close enough to get in',truck.found&&truck.idx>=0,truck);
await p.waitForTimeout(1200);
const label=await p.evaluate(()=>document.getElementById('bu').textContent+' | idx='+__fc.truckIdx()+' state='+__fc.state+' P='+__fc.P.x.toFixed(1)+','+__fc.P.z.toFixed(1));
check('truck: Enter button labelled for the truck',label.startsWith('Enter truck'),label);
await p.evaluate(()=>__fc.act('use'));
const inside=await p.evaluate(()=>__fc.TRK.inside);
check('truck: act(use) gets in',inside===true,inside);

out.errors=errs.length?errs.slice(0,5):'none';
console.log(JSON.stringify(out,null,1));
console.log(fails?'FAILURES: '+fails:'ALL PASS');
await b.close();
