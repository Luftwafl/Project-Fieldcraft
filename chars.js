/* ===== Beta 0.4.0-pre13: characters. Squads (leader plus three followers) patrol between their base and village lanes.
   Soldiers on the other side are hostile: they acquire targets by sight (cone plus line of sight), fire with distance-based hit chance,
   draw tracers and fire sound, take cover when hit, and throw grenades. Civilians walk village lanes and flee gunfire. Deaths are a
   ragdoll-style fall. Simulation tiers by distance to the player: full (< SIM_FULL m: detailed model, every frame, sight and fire),
   reduced (< SIM_RED m: simple model, 4 Hz, movement only), dormant (hidden, not updated). Counts are fixed. Characters are not world geometry. ===== */
const CH={all:[],group:null,charM:[],clock:0,lastShot:null,frameMs:0,playerTeam:null,tracerPool:null,tracerNext:0,grenades:[],respawnQ:[],navUsed:false,sounds:[],
 stats:{shotsFired:0,playerHits:0,soldierHits:0,soldierKills:0,civKills:0,deaths:0,grenades:0}};
const SIM_FULL=90,SIM_RED=220,SQUAD=4,SQUADS=2,CIV_PER=6,SOL_RANGE=120,SOL_SIGHT=85,SOL_MEMORY=6,TRC_POOL=48,GREN_T=1.4,GREN_R=6,CH_MAT={},CH_GEO={};
/* pre-release 15: respawn, awareness, squad sharing and navigation constants */
const RESPAWN_DELAY=30,BODY_TTL=12,TEAM_MAX=SQUAD*SQUADS,SHARE_R=60,INVEST_T=8,NAV_CELL=6,NAV_EXP=4000;
const TASK={patrol:'routine',suspicious:'investigate',alert:'engage',engaged:'engage',cover:'cover'};
const mkCharAssets=()=>{if(!CH.group){CH.group=new T.Group();scene.add(CH.group)}if(CH_MAT.skin)return;
 const m=c=>L({color:c});
 CH_MAT.skin=m(0xc9a27e);CH_MAT.boot=m(0x2b2521);CH_MAT.gun=m(0x1e1e1e);CH_MAT.stock=m(0x4a3a28);CH_MAT.wood=m(0x84552b);CH_MAT.blk=m(0x1d1f21);
 /* each faction's uniform is the player's own: the same uni, sleeve, web and helm colours from FACTIONS */
 CH_MAT.fac={};for(const id of Object.keys(FACTIONS)){const F=FACTIONS[id];CH_MAT.fac[id]={uni:L({map:CAMO[id]}),sleeve:m(F.sleeve),web:m(F.web),helm:L({map:CAMO[id]})}}
 CH_MAT.shirts=[0x7a5a3a,0x3a5a7a,0x8a3a3a,0x5a6a4a,0xb8b0a0,0x6a5a7a].map(m);CH_MAT.pants=[0x34322e,0x4a3e2e,0x2e3a4a].map(m);
 CH_MAT.hats=[0x8a7a4a,0x5a4a3a].map(m);CH_MAT.hair=[0x2a2420,0x8a7050,0xc9b58a].map(m)};
const G=(w,h,d)=>{const k=w+'_'+h+'_'+d;return CH_GEO[k]||(CH_GEO[k]=new T.BoxGeometry(w,h,d))};
/* spatial index: 16 m buckets listing the boxes and circles that touch them, rebuilt when the world lists change size */
const SIDX={len:-1,cl:-1,m:null};const sidxKey=(ix,iz)=>ix*4096+iz;
function sidxBuild(){SIDX.m=new Map();SIDX.len=boxes.length;SIDX.cl=circles.length;const cs=16;if(typeof NAV!=='undefined'&&NAV.ok)NAV.ok.fill(0);/* the path grid is re-judged whenever the obstacles change */
 const add=(key,kind,it)=>{let e=SIDX.m.get(key);if(!e){e={b:[],c:[]};SIDX.m.set(key,e)}e[kind].push(it)};
 for(const b of boxes){const i0=Math.floor((b.x0-.6)/cs),i1=Math.floor((b.x1+.6)/cs),j0=Math.floor((b.z0-.6)/cs),j1=Math.floor((b.z1+.6)/cs);
  for(let i=i0;i<=i1;i++)for(let j=j0;j<=j1;j++)add(sidxKey(i,j),'b',b)}
 for(const c of circles){const r=c.r+.6,i0=Math.floor((c.x-r)/cs),i1=Math.floor((c.x+r)/cs),j0=Math.floor((c.z-r)/cs),j1=Math.floor((c.z+r)/cs);
  for(let i=i0;i<=i1;i++)for(let j=j0;j<=j1;j++)add(sidxKey(i,j),'c',c)}}
const clearPoint=(x,z)=>{if(SIDX.len!==boxes.length||SIDX.cl!==circles.length)sidxBuild();const g=H(x,z),e=SIDX.m.get(sidxKey(Math.floor(x/16),Math.floor(z/16)));
 if(e){for(const b of e.b)if(b.top>g+.4&&x>b.x0-.6&&x<b.x1+.6&&z>b.z0-.6&&z<b.z1+.6)return false;for(const c of e.c)if(Math.hypot(x-c.x,z-c.z)<c.r+.6)return false}
 return true};
/* nearest clear ground to (x,z), searching outward */
function nearClear(x,z){if(clearPoint(x,z))return{x,z};for(let r=1;r<=8;r++)for(let a=0;a<8;a++){const xx=x+Math.cos(a*.785)*r,zz=z+Math.sin(a*.785)*r;if(clearPoint(xx,zz))return{x:xx,z:zz}}return{x,z}}
/* line of sight from a point at eye height to a target point: no terrain crossing, no solid box, no occluder in between */
const _los=new T.Raycaster(),_losO=new T.Vector3(),_losD=new T.Vector3();
function canSee(c,tx,ty,tz){const ex=c.x,ey=H(c.x,c.z)+1.6,ez=c.z,dx=tx-ex,dy=ty-ey,dz=tz-ez,dist=Math.hypot(dx,dy,dz);if(dist<1e-3)return true;
 for(let i=1;i<10;i++){const f=i/10,x=ex+dx*f,y=ey+dy*f,z=ez+dz*f;if(y<H(x,z))return false;for(const b of boxes)if(b.top>y&&x>b.x0&&x<b.x1&&z>b.z0&&z<b.z1)return false}
 _losO.set(ex,ey,ez);_losD.set(dx,dy,dz).normalize();_los.set(_losO,_losD);_los.near=0;_los.far=dist;
 return _los.intersectObjects(occluders,false).length===0}
const tpos=t=>t==='player'?{x:P.x,y:P.y+1.2,z:P.z}:{x:t.x,y:H(t.x,t.z)+1.3,z:t.z};
const inCone=(c,x,z,d)=>{if(d<12)return true;const fx=Math.sin(c.yaw),fz=Math.cos(c.yaw);return (fx*(x-c.x)+fz*(z-c.z))/d>.34};

/* ---------- models: a detailed model (pivoted limbs for animation) and a two-box model for the reduced tier ---------- */
/* a soldier's weapon for its class and faction (the same weapon the player gets for that class) */
function soldierWeapon(root,fac,cls){const id=FACTIONS[fac].prim[cls];const w=WD[id];const lmg=w.mag>=45;
 const add=(geo,mat,x,y,z)=>{const me=new T.Mesh(geo,mat);me.position.set(x,y,z);me.castShadow=false;me.userData.part='body';root.add(me);return me};
 const meshes=[];meshes.push(add(G(.075,.1,lmg?1.0:.9),CH_MAT.blk,.14,1.33,.42+(lmg?.05:0)));
 meshes.push(add(G(.07,.12,.2),CH_MAT.stock,.14,1.32,-.02));
 meshes.push(add(lmg?G(.11,.16,.12):G(.05,.2,.08),CH_MAT.blk,.14,lmg?1.16:1.2,.44+(lmg?.05:0)));
 if(lmg)meshes.push(add(G(.02,.14,.02),CH_MAT.blk,.14,1.2,.8));
 return meshes}
/* class kit: rifleman carries ammunition pouches, assault a pack, support a radio on the back */
function classKit(root,fm,cls,meshes){const add=(geo,mat,x,y,z)=>{const me=new T.Mesh(geo,mat);me.position.set(x,y,z);me.castShadow=false;me.userData.part='body';root.add(me);meshes.push(me);return me};
 if(cls==='rifleman'){add(G(.1,.12,.08),fm.web,-.12,1.02,.15);add(G(.1,.12,.08),fm.web,.12,1.02,.15)}
 if(cls==='assault'){add(G(.36,.42,.2),fm.web,0,1.42,-.24)}
 if(cls==='support'){add(G(.14,.2,.06),CH_MAT.gun,.14,1.42,-.22);add(G(.02,.3,.02),CH_MAT.gun,.2,1.6,-.22)}}
function buildHi(kind,o){const root=new T.Group();const meshes=[];
 const add=(parent,geo,mat,part,x,y,z)=>{const me=new T.Mesh(geo,mat);me.position.set(x,y,z);me.castShadow=false;me.receiveShadow=false;me.userData.part=part;parent.add(me);meshes.push(me);return me};
 const put=(parent,me,part)=>{me.castShadow=false;me.receiveShadow=false;me.userData.part=part;parent.add(me);meshes.push(me);return me};
 const sold=kind==='soldier';const fm=sold?CH_MAT.fac[o.team]:null,uni=sold?fm.uni:o.shirt,pants=sold?fm.uni:o.pants;
 if(sold&&RIG_SRC[o.team]){const W=rigBuild(o.team,o.cls);root.add(W.root);W.meshes.forEach(m=>meshes.push(m));
  return{root,meshes,arms:W.arms,legs:W.legs,pose:W.pose}}
 put(root,ell(pants,0,.98,0,.19,.1,.13),'body');                 /* hips */
 put(root,torsoMesh(uni,0,1.3,0),'body');                        /* chest */
 for(const s of[-1,1])put(root,ell(uni,s*.22,1.5,0,.1,.09,.1),'body'); /* shoulders */
 if(sold){const vg=new T.Group();gearVest(vg,o.team,gearMats(o.team));vg.position.set(0,.14,0);vg.traverse(m=>{if(m.isMesh){m.userData.part='body';meshes.push(m)}});root.add(vg);soldierWeapon(root,o.team,o.cls).forEach(m=>{meshes.push(m);m.userData.part='body';root.add(m)});
  classKit(root,fm,o.cls,meshes)}
 put(root,capMesh([0,1.56,0],[0,1.66,0],.05,CH_MAT.skin),'head'); /* neck */
 put(root,ell(CH_MAT.skin,0,1.78,0,.105,.12,.112),'head');        /* head */
 if(sold){const hm=gearHelmet(o.team,gearMats(o.team));hm.position.set(0,1.74,0);hm.traverse(m=>{if(m.isMesh){m.userData.part='head';meshes.push(m)}});root.add(hm)}
 else if(o.hat){add(root,G(.3,.04,.3),o.hat,'head',0,1.92,0);add(root,G(.16,.1,.16),o.hat,'head',0,1.98,0)}
 else add(root,G(.24,.08,.24),o.hair,'head',0,1.92,0);
 const pivot=(parent,x,y,z)=>{const g=new T.Group();g.position.set(x,y,z);parent.add(g);return g};
 const armMat=sold?fm.sleeve:uni;
 const arms=[pivot(root,-.3,1.52,0),pivot(root,.3,1.52,0)],legs=[pivot(root,-.1,.98,0),pivot(root,.1,.98,0)];
 for(const a of arms)put(a,capMesh([0,0,0],[0,-.5,0],.05,armMat),'limb');
 for(const l of legs){put(l,capMesh([0,-.02,0],[0,-.42,0],.076,pants),"limb");put(l,capMesh([0,-.42,0],[0,-.78,0],.064,pants),'limb');put(l,ell(CH_MAT.boot,0,-.92,.03,.085,.065,.13),'limb')}
 return{root,meshes,arms,legs}}
function buildLo(kind,o){const root=new T.Group();const uni=kind==='soldier'?CH_MAT.fac[o.team].uni:o.shirt;const meshes=[];
 const b=new T.Mesh(G(.5,1.75,.28),uni);b.position.set(0,.9,0);b.userData.part='body';root.add(b);meshes.push(b);
 const h=new T.Mesh(G(.26,.28,.26),CH_MAT.skin);h.position.set(0,1.8,0);h.userData.part='head';root.add(h);meshes.push(h);
 return{root,meshes}}
function addChar(kind,x,z,o){mkCharAssets();const g=new T.Group();g.rotation.order='YXZ';
 const hi=buildHi(kind,o),lo=buildLo(kind,o);g.add(hi.root,lo.root);CH.group.add(g);
 const ch={kind,team:o.team||null,g,hi,lo,hp:kind==='soldier'?100:60,state:kind==='soldier'?'patrol':'walk',x,z,yaw:0,tier:'full',acc:0,spd:0,phase:Math.random()*6,
  sightT:Math.random()*.2,target:null,memT:0,fireT:1+Math.random(),grenT:10+Math.random()*10,coverCD:0,hurtT:0,coverT:0,coverPos:null,
  sIdx:o.sIdx||0,squad:o.squad||0,cls:o.cls||null,leader:o.leader||null,route:o.route||null,ri:0,stuck:0,pause:Math.random()*2,
  skill:kind==='soldier'?.35+Math.random()*.6:0,elT:0,isLeader:false,aw:0,lkp:null,seenT:-99,vis:false,reactT:0,invT:0,nav:null,stT:0,task:'routine',skirm:null,skCD:0,
  lane:o.lane||null,lt:o.lt||0,ldir:o.ldir||1,fleeT:0,fleeDx:0,fleeDz:0,deadT:0,fallSign:1,limbT:null};
 for(const m of[...hi.meshes,...lo.meshes])m.userData.ch=ch;CH.all.push(ch);return ch}

/* ---------- movement ---------- */
/* returns 1 arrived, 0 moving, -1 blocked */
function walkTo(c,tx,tz,speed,dt){const dx=tx-c.x,dz=tz-c.z,d=Math.hypot(dx,dz);if(d<.05)return 1;
 const s=Math.min(d,speed*dt),base=Math.atan2(dx,dz);
 /* try the direct heading, then small turns either side, so units slide around fences and walls */
 for(const off of[0,.5,-.5,1,-1,1.6,-1.6]){const a=base+off,nx=c.x+Math.sin(a)*s,nz=c.z+Math.cos(a)*s;
  if(clearPoint(nx,nz)){c.yaw=a;c.x=nx;c.z=nz;return off===0&&d-s<.05?1:0}}
 return -1}
/* a clear point 10 to 25 m away from (x,z): a new waypoint for a unit that cannot reach its route point */
function randomClear(x,z,rmin,rmax){for(let k=0;k<40;k++){const a=Math.random()*6.283,r=rmin+Math.random()*(rmax-rmin),qx=x+Math.cos(a)*r,qz=z+Math.sin(a)*r;if(clearPoint(qx,qz))return{x:qx,z:qz}}return{x,z}}
/* ---------- navigation: a grid over the playable map, cleared by the same clearPoint test the units use; A* runs on demand ---------- */
const NAV={n:0,ok:null};const DIRS=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
const navCellCenter=(i,j)=>({x:-MAP_H+(i+.5)*NAV_CELL,z:-MAP_H+(j+.5)*NAV_CELL});
function navCellOK(i,j){if(i<0||j<0||i>=NAV.n||j>=NAV.n)return false;const k=i*NAV.n+j;let v=NAV.ok[k];
 if(v===0){const p=navCellCenter(i,j);v=clearPoint(p.x,p.z)?1:2;NAV.ok[k]=v}return v===1}
/* a straight segment is clear if every sample 1.5 m apart is clear */
function segClear(x0,z0,x1,z1){const L=Math.hypot(x1-x0,z1-z0),n=Math.max(1,Math.ceil(L/1.5));for(let k=1;k<n;k++){const f=k/n;if(!clearPoint(x0+(x1-x0)*f,z0+(z1-z0)*f))return false}return true}
function heapPush(h,f,k){h.push([f,k]);let i=h.length-1;while(i>0){const p=(i-1)>>1;if(h[p][0]<=h[i][0])break;const t=h[p];h[p]=h[i];h[i]=t;i=p}}
function heapPop(h){const top=h[0],last=h.pop();if(h.length){h[0]=last;let i=0;for(;;){const l=2*i+1,r=l+1;let m=i;if(l<h.length&&h[l][0]<h[m][0])m=l;if(r<h.length&&h[r][0]<h[m][0])m=r;if(m===i)break;const t=h[m];h[m]=h[i];h[i]=t;i=m}}return top}
/* the nearest clear grid cell (within two cells) that a straight, clear line links to the point (x,z) */
function navLink(x,z){const i0=Math.floor((x+MAP_H)/NAV_CELL),j0=Math.floor((z+MAP_H)/NAV_CELL);
 for(let r=0;r<=2;r++)for(let a=-r;a<=r;a++)for(let b=-r;b<=r;b++){const i=i0+a,j=j0+b;if(navCellOK(i,j)){const c=navCellCenter(i,j);if(segClear(x,z,c.x,c.z))return[i,j]}}
 return null}
/* a path (list of points, last one is the goal) or null when none is found within the search budget */
function findPath(sx,sz,gx,gz){
 if(!NAV.ok){NAV.n=Math.ceil(2*MAP_H/NAV_CELL);NAV.ok=new Uint8Array(NAV.n*NAV.n)}
 const lim=MAP_H-20;if(Math.abs(gx)>lim||Math.abs(gz)>lim||Math.abs(sx)>lim||Math.abs(sz)>lim)return null;
 const g0=nearClear(gx,gz);
 if(segClear(sx,sz,g0.x,g0.z))return[g0];
 const toC=x=>clamp(Math.floor((x+MAP_H)/NAV_CELL),0,NAV.n-1);
 const S=navLink(sx,sz),G=navLink(g0.x,g0.z);if(!S||!G)return null;
 const[si,sj]=S,[gi,gj]=G;
 const wi0=Math.max(0,Math.min(si,gi)-14),wi1=Math.min(NAV.n-1,Math.max(si,gi)+14),wj0=Math.max(0,Math.min(sj,gj)-14),wj1=Math.min(NAV.n-1,Math.max(sj,gj)+14);
 const Hh=wj1-wj0+1,N=(wi1-wi0+1)*Hh;
 const g=new Float32Array(N).fill(Infinity),par=new Int32Array(N).fill(-1),closed=new Uint8Array(N);
 const hf=(i,j)=>{const dx=Math.abs(i-gi),dy=Math.abs(j-gj);return Math.max(dx,dy)+.414*Math.min(dx,dy)};
 const startK=(si-wi0)*Hh+(sj-wj0);g[startK]=0;
 const open=[];heapPush(open,hf(si,sj),startK);let exp=0,goalK=-1;
 while(open.length&&exp<NAV_EXP){const[,k]=heapPop(open);if(closed[k])continue;closed[k]=1;exp++;
  const i=Math.floor(k/Hh)+wi0,j=k%Hh+wj0;
  if(i===gi&&j===gj){goalK=k;break}
  for(const[di,dj]of DIRS){const ni=i+di,nj=j+dj;if(ni<wi0||nj<wj0||ni>wi1||nj>wj1)continue;const nk=(ni-wi0)*Hh+(nj-wj0);if(closed[nk])continue;
   if(!navCellOK(ni,nj))continue;const c0=navCellCenter(i,j),c1=navCellCenter(ni,nj);if(!segClear(c0.x,c0.z,c1.x,c1.z))continue;
   const ng=g[k]+(di&&dj?1.414:1);if(ng<g[nk]){g[nk]=ng;par[nk]=k;heapPush(open,ng+hf(ni,nj),nk)}}}
 if(goalK<0)return null;
 const cells=[];for(let k=goalK;k!==-1;k=par[k]){cells.push(navCellCenter(Math.floor(k/Hh)+wi0,k%Hh+wj0));if(k===startK)break}
 cells.reverse();
 /* string-pull: drop every waypoint that can be bypassed by a clear straight line */
 const pts=[{x:sx,z:sz},...cells,g0];const out=[];let a=0;
 while(a<pts.length-1){let b=pts.length-1;while(b>a+1&&!segClear(pts[a].x,pts[a].z,pts[b].x,pts[b].z))b--;
  /* the end links are not covered by the cell-to-cell test: a blocked start or goal link means no usable path */
  if(b===a+1&&!segClear(pts[a].x,pts[a].z,pts[b].x,pts[b].z))return null;out.push(pts[b]);a=b}
 return out}
/* per-leader navigation state; the route itself is the patrol assignment and is never rewritten by a stall */
const freshNav=()=>({path:null,replanCD:0,replans:0,fail:0,bestD:1e9,noProg:0});
/* a leader walks its assigned route: each route point gets a path; a stall or a blocked step replans; repeated failure skips the point */
function leaderPatrol(c,dt){const N=c.nav||(c.nav=freshNav());
 if(c.pause>0){c.pause-=dt;return}
 if(N.replanCD>0){N.replanCD-=dt;return}
 if(!N.path){if(CH.navUsed)return;CH.navUsed=true;
  const wp=c.route[c.ri];const p=findPath(c.x,c.z,wp.x,wp.z);
  if(!p){N.fail++;N.replanCD=1;if(N.fail>=c.route.length){c.route=buildRoute(c.team);c.ri=0;N.fail=0}else c.ri=(c.ri+1)%c.route.length;return}
  N.path=p;N.bestD=1e9;N.noProg=0;N.fail=0}
 const tg=N.path[0];const r=walkTo(c,tg.x,tg.z,1.7,dt);
 const d=Math.hypot(tg.x-c.x,tg.z-c.z);if(d<N.bestD-.3){N.bestD=d;N.noProg=0}else N.noProg+=dt;
 if(r===1){N.path.shift();N.bestD=1e9;N.noProg=0;
  if(!N.path.length){N.path=null;c.pause=c.route[c.ri].hold?35+Math.random()*35:3+Math.random()*3;c.ri=(c.ri+1)%c.route.length;N.replans=0}}
 else if(r===-1||N.noProg>3){N.path=null;N.replanCD=.5;N.replans++;if(N.replans>=3){c.ri=(c.ri+1)%c.route.length;N.replans=0}}
 /* net-movement check: a leader that has gone less than 1.5 m in 4 s is stalled (sliding along an obstacle, or pinned): replan, and after three replans take the next route point */
 N.wT=(N.wT||0)+dt;if(N.wT>=4){const moved=Math.hypot(c.x-(N.wx===undefined?c.x:N.wx),c.z-(N.wz===undefined?c.z:N.wz));N.wx=c.x;N.wz=c.z;N.wT=0;
  if(moved<1.5&&N.path){N.path=null;N.replanCD=.5;N.replans++;if(N.replans>=3){c.ri=(c.ri+1)%c.route.length;N.replans=0}}}}
function followLeader(c,dt){const L=c.leader;const row=Math.floor((c.sIdx-1)/2),side=(c.sIdx%2===1?-1:1)*2.2;
 const fx=Math.sin(L.yaw),fz=Math.cos(L.yaw),rx=Math.cos(L.yaw),rz=-Math.sin(L.yaw);
 const tx=L.x-fx*(2.6+row*2.4)+rx*side,tz=L.z-fz*(2.6+row*2.4)+rz*side;const d=Math.hypot(tx-c.x,tz-c.z);
 if(d<1){c.yaw=L.yaw;return}walkTo(c,tx,tz,Math.min(3,1.7+d*.5),dt)}

/* ---------- combat ---------- */
/* best hostile in sight: other-side soldiers, and the player if this soldier is on the other side */
function acquire(c){let best=null,bd=SOL_SIGHT;
 for(const o of CH.all){if(o===c||o.kind!=='soldier'||o.state==='dead'||o.tier==='dormant'||o.team===c.team)continue;const d=Math.hypot(o.x-c.x,o.z-c.z);
  if(d<bd&&inCone(c,o.x,o.z,d)&&canSee(c,o.x,H(o.x,o.z)+1.3,o.z)){best=o;bd=d}}
 if(c.team!==CH.playerTeam&&P.hp>0){const d=Math.hypot(P.x-c.x,P.z-c.z);if(d<bd&&inCone(c,P.x,P.z,d)&&canSee(c,P.x,P.y+1.2,P.z))best='player'}
 return best}
function spawnTracer(a,b){if(!CH.tracerPool){CH.tracerPool=[];const geo=new T.BoxGeometry(.03,.03,1),mat=new T.MeshBasicMaterial({color:0xffc070,fog:false});
  for(let i=0;i<TRC_POOL;i++){const me=new T.Mesh(geo,mat);me.visible=false;me.frustumCulled=false;CH.group.add(me);CH.tracerPool.push({me,t:0})}}
 const e=CH.tracerPool[CH.tracerNext++%TRC_POOL],d=new T.Vector3().subVectors(b,a),len=d.length();
 e.me.position.copy(a).addScaledVector(d,.5);e.me.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),d.normalize());e.me.scale.set(1,1,Math.max(.1,len));e.me.visible=true;e.t=.12}
function fire(c,t){const tp=tpos(t),d=Math.hypot(tp.x-c.x,tp.z-c.z);const mx=c.x+Math.sin(c.yaw)*.6,mz=c.z+Math.cos(c.yaw)*.6;
 CH.stats.shotsFired++;CH.lastShot={x:c.x,z:c.z,t:CH.clock};CH.sounds.push({x:c.x,z:c.z,team:c.team,t:CH.clock});
 /* hit chance: range, skill, the target's movement and stance, and stress when under fire */
 let p=Math.min(.3,Math.max(.08,.3-.0025*d))*(.55+.45*c.skill);
 if(t==='player'){const sp=Math.hypot(P.vx,P.vz);if(sp>2)p*=.7;if(P.stance==='crouch')p*=.85;else if(P.stance==='prone')p*=.7}
 else if(t.spd>1.5)p*=.75;
 if(c.hurtT>0)p*=.6;
 p=Math.max(.04,p);
 const hit=Math.random()<p;
 /* a miss lands near the target: the spread grows with range and shrinks with skill */
 const sp2=1.5+d*.02*(1.2-c.skill);
 const aim=hit?tp:{x:tp.x+(Math.random()-.5)*2*sp2,y:tp.y+(Math.random()-.5)*1.2,z:tp.z+(Math.random()-.5)*2*sp2};
 spawnTracer(new T.Vector3(mx,H(c.x,c.z)+1.5,mz),new T.Vector3(aim.x,aim.y,aim.z));
 if(typeof sfx!=='undefined'&&Math.hypot(P.x-c.x,P.z-c.z)<90)try{sfx.shot(WD.akm)}catch(e){}
 if(hit){if(t==='player')hurtPlayer({wpn:'rifle',name:FACTIONS[c.team].name+' SOLDIER',wname:(WD[FACTIONS[c.team].prim[c.cls]]||{}).name,from:{x:c.x,z:c.z}});else damageChar(t,34,{x:c.x,z:c.z})}}
function damageChar(t,dmg,from){if(t.state==='dead')return;t.hp-=dmg;t.hurtT=2.5;if(t.kind==='soldier')CH.stats.soldierHits++;
 /* a soldier hit by an unseen shooter turns toward the shot and investigates; it does not know the exact position */
 if(t.kind==='soldier'&&from&&!t.target&&t.state!=='dead'){t.lkp={x:from.x,y:H(from.x,from.z)+1.3,z:from.z};t.seenT=CH.clock;t.aw=Math.max(t.aw,.6);if(t.state==='patrol'){setSoldierState(t,'suspicious');t.invT=INVEST_T}}
 if(t.kind==='civ'){t.state='flee';t.fleeT=6;const ax=t.x-(from?from.x:P.x),az=t.z-(from?from.z:P.z),l=Math.hypot(ax,az)||1;t.fleeDx=ax/l;t.fleeDz=az/l}
 if(t.hp<=0)markDead(t)}
function markDead(c){if(c.state==='dead')return;setSoldierState(c,'dead');c.deadT=0;c.fallSign=Math.random()<.5?-1:1;c.target=null;c.vis=false;c.leader=null;c.isLeader=false;
 c.limbT=[...c.hi.legs,...c.hi.arms].map(()=>(Math.random()*2-1)*.9);
 if(c.kind==='soldier'){CH.stats.soldierKills++;CH.respawnQ.push({key:slotKey(c),team:c.team,squad:c.squad,sIdx:c.sIdx,cls:c.cls,due:CH.clock+RESPAWN_DELAY})}
 else CH.stats.civKills++}
/* a bullet hit a character part (called from the bullet step) */
function hitChar(mesh,pt,b){const c=mesh.userData.ch;if(!c||c.state==='dead')return;const part=mesh.userData.part;
 const dmg=part==='head'?100:part==='body'?40:25;spark(pt,0x8a1a1a,.18);damageChar(c,dmg,b&&b.o?{x:b.o.x,z:b.o.z}:null);if(b&&b.by==='player'&&c.state==='dead')onPlayerKill(c)}
function pickCover(c){const tp=tpos(c.target);let best=null,bd=1e9;
 for(let k=0;k<16;k++){const a=k*Math.PI/8,r=k%2?6:3.5,x=c.x+Math.cos(a)*r,z=c.z+Math.sin(a)*r;if(r>=bd||!clearPoint(x,z))continue;if(canSee({x,z},tp.x,tp.y,tp.z))continue;best={x,z};bd=r}
 return best}
function throwGrenade(c,tx,ty,tz){const sx=c.x,sy=H(c.x,c.z)+1.6,sz=c.z;const vx=(tx-sx)/GREN_T,vz=(tz-sz)/GREN_T,vy=(ty-sy)/GREN_T+4.9*GREN_T;
 const me=new T.Mesh(G(.14,.14,.14),CH_MAT.gun);me.castShadow=false;CH.group.add(me);CH.grenades.push({me,x:sx,y:sy,z:sz,vx,vy,vz,t:0,team:c.team});CH.stats.grenades++}
function updateGrenades(dt){for(let i=CH.grenades.length-1;i>=0;i--){const q=CH.grenades[i];q.t+=dt;q.vy-=9.8*dt;q.x+=q.vx*dt;q.y+=q.vy*dt;q.z+=q.vz*dt;q.me.position.set(q.x,q.y,q.z);
  const g=H(q.x,q.z);if(q.y<=g||q.t>GREN_T+1){const yy=Math.max(q.y,g);spark(new T.Vector3(q.x,yy+.2,q.z),0xffaa40,.6);
   CH.lastBlast={x:q.x,z:q.z,y:yy};const dp=Math.hypot(P.x-q.x,P.z-q.z);if(P.hp>0&&dp<GREN_R)hurtPlayer({wpn:'frag',part:'blast',dmg:Math.round(70*(1-dp/GREN_R)),name:'GRENADE',wname:'GRENADE',from:{x:q.x,z:q.z}});
   for(const o of CH.all){if(o.state==='dead'||o.tier==='dormant')continue;const d=Math.hypot(o.x-q.x,o.z-q.z);if(d<GREN_R)damageChar(o,Math.round(70*(1-d/GREN_R)),{x:q.x,z:q.z})}
   CH.group.remove(q.me);CH.grenades.splice(i,1)}}}

/* state changes go through here so every unit has a readable task (c.task) */
function setSoldierState(c,s){if(c.state===s)return;c.state=s;c.stT=0;c.task=TASK[s]||c.task}
const aimPos=c=>(c.target&&c.vis)?tpos(c.target):(c.lkp||{x:c.x,y:H(c.x,c.z)+1.3,z:c.z});
/* how fast a unit becomes aware of a visible target: nearer, moving and standing-up targets are noticed sooner; skill helps */
function awareRate(c,t,d){const base=clamp(1.8-d/50,.2,1.2);const sp=t==='player'?Math.hypot(P.vx,P.vz):t.spd;
 let f=sp>1.5?1.2:.8;if(t==='player'){if(P.stance==='prone')f*=.5;else if(P.stance==='crouch')f*=.75}
 return base*f*(.6+.6*c.skill)}
/* gunfire within HEAR_R of an enemy soldier is heard: a suspicion with the sound's location, not a confirmed target */
const HEAR_R=60;
function hear(c){if(c.target||(c.state!=='patrol'&&c.state!=='suspicious'))return;
 /* the closest recent shot by the other side is the one heard */
 let best=null,bd=HEAR_R;for(const ev of CH.sounds){if(ev.team==null||ev.team===c.team||CH.clock-ev.t>4)continue;const d=Math.hypot(ev.x-c.x,ev.z-c.z);if(d<=bd){bd=d;best=ev}}
 if(!best)return;
 c.lkp={x:best.x,y:H(best.x,best.z)+1.3,z:best.z};c.seenT=CH.clock;c.aw=Math.max(c.aw,.5);
 if(c.state==='patrol'){setSoldierState(c,'suspicious');c.invT=INVEST_T}else c.invT=Math.max(c.invT,INVEST_T*.5)}
/* a visible hostile: awareness rises (or the target stays under observation); out of sight the last seen point is kept */
function sense(c){hear(c);const t=acquire(c);
 if(c.target){if(t===c.target){c.vis=true;c.seenT=CH.clock;c.lkp=tpos(t)}else{c.vis=false;if(CH.clock-c.seenT>SOL_MEMORY)dropTarget(c)}return}
 if(t){const tp=tpos(t),d=Math.hypot(tp.x-c.x,tp.z-c.z);c.lkp={x:tp.x,y:tp.y,z:tp.z};c.seenT=CH.clock;
  c.aw=Math.min(1,c.aw+awareRate(c,t,d)*.2);
  if(c.aw>=1)confirm(c,t);else if(c.state==='patrol'){setSoldierState(c,'suspicious');c.invT=INVEST_T}}
 else c.aw=Math.max(0,c.aw-.05)}
/* confirmed contact: a reaction delay follows before the first shot, and the contact is passed to squad mates in range */
function confirm(c,t){c.target=t;c.vis=true;c.aw=1;c.reactT=.5+(1-c.skill)*1.2+Math.random()*.5;setSoldierState(c,'alert');c.fireT=Math.max(c.fireT,.3);shareContact(c)}
function dropTarget(c){c.target=null;c.vis=false;if(c.state!=='patrol'){setSoldierState(c,'suspicious');c.invT=INVEST_T}}
/* squad radio: members within SHARE_R get the contact location as a suspicion (they did not see the target themselves) */
function shareContact(c){if(!c.lkp)return;for(const m of CH.all){if(m===c||m.kind!=='soldier'||m.team!==c.team||m.squad!==c.squad||m.state==='dead')continue;
 if(Math.hypot(m.x-c.x,m.z-c.z)>SHARE_R)continue;m.lkp={x:c.lkp.x,y:c.lkp.y,z:c.lkp.z};m.aw=Math.max(m.aw,.6);
 if(m.state==='patrol'&&!m.target){setSoldierState(m,'suspicious');m.invT=INVEST_T}}}
/* squad leadership: the leader keeps the role while alive; otherwise the lowest slot takes it; followers keep formation */
function elect(c){const pool=CH.all.filter(o=>o.kind==='soldier'&&o.team===c.team&&o.squad===c.squad&&o.state!=='dead');
 let L=pool.find(o=>o.isLeader)||null;if(!L)for(const o of pool)if(!L||o.sIdx<L.sIdx)L=o;
 for(const o of pool)o.isLeader=o===L;
 if(!L)return;
 if(L===c){c.leader=null;if(!c.route){c.route=buildRoute(c.team);c.ri=0;c.nav=freshNav()}}
 else{c.leader=L;c.route=null;c.nav=null}}
function updateSoldier(c,dt,full,sensing){if(c.hurtT>0)c.hurtT-=dt;c.stT+=dt;c.elT-=dt;if(c.elT<=0){c.elT=.5;elect(c)}
 if(!c.leader&&!c.route)return;
 /* dormant units (far from the player): movement only, routine state; they neither sense nor fight */
 if(!sensing){if(c.state!=='patrol'){setSoldierState(c,'patrol');c.target=null;c.vis=false;c.aw=0}if(c.leader)followLeader(c,dt);else leaderPatrol(c,dt);return}
 c.sightT-=dt;if(c.sightT<=0){c.sightT=full?.2:1;sense(c)}
 if(c.target&&c.target!=='player'&&(c.target.state==='dead'||c.target.tier==='dormant'))dropTarget(c);
 if(c.state==='patrol'&&c.aw>=.3&&!c.target){setSoldierState(c,'suspicious');c.invT=INVEST_T}
 if(c.state==='cover'){if(c.coverPos){const r=walkTo(c,c.coverPos.x,c.coverPos.z,2.4,dt);if(r!==0)c.coverPos=null}
  c.coverT-=dt;if(c.coverT<=0)c.target?setSoldierState(c,'engaged'):(setSoldierState(c,'suspicious'),c.invT=INVEST_T);return}
 if(c.state==='alert'||c.state==='engaged'){
  if(!c.target){setSoldierState(c,'suspicious');c.invT=INVEST_T;return}
  const ap=aimPos(c);c.yaw=Math.atan2(ap.x-c.x,ap.z-c.z);
  if(c.state==='alert'){c.reactT-=dt;if(c.reactT<=0)setSoldierState(c,'engaged');return}
  c.coverCD-=dt;
  if(c.hurtT>0&&c.coverCD<=0){const cp=pickCover(c);if(cp){setSoldierState(c,'cover');c.coverPos=cp;c.coverT=2.5+Math.random()*1.5;c.coverCD=6;return}}
  const tp=tpos(c.target);
  c.fireT-=dt;if(c.fireT<=0){c.fireT=1+Math.random()*.5;if(c.vis&&canSee(c,tp.x,tp.y,tp.z))fire(c,c.target)}
  c.grenT-=dt;const dP=Math.hypot(P.x-c.x,P.z-c.z);
  if(full&&c.target==='player'&&c.grenT<=0&&dP>14&&dP<40&&c.vis&&Math.random()<.5){throwGrenade(c,P.x,P.y+.2,P.z);c.grenT=20+Math.random()*10}
  return}
 if(c.state==='suspicious'){c.invT-=dt;
  /* followers keep formation and look toward the contact; a leader walks to the last seen point, then looks around */
  if(c.leader)followLeader(c,dt);
  else if(c.lkp&&Math.hypot(c.lkp.x-c.x,c.lkp.z-c.z)>5)walkTo(c,c.lkp.x,c.lkp.z,1.4,dt);
  if(c.lkp&&(c.leader||Math.hypot(c.lkp.x-c.x,c.lkp.z-c.z)<=5))c.yaw=Math.atan2(c.lkp.x-c.x,c.lkp.z-c.z);
  /* investigation over without a confirmed threat: return to routine (the route assignment is kept) */
  if(c.invT<=0&&c.aw<.3&&!c.target){setSoldierState(c,'patrol');c.lkp=null;if(c.nav)c.nav.path=null}
  return}
 if(c.leader)followLeader(c,dt);else leaderPatrol(c,dt)}

function updateCiv(c,dt,full){const dP=Math.hypot(P.x-c.x,P.z-c.z);
 if(full&&c.state!=='flee'){const sh=CH.lastShot;const shotNear=sh&&CH.clock-sh.t<2&&Math.hypot(sh.x-c.x,sh.z-c.z)<40;
  if(dP<12||shotNear){c.state='flee';c.fleeT=6;CH.stats.civFlee=(CH.stats.civFlee||0)+1;const ax=c.x-(shotNear?sh.x:P.x),az=c.z-(shotNear?sh.z:P.z),l=Math.hypot(ax,az)||1;c.fleeDx=ax/l;c.fleeDz=az/l}}
 if(c.state==='flee'){c.fleeT-=dt;const s=4*dt,base=Math.atan2(c.fleeDx,c.fleeDz);
  /* run away; if a fence or wall is in the way, turn a little either side; if boxed in, stay in the flee state */
  for(const off of[0,.5,-.5,1,-1,1.6,-1.6]){const a=base+off,nx=c.x+Math.sin(a)*s,nz=c.z+Math.cos(a)*s;if(clearPoint(nx,nz)){c.x=nx;c.z=nz;c.yaw=a;break}}
  if(c.fleeT<=0){c.state='walk';const[ax,az,bx,bz]=c.lane,dx=bx-ax,dz=bz-az;c.lt=clamp(((c.x-ax)*dx+(c.z-az)*dz)/(dx*dx+dz*dz),0,1)}return}
 if(!c.lane)return;if(c.pause>0){c.pause-=dt;return}
 const[ax,az,bx,bz]=c.lane,len=Math.hypot(bx-ax,bz-az);c.lt+=c.ldir*1.2*dt/len;
 if(c.lt>=1||c.lt<=0){c.lt=clamp(c.lt,0,1);c.ldir=-c.ldir;c.pause=1+Math.random()*2}
 c.x=ax+(bx-ax)*c.lt;c.z=az+(bz-az)*c.lt;c.yaw=Math.atan2((bx-ax)*c.ldir,(bz-az)*c.ldir)}

/* ---------- animation: stride scaled to speed, arms swing or aim, ragdoll on death ---------- */
function animate(c,dt){const m=Math.min(1,c.spd/2.2),ph=c.phase+=dt*c.spd*2.6;const sw=m*.55;
 c.hi.legs[0].rotation.x=Math.sin(ph)*sw;c.hi.legs[1].rotation.x=-Math.sin(ph)*sw;
 const aim=c.kind==='soldier'&&(c.state==='alert'||c.state==='engaged'||c.state==='cover')&&c.target;
 if(c.hi.pose)c.hi.pose(!!aim);
 else if(aim){c.hi.arms[0].rotation.x=c.hi.arms[1].rotation.x=-1.35}
 else{c.hi.arms[0].rotation.x=-Math.sin(ph)*sw*.8;c.hi.arms[1].rotation.x=Math.sin(ph)*sw*.8}
 c.hi.root.position.y=Math.abs(Math.sin(ph))*.04*m}
function updateDead(c,dt){c.deadT+=dt;const k=Math.min(1,c.deadT/.6),e=k*k*(3-2*k);
 c.g.rotation.x=c.fallSign*(Math.PI/2)*e;
 if(c.limbT){const ps=[...c.hi.legs,...c.hi.arms];ps.forEach((p,i)=>{p.rotation.x=c.limbT[i]*e})}
 c.g.position.y=H(c.x,c.z)-(c.deadT>4?Math.min(.35,(c.deadT-4)*.2):0)}

function slotKey(c){return c.team+':'+c.squad+':'+c.sIdx}
function removeChar(c){const i=CH.all.indexOf(c);if(i>=0)CH.all.splice(i,1);if(c.g.parent)c.g.parent.remove(c.g);CH.stats.removed=(CH.stats.removed||0)+1}
function aliveSoldiers(team){let n=0;for(const o of CH.all)if(o.kind==='soldier'&&o.team===team&&o.state!=='dead')n++;return n}
/* a free spawn point at the base: a configured AI spawn first, then clear ground nearby; never inside an obstacle, never on the player */
function spawnSpot(team){const b=BASES[team],others=CH.all.filter(o=>o.kind==='soldier'&&o.team===team&&o.state!=='dead');
 const ok=p=>clearPoint(p.x,p.z)&&Math.hypot(p.x-P.x,p.z-P.z)>12&&others.every(o=>Math.hypot(o.x-p.x,o.z-p.z)>2.5);
 for(const s of b.aiSpawns)if(ok(s))return{x:s.x,z:s.z};
 for(let k=0;k<24;k++){const a=k*.5236,r=6+(k%3)*2.5,p={x:b.x+Math.cos(a)*r,z:b.z+Math.sin(a)*r};if(ok(p))return p}
 return null}
function respawnSoldier(q){const p=spawnSpot(q.team);if(!p)return false;
 const E=BASES[Object.keys(BASES).find(k=>k!==q.team)];
 const c=addChar('soldier',p.x,p.z,{team:q.team,squad:q.squad,sIdx:q.sIdx,cls:q.cls});c.yaw=Math.atan2(-(E.x-p.x),-(E.z-p.z));
 CH.stats.respawns=(CH.stats.respawns||0)+1;return true}
/* one entity per slot, a team never exceeds its cap, and a slot is retried until a valid spawn point is free */
function processRespawns(){for(let i=CH.respawnQ.length-1;i>=0;i--){const q=CH.respawnQ[i];if(CH.clock<q.due)continue;
 if(CH.all.some(o=>o.kind==='soldier'&&o.state!=='dead'&&slotKey(o)===q.key)){CH.respawnQ.splice(i,1);continue}
 if(aliveSoldiers(q.team)>=TEAM_MAX){q.due=CH.clock+2;continue}
 if(respawnSoldier(q))CH.respawnQ.splice(i,1);else q.due=CH.clock+3}}

/* distant skirmishes: opposing soldiers that are both dormant (far from the player) and within 60 m of each other trade hits
   statistically for 20 to 40 s and hold their ground. Only real hits and deaths are applied (damageChar), so casualties and
   respawns follow the normal rules. Visible AI engagement happens inside the reduced and full tiers. */
const SKIRM={every:2,next:0,dur:[20,40],cool:60,range:60};
function endSkirm(a){const b=a.skirm&&a.skirm.with;a.skirm=null;a.skCD=CH.clock+SKIRM.cool;if(b&&b.skirm&&b.skirm.with===a){b.skirm=null;b.skCD=CH.clock+SKIRM.cool}}
function skirmishTick(){if(CH.clock<SKIRM.next)return;SKIRM.next=CH.clock+SKIRM.every;
 for(const a of CH.all){if(a.kind!=='soldier'||!a.skirm)continue;const b=a.skirm.with;
  if(a.state==='dead'||b.state==='dead'||a.tier!=='dormant'||b.tier!=='dormant'){endSkirm(a);continue}
  a.skirm.t+=SKIRM.every;
  if(Math.random()<.2*(.6+.6*a.skill))damageChar(b,34,{x:a.x,z:a.z});
  if(b.state!=='dead'&&Math.random()<.2*(.6+.6*b.skill))damageChar(a,34,{x:b.x,z:b.z});
  if(a.state==='dead'||b.state==='dead'||a.skirm.t>=a.skirm.dur)endSkirm(a)}
 const S=CH.all.filter(c=>c.kind==='soldier'&&c.state!=='dead'&&c.tier==='dormant'&&!c.skirm&&c.skCD<=CH.clock);
 for(const a of S){if(a.skirm)continue;
  for(const b of S){if(b===a||b.skirm||b.team===a.team||b.skCD>CH.clock)continue;
   if(Math.hypot(a.x-b.x,a.z-b.z)<=SKIRM.range){const dur=SKIRM.dur[0]+Math.random()*(SKIRM.dur[1]-SKIRM.dur[0]);
    a.skirm={with:b,t:0,dur};b.skirm={with:a,t:0,dur};CH.stats.skirms=(CH.stats.skirms||0)+1;break}}}}
function updateChars(dt){const t0=performance.now();CH.clock+=dt;CH.charM.length=0;CH.navUsed=false;const dead=[];
 while(CH.sounds.length&&(CH.clock-CH.sounds[0].t>4||CH.sounds.length>24))CH.sounds.shift();
 skirmishTick();
 for(const c of CH.all){const d=Math.hypot(c.x-P.x,c.z-P.z);c.tier=d<SIM_FULL?'full':d<SIM_RED?'reduced':'dormant';
  c.g.visible=c.tier!=='dormant';c.hi.root.visible=c.tier==='full';c.lo.root.visible=c.tier==='reduced';
  if(c.state==='dead'){updateDead(c,dt);c.g.position.set(c.x,c.g.position.y,c.z);c.g.rotation.y=c.yaw;if(c.kind==='soldier'&&c.deadT>BODY_TTL)dead.push(c);continue}
  /* far units still move (routes, lanes) so patrols progress across the whole map; they are not drawn and do not sense or fire */
  if(c.tier==='dormant'){c.acc+=dt;if(c.acc<.5)continue;let rem=c.acc;c.acc=0;if(c.skirm)continue;
   while(rem>1e-6){const h=Math.min(.25,rem);rem-=h;if(c.kind==='soldier')updateSoldier(c,h,false,false);else updateCiv(c,h,false)}
   c.g.position.set(c.x,H(c.x,c.z),c.z);c.g.rotation.y=c.yaw;continue}
  const full=c.tier==='full';let step=dt;
  if(!full){c.acc+=dt;if(c.acc<.25){c.g.position.set(c.x,H(c.x,c.z),c.z);c.g.rotation.y=c.yaw;for(const m of c.lo.meshes)CH.charM.push(m);continue}step=c.acc;c.acc=0}
  const px=c.x,pz=c.z;
  if(c.kind==='soldier')updateSoldier(c,step,full,true);else updateCiv(c,step,full);
  c.spd=step>0?Math.hypot(c.x-px,c.z-pz)/step:0;
  if(full)animate(c,dt);
  c.g.position.set(c.x,H(c.x,c.z),c.z);c.g.rotation.x=0;c.g.rotation.y=c.yaw;
  for(const m of(full?c.hi.meshes:c.lo.meshes))CH.charM.push(m)}
 for(const c of dead)removeChar(c);
 processRespawns();
 updateGrenades(dt);
 if(CH.tracerPool)for(const e of CH.tracerPool)if(e.t>0){e.t-=dt;if(e.t<=0)e.me.visible=false}
 for(const c of CH.all)if(c.g.visible)c.g.updateMatrixWorld(true);
 CH.frameMs=CH.frameMs*.95+(performance.now()-t0)*.05}

/* ---------- population: two squads per side, civilians along village lanes ---------- */
function buildRoute(baseKey){const b=BASES[baseKey];const vs=VILLAGE_PLANS.filter(v=>v.lane);const far=p=>Math.hypot(p.x-b.x,p.z-b.z)>80;
 const pts=[];const pickV=()=>vs[Math.floor(Math.random()*vs.length)];
 if(vs.length){const v1=pickV();let v2=pickV();for(let k=0;k<6&&v2===v1;k++)v2=pickV();
  /* each squad picks its own lane positions and a little jitter, so two squads do not share a destination */
 const rr=(a,b)=>a+Math.random()*(b-a);
 for(const[v,ts]of[[v1,[rr(.25,.75),rr(.8,1)]],[v2,[rr(0,.2),rr(.35,.65)]]])for(const t of ts){const[ax,az,bx,bz]=v.lane;const p=nearClear(ax+(bx-ax)*t+rr(-4,4),az+(bz-az)*t+rr(-4,4));if(far(p))pts.push({x:p.x,z:p.z,hold:true})}}
 while(pts.length<3)pts.push(randomClear(b.x,b.z,90,220));
 return pts}
function spawnChars(playerKey){mkCharAssets();for(const c of CH.all)CH.group.remove(c.g);CH.all.length=0;CH.charM.length=0;CH.lastShot=null;
 for(const g of CH.grenades)CH.group.remove(g.me);CH.grenades.length=0;
 CH.stats={shotsFired:0,playerHits:0,soldierHits:0,soldierKills:0,civKills:0,deaths:0,grenades:0,respawns:0,removed:0,skirms:0};CH.playerTeam=playerKey;CH.respawnQ.length=0;
 const enemy=Object.keys(BASES).find(k=>k!==playerKey);
 for(const team of[playerKey,enemy])for(let s=0;s<SQUADS;s++){const b=BASES[team];let leader=null;const route=buildRoute(team);
  for(let i=0;i<SQUAD;i++){const p0=nearClear(b.x+(i-1.5)*3,b.z+(s-.5)*7);
   const c=addChar('soldier',p0.x,p0.z,{team,squad:s,sIdx:i,cls:['rifleman','assault','support','rifleman'][i],leader:i===0?null:leader,route:i===0?route:null});if(i===0)leader=c;c.yaw=Math.atan2(-(b.x-p0.x),-(b.z-p0.z))}}
 for(const v of VILLAGE_PLANS){if(!v.lane)continue;const[ax,az,bx,bz]=v.lane;
  for(let i=0;i<CIV_PER;i++){const lt=(i+.5)/CIV_PER,x=ax+(bx-ax)*lt,z=az+(bz-az)*lt;
   addChar('civ',x,z,{shirt:CH_MAT.shirts[Math.floor(Math.random()*CH_MAT.shirts.length)],pants:CH_MAT.pants[Math.floor(Math.random()*CH_MAT.pants.length)],
    hat:Math.random()<.4?CH_MAT.hats[Math.floor(Math.random()*CH_MAT.hats.length)]:null,hair:CH_MAT.hair[Math.floor(Math.random()*CH_MAT.hair.length)],lane:v.lane,lt,ldir:i%2?-1:1})}}
 return CH.all.length}
