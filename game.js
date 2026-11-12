
/* ============ audio (synthesised, no files) ============ */
const AU={ctx:null,mg:null,gw:null,gf:null,nb:null,n:0};
function auInit(){if(AU.ctx||STAGE<2)return;try{const C=window.AudioContext||window.webkitAudioContext;if(!C)return;const c=new C();AU.ctx=c;AU.mg=c.createGain();AU.gw=c.createGain();AU.gf=c.createGain();AU.gw.connect(AU.mg);AU.gf.connect(AU.mg);AU.mg.connect(c.destination);
 const n=Math.floor(c.sampleRate*.6),b=c.createBuffer(1,n,c.sampleRate),d=b.getChannelData(0);for(let i=0;i<n;i++)d[i]=Math.random()*2-1;AU.nb=b;auVol()}catch(e){AU.ctx=null}}
function auVol(){if(!AU.ctx)return;AU.mg.gain.value=SET.mute?0:SET.master;AU.gw.gain.value=SET.wpn;AU.gf.gain.value=SET.fx}
function auOn(){const c=AU.ctx;if(!c)return false;if(c.state==='suspended')c.resume().catch(()=>{});return c.state!=='closed'}
function noise(dest,t,dur,type,f,q,g,fe){const c=AU.ctx,s=c.createBufferSource();s.buffer=AU.nb;const fl=c.createBiquadFilter();fl.type=type;fl.frequency.setValueAtTime(f,t);if(fe)fl.frequency.exponentialRampToValueAtTime(fe,t+dur);fl.Q.value=q;
 const ga=c.createGain();ga.gain.setValueAtTime(g,t);ga.gain.exponentialRampToValueAtTime(.0008,t+dur);s.connect(fl);fl.connect(ga);ga.connect(dest);AU.n++;s.onended=()=>{AU.n--};s.start(t,Math.random()*.25);s.stop(t+dur+.02)}
function tone(dest,t,dur,f0,f1,g,type='sine'){const c=AU.ctx,o=c.createOscillator();o.type=type;o.frequency.setValueAtTime(f0,t);o.frequency.exponentialRampToValueAtTime(f1,t+dur);const ga=c.createGain();ga.gain.setValueAtTime(g,t);ga.gain.exponentialRampToValueAtTime(.0008,t+dur);o.connect(ga);ga.connect(dest);AU.n++;o.onended=()=>{AU.n--};o.start(t);o.stop(t+dur+.02)}
const sfx={
 shot(d){try{if(!auOn()||AU.n>36)return;const t=AU.ctx.currentTime,k=d.snd;noise(AU.gw,t,k.len,'lowpass',k.f,.7,k.g,k.f*.3);noise(AU.gw,t,.035,'highpass',2400,.5,k.g*.6);tone(AU.gw,t,.12,k.th,38,k.g*.9)}catch(e){}},
 dry(){try{if(!auOn())return;tone(AU.gw,AU.ctx.currentTime,.035,1500,800,.25,'triangle')}catch(e){}},
 hit(){try{if(!auOn())return;tone(AU.gf,AU.ctx.currentTime,.07,1900,1000,.16,'triangle')}catch(e){}},
 mag(out){try{if(!auOn())return;const t=AU.ctx.currentTime;noise(AU.gw,t,.06,'bandpass',out?800:1400,3,.5);tone(AU.gw,t,.05,out?300:520,120,.18)}catch(e){}},
 sel(){try{if(!auOn())return;noise(AU.gw,AU.ctx.currentTime,.04,'bandpass',1100,2,.3)}catch(e){}},
 ui(){try{if(!auOn()||AU.n>36)return;const t=AU.ctx.currentTime;tone(AU.gf,t,.05,980,620,.09,'triangle');noise(AU.gf,t,.02,'highpass',3000,.5,.05)}catch(e){}},
 pause(open){try{if(!auOn())return;const t=AU.ctx.currentTime;tone(AU.gf,t,.14,open?420:640,open?640:380,.1,'sine')}catch(e){}}};
const unlockAudio=()=>{if(STAGE<2)return;auInit();if(AU.ctx&&AU.ctx.state!=='running')auOn()};
for(const ev of['pointerdown','keydown','touchstart'])addEventListener(ev,unlockAudio,{passive:true});

/* ============ game state ============ */
const P={x:0,y:0,z:0,vx:0,vy:0,vz:0,yaw:0,pitch:0,on:true,stam:100,exh:false,sd:0,sprint:false,speed:0,dip:0,bob:0,stance:'stand',eye:1.68,climb:null};
P.leanV=0;P.leanDir=0;P.leanT=0;P.leanLim=0;P.latch=0;P.prevL=false;P.prevR=false;P.pendL=false;P.pendR=false; /* Beta 0.4.0-pre1: tactical lean state (camera offset only) */
const W={queue:null,slots:[],cur:0,act:'ready',t:0,rs:0,removed:false,inserted:false,pend:0,ads:false,adsK:0,trig:false,dry:false,cd:0,notice:'',noticeT:0};
const RFR=[.16,.30,.38,.16]; /* reload stages: start, remove magazine, insert magazine, finish */
const sel={f:'nato',c:'rifleman',kits:DMG.DEF_KITS};
const joy={id:-1,x:0,y:0},held={},tHeld={};
let state='menu',ready=false,locked=false,resScale=1,last=performance.now();
let jumpReq=false,dbgSp=0,dbgCap=0,sprintLatch=false,shots=0,hits=0,kick=0,rcP=0,rcY=0,flashT=0,lookDX=0,sway=0,sprintK=0;
const lerp=(a,b,t)=>a+(b-a)*t,sm=t=>t*t*(3-2*t);
const curS=()=>W.slots[W.cur];
const down=a=>!!(codesOf(a).some(k=>held[k])||tHeld[a]);

/* ---------- viewmodel rig ---------- */
const gunRig=new T.Group();camera.add(gunRig);for(const id in WM)gunRig.add(WM[id].root);
const flashTex=cvs(64,64,(g,w,h)=>{const r=g.createRadialGradient(32,32,0,32,32,32);r.addColorStop(0,'#fff');r.addColorStop(.3,'#ffd27a');r.addColorStop(1,'#0000');g.fillStyle=r;g.fillRect(0,0,w,h)});
const flash=new T.Group(),fm=new T.MeshBasicMaterial({map:flashTex,transparent:true,blending:T.AdditiveBlending,depthWrite:false,side:T.DoubleSide,fog:false});
{const a=new T.Mesh(new T.PlaneGeometry(.3,.3),fm),b=new T.Mesh(new T.PlaneGeometry(.3,.3),fm);b.rotation.y=Math.PI/2;flash.add(a,b);flash.visible=false;gunRig.add(flash)}
const sparks=[],sg=new T.SphereGeometry(1,6,4);let si=0;
for(let i=0;i<20;i++){const m=new T.Mesh(sg,new T.MeshBasicMaterial({color:0xffdd99,transparent:true,depthWrite:false}));m.visible=false;m.userData={life:0,sz:1};scene.add(m);sparks.push(m)}
const spark=(p,c,sz)=>{const m=sparks[si++%sparks.length];m.position.copy(p);m.material.color.setHex(c);m.userData.life=.2;m.userData.sz=sz;m.visible=true;m.scale.setScalar(sz)};

function showModel(i){for(const k in WM)WM[k].root.visible=false;const s=W.slots[i],m=WM[s.id];m.root.visible=true;resetVis(m);flash.position.set(...m.muz)}
function resetVis(m){m.mag.visible=true;m.mag.position.copy(m.magHome);m.lh.position.set(0,0,0);if(m.slide)m.slide.position.z=0;if(m.resetPose)m.resetPose()}
const setNotice=(s,t=1.4)=>{W.notice=s;W.noticeT=t};
/* ammunition resupply (Beta 0.3.0): unlimited; stand still inside a green ring for ~0.8 s to refill every weapon's reserve */
const RES_T=.8;let resT=0,resLock=null,resNear=null;
function updateResupply(dt){let near=null;for(const r of RESUPPLY)if(Math.hypot(P.x-r.x,P.z-r.z)<r.r){near=r;break}
 resNear=near;if(!near){resT=0;resLock=null;return}
 if(resLock===near.id)return;
 if(P.speed>.6){resT=0;return}
 resT+=dt;if(resT<RES_T)return;resT=0;
 let refilled=false;for(const s of W.slots){if(s.res<s.resMax)refilled=true;s.res=s.resMax}
 resLock=near.id;
 if(refilled){setNotice('RESUPPLIED - '+near.name,2.2);sfx.ui()}else setNotice('AMMUNITION ALREADY FULL',1.6)}

/* ---------- weapon state machine: ready | holster | draw | reload ---------- */
function startReload(){const s=curS();if(W.act!=='ready')return;
 if(s.mag>=s.def.mag)return;if(s.res<=0){setNotice('NO RESERVE AMMUNITION');return}
 W.ads=false;W.act='reload';W.rs=0;W.t=0;W.removed=W.inserted=false;W.trig=false;sfx.sel()}
function cancelReload(){if(W.act!=='reload')return;W.act='ready';W.t=0;resetVis(WM[curS().id])}
function reloadStep(dt){const s=curS(),d=s.def;W.t+=dt;let dur=d.reload*RFR[W.rs];
 while(W.t>=dur){W.t-=dur;const r=W.rs;
  if(r===1&&!W.removed){W.removed=true;s.res+=s.mag;s.mag=0;sfx.mag(true)}              /* old magazine out: its rounds return to the pool, exactly once */
  else if(r===2&&!W.inserted){W.inserted=true;const n=Math.min(d.mag,s.res);s.mag=n;s.res-=n;sfx.mag(false)} /* new magazine in: exactly once */
  if(r===3){W.act='ready';W.t=0;resetVis(WM[s.id]);return}
  W.rs++;dur=d.reload*RFR[W.rs]}}
function selectSlot(i){if(i<0||i>=W.slots.length)return;if(W.act==='holster'||W.act==='draw'){W.queue=i;return}if(i===W.cur)return;
 if(W.act==='reload')cancelReload();W.ads=false;W.trig=false;W.pend=i;W.act='holster';W.t=0;sfx.sel()}
function cycle(){selectSlot((W.cur+1)%W.slots.length)}
function toggleMode(){const s=curS(),m=s.def.modes;if(W.act==='holster')return;if(m.length<2){setNotice('SEMI-AUTO ONLY');return}s.mi=(s.mi+1)%m.length;W.trig=false;setNotice('FIRE MODE: '+MODE_LABEL[m[s.mi]]);sfx.sel()}
function toggleADS(){if(state!=='play'||P.sprint||!P.on)return;if(W.ads){W.ads=false;return}if(W.act==='ready')W.ads=true}
function wUpdate(dt){const s=curS(),d=s.def;
 if(W.cd>0)W.cd-=dt;
 if(W.act==='holster'){W.t+=dt;if(W.t>=d.hol){W.cur=W.pend;showModel(W.cur);W.act='draw';W.t=0;sfx.sel()}}
 else if(W.act==='draw'){W.t+=dt;if(W.t>=d.draw){W.act='ready';W.t=0;if(W.queue!=null&&W.queue!==W.cur){const q=W.queue;W.queue=null;selectSlot(q)}else W.queue=null}}
 else if(W.act==='reload')reloadStep(dt);
 if(W.act!=='ready'){W.trig=false;return}
 const c=curS(),auto=c.def.modes[c.mi]==='AUTO',want=auto?down('fire'):W.trig;
 if(!down('fire'))W.dry=false;
 if(want&&W.cd<=0){if(c.mag>0){shoot(c);W.trig=false}else{if(!W.dry){sfx.dry();W.dry=true;setNotice(c.res>0?'MAGAZINE EMPTY':'NO AMMUNITION',1.2)}W.trig=false}}}

/* ---------- shooting ---------- */
const rc=new T.Raycaster(),_o=new T.Vector3(),_d=new T.Vector3(),_pt=new T.Vector3();
function shoot(s){const d=s.def;s.mag--;shots++;if(WM[s.id]&&WM[s.id].onShot)WM[s.id].onShot();W.cd=60/d.rpm;
 const ak=1-.35*W.adsK;P.pitch+=d.kick*.5*ak;rcP=Math.min(.14,rcP+d.kick*.5*ak);rcY+=(Math.random()-.5)*2*d.side*ak;P.yaw+=(Math.random()-.5)*d.side*.5*ak;
 kick=Math.min(1.3,kick+1);flashT=.05;flash.scale.setScalar(d.fl);sfx.shot(d);
 camera.getWorldPosition(_o);camera.getWorldDirection(_d);
 let sp=lerp(d.hip,d.ads,W.adsK)+(P.speed>.5?d.mov*(1-W.adsK*.7):0)+(P.on?0:.03);
 const a=Math.random()*6.2832,r=Math.sqrt(Math.random())*sp;dbgSp=r;dbgCap=sp;_d.x+=Math.cos(a)*r;_d.y+=Math.sin(a)*r;_d.z+=(Math.random()-.5)*r;_d.normalize();
 if(NET.on)netShot(_o,_d);SHOOTER='player';spawnBullet(_o,_d,d);SHOOTER=null}

/* ---------- ballistics: travelling projectiles, gravity, segment collision, material penetration ---------- */
const GRAV=9.81,PEN_MIN=150,MAX_T=3.2,MAX_PEN=3,MAX_LIFE=2.5,MAX_RANGE=600,MAX_BUL=40,DEF_CAT={c:'blocking',R:1e9,col:0xffe2a0};
const bullets=[],rcB=new T.Raycaster(),rcX=new T.Raycaster(),_bA=new T.Vector3(),_bD=new T.Vector3(),_bV=new T.Vector3();
function spawnBullet(o,dir,def){CH.lastShot={x:o.x,z:o.z,t:CH.clock};CH.sounds.push({x:o.x,z:o.z,team:CH.playerTeam,t:CH.clock});const v=dir.clone().multiplyScalar(def.vel);const b={by:SHOOTER,p:o.clone(),o:o.clone(),v0:v.clone(),v,mass:def.mass,E:.5*def.mass*def.vel*def.vel,t:0,dist:0,alive:true,pen:0,hit:null,def};
 bullets.push(b);if(bullets.length>MAX_BUL)bullets.shift();return b}
/* distance along d from p to the far (exit) face of mesh; MAX_T if none found (treated as thick) */
const _tA=new T.Vector3(),_tD=new T.Vector3();
/* a window pane is 36 vertices (one box) inside its building's merged glass mesh; a hit collapses them so the ray passes */
function breakPane(mesh,k){const p=mesh.geometry.attributes.position;if(!p)return;for(let v=k*36;v<k*36+36&&v<p.count;v++)p.setXYZ(v,0,0,0);p.needsUpdate=true}
function thickAlong(mesh,p,d){if(mesh.isInstancedMesh)return .5; /* instanced bags/posts: nominal thickness (reverse ray could hit a neighbour) */const O=_tA.copy(p).addScaledVector(d,MAX_T);rcX.set(O,_tD.copy(d).negate());rcX.near=0;rcX.far=MAX_T+.01;
 const h=rcX.intersectObject(mesh,false);return h.length?MAX_T-h[0].distance:MAX_T}
/* first ground crossing on segment a->b, as a fraction in (0,1], or -1 */
function terrainCross(a,b){const fa=a.y-H(a.x,a.z),fb=b.y-H(b.x,b.z);if(!(fa>0&&fb<=0))return -1;let lo=0,hi=1;
 for(let k=0;k<8;k++){const m=(lo+hi)/2,x=a.x+(b.x-a.x)*m,y=a.y+(b.y-a.y)*m,z=a.z+(b.z-a.z)*m;if(y-H(x,z)>0)lo=m;else hi=m}return hi}
/* advance one projectile by dt; live = target boards still standing */
function stepBullet(b,dt,live){
 b.t+=dt;if(b.t>MAX_LIFE||b.dist>MAX_RANGE){b.alive=false;return}
 /* trapezoidal step: average velocity over the frame is exact for constant gravity, independent of frame length */
 const segV=_bV.copy(b.v);b.v.y-=GRAV*(b.def.dk||1)*dt;segV.add(b.v).multiplyScalar(.5*dt);const L=segV.length();if(L<=0)return;
 const d=_bD.copy(segV).normalize();let cur=_bA.copy(b.p),left=L,pen=0;
 for(let guard=0;guard<8;guard++){
  const end=new T.Vector3().copy(cur).addScaledVector(d,left);
  const tc=terrainCross(cur,end);
  let best=left,kind=0,ht=null,ho=null;
  if(tc>0){best=tc*left;kind=3}
  if(live.length){rcB.set(cur,d);rcB.near=0;rcB.far=best;const h=rcB.intersectObjects(live,false);if(h.length&&h[0].distance<best){best=h[0].distance;kind=1;ht=h[0].object.userData.t}}
  if(CH.charM.length){rcB.set(cur,d);rcB.near=0;rcB.far=best;const h=rcB.intersectObjects(CH.charM,false);if(h.length&&h[0].distance<best){best=h[0].distance;kind=4;ho=h[0]}}
  if(NET.on){const rh=netBulletHit(cur,d,best,b);if(rh){best=rh.t;kind=5;ho=rh}}
  rcB.set(cur,d);rcB.near=0;rcB.far=best;{const h=rcB.intersectObjects(occluders,false);if(h.length&&h[0].distance<best){best=h[0].distance;kind=2;ho=h[0]}}
  const pt=new T.Vector3().copy(cur).addScaledVector(d,best);
  if(kind===1){ht.state=1;ht.fl=.25;hits++;spark(pt,0xff6a3a,.14);sfx.hit();b.hit={kind:'target',E:b.E};b.alive=false;return}
  if(kind===4){hitChar(ho.object,pt,b);spark(pt,0x8a1a1a,.14);b.hit={kind:'char',E:b.E};b.alive=false;return}
  if(kind===5){netConfirmHit(ho);spark(pt,0x8a1a1a,.14);b.hit={kind:'char',E:b.E};b.alive=false;return}
  if(kind===0){cur=end;left=0;break}
  if(kind===3){spark(pt,0xa08a64,.16);b.hit={kind:'ground',E:b.E,stop:true};b.alive=false;return}
  if(ho.object.userData.glass){breakPane(ho.object,Math.floor(ho.face.a/36));spark(pt,0xcfe6f0,.09);const adv=best+.06;cur=new T.Vector3().copy(pt).addScaledVector(d,.06);left-=adv;if(left<=0)break;continue}
  const cat=OCC_CAT.get(ho.object.material)||DEF_CAT,t=thickAlong(ho.object,pt,d),cost=cat.R*t;
  if(cat.R>=1e8||b.E-cost<PEN_MIN){spark(pt,cat.col,.12);b.hit={kind:cat.c,stop:true,E:b.E};b.alive=false;return}
  const f=Math.sqrt(Math.max(0,b.E-cost)/b.E);b.E-=cost;b.v.multiplyScalar(f);pen++;b.pen++;
  const ex=new T.Vector3().copy(pt).addScaledVector(d,t);spark(ex,cat.col,.07);
  if(pen>=MAX_PEN){b.hit={kind:cat.c,stop:true,E:b.E,maxPen:true};b.alive=false;return}
  const adv=best+t+.02;cur=new T.Vector3().copy(pt).addScaledVector(d,t+.02);left-=adv;if(left<=0)break;
 }
 if(!b.alive)return;
 b.p.copy(cur).addScaledVector(d,Math.max(0,left));b.dist+=L;
}
/* tracer pool: one thin streak per live round so trajectory and bullet drop are visible (shared geometry and material) */
const TRC=[],trcGeo=new T.BoxGeometry(.014,.014,1),trcMat=new T.MeshBasicMaterial({color:0xffe6a0,fog:false}),_zAx=new T.Vector3(0,0,1),TRC_LEN=12;
for(let i=0;i<MAX_BUL;i++){const m=new T.Mesh(trcGeo,trcMat);m.visible=false;m.frustumCulled=false;scene.add(m);TRC.push(m)}
let trcUsed=0;
function updateTracers(){for(let i=0;i<trcUsed||i<bullets.length;i++){const m=TRC[i];if(!m)continue;const b=bullets[i];
 if(!b||!b.alive){m.visible=false;continue}
 const d=_bD.copy(b.v).normalize(),len=Math.min(TRC_LEN,b.dist+.5);
 m.position.copy(b.p).addScaledVector(d,-len/2);m.quaternion.setFromUnitVectors(_zAx,d);m.scale.set(1,1,len);m.visible=true}
 trcUsed=bullets.length}
function updateBullets(dt){if(!bullets.length){if(trcUsed){for(let i=0;i<trcUsed;i++)TRC[i].visible=false;trcUsed=0}return}const live=targets.filter(t=>t.state===0).map(t=>t.board);
 for(const b of bullets)if(b.alive)stepBullet(b,dt,live);
 for(let i=bullets.length-1;i>=0;i--)if(!bullets[i].alive)bullets.splice(i,1);
 updateTracers()}
/* test hook: fire a projectile from origin along dir with weapon id, run it to completion, report outcome */
function simulateShot(origin,dir,id,maxT){const def=WD[id];const b=spawnBullet(new T.Vector3(...origin),new T.Vector3(...dir).normalize(),def);
 const live=targets.filter(t=>t.state===0).map(t=>t.board);let n=0;while(b.alive&&b.t<(maxT||1e9)&&n<4000){stepBullet(b,1/120,live);n++}
 bullets.splice(bullets.indexOf(b),1);return{hit:b.hit,E0:.5*def.mass*def.vel*def.vel,E:b.E,pen:b.pen,p:[b.p.x,b.p.y,b.p.z],t:b.t}}

/* ---------- spawn / loadout ---------- */
function respawn(sp){bullets.length=0;for(const m of TRC)m.visible=false;trcUsed=0;Object.assign(P,{hp:100,x:sp.x,z:sp.z,yaw:sp.yaw,pitch:0,vx:0,vy:0,vz:0,stam:100,exh:false,on:true,dip:0,sprint:false,speed:0,sd:0,stance:'stand',eye:1.68,climb:null});P.y=H(P.x,P.z);shots=hits=0;rcP=rcY=0;dmgReset(sel.kits);
 targets.forEach(t=>{t.state=0;t.ang=0;t.hinge.rotation.x=0;t.fl=0;t.mat.color.setHex(0xffffff)})}
function deploy(again){const F=FACTIONS[sel.f],C=CLASSES[sel.c];if(RIG_SRC[sel.f]){fpRigBuild(sel.f,sel.c);for(const k in WM)WM[k].arms.visible=false}GM.slv.color.setHex(0xffffff);GM.slv.map=CAMO[sel.f];GM.slv.needsUpdate=true;$('clNote').textContent='';
 const mk=(id,mags)=>{const d=WD[id],n=(d.reserveMags||mags)*d.mag;return{id,def:d,mag:d.mag,res:n,resMax:n,mi:Math.max(0,d.modes.indexOf('AUTO'))}};
 W.slots=[mk(F.prim[sel.c],C.mags),mk(F.side,SIDE_MAGS)];W.cur=0;W.pend=0;applyOptic(F.prim[sel.c]);showModel(0);
 Object.assign(W,{queue:null,act:'draw',t:0,rs:0,ads:false,adsK:0,trig:false,dry:false,cd:0,noticeT:0});kick=0;sprintLatch=false;$('bs').classList.remove('on');
 respawn(BASES[F.base].spawn);if(!NET.on&&!again){spawnChars(F.base);cqBeginSP()}}
/* death, the downed state and revive: see damage.js */

/* ---------- collision (unchanged from Stage 1) ---------- */
/* a ramp's walking surface at (x,z), or null outside it: the ramp is a straight sloped strip of half-width hw */
function rampY(r,x,z){const dx=r.bx-r.ax,dz=r.bz-r.az,px=x-r.ax,pz=z-r.az,L2=r.L*r.L,t=(px*dx+pz*dz)/L2;if(t<-.02||t>1.02)return null;
 if(Math.abs(px*dz-pz*dx)/r.L>r.hw+.12)return null;return r.yA+(r.yB-r.yA)*Math.min(1,Math.max(0,t))}
function groundAt(x,z,f){let g=H(x,z);for(const b of boxes)if(b.top>g&&x>=b.x0-.05&&x<=b.x1+.05&&z>=b.z0-.05&&z<=b.z1+.05&&f>=b.top-.35)g=b.top;for(const c of circles)if(c.top!==undefined&&c.top>g&&f>=c.top-.35&&(x-c.x)**2+(z-c.z)**2<=(c.r+.1)**2)g=c.top;
 for(const r of RAMPS){const y=rampY(r,x,z);if(y!==null&&y>g&&f>=y-.35)g=y}return g}
function collide(){const r0=.4;
 for(const c of circles){if(c.top!==undefined&&P.y>=c.top-.25)continue;const dx=P.x-c.x,dz=P.z-c.z,rs=r0+c.r,d2=dx*dx+dz*dz;if(d2<rs*rs){const d=Math.sqrt(d2)||.001;P.x=c.x+dx/d*rs;P.z=c.z+dz/d*rs}}
 for(const b of boxes){if(P.y>=b.top-.35||P.y+1.7<=b.bot)continue; /* overhead slabs and lintels do not block a standing player */const cx=clamp(P.x,b.x0,b.x1),cz=clamp(P.z,b.z0,b.z1),dx=P.x-cx,dz=P.z-cz,d2=dx*dx+dz*dz;
  if(d2<r0*r0){if(d2>1e-8){const d=Math.sqrt(d2);P.x=cx+dx/d*r0;P.z=cz+dz/d*r0}else{const l=P.x-b.x0,r=b.x1-P.x,t=P.z-b.z0,u=b.z1-P.z,m=Math.min(l,r,t,u);if(m===l)P.x=b.x0-r0;else if(m===r)P.x=b.x1+r0;else if(m===t)P.z=b.z0-r0;else P.z=b.z1+r0}}}}

/* ---------- viewmodel animation ---------- */
const _o5=[0,0,0,0,0];
function reloadAnim(m,d,o){const r=W.rs,p=clamp(W.t/(d.reload*RFR[r]),0,1),e=sm(p);let tilt=1,mg=0,lhk=1,vis=true;
 if(r===0){tilt=e;lhk=e}else if(r===1){mg=e;vis=p<.92}else if(r===2){mg=1-e;vis=p>.12}else{tilt=1-e;lhk=1-e}
 const drop=(r===1||r===2)?-.2*mg:0;
 m.mag.visible=vis;m.mag.position.set(m.magHome.x,m.magHome.y+drop,m.magHome.z);
 m.lh.position.set(m.lhTo[0]*lhk,(m.lhTo[1]+drop)*lhk,m.lhTo[2]*lhk);
 o[0]=-.03*tilt;o[1]=.09*tilt;o[2]=.07*tilt;o[3]=.38*tilt;o[4]=-.5*tilt}
function gunPose(kb){const s=curS(),d=s.def,m=WM[s.id],a=W.adsK,h=d.hipPos,ap=m.adsPos;
 let x=lerp(h[0],ap[0],a),y=lerp(h[1],ap[1],a),z=lerp(h[2],ap[2],a),rx=0,ry=0,rz=0;const bob=1-.75*a;
 x+=Math.cos(P.bob)*.008*kb*bob;y+=Math.sin(P.bob*2)*.012*kb*bob;z+=kick*.045*(1-.5*a);rx+=kick*.05*(1-.4*a);
 y-=.05*sprintK;ry+=.5*sprintK;rx+=.15*sprintK;ry+=sway*(1-a);rx+=(d.kind==='rifle'?.1:.05)*(1-a);ry+=(d.kind==='rifle'?.12:.07)*(1-a);
 if(W.act==='holster'){const e=sm(clamp(W.t/d.hol,0,1));y-=.3*e;rx+=.8*e;x+=.05*e}
 else if(W.act==='draw'){const e=1-sm(clamp(W.t/d.draw,0,1));y-=.3*e;rx+=.8*e;x+=.05*e}
 else if(W.act==='reload'){if(m.reloadPose)m.reloadPose(W.rs,clamp(W.t/(d.reload*RFR[W.rs]),0,1),_o5);else reloadAnim(m,d,_o5);x+=_o5[0];y+=_o5[1];z+=_o5[2];rx+=_o5[3];rz+=_o5[4]}
 if(m.slide)m.slide.position.z=(s.mag===0&&W.act==='ready')?.032:kick*.02;
 gunRig.position.set(x,y,z);gunRig.rotation.set(rx,ry,rz)}

/* ---------- per-frame update ---------- */
function update(dt){fpRigFrame();for(const k in WM)if(WM[k].anim)WM[k].anim(dt);
 
 let f=(down('fwd')?1:0)-(down('back')?1:0)+joy.y,st=(down('right')?1:0)-(down('left')?1:0)+joy.x;const l=Math.hypot(f,st);if(l>1){f/=l;st/=l}
 const fireHeld=down('fire');
 P.sprint=(down('sprint')||sprintLatch)&&f>.3&&!P.exh&&P.stam>0&&!fireHeld&&P.stance==='stand'&&!P.climb;
 if(P.sprint)W.ads=false;
 W.adsK+=((W.ads?1:0)-W.adsK)*Math.min(1,10*dt);if(!W.ads&&W.adsK<.002)W.adsK=0;
 P.eye+=((P.stance==='stand'?1.68:P.stance==='crouch'?1.05:.45)-P.eye)*Math.min(1,10*dt);const sp=(P.sprint?7.2:P.stance==='stand'?4.4:P.stance==='crouch'?2.2:1.1)*(1-.45*W.adsK),sy=Math.sin(P.yaw),cy=Math.cos(P.yaw),k=Math.min(1,(P.on?12:2.2)*dt);
 P.vx+=((-sy*f+cy*st)*sp-P.vx)*k;P.vz+=((-cy*f-sy*st)*sp-P.vz)*k;
 if(P.sprint&&l>.1){P.stam-=20*dt;P.sd=.8;if(P.stam<=0){P.stam=0;P.exh=true;sprintLatch=false;$('bs').classList.remove('on')}}else{P.sd-=dt;if(P.sd<=0)P.stam=Math.min(100,P.stam+16*dt)}
 if(P.exh&&P.stam>=25)P.exh=false;
 if(P.on&&P.stance==='stand'&&!P.climb&&(down('jump')||jumpReq)&&!(jumpReq&&startClimb())){P.vy=7;P.on=false;W.ads=false}jumpReq=false;
 if(P.climb)climbStep(dt);else{
 P.x=clamp(P.x+P.vx*dt,-MAP_H+6,MAP_H-6);P.z=clamp(P.z+P.vz*dt,-MAP_H+6,MAP_H-6);collide();
 const was=P.on;P.vy-=22*dt;P.y+=P.vy*dt;const g=groundAt(P.x,P.z,P.y);
 if(P.y<=g){if(P.vy<-8)P.dip=Math.min(.25,-P.vy*.015);P.y=g;P.vy=0;P.on=true}else if(was&&P.y-g<.3&&P.vy<=0){P.y=g;P.vy=0;P.on=true}else P.on=false}
 if(!P.on)W.ads=false;
 const spd=Math.hypot(P.vx,P.vz);P.speed=spd;P.bob+=dt*spd*(P.on?1.7:0);P.dip*=Math.pow(.02,dt);const kb=P.on?clamp(spd/4.4,0,1.3):0;
 const d=curS().def;rcP*=Math.exp(-d.rec*dt);rcY*=Math.exp(-d.rec*dt);P.pitch=clamp(P.pitch,-1.5,1.5);
 leanUpdate(dt);camera.position.set(P.x+Math.cos(P.bob)*.015*kb*(1-.7*W.adsK),P.y+P.eye+Math.sin(P.bob*2)*.03*kb*(1-.7*W.adsK)-P.dip,P.z);camera.rotation.set(clamp(P.pitch+rcP,-1.55,1.55),P.yaw+rcY,-P.leanV*.45);camera.position.x+=Math.cos(P.yaw)*P.leanV;camera.position.z-=Math.sin(P.yaw)*P.leanV;
 const fov=P.sprint?76:lerp(70,W.cur===0?adsFovFor(d.adsFov):d.adsFov,W.adsK);if(Math.abs(camera.fov-fov)>.05){camera.fov+=(fov-camera.fov)*Math.min(1,10*dt);camera.updateProjectionMatrix()}
 wUpdate(dt);
 kick=Math.max(0,kick-dt*7);flashT-=dt;flash.visible=flashT>0;if(flash.visible)flash.rotation.z=Math.random()*3;
 sprintK+=((P.sprint?1:0)-sprintK)*Math.min(1,8*dt);sway+=(clamp(-lookDX*.6,-.06,.06)-sway)*Math.min(1,10*dt);lookDX=0;
 gunPose(kb);
 if(W.noticeT>0)W.noticeT-=dt;
 updateWorld(dt)}
function updateWorld(dt){ updateChars(dt); updateBullets(dt); updateResupply(dt); /* world-side simulation: reusable by future AI / PvE systems */
 for(const t of targets){if(t.fl>0){t.fl-=dt;t.mat.color.setRGB(1,1-t.fl*3,1-t.fl*3)}else if(t.mat.color.g<1)t.mat.color.setHex(0xffffff);
  if(t.state===1){t.ang+=dt*7;if(t.ang>=Math.PI/2){t.ang=Math.PI/2;t.state=2;t.t=0}}else if(t.state===2){t.t+=dt;if(t.t>3.5)t.state=3}else if(t.state===3){t.ang-=dt*3;if(t.ang<=0){t.ang=0;t.state=0}}
  t.hinge.rotation.x=-t.ang}
 for(const m of sparks)if(m.userData.life>0){m.userData.life-=dt;const q=Math.max(0,m.userData.life/.2);m.scale.setScalar(m.userData.sz*(2-q));m.material.opacity=q;if(q<=0)m.visible=false}

 flagT+=dt;for(const f of flags){const ph=f.userData.ph||0;f.rotation.y=Math.sin(flagT*2+ph)*.25;f.rotation.z=Math.sin(flagT*3+ph)*.05}
 sun.position.set(P.x+60,P.y+90,P.z+40);sun.target.position.set(P.x,P.y,P.z)}

/* ============ HUD ============ */
const keyName=c=>({Mouse0:'LMB',Mouse1:'MMB',Mouse2:'RMB',Mouse3:'M4',Mouse4:'M5',ShiftLeft:'SHIFT',ControlLeft:'CTRL',ControlRight:'CTRL',AltLeft:'ALT',AltRight:'ALT',Space:'SPACE',ArrowUp:'UP',ArrowDown:'DOWN',ArrowLeft:'LEFT',ArrowRight:'RIGHT',Backquote:'`',Minus:'-',Equal:'=',Comma:',',Period:'.',Slash:'/',Semicolon:';',Quote:"'",Backslash:'\\',BracketLeft:'[',BracketRight:']',Tab:'TAB',Enter:'ENTER',Backspace:'BKSP'}[c]||c.replace(/^Key|^Digit/,'').replace(/^Numpad/,'NUM '));
const E={};for(const id of['fc','wsl','wn','wm','wam','wrs','wp','wic','ctx','st1','sta','stb','fps','cmpd','cmpc','cmp','bads','bm','mini'])E[id]=$(id);
const setT=(el,v)=>{if(el._v!==v){el._v=v;el.textContent=v}};
const cc=E.cmpc,cg2=cc.getContext('2d');let cmpW=300,cmpH=34,cmpDpr=1,cmpLast=-999;
function cmpSize(){const r=E.cmp.getBoundingClientRect();if(!r.width)return;cmpDpr=Math.min(2,devicePixelRatio||1);cmpW=r.width;cmpH=r.height;cc.width=Math.round(cmpW*cmpDpr);cc.height=Math.round(cmpH*cmpDpr);cmpLast=-999}
const CARD={0:'N',45:'NE',90:'E',135:'SE',180:'S',225:'SW',270:'W',315:'NW'};
function drawCmp(h){const w=cmpW,hh=cmpH,span=110,px=w/span;cg2.setTransform(cmpDpr,0,0,cmpDpr,0,0);cg2.clearRect(0,0,w,hh);cg2.textAlign='center';cg2.fillStyle='#d6d8c4';cg2.strokeStyle='#d6d8c4';cg2.lineWidth=1;
 for(let a=Math.ceil((h-span/2)/5)*5;a<=h+span/2;a+=5){const n=((a%360)+360)%360,x=w/2+(a-h)*px;let len=4;if(n%15===0)len=8;if(n%45===0)len=12;
  cg2.globalAlpha=n%15===0?.95:.5;cg2.beginPath();cg2.moveTo(x,hh-1);cg2.lineTo(x,hh-1-len);cg2.stroke();
  if(n%45===0){cg2.font='600 12px sans-serif';cg2.globalAlpha=1;cg2.fillText(CARD[n],x,hh-17)}else if(n%30===0){cg2.font='10px sans-serif';cg2.globalAlpha=.8;cg2.fillText(String(n),x,hh-13)}}
 cg2.globalAlpha=1}
function heading(){return((-P.yaw*180/Math.PI)%360+360)%360}
/* Beta 0.3.75 minimap: a static terrain/forest/road base image (built once), plus player and object markers drawn each tick */
const MM=document.getElementById('mm'),mmx=MM?MM.getContext('2d'):null,MM_N=608,MM_WIN=320;let mmBase=null,mmT=0;
if(MM)MM.addEventListener('click',()=>toggleFullMap());
function buildMinimapBase(){const S=MM_N/(MAP_H*2),c=document.createElement('canvas');c.width=c.height=MM_N;const g=c.getContext('2d');
 const px=(x,z)=>[(x+MAP_H)*S,(z+MAP_H)*S];
 /* the urban map: lawn outside, then blocks (concrete, lawn for parks and houses, sand for the bases), streets, building footprints */
 g.fillStyle='#55683a';g.fillRect(0,0,MM_N,MM_N);
 for(let j=0;j<BLK_C.length;j++)for(let i=0;i<BLK_C.length;i++){const d=DISTRICT[j][i],[a,b]=px(BLK_C[i]-BLK_EDGE,BLK_C[j]-BLK_EDGE),w=2*BLK_EDGE*S;
  g.fillStyle=d==='G'||d==='H'||d==='R'?'#5f7a45':d==='N'||d==='W'?'#b0a47c':'#8f8b80';g.fillRect(a,b,w,w)}
 g.fillStyle='#3d4044';
 for(const s0 of STREET_C){let[a,b]=px(-186,s0-STREET_HW),[e,f]=px(186,s0+STREET_HW);g.fillRect(a,b,e-a,f-b);[a,b]=px(s0-STREET_HW,-186);[e,f]=px(s0+STREET_HW,186);g.fillRect(a,b,e-a,f-b)}
 g.fillStyle='#d2cab4';for(const q of FOOT){const[a,b]=px(q.x0,q.z0),[e,f]=px(q.x1,q.z1);g.fillRect(a,b,e-a,f-b)}
 g.font='bold 12px sans-serif';g.textAlign='center';g.textBaseline='middle';
 for(const p of CQ_POINTS){const[a,b]=px(p.x,p.z);g.strokeStyle='#e0d8a8';g.lineWidth=1.5;g.beginPath();g.arc(a,b,22*S,0,7);g.stroke();g.fillStyle='#f0ecd0';g.fillText(p.name,a,b)}
 for(const k of['nato','wp']){const B=BASES[k],[a,b]=px(B.x,B.z);g.fillStyle=k==='nato'?'#3f6fc0':'#c04040';g.fillRect(a-6,b-6,12,12);g.fillStyle='#fff';g.fillText(k==='nato'?'N':'W',a,b+.5)}
 return c}
function drawMinimap(){if(!mmx||!ready||state!=='play')return;if(!mmBase)mmBase=buildMinimapBase();const S=MM_N/(MAP_H*2),half=MM_WIN*S/2;
 let cx=(P.x+MAP_H)*S,cz=(P.z+MAP_H)*S;cx=clamp(cx,half,MM_N-half);cz=clamp(cz,half,MM_N-half);
 const C=MM.width,k=C/(MM_WIN*S);mmx.save();mmx.beginPath();mmx.arc(C/2,C/2,C/2,0,7);mmx.clip();mmx.fillStyle='#14180f';mmx.fillRect(0,0,C,C);
 mmx.drawImage(mmBase,cx-half,cz-half,half*2,half*2,0,0,C,C);
 const toM=(x,z)=>[C/2+((x+MAP_H)*S-cx)*k,C/2+((z+MAP_H)*S-cz)*k];
 mmx.fillStyle='#e0d8a8';mmx.font='bold 14px sans-serif';mmx.textAlign='center';mmx.textBaseline='top';mmx.fillText('N',C/2,4);
 const[px0,pz0]=[C/2,C/2];const fx=-Math.sin(P.yaw),fz=-Math.cos(P.yaw);
 mmx.save();mmx.translate(px0,pz0);mmx.rotate(Math.atan2(fz,fx)+Math.PI/2);mmx.fillStyle='#ffd35a';mmx.beginPath();mmx.moveTo(0,-11);mmx.lineTo(7,8);mmx.lineTo(0,4);mmx.lineTo(-7,8);mmx.closePath();mmx.fill();mmx.restore();
 mmx.restore();
 allyDots(mmx,toM,C);mmx.strokeStyle='rgba(226,224,190,.45)';mmx.lineWidth=1.5;mmx.beginPath();mmx.arc(C/2,C/2,C/2-1,0,7);mmx.stroke()}
function hudTick(fps){const s=curS();if(!s)return;const d=s.def,m=d.modes[s.mi];
 setT(E.wn,d.name);setT(E.wm,MODE_LABEL[m]);setT(E.wam,String(s.mag).padStart(2,'0'));setT(E.wrs,'/ '+s.res);
 if(E.wic._k!==s.id){E.wic._k=s.id;E.wic.innerHTML=ICONS[s.id]}
 E.wp.className=s.mag===0?'empty':s.mag<=Math.ceil(d.mag*.25)?'low':'';E.wp.querySelector('#wbar i').style.width=(s.mag/d.mag*100)+'%';
 const pis=d.modes.length<2;if(E.wm._h!==pis){E.wm._h=pis;E.wm.style.display=pis?'none':'';E.bm.style.display=pis?'none':''}
 if(E.fc){setT(E.fc,FACTIONS[sel.f].name+' / '+CLASSES[sel.c].name)}
 setT(E.wsl,(W.cur===0?'PRIMARY':'SIDEARM'));
 {const bu=hudTick.bu||(hudTick.bu=$('bu'));if(bu)bu.style.display='none'}
 let msg='';if(W.noticeT>0)msg=W.notice;else if(W.act==='reload')msg='RELOADING';else if(W.act==='holster'||W.act==='draw')msg='SWITCHING';
 else if(W.act==='ready'&&s.mag===0)msg=s.res>0?'MAGAZINE EMPTY - '+(touch?'TAP RELOAD':keyName(SET.binds.reload)+' TO RELOAD'):'NO AMMUNITION';
 else if(state==='play'&&resNear&&resNear.id!==resLock)msg='RESUPPLY POINT - STAND STILL';

 else if(state==='play'&&P.on&&!P.climb&&P.stance==='stand'&&climbTarget())msg=(touch?'TAP JUMP':keyName(SET.binds.jump))+' TO CLIMB';
 else if(state==='play'&&P.stance!=='stand')msg=P.stance==='crouch'?'CROUCHED':'PRONE';
 else if(state==='play'&&!touch&&!locked)msg='CLICK TO CAPTURE MOUSE';
 setT(E.ctx,msg);E.ctx.classList.toggle('on',!!msg);
 if(STAGE<2)setT(E.mini,d.name+'  '+MODE_LABEL[m]+'   '+s.mag+' / '+s.res);
 setT(E.st1,'TARGETS  HITS '+hits+'  SHOTS '+shots+(shots?'  ACC '+Math.round(hits/shots*100)+'%':'')+'  '+dmgHudText());
 E.sta.style.width=P.stam+'%';E.stb.style.opacity=P.stam<99?.8:0;
 E.bads.classList.toggle('on',W.ads);setT(E.bm.querySelector('.mlab'),m==='AUTO'?'AUTO':'SEMI');
 if(fps)setT(E.fps,SET.fps?fps+' FPS  RES '+Math.round(resScale*100)+'%':'')}

/* ============ rendering quality ============ */
function applyRes(){const w=innerWidth,h=innerHeight;renderer.setPixelRatio(Math.min(devicePixelRatio||1,Qc.cap)*Qc.base*resScale*SET.res);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
 prev.cam.aspect=w/h;prev.cam.setViewOffset(w,h,-w*.2,0,w,h);prev.cam.updateProjectionMatrix();cmpSize()}
function applyFog(){scene.fog.near=Qc.fog[0]*SET.view;scene.fog.far=Qc.fog[1]*SET.view}
function applyShadow(){const on=Qc.shadow>0&&SET.shadow;if(on&&Qc.shadow&&sun.shadow.mapSize.x!==Qc.shadow){sun.shadow.mapSize.set(Qc.shadow,Qc.shadow);if(sun.shadow.map){sun.shadow.map.dispose();sun.shadow.map=null}}
 if(renderer.shadowMap.enabled!==on){renderer.shadowMap.enabled=on;scene.traverse(o=>{if(o.material)[].concat(o.material).forEach(m=>{m.needsUpdate=true})})}sun.castShadow=on}
function setQ(n){Qn=n;Qc=Q[n];SET.q=n;saveSet();resScale=1;
 applyRes();applyFog();applyShadow();buildWorld();applyShadow()}
addEventListener('resize',applyRes);

/* ============ menus / screens ============ */
const ui={v:'',prev:''},cap={a:null,idx:-1,conf:null};
function setState(s){state=s;document.body.dataset.s=s}
function view(v,prev){if(prev!==undefined)ui.prev=prev;ui.v=v;document.body.dataset.v=v||'';const m=$('menu');m.style.display=v?'flex':'none';for(const s of m.children)s.classList.toggle('on',s.id==='s-'+v);
 cap.a=null;cap.conf=null;if(v==='class')renderClass();else if(v==='ally')alOpen();else if(v==='controls')renderControls();else if(v==='graphics')syncGfx();else if(v==='audio')syncAudio();else if(v==='gun')renderGunsmith();else if(v==='servers')netPrefs();
 if(v==='faction'||v==='home')setPreview(sel.f,sel.c);if(v==='home')renderAccount()}
const fsTry=()=>{try{const d=document.documentElement;if(d.requestFullscreen)d.requestFullscreen().then(()=>screen.orientation&&screen.orientation.lock&&screen.orientation.lock('landscape')).catch(()=>{})}catch(e){}};
const lock=()=>{try{const p=renderer.domElement.requestPointerLock();if(p&&p.catch)p.catch(()=>{})}catch(e){}};
function clearInput(){for(const k in held)held[k]=false;for(const k in tHeld)tHeld[k]=false;joyReset();W.trig=false;sprintLatch=false;$('bs').classList.remove('on')}
function enterPlay(){view('');setState('play');cmpSize();last=performance.now();if(touch)fsTry();else lock()}
function pause(){if(state!=='play')return;sfx.pause(true);clearInput();setState('pause');view('pause','');if(document.pointerLockElement)document.exitPointerLock()}
function resume(){sfx.pause(false);enterPlay()}
let MATCH_ON=false;
function toFaction(){clearInput();netLeave();MATCH_ON=false;setState('menu');view('home','')}
function renderClass(){kitShow();const F=FACTIONS[sel.f],C=CLASSES[sel.c],P1=WD[F.prim[sel.c]],S1=WD[F.side];setPreview(sel.f,sel.c);$('bBack').textContent=NET.on?'Leave match':'Back';
 $('cf-f').textContent=F.name+' - '+(sel.f==='nato'?'US-PATTERN KIT, 1968':'SOVIET / EASTERN BLOC KIT');
 for(const b of document.querySelectorAll('.tab'))b.classList.toggle('sel',b.dataset.c===sel.c);
 const lim=C.limit===Infinity?'Unlimited':C.limit+' per team';
 const wl=(w,mags)=>w.name+'<small>'+w.cal+' - '+w.mag+'-round magazine, '+(w.reserveMags||mags)*w.mag+' reserve - '+w.modes.map(x=>MODE_LABEL[x]).join(' / ')+'</small>';
 $('cf-sheet').innerHTML='<div class="sr"><i>Faction</i><span>'+F.name+'</span></div><div class="sr"><i>Class</i><span>'+C.name+'<small>Class limit: '+lim+' (not enforced)</small></span></div>'+
  '<div class="sr"><i>Primary</i><span>'+wl(P1,C.mags)+'</span></div><div class="sr"><i>Sidearm</i><span>'+wl(S1,SIDE_MAGS)+'</span></div><div class="sr"><i>Equipment</i><span>'+C.gear[sel.f]+'</span></div>';
 $('bDeploy').textContent='DEPLOY AS '+C.name.toUpperCase();$('bDeploy').classList.toggle('dis',!classAvailable(sel.c))}
function renderControls(){const kb=$('kb');kb.innerHTML='';$('kbw').classList.toggle('hide',touch);$('tcw').classList.toggle('hide',!touch);
 $('gLean').textContent='Lean: '+(SET.leanMode==='toggle'?'TOGGLE (tap to lean, tap again to stop)':'HOLD (lean while key is held)');
 const sv=$('sens');sv.value=Math.round((touch?SET.touch:SET.mouse)*100);$('sensV').textContent=sv.value+'%';$('sensL').textContent=touch?'Touch look':'Mouse look';
 if(touch)return;
 const mkb=(txt,cls,fn)=>{const b=document.createElement('button');b.className='kb'+(cls?' '+cls:'');b.textContent=txt;b.onclick=fn;return b};
 for(const[a,label]of ACTS){const r=document.createElement('div');r.className='kr';const sp=document.createElement('span');sp.textContent=label;const kk=document.createElement('div');kk.className='kkeys';
  const codes=codesOf(a);
  codes.forEach((k,i)=>{const on=cap.a===a&&cap.idx===i;
   kk.append(mkb(on?'PRESS KEY...':keyName(k),on?'cap':'',()=>{if(on){capture('Mouse0');return}cap.a=a;cap.idx=i;cap.conf=null;renderControls()}));
   if(i>0)kk.append(mkb('×','kx',()=>{removeSlot(a,i);saveSet();renderControls()}))});
  if(cap.a===a&&cap.idx===-1)kk.append(mkb('PRESS KEY...','cap',()=>capture('Mouse0')));
  else if(codes.length<MAX_KEYS)kk.append(mkb('+','kadd',()=>{cap.a=a;cap.idx=-1;cap.conf=null;renderControls()}));
  r.append(sp,kk);kb.append(r)}
 const kc=$('kc');kc.innerHTML='';
 if(cap.conf){const{a,idx,other,code,ok}=cap.conf,nm=x=>ACTS.find(y=>y[0]===x)[1];const t=document.createElement('div');
  t.textContent=!ok?keyName(code)+' is the only key for "'+nm(other)+'", so it cannot be moved. Cancel.':keyName(code)+' is already used for "'+nm(other)+'". '+(idx>=0?'Swap the two bindings, or cancel.':'Move it to this action, or cancel.');kc.append(t);
  const old=idx>=0?codesOf(a)[idx]:null;
  if(ok)kc.append(mkb(old?'SWAP':'MOVE','',()=>{applyBind(a,idx,code,other);cap.conf=null;saveSet();renderControls()}));
  kc.append(mkb('CANCEL','',()=>{cap.conf=null;renderControls()}))}}
function capture(code){if(code==='Escape'){cap.a=null;renderControls();return}const a=cap.a;if(!a)return;
 const codes=codesOf(a);if(codes.includes(code)){cap.a=null;cap.conf=null;renderControls();return}
 const other=Object.keys(DEFBINDS).find(k=>k!==a&&codesOf(k).includes(code));
 if(other){const old=cap.idx>=0?codes[cap.idx]:null,oc=codesOf(other);cap.conf={a,idx:cap.idx,other,code,ok:!!((old&&!oc.includes(old))||oc.length>1)};cap.a=null;renderControls();return}
 setSlot(a,cap.idx,code);cap.a=null;cap.conf=null;saveSet();renderControls()}
function syncGfx(){for(const[id,v,fmt]of[['gRes',SET.res*100,x=>x+'%'],['gView',SET.view*100,x=>x+'%']]){const el=$(id);el.value=Math.round(v);el.nextElementSibling.textContent=fmt(el.value)}
 $('gShadow').textContent='Shadows: '+(Q[SET.q].shadow?(SET.shadow?'ON':'OFF'):'N/A (Low)');$('gShadow').classList.toggle('dis',!Q[SET.q].shadow);
$('qlow').classList.toggle('sel',SET.q==='low');$('qmed').classList.toggle('sel',SET.q==='med');$('qhigh').classList.toggle('sel',SET.q==='high');$('gFps').textContent='Performance readout: '+(SET.fps?'ON':'OFF')}
function syncAudio(){$('aMute').textContent='Mute: '+(SET.mute?'ON':'OFF');for(const[id,k]of[['vMaster','master'],['vWpn','wpn'],['vFx','fx']]){const el=$(id);el.value=Math.round(SET[k]*100);el.nextElementSibling.textContent=el.value+'%'}}
/* wire up menu buttons */
for(const b of document.querySelectorAll('#menu [data-f]')){b.onclick=()=>{sel.f=b.dataset.f;view('class','faction')};b.onmouseenter=()=>setPreview(b.dataset.f,sel.c)}
for(const b of document.querySelectorAll('#menu .tab'))b.onclick=()=>{sel.c=b.dataset.c;renderClass()};
for(const b of document.querySelectorAll('#menu [data-go]'))b.onclick=()=>view(b.dataset.go,ui.v);
for(const b of document.querySelectorAll('#menu [data-back]'))b.onclick=()=>view(ui.prev);
$('bBack').onclick=()=>NET.on?toFaction():view(ui.prev);$('fBack').onclick=()=>view('mode','');
$('accLogin').onclick=()=>accSubmit(false);$('accReg').onclick=()=>accSubmit(true);$('accOut').onclick=()=>accLogout(false);
$('pveBtn').onclick=()=>{NET.mode='sp';view('faction','mode')};$('pvpBtn').onclick=()=>pvpStart();
$('srvRefresh').onclick=netList;$('fmClose').onclick=toggleFullMap;$('admBtn').onclick=netAdminToggle;$('admClose').onclick=netAdminToggle;
$('admRestart').onclick=()=>netSend({type:'admin',action:'restart'});$('meAgain').onclick=()=>{cqHide();MATCH_ON=true;deploy(false);enterPlay()};$('meMenu').onclick=()=>{cqHide();toFaction()};
$('bDeploy').onclick=()=>{if(!classAvailable(sel.c))return;
 if(NET.mode==='mp'){if(NET.on){deploy(true);enterPlay();return}auInit();auOn();netConnect();return}
 auInit();auOn();deploy(MATCH_ON);MATCH_ON=true;enterPlay()};

/* ---------- spawn on an ally (0.4.0 pre-release 17, update 3) ---------- */
const AL={zoom:1,cx:0,cz:0,sel:null,last:null,lastT:0,open:(()=>{try{return localStorage.getItem('fc_ally_open')!=='0'}catch(e){return true}})()};
let alTimer=0;
const alTeam=()=>CH.playerTeam||FACTIONS[sel.f].base;
const alList=()=>NET.on?[...NET.players.values()].filter(p=>p.id!==NET.id&&p.alive&&!p.down&&p.team===alTeam()):CH.all.filter(o=>o.kind==='soldier'&&o.team===alTeam()&&o.state!=='dead');
function alSpot(c){const yaw=BASES[FACTIONS[sel.f].base].spawn.yaw;
 for(const r of[2.2,3.2])for(let k=0;k<8;k++){const a=k*Math.PI/4,x=c.x+Math.cos(a)*r,z=c.z+Math.sin(a)*r;
  if(boxes.some(b=>x>b.x0-.6&&x<b.x1+.6&&z>b.z0-.6&&z<b.z1+.6&&b.top>H(x,z)+.5))continue;
  if(CH.all.some(o=>o!==c&&o.state!=='dead'&&Math.hypot(o.x-x,o.z-z)<1.2))continue;
  return{x,z,yaw}}
 return{x:c.x,z:c.z+2.2,yaw}}
function alOpen(){AL.zoom=1;AL.cx=0;AL.cz=0;alRender();clearInterval(alTimer);alTimer=setInterval(()=>{if(ui.v!=='ally'){clearInterval(alTimer);return}alRender()},400)}
function alRender(){const cv=$('alMap');if(!cv)return;
 const list=alList();if(AL.sel&&!list.includes(AL.sel))AL.sel=null;
 const idx=AL.sel?list.indexOf(AL.sel)+1:0;
 $('alCount').textContent=list.length+' ALLIES IN THE FIELD • '+list.filter(o=>o.hp>=50).length+' READY';
 $('alPick').textContent=AL.sel?'ALLY '+idx+' SELECTED':'SELECT AN ALLY';
 $('alSpawn').disabled=!AL.sel;$('alSpawn').textContent=AL.sel?'SPAWN ON ALLY '+idx:'SELECT A SPAWN';
 $('alTog').textContent=AL.open?'ON':'OFF';
 const dpr=devicePixelRatio||1,W=cv.clientWidth,Hh=cv.clientHeight;if(!W||!Hh)return;
 if(cv.width!==Math.round(W*dpr)||cv.height!==Math.round(Hh*dpr)){cv.width=Math.round(W*dpr);cv.height=Math.round(Hh*dpr)}
 const g=cv.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);g.fillStyle='#161a13';g.fillRect(0,0,W,Hh);
 const k=Math.min(W,Hh)/(2*MAP_H/AL.zoom),px=x=>W/2+(x-AL.cx)*k,pz=z=>Hh/2+(z-AL.cz)*k;
 g.strokeStyle='#2a3024';g.lineWidth=1;for(let v=-MAP_H;v<=MAP_H;v+=200){g.beginPath();g.moveTo(px(v),0);g.lineTo(px(v),Hh);g.moveTo(0,pz(v));g.lineTo(W,pz(v));g.stroke()}
 g.strokeStyle='#6d7a58';g.lineWidth=2;g.strokeRect(px(-MAP_H),pz(-MAP_H),2*MAP_H*k,2*MAP_H*k);
 for(const[key,b]of[['nato',BASES.nato],['wp',BASES.wp]]){g.beginPath();g.arc(px(b.x),pz(b.z),Math.max(4,b.radius*k),0,7);g.fillStyle=key===sel.f?'rgba(120,150,90,.35)':'rgba(150,80,70,.25)';g.fill();g.strokeStyle='#aab58c';g.lineWidth=1;g.stroke();g.fillStyle='#d8dcc4';g.font='12px monospace';const lab=key==='nato'?'NATO BASE':'WARSAW PACT BASE',tw=g.measureText(lab).width,lx=px(b.x),lft=lx+8+tw>W-64;g.fillText(lab,lft?lx-8-tw:lx+8,pz(b.z)-8)}
 for(const o of list){const x=px(o.x),y=pz(o.z);
  if(o===AL.sel){g.beginPath();g.arc(x,y,11,0,7);g.strokeStyle='#ffd35a';g.lineWidth=2;g.stroke()}
  g.beginPath();g.arc(x,y,6,0,7);g.fillStyle=o.hp>=50?'#ff4d3d':'#a8453c';g.fill();g.strokeStyle='#10130a';g.lineWidth=1.5;g.stroke()}
 g.beginPath();g.arc(px(P.x),pz(P.z),4,0,7);g.fillStyle='#f4f4e8';g.fill();
}
function alHit(ev){const cv=$('alMap'),r=cv.getBoundingClientRect(),mx=ev.clientX-r.left,my=ev.clientY-r.top,W=cv.clientWidth,Hh=cv.clientHeight,k=Math.min(W,Hh)/(2*MAP_H/AL.zoom);
 let best=null,bd=26;for(const o of alList()){const d=Math.hypot(W/2+(o.x-AL.cx)*k-mx,Hh/2+(o.z-AL.cz)*k-my);if(d<bd){bd=d;best=o}}return best}
function spawnOnAlly(c){if(!alList().includes(c)){alRender();return}
 if(!classAvailable(sel.c)){$('alNote').textContent='That role is not available.';return}
  const at=alSpot(c);auInit();auOn();deploy(true);MATCH_ON=true;respawn(at);enterPlay()}
$('bAlly').onclick=()=>{if(!alList().length){$('clNote').textContent='No allies in the field. Deploy at base to start a match.';return}view('ally','class')};
$('alMap').onpointerdown=ev=>{const o=alHit(ev);if(!o){AL.last=null;AL.sel=null;alRender();return}
 const now=performance.now();if(AL.last===o&&now-AL.lastT<380){AL.last=null;spawnOnAlly(o);return}
 AL.last=o;AL.lastT=now;AL.sel=o;alRender()};
$('alZin').onclick=()=>{AL.zoom=Math.min(8,AL.zoom*1.6);alRender()};
$('alZout').onclick=()=>{AL.zoom=Math.max(1,AL.zoom/1.6);alRender()};
$('alFit').onclick=()=>{AL.zoom=1;AL.cx=0;AL.cz=0;alRender()};
$('alTog').onclick=()=>{AL.open=!AL.open;try{localStorage.setItem('fc_ally_open',AL.open?'1':'0')}catch(e){}alRender()};
$('alBack').onclick=()=>view('class');
$('alBase').onclick=()=>$('bDeploy').click();
$('alSpawn').onclick=()=>{if(AL.sel)spawnOnAlly(AL.sel)};
$('pResume').onclick=resume;$('cNo').onclick=()=>view(ui.prev);$('cYes').onclick=toFaction;
$('qlow').onclick=()=>{if(SET.q!=='low'){setQ('low');syncGfx()}};$('qmed').onclick=()=>{if(SET.q!=='med'){setQ('med');syncGfx()}};$('qhigh').onclick=()=>{if(SET.q!=='high'){setQ('high');syncGfx()}};
$('gRes').oninput=e=>{SET.res=+e.target.value/100;e.target.nextElementSibling.textContent=e.target.value+'%';applyRes();saveSet()};
$('gView').oninput=e=>{SET.view=+e.target.value/100;e.target.nextElementSibling.textContent=e.target.value+'%';applyFog();saveSet()};
$('gShadow').onclick=()=>{if(!Q[SET.q].shadow)return;SET.shadow=!SET.shadow;applyShadow();saveSet();syncGfx()};
$('aMute').onclick=()=>{SET.mute=!SET.mute;auVol();saveSet();syncAudio()};
$('gFps').onclick=()=>{SET.fps=!SET.fps;if(!SET.fps)setT(E.fps,'');saveSet();syncGfx()};
$('kReset').onclick=()=>{SET.binds=Object.assign({},DEFBINDS);SET.more={};cap.a=null;cap.conf=null;saveSet();renderControls()};
$('gLean').onclick=()=>{SET.leanMode=SET.leanMode==='toggle'?'hold':'toggle';P.latch=0;saveSet();renderControls()};
$('sens').oninput=e=>{const v=+e.target.value/100;if(touch)SET.touch=v;else SET.mouse=v;$('sensV').textContent=e.target.value+'%';saveSet()};
for(const[id,k]of[['vMaster','master'],['vWpn','wpn'],['vFx','fx']])$(id).oninput=e=>{SET[k]=+e.target.value/100;e.target.nextElementSibling.textContent=e.target.value+'%';auVol();saveSet()};
$('aTest').onclick=()=>{auInit();if(!auOn())return;sfx.shot(WD.akm);setTimeout(()=>sfx.hit(),260);setTimeout(()=>sfx.mag(true),520);setTimeout(()=>sfx.mag(false),800)};

/* ============ input ============ */
const LEAN_MAX=.42;
function leanBlocked(x,z,y){for(const b of boxes){if(y>=b.top-.1)continue;if(x>b.x0-.2&&x<b.x1+.2&&z>b.z0-.2&&z<b.z1+.2)return true}
 for(const c of circles){if(c.top!==undefined&&y>=c.top-.1)continue;const dx=x-c.x,dz=z-c.z,rr=c.r+.2;if(dx*dx+dz*dz<rr*rr)return true}return false}
function leanClear(dir){const rx=Math.cos(P.yaw),rz=-Math.sin(P.yaw);let ok=0;
 for(let s=.05;s<=LEAN_MAX+1e-6;s+=.05){const x=P.x+rx*dir*s,z=P.z+rz*dir*s;if(leanBlocked(x,z,P.y+P.eye)||leanBlocked(x,z,P.y+P.eye*.55))break;ok=s}return ok}
function leanUpdate(dt){
 const pl=down('leanL'),pr=down('leanR');let want;
 /* a key press counts even if it starts and ends between two frames (pendL/pendR are set on the press itself) */
 if(SET.leanMode==='toggle'){if((pl&&!P.prevL)||P.pendL)P.latch=P.latch===-1?0:-1;if((pr&&!P.prevR)||P.pendR)P.latch=P.latch===1?0:1;want=P.latch}else want=(pl?-1:0)+(pr?1:0);
 P.prevL=pl;P.prevR=pr;P.pendL=false;P.pendR=false;
 const ok=P.on&&!P.climb&&!P.sprint&&P.stance!=='prone';
 if(!ok&&SET.leanMode==='toggle')P.latch=0;
 const dir=ok?want:0;
 if(dir!==P.leanDir){P.leanDir=dir;P.leanT=0;if(dir!==0){P.leanLim=leanClear(dir);if(P.leanLim<.05)setNotice('NO ROOM TO LEAN',.8)}}
 P.leanT-=dt;if(dir!==0&&P.leanT<=0){P.leanLim=leanClear(dir);P.leanT=.15}
 const target=dir===0?0:dir*P.leanLim;
 P.leanV+=(target-P.leanV)*Math.min(1,10*dt);if(Math.abs(P.leanV)<.001)P.leanV=0}
function setStance(s){if(P.climb||s===P.stance)return;P.stance=s;if(s!=='stand')P.sprint=false;setNotice(s==='stand'?'STANDING':s==='crouch'?'CROUCHING':'PRONE',.9)}
/* climbing: jump near a climbable top (sandbag or rock, 1.25 m above feet or lower) to mount it */
function climbTarget(){const fx=-Math.sin(P.yaw),fz=-Math.cos(P.yaw),qx=P.x+fx*.75,qz=P.z+fz*.75;let best=null,bd=1e9;const ok=t=>t>P.y+.2&&t<=P.y+1.25;
 for(const c of circles){if(!c.climb||!ok(c.top))continue;const dd=Math.hypot(qx-c.x,qz-c.z),d=dd-c.r;if(d<=.45&&d<bd){bd=d;const k=c.r*.6/(dd||1);best={top:c.top,ex:c.x+(qx-c.x)*k,ez:c.z+(qz-c.z)*k}}}
 for(const b of boxes){if(!b.climb||!ok(b.top))continue;const cx=clamp(qx,b.x0,b.x1),cz=clamp(qz,b.z0,b.z1),d=Math.hypot(qx-cx,qz-cz);if(d<=.45&&d<bd){bd=d;let lx=b.x0+.3,hx=b.x1-.3,lz=b.z0+.3,hz=b.z1-.3;if(lx>hx)lx=hx=(b.x0+b.x1)/2;if(lz>hz)lz=hz=(b.z0+b.z1)/2;best={top:b.top,ex:clamp(qx+fx*.4,lx,hx),ez:clamp(qz+fz*.4,lz,hz)}}}
 return best}
function startClimb(){if(P.stance!=='stand'||!P.on||P.climb)return false;const t=climbTarget();if(!t)return false;
 P.climb={x0:P.x,z0:P.z,x1:t.ex,z1:t.ez,y0:P.y,y1:t.top,t:0,dur:.5+.45*Math.max(0,t.top-P.y)};W.ads=false;P.sprint=false;setNotice('CLIMBING',.8);return true}
function climbStep(dt){const c=P.climb;c.t+=dt;const k=Math.min(1,c.t/c.dur),e=k*k*(3-2*k);P.x=c.x0+(c.x1-c.x0)*e;P.z=c.z0+(c.z1-c.z0)*e;P.y=c.y0+(c.y1-c.y0)*e+Math.sin(Math.PI*k)*.12;P.vx=P.vz=0;P.vy=0;P.dip=0;if(k>=1){P.climb=null;P.y=c.y1;P.on=true}}
function act(a){if(state!=='play'||(P.down&&a!=='map'))return;if(FMAP&&a!=='map')return;if(a==='leanL'||a==='leanR'){if(a==='leanL')P.pendL=true;else P.pendR=true}switch(a){case'map':toggleFullMap();break;case'use':break;case'cam':break;case'fire':W.trig=true;W.dry=false;break;case'ads':toggleADS();break;case'reload':startReload();break;case'slot1':selectSlot(0);break;case'slot2':selectSlot(1);break;case'cycle':cycle();break;case'mode':toggleMode();break;case'jump':jumpReq=true;break;case'crouch':setStance(P.stance==='stand'?'crouch':P.stance==='crouch'?'stand':'crouch');break;case'prone':setStance(P.stance==='prone'?'crouch':'prone');break;case'med':useKit();break}}
const press=c=>{for(const a in DEFBINDS)if(codesOf(a).includes(c))act(a)};
addEventListener('keydown',e=>{let c=e.code;if(c==='ShiftRight')c='ShiftLeft';
 if(cap.a){e.preventDefault();if(!e.repeat)capture(c);return}
 if(c==='Escape'){if(FMAP){toggleFullMap();return}if(state==='play')pause();else if(ui.v==='pause')resume();else if(ui.v&&ui.prev!==undefined&&ui.v!=='faction'&&ui.v!=='home'&&!(NET.on&&ui.v==='class'))view(ui.prev);return}
 if(codesOf('pause').includes(c)){if(e.repeat)return;if(state==='play')pause();else if(state==='pause'&&ui.v==='pause')resume();return}
 if(state!=='play')return;
 if(['Space','ArrowUp','ArrowDown','Tab'].includes(c))e.preventDefault();
 if(e.repeat){held[c]=true;return}held[c]=true;press(c)});
addEventListener('keyup',e=>{let c=e.code;if(c==='ShiftRight')c='ShiftLeft';held[c]=false});
addEventListener('mousedown',e=>{
 if(cap.a){if(e.button===0){if(!e.target.closest('.kb.cap')){cap.a=null;setTimeout(renderControls,250)}return}e.preventDefault();capture('Mouse'+e.button);return}
 if(state!=='play'||touch)return;if(!locked){lock();return}
 const c='Mouse'+e.button;held[c]=true;press(c)});
addEventListener('mouseup',e=>{held['Mouse'+e.button]=false});
addEventListener('contextmenu',e=>e.preventDefault());
const look=(dx,dy)=>{const k=1-.35*W.adsK;P.yaw-=dx*k;P.pitch=clamp(P.pitch-dy*k,-1.5,1.5);lookDX+=dx};
addEventListener('mousemove',e=>{if(state==='play'&&locked)look(e.movementX*.0022*SET.mouse,e.movementY*.0022*SET.mouse)});
document.addEventListener('pointerlockchange',()=>{locked=document.pointerLockElement===renderer.domElement;if(!locked&&state==='play'&&!touch&&!FMAP&&!P.down)pause()});
addEventListener('blur',pause);document.addEventListener('visibilitychange',()=>{if(document.hidden)pause()});
document.addEventListener('touchmove',e=>{if(state==='play')e.preventDefault()},{passive:false});
['gesturestart','gesturechange'].forEach(t=>document.addEventListener(t,e=>e.preventDefault()));
/* touch controls */
const jz=$('joy'),jb=$('jb'),jt=$('jt'),lk={id:-1,x:0,y:0},lz=$('look');let jox=0,joy0=0;
function joyReset(){joy.id=-1;joy.x=joy.y=0;jb.style.display='none';lk.id=-1}
jz.addEventListener('pointerdown',e=>{if(joy.id>=0)return;joy.id=e.pointerId;jz.setPointerCapture(e.pointerId);jox=e.clientX;joy0=e.clientY;jb.style.left=jox-60+'px';jb.style.top=joy0-60+'px';jb.style.display='block';jt.style.transform='none'});
jz.addEventListener('pointermove',e=>{if(e.pointerId!==joy.id)return;let dx=e.clientX-jox,dy=e.clientY-joy0;const d=Math.hypot(dx,dy),m=55;if(d>m){dx*=m/d;dy*=m/d}joy.x=dx/m;joy.y=-dy/m;jt.style.transform='translate('+dx+'px,'+dy+'px)'});
const jend=e=>{if(e.pointerId!==joy.id)return;joy.id=-1;joy.x=joy.y=0;jb.style.display='none'};jz.addEventListener('pointerup',jend);jz.addEventListener('pointercancel',jend);
lz.addEventListener('pointerdown',e=>{if(lk.id>=0)return;lk.id=e.pointerId;lk.x=e.clientX;lk.y=e.clientY;lz.setPointerCapture(e.pointerId)});
lz.addEventListener('pointermove',e=>{if(e.pointerId!==lk.id||state!=='play')return;look((e.clientX-lk.x)*.0042*SET.touch,(e.clientY-lk.y)*.0042*SET.touch);lk.x=e.clientX;lk.y=e.clientY});
const lend=e=>{if(e.pointerId===lk.id)lk.id=-1};lz.addEventListener('pointerup',lend);lz.addEventListener('pointercancel',lend);
function bind(id,dn,up,sticky){const el=$(id);el.addEventListener('pointerdown',e=>{e.preventDefault();el.setPointerCapture(e.pointerId);if(!sticky)el.classList.add('on');dn()});
 const u=e=>{if(!sticky)el.classList.remove('on');if(up)up()};el.addEventListener('pointerup',u);el.addEventListener('pointercancel',u)}
bind('bf',()=>{tHeld.fire=true;act('fire')},()=>{tHeld.fire=false});
bind('bads',()=>act('ads'),null,true);bind('br',()=>act('reload'));bind('bw',()=>act('cycle'));bind('bm',()=>act('mode'));
bind('bj',()=>{tHeld.jump=true;act('jump')},()=>{tHeld.jump=false});
bind('bu',()=>act('use'),()=>{});bind('bmed',()=>act('med'),()=>{});bind('bln',()=>{tHeld.leanL=true},()=>{tHeld.leanL=false});bind('brn',()=>{tHeld.leanR=true},()=>{tHeld.leanR=false});
addEventListener('blur',()=>{P.latch=0;tHeld.leanL=tHeld.leanR=false;for(const k of[...codesOf('leanL'),...codesOf('leanR')])held[k]=false});bind('bc',()=>act('cam'),()=>{});bind('bcr',()=>act('crouch'),()=>{});bind('bpr',()=>act('prone'),()=>{});
bind('bs',()=>{sprintLatch=!sprintLatch;$('bs').classList.toggle('on',sprintLatch)},null,true);
$('bp').addEventListener('pointerdown',e=>{e.preventDefault();pause()});

/* ============ main loop ============ */
let fAcc=0,fN=0,hAcc=0,flagT=0,fpsNow=0;
/* distance cull for foliage tiles: hidden only when their nearest point is beyond the fog (fog ends at 165 m x view, at most about 215 m) */
let vegT=0;const VEG_RANGE=240;
function cullVeg(){for(const t of VEG){const[x0,z0,x1,z1]=t.userData.box;const nx=clamp(P.x,x0,x1),nz=clamp(P.z,z0,z1);t.visible=Math.hypot(nx-P.x,nz-P.z)<VEG_RANGE}}
function frame(now){requestAnimationFrame(frame);const raw=(now-last)/1000,dt=Math.min(.05,raw);last=now;
 const showPrev=state==='menu'||ui.v==='class';
 if(state==='play'){dmgTick(dt);update(dt);if(NET.on)netUpdate(dt);else cqUpdateSP(dt);scopeHud();fAcc+=raw;fN++;
  if(fAcc>2){fpsNow=fN/fAcc;if(fpsNow<24&&resScale>.5){resScale=Math.max(.5,resScale-.1);applyRes()}else if(fpsNow>=56&&resScale<1){resScale=Math.min(1,resScale+.1);applyRes()}hudTick(Math.round(fpsNow));fAcc=fN=0}
  hAcc+=dt;if(hAcc>.06){hAcc=0;hudTick();drawMinimap();if(FMAP)drawFullMap()}
 vegT+=dt;if(vegT>.2){vegT=0;cullVeg()}
  const h=STAGE>=2?heading():0;if(STAGE>=2&&(Math.abs(h-cmpLast)>.15||cmpLast<-900)){cmpLast=h;drawCmp(h);setT(E.cmpd,String(Math.round(h)%360).padStart(3,'0')+'\u00b0')}}
 if(showPrev){prev.t+=dt;if(prev.cur)prev.cur.rotation.y=Math.PI+Math.sin(prev.t*.5)*.7;renderer.render(prev.scene,prev.cam)}
 else{
  sky.position.copy(camera.position);ring.position.set(camera.position.x,0,camera.position.z);renderer.render(scene,camera)}}

/* ============ init ============ */
document.body.classList.toggle('st15',STAGE<2);
if(STAGE<2){$('pMain').textContent='Main menu';$('pMain').onclick=toFaction}
document.getElementById('menu').addEventListener('click',e=>{if(e.target.closest('button,.tab,[data-f]'))sfx.ui()});
/* Stage 3 hooks: centralised config, no duplicated state */
const SPAWN_POINTS=[];for(const k in BASES){const b=BASES[k];SPAWN_POINTS.push({faction:k,kind:'player',...b.spawn});(b.aiSpawns||[]).forEach(p=>SPAWN_POINTS.push({faction:k,kind:'ai',...p}))}
window.FC={STAGE,FACTIONS,CLASSES,WD,BASES,SPAWN_POINTS,player:P,weapons:W,settings:SET,get state(){return state}};
window.__fc={NET:()=>NET,groundAt,collide,ramps:()=>RAMPS,city:()=>CITY,footprints:()=>FOOT,cqPoints:()=>CQ_POINTS,dmgTick,dmgReset,useKit,reviveNow,dmgHudText,P,DMG,prevRig:()=>prev.cur&&prev.cur.userData.rig,prevCam:()=>prev.cam,WM,T,shoot,earn,hurtPlayer,playerDied,MATCH_ON:()=>MATCH_ON,ACC:()=>ACC,hitChar,cqUpdateSP,onPlayerKill,adsFovFor,held,CH,CQS:()=>CQS,WALLET:()=>WALLET,SCOPES,buyScope,equipScope,toggleFullMap,allyMarks,netConnect,netList,netLeave,netSend,fire,findPath,segClear,aliveSoldiers,RESPAWN_DELAY,BODY_TTL,SHARE_R,INVEST_T,updateChars,spawnChars,hurtPlayer,canSee,clearPoint,damageChar,throwGrenade,SIM_FULL,SIM_RED,respawn,H,MAP_H,tHeld,leanClear,leanUpdate,get leanLim(){return P.leanLim},get boxes(){return boxes},get occluders(){return occluders},simulateShot,bullets,HOUSES,buildMinimapBase,ROADS,RESUPPLY,roadDist,updateResupply,get resLock(){return resLock},get resNear(){return resNear},get resT(){return resT},get TRC(){return TRC},H,get occluders(){return occluders},get OCC_CAT(){return OCC_CAT},BASES,SPAWN_POINTS,AU,get boxes(){return boxes},get circles(){return circles},get flags(){return flags},applyShadow,applyFog,applyRes,sfx,joy,tHeld,get sprintLatch(){return sprintLatch},T,camera,scene,get lastSp(){return dbgSp},get lastCap(){return dbgCap},selectSlot,get state(){return state},W,P,SET,WD,WM,sel,ui,FACTIONS,CLASSES,get hits(){return hits},get shots(){return shots},setLocked:v=>{locked=v},act,view,groundAt,collide,stepBullet,alList,AL,alSpot,spawnOnAlly,alRender,breakPane,down,heading,deploy,cycle,startReload,toggleADS,get kick(){return kick}};
setQ(Qn);ready=true;view('home','');setPreview('nato','rifleman');camera.position.set(0,1.68,16);
$('load').classList.add('hide');requestAnimationFrame(frame);
</script></body></html>
