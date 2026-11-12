const HOUSES=[];
/* Beta 0.3.75 transport truck: one shared state; the model is rebuilt with the world (buildTruck) */
const TRUCKS=[{g:null,x:0,z:0,y:0,yaw:0,v:0,n:'NATO'},{g:null,x:0,z:0,y:0,yaw:0,v:0,n:'WARSAW PACT'}];
const TRK={inside:false,cam3:false,lookOff:0,lastYaw:0,i:0};
/* Beta 0.3.8 fairness: the world is identical on every preset (placement, fog, collision). Presets change rendering only: shadows, resolution, geometry detail (lod) and terrain sampling grid (cell; the grid samples the same height function that collision uses). */
const WORLD={trees:2200,bushes:320,grass:1300,rocks:90,fog:[150,520]};
const Q={low:{...WORLD,lod:0,cell:10,shadow:0,cap:1,base:.75},
         med:{...WORLD,lod:1,cell:6,shadow:1024,cap:1.5,base:1},
         high:{...WORLD,lod:2,cell:4,shadow:2048,cap:2,base:1.1}};
let Qn=SET.q,Qc=Q[Qn];
const renderer=new T.WebGLRenderer({antialias:false,powerPreference:'high-performance'});
renderer.shadowMap.type=T.PCFShadowMap;document.body.prepend(renderer.domElement);
const scene=new T.Scene(),camera=new T.PerspectiveCamera(70,1,.05,800);camera.rotation.order='YXZ';scene.add(camera);
const HAZE=0xc2c9c8;scene.fog=new T.Fog(HAZE,25,165);
scene.add(new T.HemisphereLight(0xd7e0ea,0x4b5236,1.0));
const sun=new T.DirectionalLight(0xf3ead6,1.25);scene.add(sun,sun.target);
Object.assign(sun.shadow.camera,{left:-45,right:45,top:45,bottom:-45,near:1,far:260});sun.shadow.bias=-.0006;sun.shadow.normalBias=.05;
const L=o=>new T.MeshLambertMaterial(o),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
let seed=1;const R=()=>{seed=(seed+0x6D2B79F5)|0;let t=Math.imul(seed^(seed>>>15),1|seed);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296};
const rr=(a,b)=>a+(b-a)*R();

function cvs(w,h,draw,rx=1,ry=1){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(rx,ry);t.anisotropy=2;return t}
function speckle(g,w,h,n,a){for(let i=0;i<n;i++){const v=R()<.5?0:255;g.fillStyle=`rgba(${v},${v},${v},${a*R()})`;g.fillRect(R()*w,R()*h,1+R()*2,1+R()*2)}}
const skyTex=cvs(2,256,(g,w,h)=>{const gr=g.createLinearGradient(0,0,0,h);gr.addColorStop(0,'#6d7f90');gr.addColorStop(.33,'#9eadb7');gr.addColorStop(.5,'#c2c9c8');gr.addColorStop(1,'#c2c9c8');g.fillStyle=gr;g.fillRect(0,0,w,h)});
const sky=new T.Mesh(new T.SphereGeometry(760,24,12),new T.MeshBasicMaterial({map:skyTex,side:T.BackSide,fog:false,depthWrite:false}));sky.renderOrder=-1;scene.add(sky);
const ring=new T.Group();scene.add(ring);
{const n=26,im=new T.InstancedMesh(new T.ConeGeometry(1,1,6),new T.MeshBasicMaterial({fog:false}),n),M=new T.Matrix4(),q=new T.Quaternion(),col=new T.Color();
 for(let i=0;i<n;i++){const a=i/n*Math.PI*2+rr(-.1,.1),r=rr(690,720),sy=rr(40,90);M.compose(new T.Vector3(Math.cos(a)*r,sy/2-22,Math.sin(a)*r),q.setFromEuler(new T.Euler(0,rr(0,6),0)),new T.Vector3(rr(80,130),sy,rr(80,130)));im.setMatrixAt(i,M);im.setColorAt(i,col.setHex(0x74858f).lerp(new T.Color(HAZE),rr(.25,.5)))}
 ring.add(im)}

/* ============ terrain function (shared by rendering + physics) ============ */
const FY=1.5;
const sstep=(a,b,x)=>{x=clamp((x-a)/(b-a),0,1);return x*x*(3-2*x)};
function segD(px,pz,ax,az,bx,bz){const dx=bx-ax,dz=bz-az;const t=clamp(((px-ax)*dx+(pz-az)*dz)/(dx*dx+dz*dz),0,1);return Math.hypot(px-ax-t*dx,pz-az-t*dz)}
/* Beta 0.5.0 countryside: beveled cuboid geometry (unit size, base at y=0), the look of the test map's hills and blocks */
const BEV_GEO=(()=>{const b=.14,hw=.5-b,s=new T.Shape();s.moveTo(-hw,-hw);s.lineTo(hw,-hw);s.lineTo(hw,hw);s.lineTo(-hw,hw);s.closePath();
 const g=new T.ExtrudeGeometry(s,{depth:1-2*b,bevelEnabled:true,bevelThickness:b,bevelSize:b,bevelSegments:1,curveSegments:1});
 g.translate(0,0,-.5);g.rotateX(-Math.PI/2);g.translate(0,.5,0);g.computeVertexNormals();return g})();
/* hills: each site is a stack of three beveled tiers. Their height is part of the ground (H), so they are walkable. Built lazily, after the bases are scaled. */
let HILLS=null;
function hillList(){if(HILLS)return HILLS;HILLS=[];let s=4421;const rn=()=>(s=(s*16807)%2147483647)/2147483647;
 for(let gx=-MAP_H;gx<=MAP_H;gx+=110)for(let gz=-MAP_H;gz<=MAP_H;gz+=110){
  if(rn()<.35)continue;const x=gx+(rn()-.5)*60,z=gz+(rn()-.5)*60,r=45+rn()*35,h=8+rn()*10;
  const edge=Math.max(Math.abs(x),Math.abs(z));if(edge<MAP_H-170||edge>MAP_H+40)continue; /* outskirts only */
  if(Math.hypot(x-BASES.nato.x,z-BASES.nato.z)<r+170||Math.hypot(x-BASES.wp.x,z-BASES.wp.z)<r+150)continue;
  if(SETTLEMENTS.some(q=>Math.hypot(x-q.x,z-q.z)<r+70)||OUTPOSTS.some(q=>Math.hypot(x-q.x,z-q.z)<r+50))continue;
  HILLS.push({x,z,h,a:rn()*Math.PI/2,r2:(r*1.15)*(r*1.15),t:[{r,h:h*.38,c:0x5f6d3d},{r:r*.62,h:h*.7,c:0x6b7a46},{r:r*.34,h,c:0x78864f}]})}
 return HILLS}
function hillsH(x,z){let y=0;for(const h of hillList()){const dx=x-h.x,dz=z-h.z;if(dx*dx+dz*dz>h.r2)continue;const d=Math.sqrt(dx*dx+dz*dz);
 for(const t of h.t){const q=t.h*(1-sstep(t.r*.9,t.r*1.12,d));if(q>y)y=q}}return y}
const Hraw=(x,z)=>FY+hillsH(x,z); /* Beta 0.5.0: flat ground; only the outskirts rise above it */
/* ============ faction bases: ONE central config (terrain pad, world build, spawning, future AI) ============ */
const faceTo=(x,z,tx,tz)=>Math.atan2(-(tx-x),-(tz-z));   /* yaw that looks from (x,z) towards (tx,tz); forward = (-sin yaw, -cos yaw) */
const BASES={
 nato:{id:'nato',name:'NATO FORWARD BASE',x:-235,z:140,radius:26,spawn:{id:'nato-player',x:-235,z:156,yaw:0},aiSpawns:[{id:'nato-ai-1',x:-249,z:155},{id:'nato-ai-2',x:-221,z:155},{id:'nato-ai-3',x:-254,z:134},{id:'nato-ai-4',x:-216,z:133}]},
 wp:{id:'wp',name:'WARSAW PACT FORWARD BASE',x:235,z:-140,radius:22,spawn:{id:'wp-player',x:239,z:-128,yaw:0},aiSpawns:[{id:'wp-ai-1',x:228,z:-129},{id:'wp-ai-2',x:251,z:-128},{id:'wp-ai-3',x:241,z:-138},{id:'wp-ai-4',x:215,z:-147}]}};
BASES.nato.spawn.yaw=faceTo(BASES.nato.spawn.x,BASES.nato.spawn.z,BASES.wp.x,BASES.wp.z);
BASES.wp.spawn.yaw=faceTo(BASES.wp.spawn.x,BASES.wp.spawn.z,BASES.nato.x,BASES.nato.z);

/* ============ Beta 0.3.0 map layout: expanded battlefield, settlements, outposts, roads, resupply ============ */
const MAP_SCALE=1.6; /* Beta 0.3.75: the whole layout is scaled out from the 0.3.0 positions (same arrangement, larger map) */
const MAP_H=Math.round(380*MAP_SCALE); /* playable map spans -MAP_H..MAP_H on X and Z */
const SETTLEMENTS=[{id:'hrazany',name:'HRAZANY',x:-110,z:70,size:1},{id:'lipova',name:'LIPOVA',x:40,z:130,size:.7},{id:'sedlec',name:'SEDLEC',x:150,z:30,size:1.1},{id:'dubrava',name:'DUBRAVA',x:70,z:-215,size:.8},{id:'ostrov',name:'OSTROV',x:-150,z:-120,size:.9}];
const OUTPOSTS=[{id:'op1',name:'OUTPOST 1',x:-40,z:40},{id:'op2',name:'OUTPOST 2',x:110,z:-80},{id:'op3',name:'OUTPOST 3',x:-170,z:-30},{id:'op4',name:'OUTPOST 4',x:30,z:200}];
/* road junctions; every route that shares a junction shares these exact coordinates */
const NODE={ngate:[BASES.nato.x+12,BASES.nato.z+34],wgate:[BASES.wp.x-30,BASES.wp.z+10],hr:[-110,70],li:[40,130],se:[150,30],du:[70,-215],os:[-150,-120],op1:[-40,40],op2:[110,-80],op3:[-170,-30],op4:[30,200]};
const ROADS=[
 {t:'paved',p:[NODE.ngate,[-175,100],NODE.hr,NODE.op1,[30,15],[90,0],NODE.se,[190,-20],[200,-80],NODE.wgate]},
 {t:'dirt',p:[NODE.ngate,[-150,190],NODE.li,[110,60],NODE.se]},
 {t:'dirt',p:[NODE.li,NODE.op4]},
 {t:'dirt',p:[NODE.hr,[-130,10],NODE.os,[-90,-185],NODE.du,[150,-170],NODE.wgate]},
 {t:'track',p:[NODE.op1,[20,-20],[60,-60],NODE.op2,[150,-100],NODE.wgate]},
 {t:'track',p:[NODE.op3,[-185,40],[-175,100]]},
 {t:'track',p:[NODE.op3,NODE.os]},
 ...SETTLEMENTS.map(s=>({t:'street',p:[[s.x-12,s.z-2],[s.x+12,s.z+2]]}))];
/* resupply points: unlimited ammunition, one at each main base and each outpost */
/* Beta 0.3.75 scale-out: every hand-placed road point, junction, base, settlement and outpost is multiplied by MAP_SCALE exactly once */
{const pts=new Set();for(const k in NODE)pts.add(NODE[k]);for(const r of ROADS)for(const pt of r.p)pts.add(pt);
 for(const pt of pts){pt[0]*=MAP_SCALE;pt[1]*=MAP_SCALE}
 for(const b of[BASES.nato,BASES.wp]){b.x*=MAP_SCALE;b.z*=MAP_SCALE;b.spawn.x*=MAP_SCALE;b.spawn.z*=MAP_SCALE;for(const a of b.aiSpawns){a.x*=MAP_SCALE;a.z*=MAP_SCALE}}
 for(const s of SETTLEMENTS){s.x*=MAP_SCALE;s.z*=MAP_SCALE}
 for(const o of OUTPOSTS){o.x*=MAP_SCALE;o.z*=MAP_SCALE}
 /* gate junctions are base-relative: recompute from the scaled bases so the roads meet the actual gates */
 NODE.ngate[0]=BASES.nato.x+12;NODE.ngate[1]=BASES.nato.z+34;NODE.wgate[0]=BASES.wp.x-30;NODE.wgate[1]=BASES.wp.z+10}
/* truck spawn: on the paved road just outside the NATO gate */
{const gp=NODE.ngate,wp=NODE.wgate,a=TRUCKS[0],c=TRUCKS[1];a.sx=gp[0]+4;a.sz=gp[1]+8;a.syaw=faceTo(a.sx,a.sz,NODE.hr[0],NODE.hr[1]);c.sx=wp[0]-4;c.sz=wp[1]+8;c.syaw=faceTo(c.sx,c.sz,NODE.hr[0],NODE.hr[1])}
/* Beta 0.3.82: no truck is parked at the start. The trigger pad spawns both trucks; an unoccupied truck despawns after TRUCK_TTL seconds. */
const TRIGS=[{x:NODE.ngate[0]-6,z:NODE.ngate[1]+20,r:3,was:false,n:'NATO'},{x:NODE.wgate[0]+12,z:NODE.wgate[1]-20,r:3,was:false,n:'WARSAW PACT'}],TRUCK_TTL=60;
const RESUPPLY=[{id:'nato-base',name:'NATO BASE',x:BASES.nato.x,z:BASES.nato.z-4,r:3.2},{id:'wp-base',name:'WARSAW PACT BASE',x:BASES.wp.x-6,z:BASES.wp.z-4,r:3.2},...OUTPOSTS.map(o=>({id:o.id,name:o.name,x:o.x,z:o.z,r:3.2}))];
/* ground pads: bases, settlements, outposts and the training-range corridor are levelled (each to its own height) */
const padY=(x,z,r)=>{let t=0,n=0;for(let i=-r;i<=r;i+=2)for(let j=-r;j<=r;j+=2)if(i*i+j*j<=r*r){t+=Hraw(x+i,z+j);n++}return n?t/n:Hraw(x,z)};
const PADS=[{x:BASES.nato.x,z:BASES.nato.z,r0:BASES.nato.radius,r1:BASES.nato.radius+60,y:FY},{x:BASES.wp.x,z:BASES.wp.z,r0:BASES.wp.radius+14,r1:BASES.wp.radius+74,y:FY},{x:BASES.wp.x,z:BASES.wp.z,r0:48,r1:100,y:FY},{seg:[0,-50,0,-140],r0:14,r1:64,y:FY}];
/* Beta 0.4.0-pre3: village plans. One axis-aligned street per settlement; homes face the street (doors toward it), a barn sits at the edge of larger settlements, and a dirt lane runs along the street. Own seeded generator so the world's random sequence is unchanged. */
const VILLAGE_PLANS=[];
{let vs=7331;const vr=()=>(vs=(vs*16807)%2147483647)/2147483647;
 for(const s of SETTLEMENTS){
  const n=s.size>.95?6:s.size>.75?4:3,alongX=vr()<.5,ux=alongX?1:0,uz=alongX?0:1,nx=alongX?0:1,nz=alongX?1:0,sp=12.5,K=n>4?3:2;
  const plan={s,alongX,ux,uz,nx,nz,lane:null,homes:[],barn:null,ext:0};
  const door=sd=>{const dx=-sd*nx,dz=-sd*nz;return Math.abs(dx)>Math.abs(dz)?(dx>0?3:2):(dz>0?1:0)}; /* Beta 0.4.0-pre11: the x-axis labels were swapped, so doors on that side faced away from the street */
  for(const k of[0,1,-1,2,-2,3,-3].filter(k=>Math.abs(k)<=K))for(const sd of[1,-1]){
   if(plan.homes.length>=n)break;
   const along=k*sp+(vr()-.5)*1.4,setb=6.8+vr()*1.6,x=s.x+ux*along+nx*sd*setb,z=s.z+uz*along+nz*sd*setb;
   if(roadDist(x,z)<6||plan.homes.some(h=>Math.hypot(h.x-x,h.z-z)<12))continue;
   plan.homes.push({x,z,sd,along,rot:!alongX,doorSide:door(sd),w:6+vr()*3,d:5+vr()*2,h:2.7+vr()*.3,ti:vr(),pi:vr(),ext:vr()<.35,chimney:vr()<.8,win:1+Math.floor(vr()*3)})}
  /* town square (Beta 0.4.0-pre11): the largest villages clear homes within 12 m of their centre and get a square there */
  if(s.size>.95){plan.square={x:s.x,z:s.z};plan.homes=plan.homes.filter(h=>Math.hypot(h.x-s.x,h.z-s.z)>12)}
  /* town centre (Beta 0.4.0-pre6): the largest villages replace their first home with a shop facing the street */
  if(s.size>.95&&plan.homes.length){const f=plan.homes.shift();plan.shop={x:f.x,z:f.z,sd:f.sd,along:f.along,rot:f.rot,doorSide:f.doorSide,w:10,d:6.5,h:3.4,ti:f.ti,win:3}}
  /* workshop (Beta 0.4.0-pre11): mid-size and large villages turn one more home into a workshop */
  if(s.size>.75&&plan.homes.length>2){const f=plan.homes.pop();plan.workshop={x:f.x,z:f.z,sd:f.sd,along:f.along,rot:f.rot,doorSide:f.doorSide,w:9,d:6,h:3.3,ti:f.ti,pi:f.pi,win:2}}
  /* yards (Beta 0.4.0-pre4): a back-yard fence and optionally a shed at one rear corner; dropped where a road is too close */
  for(const hm of plan.homes){const ox=nx*hm.sd,oz=nz*hm.sd,dF=hm.d/2+4,fx=hm.x+ox*dF,fz=hm.z+oz*dF;
   hm.fence=vr()<.6&&roadDist(fx,fz)>3?{x:fx,z:fz}:null;
   const shedSide=vr()<.5?1:-1,dS=hm.d/2+2.2,shx=hm.x+ox*dS+ux*(hm.w/2-2)*shedSide,shz=hm.z+oz*dS+uz*(hm.w/2-2)*shedSide,wantShed=vr()<.5;
   hm.shed=wantShed&&roadDist(shx,shz)>3?{x:shx,z:shz}:null}
  if(s.size>.9){const along=-(K+1)*sp-6.25;plan.barn={x:s.x+ux*along-nx*15,z:s.z+uz*along-nz*15,along,rot:!alongX,doorSide:door(-1)}}
  /* farmstead (Beta 0.4.0-pre5): barn, silo and hay on the far side of the street, joined to the lane by a track; skipped if a road is too close */
  {const fa=(K+1)*sp+18,fs=vr()<.5?1:-1,fx=s.x+ux*fa+nx*fs*30,fz=s.z+uz*fa+nz*fs*30;
   if(roadDist(fx,fz)>12&&roadDist(fx+ux*10,fz+uz*10)>4)plan.farm={x:fx,z:fz,along:fa,side:fs,rot:!alongX,doorSide:door(fs)}}
  const far=[...plan.homes.map(h=>Math.hypot(h.along,8)),plan.shop?Math.hypot(plan.shop.along,8):0,plan.barn?Math.hypot(plan.barn.along,15):0,plan.farm?Math.hypot(plan.farm.x-s.x,plan.farm.z-s.z)+12:0,22];
  plan.ext=Math.max(...far)+8;
  const L=Math.max(...plan.homes.map(h=>Math.abs(h.along)+6),plan.barn?Math.abs(plan.barn.along)+8:0,20)+6;
  plan.lane=[s.x-ux*L,s.z-uz*L,s.x+ux*L,s.z+uz*L];
  /* road connector (Beta 0.4.0-pre8): from the nearer lane end to the closest point on the road network, if within 160 m */
  {const clearOf=(c)=>{for(const h of plan.homes)if(segD(h.x,h.z,c[0],c[1],c[2],c[3])<5)return false;if(plan.shop&&segD(plan.shop.x,plan.shop.z,c[0],c[1],c[2],c[3])<8)return false;if(plan.barn&&segD(plan.barn.x,plan.barn.z,c[0],c[1],c[2],c[3])<9)return false;return true};
   let pick=null;for(const e of[[plan.lane[0],plan.lane[1]],[plan.lane[2],plan.lane[3]]]){let best=null;for(const r of ROADS)for(let i=0;i<r.p.length-1;i++)for(let t=0;t<=1.0001;t+=.05){
    const px=r.p[i][0]+(r.p[i+1][0]-r.p[i][0])*t,pz=r.p[i][1]+(r.p[i+1][1]-r.p[i][1])*t,d=Math.hypot(px-e[0],pz-e[1]);if(!best||d<best.d)best={d,px,pz}}
    if(best&&best.d>3&&best.d<160){const c=[e[0],e[1],best.px,best.pz];if(clearOf(c)&&(!pick||best.d<pick.d))pick={d:best.d,c}}}
   if(pick)plan.connector=pick.c}
  /* elbow connector (Beta 0.4.0-pre11): if no straight track fits, a two-part track from a lane end via one bend point to the road */
  if(!plan.connector){const clearSeg=(c)=>{for(const h of plan.homes)if(segD(h.x,h.z,c[0],c[1],c[2],c[3])<5)return false;if(plan.shop&&segD(plan.shop.x,plan.shop.z,c[0],c[1],c[2],c[3])<8)return false;if(plan.workshop&&segD(plan.workshop.x,plan.workshop.z,c[0],c[1],c[2],c[3])<8)return false;if(plan.barn&&segD(plan.barn.x,plan.barn.z,c[0],c[1],c[2],c[3])<9)return false;if(plan.farm&&segD(plan.farm.x,plan.farm.z,c[0],c[1],c[2],c[3])<10)return false;return true};
   let pick=null;for(const e of[[plan.lane[0],plan.lane[1]],[plan.lane[2],plan.lane[3]]])for(let ang=0;ang<360;ang+=10)for(const rad of[12,18,24,32]){
    const a=ang*Math.PI/180,mx=e[0]+Math.cos(a)*rad,mz=e[1]+Math.sin(a)*rad;
    if(segD(mx,mz,plan.lane[0],plan.lane[1],plan.lane[2],plan.lane[3])<7||!clearSeg([e[0],e[1],mx,mz])||roadDist(mx,mz)<4)continue;
    let best=null;for(const r of ROADS)for(let i=0;i<r.p.length-1;i++)for(let t=0;t<=1.0001;t+=.05){const px=r.p[i][0]+(r.p[i+1][0]-r.p[i][0])*t,pz=r.p[i][1]+(r.p[i+1][1]-r.p[i][1])*t,d=Math.hypot(px-mx,pz-mz);if(!best||d<best.d)best={d,px,pz}}
    if(!best||best.d>160||best.d<3||!clearSeg([mx,mz,best.px,best.pz]))continue;
    const tot=rad+best.d;if(!pick||tot<pick.tot)pick={tot,c1:[e[0],e[1],mx,mz],c2:[mx,mz,best.px,best.pz]}}
   if(pick){plan.connector=pick.c1;plan.connector2=pick.c2}}
  VILLAGE_PLANS.push(plan)}
}
function villageBlocked(x,z){for(const v of VILLAGE_PLANS){const[ax,az,bx,bz]=v.lane;if(segD(x,z,ax,az,bx,bz)<7)return true;if(v.connector&&segD(x,z,...v.connector)<5)return true;if(v.connector2&&segD(x,z,...v.connector2)<5)return true;for(const h of v.homes)if(Math.hypot(h.x-x,h.z-z)<9)return true;if(v.barn&&Math.hypot(v.barn.x-x,v.barn.z-z)<12)return true;if(v.farm&&Math.hypot(v.farm.x-x,v.farm.z-z)<16)return true}return false}
function settleCore(x,z){for(const s of SETTLEMENTS)if(Math.hypot(s.x-x,s.z-z)<22*s.size+4)return true;return false}
function flatNS(x,z){let f=0;for(const p of PADS){if(p.set)continue;const q=padF(p,x,z);if(q>f)f=q}return f}
for(const s of SETTLEMENTS){const pv=VILLAGE_PLANS.find(v=>v.s===s),r0=Math.max(22*s.size,pv?pv.ext:0);PADS.push({x:s.x,z:s.z,r0,r1:r0+25,y:padY(s.x,s.z,22*s.size),set:true})}
for(const o of OUTPOSTS)PADS.push({x:o.x,z:o.z,r0:9,r1:50,y:padY(o.x,o.z,9)});
for(const g of TRIGS)PADS.push({x:g.x,z:g.z,r0:g.r+1,r1:g.r+6,y:Hraw(g.x,g.z)}); /* Beta 0.3.82: level ground under each truck trigger pad */
const padF=(p,x,z)=>p.seg?1-sstep(p.r0,p.r1,segD(x,z,p.seg[0],p.seg[1],p.seg[2],p.seg[3])):1-sstep(p.r0,p.r1,Math.hypot(x-p.x,z-p.z));
const flat=(x,z)=>{let f=0;for(const p of PADS){const q=padF(p,x,z);if(q>f)f=q}return f};
const H=(x,z)=>{let f=0,sw=0,sy=0;for(const p of PADS){const q=padF(p,x,z);if(q>0){sw+=q;sy+=q*p.y;if(q>f)f=q}}const y=sw>0?sy/sw:FY;return Hraw(x,z)*(1-f)+y*f};
/* Beta 0.3.75 forest density (0..1): large forest zones, a wooded band at the map edge, open ground between */
const FZ=[[-260,-60,120],[250,40,130],[40,-250,110],[-60,330,130],[240,240,95],[-220,-270,120],[-20,-420,90],[380,-420,90],[-450,160,100],[120,450,100],[-430,-300,80],[460,220,90],[-120,430,85],[300,-40,70]];
const forestAt=(x,z)=>{let f=.12+.16*Math.sin(x*.021+1)*Math.cos(z*.019+2)+.08*Math.sin(x*.047+z*.031);
 for(const[zx,zz,r]of FZ){const dx=x-zx,dz=z-zz,ang=Math.atan2(dz,dx),wob=1+.16*Math.sin(3*ang+zx*.07)+.09*Math.sin(5*ang+zz*.05+1);const v=1-sstep(r*.6,r*1.1,Math.hypot(dx,dz)/wob);if(v>f)f=v}
 return 0};
/* Beta 0.3.75 transport truck model: olive-drab 2.5-ton style truck, nose toward -z, origin at ground level under the chassis */
/* merge the mesh children of a group into one mesh per material (fewer draw calls) */
const mergeMeshes=(group)=>{const kids=group.children.filter(m=>m.isMesh),bk=new Map();
 for(const m of kids){m.updateMatrix();const g=m.geometry.clone();g.applyMatrix4(m.matrix);const q=g.index?g.toNonIndexed():g;if(q!==g)g.dispose();let e=bk.get(m.material);if(!e){e={p:[],n:[]};bk.set(m.material,e)}const a=q.attributes.position.array,n=q.attributes.normal.array;for(let i=0;i<a.length;i++)e.p.push(a[i]);for(let i=0;i<n.length;i++)e.n.push(n[i]);q.dispose()}
 for(const m of kids)group.remove(m);
 const out=[];for(const[mat,e]of bk){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(e.p,3));g.setAttribute('normal',new T.Float32BufferAttribute(e.n,3));const mm=new T.Mesh(g,mat);mm.castShadow=mm.receiveShadow=true;group.add(mm);out.push(mm)}
 return out};
function buildTruck(t){const g=new T.Group(),ext=new T.Group(),int=new T.Group();g.add(ext);g.add(int);t.ext=ext;t.int=int;
 /* Beta 0.3.8: olive 4x4 cargo truck; exterior (ext) and cab interior (int) are shown separately */
 const mO=L({color:0x4e5a3a}),mOc=L({color:0x4e5a3a,side:T.DoubleSide}),mD=L({color:0x363b2a}),mCan=L({color:0x8a8d6a}),mG=L({color:0x2a3840,side:T.DoubleSide}),mT=L({color:0x1c1c1a}),mR=L({color:0x6f6f66}),mM=L({color:0x2f2f2a}),mL=L({color:0xe8e2b0}),mRd=L({color:0x8a2a1e}),mDash=L({color:0x2b2a24}),mSeat=L({color:0x3d3a2e});
 const put=(geo,mat,x,y,z,rx,rz,occ,par)=>{const m=new T.Mesh(geo,mat);m.position.set(x,y,z);if(rx)m.rotation.x=rx;if(rz)m.rotation.z=rz;m.castShadow=m.receiveShadow=true;(par||ext).add(m);return m};
 const box=(w,h,d,mat,x,y,z,occ,rx,par)=>put(new T.BoxGeometry(w,h,d),mat,x,y,z,rx,0,occ,par);
 const cyl=(rt,rb,h,seg,mat,x,y,z,rx,rz,occ,par)=>put(new T.CylinderGeometry(rt,rb,h,seg),mat,x,y,z,rx,rz,occ,par);
 /* chassis, bonnet, grille, lamps, bumper */
 box(2.0,.22,5.6,mD,0,.78,0,true);
 box(1.9,.5,.7,mO,0,1.42,-3.1,true);
 box(1.6,.5,.06,mD,0,1.3,-3.45,false);
 for(const y of[1.18,1.3,1.42])box(1.5,.04,.05,mM,0,y,-3.49,false);
 for(const sx of[-.68,.68])cyl(.11,.11,.06,10,mL,sx,1.5,-3.46,Math.PI/2,0,false);
 box(2.3,.2,.16,mM,0,.86,-3.47,true);
 for(const sx of[-.95,.95])box(.3,.3,.04,mRd,sx,1.05,-3.47,false);
 /* cab */
 box(2.2,1.45,1.75,mOc,0,2.0,-1.9,true);
 box(2.32,.1,1.85,mO,0,2.78,-1.9,true);
 box(1.98,.78,.05,mG,0,2.22,-2.78,false,-.18);
 for(const sx of[-1,1]){box(.04,.5,1.2,mG,sx*1.11,2.35,-1.9,false);box(.06,.08,.22,mM,sx*1.12,2.0,-1.7,false);box(.04,.04,.45,mM,sx*1.25,2.45,-2.45,false);box(.05,.4,.25,mM,sx*1.3,2.45,-2.7,false)}
 /* exhaust stack, running boards, cargo body with canvas, ribs, tailgate, rear lamps */
 cyl(.06,.06,1.9,8,mM,1.02,1.9,-.9,0,0,false);cyl(.08,.08,.12,8,mM,1.02,2.88,-.9,0,0,false);
 for(const sx of[-1,1])box(.25,.08,2.4,mD,sx*1.16,.66,-.5,false);
 box(2.36,1.9,3.3,mCan,0,2.35,1.05,true);
 for(const z of[-.3,.5,1.3,2.1])box(2.4,.04,.04,mD,0,3.3,z,false);
 for(const sx of[-1,1])box(.05,.05,3.3,mD,sx*1.19,3.3,1.05,false);
 box(2.36,1.88,.04,mD,0,2.35,2.72,false);
 for(const sx of[-1,1])box(.14,.22,.05,mRd,sx*1.1,1.95,2.75,false);
 /* spare wheel on the tailgate */
 cyl(.45,.45,.28,14,mT,0,1.6,2.98,Math.PI/2,0,false);cyl(.25,.25,.3,10,mR,0,1.6,2.98,Math.PI/2,0,false);
 /* wheels: single front pair, rear dual pairs, mudguards */
 const wheel=(x,z)=>{cyl(.5,.5,.36,14,mT,x,.5,z,0,Math.PI/2,true);cyl(.26,.26,.38,10,mR,x,.5,z,0,Math.PI/2,false)};
 for(const sx of[-1,1]){wheel(sx*1.12,-2.0);wheel(sx*1.12,1.6);wheel(sx*.86,1.6);box(.6,.05,1.0,mO,sx*1.2,1.12,-2.0,false);box(.6,.05,1.3,mO,sx*1.2,1.12,1.6,false)}
 /* cab interior (first person view): dash, wheel, seats, pillars, roof lining, gear lever */
 box(2.1,.32,.42,mDash,0,1.95,-2.3,false,0,int);
 box(2.2,.04,1.75,mO,0,2.76,-1.9,false,0,int);
 for(const sx of[-1,1])box(.07,1.5,.07,mO,sx*1.06,2.05,-2.2,false,0,int);
 put(new T.TorusGeometry(.19,.018,6,16),mM,-.42,1.92,-2.02,-.55,0,false,int);
 for(const sx of[-.45,.45]){box(.5,.14,.5,mSeat,sx,1.36,-1.78,false,0,int);box(.5,.6,.12,mSeat,sx,1.72,-1.44,false,0,int)}
 cyl(.02,.02,.4,6,mM,-.1,1.6,-1.85,-.2,0,false,int);
 mergeMeshes(int);mergeMeshes(ext);occluders.push(...ext.children);
 g.position.set(t.x,t.y,t.z);g.rotation.y=t.yaw;return g}
function roadDist(x,z){let best=1e9;for(const r of ROADS){const p=r.p;for(let i=0;i<p.length-1;i++){const d=segD(x,z,p[i][0],p[i][1],p[i+1][0],p[i+1][1]);if(d<best)best=d}}return best}
function densify(pl,step){const out=[];for(let i=0;i<pl.length-1;i++){const a=pl[i],c=pl[i+1],n=Math.max(1,Math.ceil(Math.hypot(c[0]-a[0],c[1]-a[1])/step));for(let k=0;k<n;k++){const t=k/n;out.push([a[0]+(c[0]-a[0])*t,a[1]+(c[1]-a[1])*t])}}out.push(pl[pl.length-1]);return out}
/* snapshot / shift: lets the NATO outpost be authored at the origin and moved to its base centre */
const snapWorld=()=>({w:world.children.length,b:boxes.length,c:circles.length});
function shiftSince(s,dx,dz){for(let i=s.w;i<world.children.length;i++){const o=world.children[i];o.position.x+=dx;o.position.z+=dz}
 for(let i=s.b;i<boxes.length;i++){const q=boxes[i];q.x0+=dx;q.x1+=dx;q.z0+=dz;q.z1+=dz}
 for(let i=s.c;i<circles.length;i++){circles[i].x+=dx;circles[i].z+=dz}}


/* ============ world ============ */
let world=null,boxes=[],circles=[],occluders=[],targets=[],flag=null,flags=[];
let OCC_CAT=new Map();
const disposeG=g=>g.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material)[].concat(o.material).forEach(m=>{if(m.map)m.map.dispose();m.dispose()})});
const _M=new T.Matrix4(),_q=new T.Quaternion(),_p=new T.Vector3(),_s=new T.Vector3(),_e=new T.Euler();
const setI=(im,i,x,y,z,sx,sy,sz,ry=0,rx=0,rz=0)=>{_e.set(rx,ry,rz);_q.setFromEuler(_e);_M.compose(_p.set(x,y,z),_q,_s.set(sx,sy,sz));im.setMatrixAt(i,_M)};
/* Beta 0.3.8: an InstancedMesh is culled as one object, so vegetation is split into 200 m tiles that the renderer can skip when off screen. The same instances are drawn; only the grouping changes. */
const TILE=200;
let VEG=[];   /* foliage/grass/bush tiles that the distance cull may hide (trunks and rocks are bullet occluders and are never hidden) */
const tileIM=(im)=>{const n=im.count,m4=new T.Matrix4(),pv=new T.Vector3(),col=new T.Color(),buckets=new Map();
 for(let i=0;i<n;i++){im.getMatrixAt(i,m4);pv.setFromMatrixPosition(m4);const k=Math.floor(pv.x/TILE)+','+Math.floor(pv.z/TILE);let b=buckets.get(k);if(!b){b=[];buckets.set(k,b)}b.push(i)}
 const out=[];for(const[k,idx]of buckets){const[ix,iz]=k.split(',').map(Number);const t=new T.InstancedMesh(im.geometry,im.material,idx.length);t.userData.box=[ix*TILE,iz*TILE,(ix+1)*TILE,(iz+1)*TILE];
  for(let j=0;j<idx.length;j++){im.getMatrixAt(idx[j],m4);t.setMatrixAt(j,m4);if(im.instanceColor){im.getColorAt(idx[j],col);t.setColorAt(j,col)}}
  t.instanceMatrix.needsUpdate=true;if(t.instanceColor)t.instanceColor.needsUpdate=true;
  t.castShadow=im.castShadow;t.receiveShadow=im.receiveShadow;t.computeBoundingSphere();world.add(t);out.push(t)}
 return out};

function buildWorld(){
 if(world){scene.remove(world);disposeG(world)}
 world=new T.Group();scene.add(world);boxes=[];circles=[];occluders=[];targets=[];flags=[];VEG=[];seed=1337;
 const SH=true,add=(m,c=SH,r=SH)=>{m.castShadow=c;m.receiveShadow=r;world.add(m);return m};
 const col=new T.Color(),BOX=new T.BoxGeometry(1,1,1);
 /* materials */
 const tGround=cvs(128,128,(g,w,h)=>{g.fillStyle='#d6d6d6';g.fillRect(0,0,w,h);speckle(g,w,h,2600,.35)},200,200);
 const tWall=cvs(128,128,(g,w,h)=>{g.fillStyle='#dcdcdc';g.fillRect(0,0,w,h);g.fillStyle='#0003';for(let y=0;y<h;y+=12)g.fillRect(0,y,w,2);speckle(g,w,h,900,.3)},3,1);
 const tRoof=cvs(64,64,(g,w,h)=>{g.fillStyle='#ccc';g.fillRect(0,0,w,h);g.fillStyle='#0004';for(let x=0;x<w;x+=8)g.fillRect(x,0,3,h);speckle(g,w,h,300,.3)},4,2);
 const tWood=cvs(64,64,(g,w,h)=>{g.fillStyle='#d4d4d4';g.fillRect(0,0,w,h);g.fillStyle='#0005';for(let x=0;x<w;x+=16)g.fillRect(x,0,2,h);for(let i=0;i<40;i++)g.fillRect(R()*w,R()*h,1,6+R()*10);speckle(g,w,h,200,.3)});
 const tSand=cvs(64,64,(g,w,h)=>{g.fillStyle='#d8d8d8';g.fillRect(0,0,w,h);speckle(g,w,h,900,.4);g.fillStyle='#0003';g.fillRect(0,30,w,2);g.fillRect(30,0,2,w)});
 const mGround=L({vertexColors:true,map:tGround}),mWall=L({color:0x7f836a,map:tWall}),mRoof=L({color:0x434a38,map:tRoof,side:T.DoubleSide}),mWood=L({color:0x8a6840,map:tWood}),
  mSand=L({color:0xb0a47c,map:tSand}),mTent=L({color:0x6c6f48,side:T.DoubleSide,map:tSand}),mDark=L({color:0x15181a}),mDirt=L({color:0x6a5a3e,map:tGround}),mMetal=L({color:0x4b514b});
 /* penetration categories (Beta 0.2.5): R = resistance in J per metre of material. Unlisted materials (rock, tree trunks, concrete) block. */
 OCC_CAT=new Map([[mWood,{c:'wood',R:1500,col:0xc9a06a}],[mSand,{c:'sand',R:12000,col:0xcbbf98}],[mWall,{c:'concrete',R:1e9,col:0xd8d2c0}],[mDark,{c:'concrete',R:1e9,col:0xd8d2c0}],[mRoof,{c:'sheet',R:20000,col:0xffb050}],[mTent,{c:'fabric',R:600,col:0xbfb9a0}],[mMetal,{c:'metal',R:40000,col:0xffb050}]]);
 /* terrain */
 {const seg=Math.round(MAP_H*2/Qc.cell),g=new T.PlaneGeometry(MAP_H*2,MAP_H*2,seg,seg);g.rotateX(-Math.PI/2);const p=g.attributes.position;
  for(let i=0;i<p.count;i++)p.setY(i,H(p.getX(i),p.getZ(i)));g.computeVertexNormals();
  const nm=g.attributes.normal,cl=new Float32Array(p.count*3),A=new T.Color(0x4a5e2c),B=new T.Color(0x6e7c3c),D=new T.Color(0x6e5b3f),G=new T.Color(0x8c8672),c=new T.Color();
  for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i),n=.5+.5*Math.sin(x*.07)*Math.cos(z*.06+1)+.2*Math.sin(x*.31+z*.27),f=flat(x,z),sl=1-nm.getY(i);
   c.copy(A).lerp(B,clamp(n,0,1));c.lerp(D,clamp((sl-.05)*9,0,.9));c.lerp(f>.5?(.5+.5*Math.sin(x*.9)*Math.sin(z*.8)>.55?G:D):c,sstep(.3,.9,f)*.85);
   c.multiplyScalar(.9+.2*Math.sin(x*.5)*Math.sin(z*.43));cl.set([c.r,c.g,c.b],i*3)}
  g.setAttribute('color',new T.BufferAttribute(cl,3));const m=new T.Mesh(g,mGround);m.receiveShadow=SH;world.add(m)}
 /* helpers */
 function addBox(x,y,z,w,h,d,mat,o={}){const m=new T.Mesh(BOX,mat);m.scale.set(w,h,d);m.position.set(x,y+h/2,z);add(m,o.cast??SH,SH);
  if(o.col!==false)boxes.push({x0:x-w/2,x1:x+w/2,z0:z-d/2,z1:z+d/2,top:y+h,bot:y});if(o.occ!==false)occluders.push(m);return m}
 function gable(x,y,z,span,rise,len,mat,alongX){const s=new T.Shape();s.moveTo(-span/2,0);s.lineTo(span/2,0);s.lineTo(0,rise);s.closePath();
  const g=new T.ExtrudeGeometry(s,{depth:len,bevelEnabled:false});g.translate(0,0,-len/2);if(alongX)g.rotateY(Math.PI/2);const m=new T.Mesh(g,mat);m.position.set(x,y,z);add(m);occluders.push(m)}
 /* hills on the outskirts: stacked beveled tiers, one mesh per tier. They are sniping ground at the edge of the map. */
 for(const h of hillList()){const yb=Hraw(h.x,h.z)-h.h;
  for(const t of h.t){const a=t.r*1.02,top=yb+t.h,bot=yb-3;const m=new T.Mesh(BEV_GEO,L({color:t.c}));m.position.set(h.x,bot,h.z);m.scale.set(2*a,top-bot,2*a);m.rotation.y=h.a;add(m,true,true)}}
 /* boundary edge: a concrete wall round the playable square (collision, so nobody leaves the map) */
 {const e=MAP_H-2,t=3,mEdge=L({color:0x6f6c64,map:tWall});addBox(0,FY,-e,e*2+t,6,t,mEdge);addBox(0,FY,e,e*2+t,6,t,mEdge);addBox(-e,FY,0,t,6,e*2+t,mEdge);addBox(e,FY,0,t,6,e*2+t,mEdge)}
 const SNAP0=snapWorld();
 /* outpost buildings */
 function hut(x,z,w,d,h,mw=mWall,mr=mRoof){addBox(x,FY-.2,z,w,h+.2,d,mw);gable(x,FY+h,z,d+.8,1.2,w+.8,mr,true);
  const n=Math.floor(w/3.2);for(let i=0;i<n;i++){const wx=x-w/2+(i+.5)*w/n;for(const sd of[-1,1])addBox(wx,FY+1.1,z+sd*(d/2+.03),.9,.8,.1,mDark,{col:false,occ:false,cast:false})}
  addBox(x+w/2-1.6,FY,z+d/2+.04,1,2,.1,mWood,{col:false,occ:false,cast:false})}
 hut(-12,-9,13,5.5,3);hut(-12,3,13,5.5,3);hut(12,-8,8,6.5,3.2);hut(13,4,7,4.5,2.8);
 {const m=new T.Mesh(new T.CylinderGeometry(.04,.07,8,6),mMetal);m.position.set(15,FY+3.2+4,-6);add(m,SH,false)}
 for(const[x,z]of[[-1,-14],[4,-14.5],[-7,-16.5]]){gable(x,FY,z,3.2,2.2,5,mTent,false);boxes.push({x0:x-1.6,x1:x+1.6,z0:z-2.5,z1:z+2.5,top:FY+2.2})}
 /* sandbags */
 {const bags=[];const wall=(x,z,len,ax)=>{const n=Math.round(len/.8);for(let r=0;r<3;r++){const c=r%2?n-1:n;for(let i=0;i<c;i++){const o=(i-(c-1)/2)*.8;bags.push([ax?x+o:x+rr(-.04,.04),FY+r*.27+.135,ax?z+rr(-.04,.04):z+o,(ax?0:Math.PI/2)+rr(-.12,.12)])}}
   boxes.push(ax?{x0:x-len/2,x1:x+len/2,z0:z-.28,z1:z+.28,top:FY+.8,climb:true}:{x0:x-.28,x1:x+.28,z0:z-len/2,z1:z+len/2,top:FY+.8,climb:true})};
  wall(0,.8,5,true);wall(-2.6,-.6,3,false);wall(2.6,-.6,3,false);wall(-7,18,4,true);wall(7,18,4,true);wall(-20,-58,4,true);wall(20,-58,4,true);
  const im=new T.InstancedMesh(new T.BoxGeometry(.8,.27,.5),mSand,bags.length);bags.forEach((b,i)=>setI(im,i,b[0],b[1],b[2],1,1,1,b[3]));im.castShadow=im.receiveShadow=SH;world.add(im);occluders.push(im)}
 /* crates, barrels */
 for(const[x,y,z,s]of[[19,0,-1,1],[20.2,0,-1.1,.9],[19.5,1,-1,.8],[-20,0,12,1],[-20.1,0,13.2,.9]])addBox(x,FY+y,z,s,s,s,mWood);
 {const pts=[[19,3],[20,3.7],[19.2,4.6],[-19.5,16],[-20.4,16.8]],im=new T.InstancedMesh(new T.CylinderGeometry(.3,.3,.9,10),L({color:0xffffff}),pts.length);
  pts.forEach((p,i)=>{setI(im,i,p[0],FY+.45,p[1],1,1,1);im.setColorAt(i,col.setHex(i%2?0x4a5a3a:0x7a4a2a));circles.push({x:p[0],z:p[1],r:.35})});im.castShadow=SH;world.add(im)}
 /* fence */
 {const posts=[],seg=(x0,z0,x1,z1)=>{const len=Math.hypot(x1-x0,z1-z0),ax=Math.abs(z1-z0)<.01,cx=(x0+x1)/2,cz=(z0+z1)/2;
   for(const y of[.5,1])addBox(cx,FY+y,cz,ax?len:.05,.1,ax?.05:len,mWood,{col:false,cast:false});
   boxes.push({x0:cx-(ax?len/2:.08),x1:cx+(ax?len/2:.08),z0:cz-(ax?.08:len/2),z1:cz+(ax?.08:len/2),top:FY+1.3});
   const n=Math.max(1,Math.round(len/3));for(let i=0;i<=n;i++)posts.push([x0+(x1-x0)*i/n,z0+(z1-z0)*i/n])};
  seg(-22,22,-3,22);seg(3,22,22,22);seg(-22,-20,-3,-20);seg(3,-20,22,-20);seg(-22,-20,-22,22);seg(22,-20,22,22);
  const im=new T.InstancedMesh(BOX,mWood,posts.length);posts.forEach((p,i)=>setI(im,i,p[0],FY+.7,p[1],.14,1.4,.14));im.castShadow=SH;world.add(im)}
 shiftSince(SNAP0,BASES.nato.x,BASES.nato.z);
 /* flags: built per base below */
 {const NB=BASES.nato,WB=BASES.wp,cx=WB.x,cz=WB.z;
  const mTentWP=L({color:0x8c7752,side:T.DoubleSide,map:tSand}),mWallWP=L({color:0x9b8f68,map:tWall}),mRoofWP=L({color:0x5b3d2c,map:tRoof,side:T.DoubleSide}),mCrateWP=L({color:0x55603c,map:tWood});
  function flagTex(kind){return cvs(192,120,(g,w,h)=>{if(kind==='nato'){g.fillStyle='#1b3a73';g.fillRect(0,0,w,h);g.strokeStyle='#f0f0f0';g.lineWidth=4;g.beginPath();g.arc(w/2,h/2,30,0,7);g.stroke();g.fillStyle='#f0f0f0';
     for(let i=0;i<4;i++){g.save();g.translate(w/2,h/2);g.rotate(i*Math.PI/2);g.beginPath();g.moveTo(0,-46);g.lineTo(6,-6);g.lineTo(-6,-6);g.closePath();g.fill();g.restore()}}
    else{g.fillStyle='#a01c1c';g.fillRect(0,0,w,h);g.strokeStyle='#e0b84a';g.lineWidth=5;g.strokeRect(5,5,w-10,h-10);g.fillStyle='#e0b84a';g.beginPath();
     for(let i=0;i<10;i++){const r=i%2?15:38,a=-Math.PI/2+i*Math.PI/5;g.lineTo(w/2+Math.cos(a)*r,h/2+Math.sin(a)*r)}g.closePath();g.fill()}})}
  function makeFlag(x,z,kind){const y=H(x,z),pole=new T.Mesh(new T.CylinderGeometry(.06,.08,9.5,6),mMetal);pole.position.set(x,y+4.75,z);add(pole,SH,false);circles.push({x,z,r:.2});
   const f=new T.Mesh(new T.PlaneGeometry(2.9,1.8),new T.MeshBasicMaterial({map:flagTex(kind),side:T.DoubleSide}));f.position.set(x+1.5,y+8.2,z);f.userData.ph=flags.length*1.7;world.add(f);flags.push(f);flag=flags[0]}
  function marker(sp,col){const g=new T.Group(),m=new T.MeshBasicMaterial({color:col,transparent:true,opacity:.8,depthWrite:false});g.position.set(sp.x,H(sp.x,sp.z)+.06,sp.z);g.rotation.y=sp.yaw;
   const r=new T.Mesh(new T.RingGeometry(1.15,1.45,32),m);r.rotation.x=-Math.PI/2;g.add(r);
   const sh=new T.Shape();sh.moveTo(0,.95);sh.lineTo(.5,-.35);sh.lineTo(0,-.12);sh.lineTo(-.5,-.35);sh.closePath();const a=new T.Mesh(new T.ShapeGeometry(sh),m);a.rotation.x=-Math.PI/2;g.add(a);world.add(g)}
  function sign(x,z,text,col,face,fs=34){const ct=cvs(512,100,(g,w,h)=>{g.fillStyle='#1c1f14';g.fillRect(0,0,w,h);g.strokeStyle=col;g.lineWidth=5;g.strokeRect(4,4,w-8,h-8);g.fillStyle=col;g.font='bold '+fs+'px sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText(text,w/2,h/2+2)}),gy=H(x,z);
   for(const s of[-1,1])addBox(x+s*2.3*Math.cos(face),gy,z-s*2.3*Math.sin(face),.14,2.8,.14,mWood,{col:false,occ:false,cast:false});
   for(const k of[0,1]){const p=new T.Mesh(new T.PlaneGeometry(4.6,.9),new T.MeshBasicMaterial({map:ct}));p.position.set(x+Math.sin(face+k*Math.PI)*.08,gy+2.3,z+Math.cos(face+k*Math.PI)*.08);p.rotation.y=face+k*Math.PI;world.add(p)}}
  function bagWall(list){const bags=[];for(const[x,z,len,ax]of list){const n=Math.round(len/.8);for(let r=0;r<3;r++){const c=r%2?n-1:n;for(let i=0;i<c;i++){const o=(i-(c-1)/2)*.8,gy=H(x,z);bags.push([ax?x+o:x+rr(-.04,.04),gy+r*.27+.135,ax?z+rr(-.04,.04):z+o,(ax?0:Math.PI/2)+rr(-.12,.12)])}}
    boxes.push(ax?{x0:x-len/2,x1:x+len/2,z0:z-.28,z1:z+.28,top:FY+.8,climb:true}:{x0:x-.28,x1:x+.28,z0:z-len/2,z1:z+len/2,top:FY+.8,climb:true})}
   const im=new T.InstancedMesh(new T.BoxGeometry(.8,.27,.5),mSand,bags.length);bags.forEach((b,i)=>setI(im,i,b[0],b[1],b[2],1,1,1,b[3]));im.castShadow=im.receiveShadow=SH;world.add(im);occluders.push(im)}
  /* NATO base identification (the original outpost is the NATO base) */
  makeFlag(NB.x,NB.z+8,'nato');marker(NB.spawn,0x6f9be0);sign(NB.x+8,NB.z+26.5,NB.name,'#8fb0e8',faceTo(NB.x+8,NB.z+26.5,WB.x,WB.z)+Math.PI);
  for(const[x,z]of[[NB.x-9,NB.z-20.8],[NB.x+9,NB.z-20.8]])addBox(x,FY,z,1.6,.9,1.2,L({color:0x3d4a2c,map:tWood}));  /* extra olive supply crates by the north gate */
  /* Warsaw Pact base */
  makeFlag(cx,cz+6,'wp');marker(WB.spawn,0xe05a4a);sign(cx+16,cz+25,WB.name,'#f0b8a8',faceTo(cx+16,cz+25,NB.x,NB.z)+Math.PI);
  /* TRUCK SPAWN marker: a large yellow-on-black panel on two posts, with a tall yellow beacon mast beside it so it can be seen from far off. k scales the size (1 at the spawn point, smaller at the pad). */
  function truckSign(x,z,face,k){const gy=H(x,z),ct=cvs(1024,240,(g,w,h)=>{g.fillStyle='#1c1f14';g.fillRect(0,0,w,h);g.strokeStyle='#ffd23a';g.lineWidth=14;g.strokeRect(7,7,w-14,h-14);g.fillStyle='#ffd23a';g.font='bold 150px sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText('TRUCK SPAWN',w/2,h/2+6)}),
   W=6.2*k,Hp=1.45*k,base=3.3*k,fx=Math.sin(face),fz=Math.cos(face);
   for(const sd of[-1,1])addBox(x+sd*W*.38*Math.cos(face),gy,z-sd*W*.38*Math.sin(face),.16,base+Hp,.16,mWood,{col:false,occ:false,cast:false});
   for(const side of[0,Math.PI]){const p=new T.Mesh(new T.PlaneGeometry(W,Hp),new T.MeshBasicMaterial({map:ct}));p.position.set(x+fx*.08*(side?-1:1),gy+base+Hp/2,z+fz*.08*(side?-1:1));p.rotation.y=face+side;world.add(p)}
   const mh=(k>=1?10:7),rx=Math.cos(face),rz=-Math.sin(face),ca=W/2+1.1;let mx=x+rx*ca,mz=z+rz*ca;if(roadDist(x-rx*ca,z-rz*ca)>roadDist(mx,mz)){mx=x-rx*ca;mz=z-rz*ca}const mast=new T.Mesh(new T.CylinderGeometry(.09,.12,mh,6),new T.MeshBasicMaterial({color:0xffd23a}));mast.position.set(mx,gy+mh/2,mz);world.add(mast);
   const cap=new T.Mesh(new T.SphereGeometry(.42,10,8),new T.MeshBasicMaterial({color:0xfff2a0}));cap.position.set(mx,gy+mh+.2,mz);world.add(cap);
   circles.push({x:mx,z:mz,r:.25})}
  /* TRUCK SPAWN signs at the real TRUCKS spawn points: 7 m to the side of the truck, on whichever side is farther from the road, so the sign never blocks the road or a spawning truck */
  for(const t of TRUCKS){const rx=Math.cos(t.syaw),rz=-Math.sin(t.syaw);let best=null;for(const k of[7,-7]){const x=t.sx+rx*k,z=t.sz+rz*k,d=roadDist(x,z);if(!best||d>best.d)best={x,z,d}}truckSign(best.x,best.z,faceTo(best.x,best.z,t.sx,t.sz),1)}
  /* the spawn footprint: a flat yellow outline on the ground where the truck appears (no collision, not an occluder) */
  for(const t of TRUCKS){const fx=Math.sin(t.syaw),fz=Math.cos(t.syaw),px=Math.cos(t.syaw),pz=-Math.sin(t.syaw),mk=new T.MeshBasicMaterial({color:0xffd23a});
   const strip=(cx,cz,w,d)=>{const m=new T.Mesh(new T.BoxGeometry(w*1.8,.04,d),mk);m.position.set(cx,H(cx,cz)+.08,cz);m.rotation.y=t.syaw;world.add(m)};
   strip(t.sx+px*1.5,t.sz+pz*1.5,.15,7);strip(t.sx-px*1.5,t.sz-pz*1.5,.15,7);strip(t.sx+fx*3.5,t.sz+fz*3.5,3.15,.15);strip(t.sx-fx*3.5,t.sz-fz*3.5,3.15,.15)}
  /* the truck trigger pad (the button that spawns the trucks): a second TRUCK SPAWN sign 5.5 m from its centre, on the side away from the road, facing the pad */
  for(const g of TRIGS){let best=null;for(let k=0;k<8;k++){const a=k*.785398,x=g.x+Math.sin(a)*5.5,z=g.z+Math.cos(a)*5.5,d=roadDist(x,z);if(clearPoint(x,z)&&(!best||d>best.d))best={x,z,d}}
   if(best)truckSign(best.x,best.z,faceTo(best.x,best.z,g.x,g.z),.8)}
  hut(cx-10,cz-8,12,5.5,3,mWallWP,mRoofWP);hut(cx+10,cz-10,10,5.5,3.1,mWallWP,mRoofWP);
  for(const[x,z]of[[cx-16,cz+4],[cx-18,cz+14],[cx-12,cz+22]]){gable(x,FY,z,3.4,2.3,5.4,mTentWP,false);boxes.push({x0:x-1.7,x1:x+1.7,z0:z-2.7,z1:z+2.7,top:FY+2.3})}
  bagWall([[cx+14,cz+20,6,true],[cx+20,cz+12,6,false],[cx+4,cz+20,5,true]]);
  for(const[x,y,z,sz]of[[cx+10,0,cz+4,1.1],[cx+11.2,0,cz+4.1,1],[cx+10.5,1.05,cz+4,.85],[cx+2,0,cz-6,1],[cx+3.2,0,cz-6.1,.9]])addBox(x,FY+y,z,sz,sz,sz,mCrateWP);
  {const pts=[[cx+18,cz-2],[cx+19,cz-1.3],[cx+18.2,cz-.2]],im=new T.InstancedMesh(new T.CylinderGeometry(.3,.3,.9,10),L({color:0xffffff}),pts.length);
   pts.forEach((p,i)=>{setI(im,i,p[0],FY+.45,p[1],1,1,1);im.setColorAt(i,new T.Color(i%2?0x5a4a2a:0x6a3a2a));circles.push({x:p[0],z:p[1],r:.35})});im.castShadow=SH;world.add(im)}
  for(const[x0,z0,x1,z1]of[[cx-22,cz-14,cx+22,cz-14],[cx-22,cz-14,cx-22,cz+26]]){const len=Math.hypot(x1-x0,z1-z0),ax=Math.abs(z1-z0)<.01,mx=(x0+x1)/2,mz=(z0+z1)/2;
   for(const y of[.5,1])addBox(mx,FY+y,mz,ax?len:.05,.1,ax?.05:len,mWood,{col:false,cast:false});boxes.push({x0:mx-(ax?len/2:.08),x1:mx+(ax?len/2:.08),z0:mz-(ax?.08:len/2),z1:mz+(ax?.08:len/2),top:FY+1.3});
   const n=Math.round(len/3);for(let i=0;i<=n;i++)addBox(x0+(x1-x0)*i/n,FY,z0+(z1-z0)*i/n,.14,1.4,.14,mWood,{col:false,occ:false,cast:false})}
 }
 /* ===== Beta 0.3.0: roads, settlements, outposts, resupply ===== */
 const roadMat={paved:L({color:0x3f4145,side:T.DoubleSide}),dirt:L({color:0x7d6b4d,side:T.DoubleSide}),track:L({color:0x6e6248,side:T.DoubleSide}),street:L({color:0x56595e,side:T.DoubleSide})},HW={paved:4.5,dirt:2.4,track:1.6,street:3};
 function ribbon(polys,hw){const pos=[],idx=[];let vi=0;
  for(const pl of polys){const pts=densify(pl,2);
   for(let i=0;i<pts.length;i++){const a=pts[Math.max(0,i-1)],c=pts[Math.min(pts.length-1,i+1)],x=pts[i][0],z=pts[i][1];
    let dx=c[0]-a[0],dz=c[1]-a[1];const L=Math.hypot(dx,dz)||1;dx/=L;dz/=L;const nx=-dz*hw,nz=dx*hw;
    pos.push(x+nx,H(x+nx,z+nz)+.07,z+nz,x-nx,H(x-nx,z-nz)+.07,z-nz);
    if(i<pts.length-1)idx.push(vi,vi+2,vi+1,vi+1,vi+2,vi+3);vi+=2}}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();return g}
 for(const t of['paved','dirt','track','street']){const list=ROADS.filter(r=>r.t===t);if(!list.length)continue;
  const m=new T.Mesh(ribbon(list.map(r=>r.p),HW[t]),roadMat[t]);m.receiveShadow=SH;world.add(m)}
 /* ===== Beta 0.5.0 city: skyscrapers and blocks built from the test map's floor module (1.0 m wall panels, slab floors, window openings with frames and no glass). Every building has a ground-floor doorway on the road side. No doors, no furniture. ===== */
 const CITY_MAT=[0x8d8a80,0x9a948a,0x7e7b72,0xa39f92,0x6f6d66].map(c=>L({color:c,map:tWall}));
 const mSlab=L({color:0x5e5c57}),mFrameC=L({color:0xc9c5b8}),mRoofC=L({color:0x4a4a46}),mStepC=L({color:0x77746c});
 const FLOOR_H=3.4,CT=.3,DOOR_HC=2.0,DOOR_WC=1.6,WIN_WC=1.4,WIN_BC=.9,WIN_TC=2.5,NOC={col:false,occ:false,cast:false},CB=[];
 /* one run of wall between a0 and a1 (metres along the wall), from y0 to y1; k = 0 north, 1 south, 2 west, 3 east */
 function cRun(x,y,z,bx,bz,k,a0,a1,y0,y1,th,mat,o){const len=a1-a0,mid=(a0+a1)/2,hh=y1-y0;if(len<=0||hh<=0)return;
  if(k<2)addBox(x+mid,y+y0,z+(k===0?-bz/2:bz/2),len,hh,th,mat,o);else addBox(x+(k===2?-bx/2:bx/2),y+y0,z+mid,th,hh,len,mat,o)}
 /* four walls with openings; on the ground storey the piers and the sills are solid, the lintels are not */
 function cWalls(x,y,z,bx,bz,h,mat,open,ground){const ws={col:false},wl={col:false};
  for(let k=0;k<4;k++){const Lk=k<2?bx:bz,o=open[k].slice().sort((p,q)=>p.a0-q.a0),sol=ground?ws:wl;let cur=-Lk/2;
   for(const q of o){cRun(x,y,z,bx,bz,k,cur,q.a0,0,h,CT,mat,sol);if(q.y0>0)cRun(x,y,z,bx,bz,k,q.a0,q.a1,0,q.y0,CT,mat,sol);if(q.y1<h)cRun(x,y,z,bx,bz,k,q.a0,q.a1,q.y1,h,CT,mat,wl);cur=q.a1}
   cRun(x,y,z,bx,bz,k,cur,Lk/2,0,h,CT,mat,sol)}}
 /* a painted frame round each opening (no glass) */
 function cFrame(x,y,z,bx,bz,k,q){const th=CT+.08;
  cRun(x,y,z,bx,bz,k,q.a0-.05,q.a0+.05,q.y0,q.y1,th,mFrameC,NOC);cRun(x,y,z,bx,bz,k,q.a1-.05,q.a1+.05,q.y0,q.y1,th,mFrameC,NOC);
  cRun(x,y,z,bx,bz,k,q.a0-.1,q.a1+.1,q.y1,q.y1+.08,th,mFrameC,NOC);
  if(q.y0>0)cRun(x,y,z,bx,bz,k,q.a0-.14,q.a1+.14,q.y0-.05,q.y0,th+.1,mFrameC,NOC)}
 /* the side of a building that faces the nearest road: 0 north, 1 south, 2 west, 3 east */
 function doorFacing(x,z){let best=null;for(const r of ROADS)for(const p of r.p){const d=Math.hypot(p[0]-x,p[1]-z);if(!best||d<best.d)best={d,px:p[0],pz:p[1]}}
  if(!best)return 0;const dx=best.px-x,dz=best.pz-z;return Math.abs(dx)>Math.abs(dz)?(dx>0?3:2):(dz>0?1:0)}
 /* ---- city (0.4.0 pre-release 17, update 3): floors with stairs, glass panes, street grid ---- */
 const GG=-MAP_H+60,GP=46,CITY_N=120;               /* block cells on a 46 m grid; streets run between them */
 const SW=1.2,SR=FLOOR_H/10,RUN=FLOOR_H;            /* stairs: 1.2 m wide, ten treads of 0.34 m rise and run */
 const mGlass=L({color:0xa9cfe0,transparent:true,opacity:.3,depthWrite:false});
 const GLS={cast:false,col:false},SLABO={cast:false};
 /* one pane per window opening, filling the opening; panes are merged per building (see breakPane in game.js) */
 function glassPane(x,y,z,bx,bz,k,q){const mid=(q.a0+q.a1)/2,w=q.a1-q.a0-.12,h=q.y1-q.y0-.12,yb=y+q.y0+.06;
  if(k<2)addBox(x+mid,yb,z+(k===0?-bz/2:bz/2),w,h,.05,mGlass,GLS);else addBox(x+(k===2?-bx/2:bx/2),yb,z+mid,.05,h,w,mGlass,GLS)}
 function building(x,z,bx,bz,floors,doorSide,mat){
  const sv=world,occ0=occluders.length,G0=new T.Group(),y0=H(x,z);world=G0;
  /* stairs run along the longer side (u); v is across it. Stairs alternate sides from floor to floor so each flight lands on a clear walkway */
  const runZ=bz>=bx,Ur=Math.max(bx,bz),Vr=Math.min(bx,bz);
  if(Ur<6)floors=1;                                 /* too small for a stair: one storey */
  const vSign=runZ?(doorSide===3?1:doorSide===2?-1:0):(doorSide===1?1:doorSide===0?-1:0),side0=vSign?-vSign:-1;
  const U0=-Ur/2+.8,U1=U0+RUN,CU=[-Ur/2+.1,Ur/2-.1],CV=[-Vr/2+.1,Vr/2-.1];
  const sb=(u0,u1,v0,v1,y,h,mt,o)=>{const cu=(u0+u1)/2,cv=(v0+v1)/2,du=u1-u0,dv=v1-v0;if(runZ)addBox(x+cv,y,z+cu,dv,h,du,mt,o);else addBox(x+cu,y,z+cv,du,h,dv,mt,o)};
  for(let f=0;f<floors;f++){const y=y0+f*FLOOR_H,g=f===0,open=[[],[],[],[]];
   const stair=f<floors-1,sC=(Vr/2-.3-SW/2)*((f%2===0)?side0:-side0),HV0=sC-SW/2,HV1=sC+SW/2;
   if(g)open[doorSide].push({a0:-DOOR_WC/2,a1:DOOR_WC/2,y0:0,y1:DOOR_HC,door:true});
   for(let k=0;k<4;k++){if(g&&k===doorSide)continue;const Lk=k<2?bx:bz,n=Math.max(0,Math.floor((Lk-1.6)/2.8));
    for(let i=0;i<n;i++){const c=-Lk/2+Lk*(i+1)/(n+1);open[k].push({a0:c-WIN_WC/2,a1:c+WIN_WC/2,y0:WIN_BC,y1:WIN_TC})}}
   cWalls(x,y,z,bx,bz,FLOOR_H,mat,open,g);
   /* walking collision: one full-height box per wall side (windows are not passable: the sill and the piers stop you); the ground door is a gap */
   for(let k=0;k<4;k++){const c=k<2?z+(k===0?-bz/2:bz/2):x+(k===2?-bx/2:bx/2),a0=k<2?x-bx/2:z-bz/2,a1=k<2?x+bx/2:z+bz/2,mid=k<2?x:z;
    const seg=(p,q)=>{if(q-p<=.01)return;if(k<2)boxes.push({x0:p,x1:q,z0:c-CT/2,z1:c+CT/2,top:y+FLOOR_H,bot:y});else boxes.push({x0:c-CT/2,x1:c+CT/2,z0:p,z1:q,top:y+FLOOR_H,bot:y})};
    if(g&&k===doorSide){seg(a0,mid-DOOR_WC/2);seg(mid+DOOR_WC/2,a1)}else seg(a0,a1)}
   for(let k=0;k<4;k++)for(const q of open[k]){cFrame(x,y,z,bx,bz,k,q);if(!q.door)glassPane(x,y,z,bx,bz,k,q)}
   if(stair){ /* this floor's slab has a hole where the stair rises; the stair itself is solid treads */
    for(const[a,b,c,d]of[[CU[0],U0,CV[0],CV[1]],[U1,CU[1],CV[0],CV[1]],[U0,U1,CV[0],HV0],[U0,U1,HV1,CV[1]]])if(b-a>.05&&d-c>.05)sb(a,b,c,d,y+FLOOR_H-.25,.25,mSlab,SLABO);
    for(let i=0;i<10;i++)sb(U0+i*SR,U0+(i+1)*SR,HV0,HV1,y,(i+1)*SR,mSlab)}
   else sb(CU[0],CU[1],CV[0],CV[1],y+FLOOR_H-.25,.25,mSlab,SLABO);
   if(g){addBox(x,y+.02,z,bx-.6,.1,bz-.6,mSlab,NOC);const dx=doorSide===2?-bx/2:doorSide===3?bx/2:0,dz=doorSide===0?-bz/2:doorSide===1?bz/2:0;
    addBox(x+dx,y,z+dz,doorSide<2?DOOR_WC+.4:.5,.06,doorSide<2?.5:DOOR_WC+.4,mStepC,NOC)}
  }
  addBox(x,y0+floors*FLOOR_H,z,bx+.3,.4,bz+.3,mRoofC,NOC);
  world=sv;const mm=mergeMeshes(G0);for(const m of mm)if(m.material===mGlass)m.userData.glass=true;
  occluders.splice(occ0,occluders.length-occ0,...mm);world.add(...mm);
 }
 /* free ground for a building of half-diagonal r: clear of the bases, outposts, truck triggers, other buildings and (optionally) roads */
 function freeSite(x,z,r,road){if(Math.max(Math.abs(x),Math.abs(z))>MAP_H-r-14)return false;
  for(const[dx,dz]of[[0,0],[.7,.7],[-.7,.7],[.7,-.7],[-.7,-.7]])if(hillsH(x+dx*r,z+dz*r)>.2)return false; /* flat ground only */
  if(road&&roadDist(x,z)<r+7)return false;
  for(const b of[BASES.nato,BASES.wp])if(Math.hypot(x-b.x,z-b.z)<b.radius+r+70)return false;
  if(OUTPOSTS.some(o=>Math.hypot(o.x-x,o.z-z)<r+40))return false;
  if(TRIGS.some(g=>Math.hypot(g.x-x,g.z-z)<r+18))return false;
  if(CB.some(q=>Math.hypot(q.x-x,q.z-z)<r+q.r+3))return false;
  return true}
 function place(x,z,bx,bz,floors,mat){const ds=doorFacing(x,z);CB.push({x,z,r:Math.hypot(bx,bz)/2});HOUSES.push({x,z,bx,bz,doorSide:ds,doorW:DOOR_WC,barn:false,y:H(x,z)});building(x,z,bx,bz,floors,ds,mat)}
 /* the settlements' home sites become buildings: the largest settlement gets towers */
 for(const v of VILLAGE_PLANS)for(const hm of v.homes){const tall=v.s.size>.95,floors=tall?9+Math.floor(hm.ti*6):3+Math.floor(hm.pi*4);
  const k=tall?1.3:1,bx=(hm.rot?hm.d:hm.w)*k,bz=(hm.rot?hm.w:hm.d)*k;
  if(freeSite(hm.x,hm.z,Math.hypot(bx,bz)/2,false))place(hm.x,hm.z,bx,bz,floors,CITY_MAT[Math.floor(hm.pi*CITY_MAT.length)])}
 /* the city: blocks on the grid cells, in random order so the city spreads over the map; towers towards the middle */
 {let s=9173;const rn=()=>(s=(s*16807)%2147483647)/2147483647;const cells=[];
  for(let i=0;i<24;i++)for(let j=0;j<24;j++)cells.push([GG+GP*i,GG+GP*j]);
  for(let i=cells.length-1;i>0;i--){const j=Math.floor(rn()*(i+1));const t=cells[i];cells[i]=cells[j];cells[j]=t}
  let n=0;
  for(const[gx,gz]of cells){if(n>=CITY_N)break;
   const x=gx+(rn()-.5)*6,z=gz+(rn()-.5)*6,c=Math.hypot(x,z),skip=rn()<.2,mat=CITY_MAT[Math.floor(rn()*CITY_MAT.length)];
   let bx,bz,floors;
   if(c<260){bx=14+rn()*5;bz=12+rn()*5;floors=12+Math.floor(rn()*8)}
   else if(c<420){bx=12+rn()*5;bz=10+rn()*4;floors=5+Math.floor(rn()*6)}
   else{bx=9+rn()*4;bz=8+rn()*3;floors=2+Math.floor(rn()*3)}
   if(skip||!freeSite(x,z,Math.hypot(bx,bz)/2,true))continue;
   place(x,z,bx,bz,floors,mat);n++}}
 /* streets: 9 m asphalt on the grid lines between blocks, pavements, centre dashes and lamps (visual only; trucks keep to ROADS) */
 {const T_MAX=MAP_H-100,LN=[];for(let i=0;i<24;i++)LN.push(GG+GP*i+GP/2);const segs=[];
  const okAt=(x,z)=>{if(Math.max(Math.abs(x),Math.abs(z))>T_MAX+30)return false;
   for(const[dx,dz]of[[0,0],[23,0],[-23,0],[0,23],[0,-23]])if(hillsH(x+dx,z+dz)>.2)return false;
   for(const b of[BASES.nato,BASES.wp])if(Math.hypot(x-b.x,z-b.z)<b.radius+30)return false;
   return!OUTPOSTS.some(o=>Math.hypot(o.x-x,o.z-z)<40)};
  for(const dir of[0,1])for(const L0 of LN)for(let t=-T_MAX;t<T_MAX;t+=GP){const tc=t+GP/2,x=dir?L0:tc,z=dir?tc:L0;if(okAt(x,z))segs.push([dir,L0,tc])}
  const N=segs.length,asph=new T.InstancedMesh(BOX,L({color:0x3f4145}),N),walk=new T.InstancedMesh(BOX,L({color:0x9b978d}),N*2),
   dash=new T.InstancedMesh(BOX,L({color:0xd9d6c8}),N*3),lamp=new T.InstancedMesh(BOX,L({color:0x2a2c2e}),N*2);
  let ai=0,wi=0,di=0,li=0;
  for(const[dir,L0,tc]of segs){const x=dir?L0:tc,z=dir?tc:L0,y=H(x,z),len=GP+.1;
   if(dir){setI(asph,ai++,L0,y+.03,tc,9,.06,len);for(const sd of[-1,1])setI(walk,wi++,L0+sd*5.5,y+.07,tc,2,.14,len);
    for(const o of[-15,0,15])setI(dash,di++,L0,y+.04,tc+o,.25,.02,3);for(const sd of[-1,1])setI(lamp,li++,L0+sd*6.2,y+3,tc,.18,6,.18)}
   else{setI(asph,ai++,tc,y+.03,L0,len,.06,9);for(const sd of[-1,1])setI(walk,wi++,tc,y+.07,L0+sd*5.5,len,.14,2);
    for(const o of[-15,0,15])setI(dash,di++,tc+o,y+.04,L0,3,.02,.25);for(const sd of[-1,1])setI(lamp,li++,tc,y+3,L0+sd*6.2,.18,6,.18)}}
  for(const im of[asph,walk,dash,lamp]){im.count=im===asph?ai:im===walk?wi:im===dash?di:li;im.instanceMatrix.needsUpdate=true;im.receiveShadow=true;world.add(im)}}
 /* street lamps along the paved roads (visual only) */
 {const pts=[];for(const r of ROADS)if(r.t==='paved')for(const p of densify(r.p,45))pts.push(p);
  const im=new T.InstancedMesh(BOX,L({color:0x2a2c2e}),pts.length*2);let i=0;
  for(const p of pts){const y=H(p[0],p[1]);for(const sd of[-1,1])setI(im,i++,p[0]+sd*5.5,y+3,p[1],.18,6,.18)}
  im.count=i;im.instanceMatrix.needsUpdate=true;im.castShadow=SH;world.add(im)}

/* outpost: sandbag lines, a small tent and two crates (restrained, no garrison) */
 function sandLine(x0,z0,x1,z1){const len=Math.hypot(x1-x0,z1-z0),n=Math.max(1,Math.round(len/.8)),ax=Math.abs(z1-z0)<.01,bags=[];let ymax=0;
  for(let r=0;r<2;r++)for(let i=0;i<n;i++){const t=(i+.5)/n,x=x0+(x1-x0)*t+(ax?0:r*.5),z=z0+(z1-z0)*t+(ax?r*.5:0),gy=H(x,z);ymax=Math.max(ymax,gy);
   bags.push([x,gy+r*.27+.135,z,ax?0:Math.PI/2])}
  const im=new T.InstancedMesh(new T.BoxGeometry(.8,.27,.5),mSand,bags.length);bags.forEach((b,i)=>setI(im,i,b[0],b[1],b[2],1,1,1,b[3]));im.castShadow=im.receiveShadow=SH;world.add(im);occluders.push(im);
  boxes.push({x0:Math.min(x0,x1)-.3,x1:Math.max(x0,x1)+.3,z0:Math.min(z0,z1)-.3,z1:Math.max(z0,z1)+.3,top:ymax+.55,climb:true})}
 for(const o of OUTPOSTS){const y=H(o.x,o.z);
  sandLine(o.x-6,o.z-7,o.x+6,o.z-7);sandLine(o.x-7,o.z-7,o.x-7,o.z+3);
  gable(o.x+4,y,o.z+5,3.2,2.2,5,mTent,false);boxes.push({x0:o.x+2.4,x1:o.x+5.6,z0:o.z+2.5,z1:o.z+7.5,top:y+2.2});
  addBox(o.x+3,y,o.z-2,1.1,1.1,1.1,mWood);addBox(o.x+4.2,y,o.z-1.6,.9,.9,.9,mWood)}
 /* resupply points: a green ring on the ground, with crates; standing still inside the ring refills ammunition */
 for(const r of RESUPPLY){const y=H(r.x,r.z),ring=new T.Mesh(new T.RingGeometry(2.6,3.1,36),new T.MeshBasicMaterial({color:0x8fe0a0,transparent:true,opacity:.7,depthWrite:false}));
  ring.rotation.x=-Math.PI/2;ring.position.set(r.x,y+.07,r.z);world.add(ring);
  const cm=L({color:0x4d5a2e,map:tWood});addBox(r.x+1.2,y,r.z+.9,.9,.9,.9,cm);addBox(r.x+1.9,y,r.z+1.7,.9,.9,.9,cm)}
 for(const g of TRIGS){const h0=H(g.x,g.z),conform=(geo,lift)=>{geo.rotateX(-Math.PI/2);const p=geo.attributes.position;for(let k=0;k<p.count;k++)p.setY(k,H(g.x+p.getX(k),g.z+p.getZ(k))-h0+lift);p.needsUpdate=true;geo.computeVertexNormals();return geo};add(new T.Mesh(conform(new T.CircleGeometry(g.r,28),.06),L({color:0x3d4a2e})),false,true).position.set(g.x,h0,g.z);add(new T.Mesh(conform(new T.RingGeometry(g.r-.35,g.r,28),.09),L({color:0xd8c24a})),false,true).position.set(g.x,h0,g.z)}
}
