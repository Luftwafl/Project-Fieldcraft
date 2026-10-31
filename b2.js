const HOUSES=[];
/* Beta 0.3.75 transport truck: one shared state; the model is rebuilt with the world (buildTruck) */
const TRUCKS=[{g:null,x:0,z:0,y:0,yaw:0,v:0,n:'NATO'},{g:null,x:0,z:0,y:0,yaw:0,v:0,n:'WARSAW PACT'}];
const TRK={inside:false,cam3:false,lookOff:0,lastYaw:0,i:0};
/* Beta 0.3.8 fairness: the world is identical on every preset (placement, fog, collision). Presets change rendering only: shadows, resolution, geometry detail (lod) and terrain sampling grid (cell; the grid samples the same height function that collision uses). */
const WORLD={trees:2200,bushes:320,grass:1300,rocks:90,fog:[25,165]};
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
const Hraw=(x,z)=>Math.sin(x*.031)*Math.cos(z*.027)*2.2+Math.sin(x*.012+1.3)*Math.sin(z*.014+.4)*5+Math.sin(x*.083+z*.05)*Math.sin(z*.09)*.55+Math.cos(x*.2)*Math.sin(z*.17)*.12+Math.sin(x*.0068+.5)*Math.cos(z*.0061+1.1)*9+Math.sin(x*.0113-z*.009+2)*3+Math.sin(x*.026+z*.019+.7)*Math.cos(z*.013-x*.008)*4.5+Math.sin(-x*.017+z*.031+2.1)*3.2-3.5*Math.exp(-((x-20)**2+(z+60)**2)/(2*55*55))-3.5*Math.exp(-((x+260)**2+(z+40)**2)/(2*55*55))-3.5*Math.exp(-((x-300)**2+(z-60)**2)/(2*55*55))-3.5*Math.exp(-((x+40)**2+(z-250)**2)/(2*55*55));
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
 return Math.max(f,.9*sstep(MAP_H*.7,MAP_H*.9,Math.max(Math.abs(x),Math.abs(z))))};
/* Beta 0.3.75 transport truck model: olive-drab 2.5-ton style truck, nose toward -z, origin at ground level under the chassis */
/* merge the mesh children of a group into one mesh per material (fewer draw calls) */
const mergeMeshes=(group)=>{const kids=group.children.filter(m=>m.isMesh),bk=new Map();
 for(const m of kids){m.updateMatrix();const g=m.geometry.clone();g.applyMatrix4(m.matrix);const q=g.toNonIndexed();g.dispose();let e=bk.get(m.material);if(!e){e={p:[],n:[]};bk.set(m.material,e)}const a=q.attributes.position.array,n=q.attributes.normal.array;for(let i=0;i<a.length;i++)e.p.push(a[i]);for(let i=0;i<n.length;i++)e.n.push(n[i]);q.dispose()}
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
  if(o.col!==false)boxes.push({x0:x-w/2,x1:x+w/2,z0:z-d/2,z1:z+d/2,top:y+h});if(o.occ!==false)occluders.push(m);return m}
 function gable(x,y,z,span,rise,len,mat,alongX){const s=new T.Shape();s.moveTo(-span/2,0);s.lineTo(span/2,0);s.lineTo(0,rise);s.closePath();
  const g=new T.ExtrudeGeometry(s,{depth:len,bevelEnabled:false});g.translate(0,0,-len/2);if(alongX)g.rotateY(Math.PI/2);const m=new T.Mesh(g,mat);m.position.set(x,y,z);add(m);occluders.push(m)}
 /* trees */
 {/* Beta 0.3.75 forests: a dense forest zone list (large woods), a wooded band at the map edge, and open ground between them */
  const forest=forestAt;const tr=[];
  const clearingAt=(x,z)=>.5+.5*Math.sin(x*.037+z*.029)*Math.cos(z*.041-x*.017);
  const broadP=(x,z,edge)=>clamp(.3+.3*Math.sin(x*.013-1)*Math.cos(z*.009+.5)+.3*edge,.05,.9);
  for(let a=0;tr.length<WORLD.trees&&a<WORLD.trees*60;a++){const x=rr(-MAP_H+6,MAP_H-6),z=rr(-MAP_H+6,MAP_H-6);if(forest(x,z)<.3&&R()>.04)continue;if(flatNS(x,z)>.03||roadDist(x,z)<5||villageBlocked(x,z)||settleCore(x,z))continue;
   /* Beta 0.4.0-pre9: glades inside forests, and broadleaf trees more common at the forest edge and in patches */
   if(forest(x,z)>.3&&clearingAt(x,z)>.82&&R()<.8)continue;
   const edge=1-Math.min(1,Math.abs(forest(x,z)-.5)*2);tr.push({x,z,y:H(x,z),s:rr(.7,1.5),w:rr(.8,1.25),hh:rr(.85,1.3),b:R()<broadP(x,z,edge)})}
  const n=tr.length,pines=tr.filter(t=>!t.b),broad=tr.filter(t=>t.b);
  const trunkG=new T.CylinderGeometry(.12,.2,1,Qc.lod<1?4:6);trunkG.translate(0,.5,0);const coneG=new T.ConeGeometry(1,1,Qc.lod<1?5:7);coneG.translate(0,.5,0);
  const trunk=new T.InstancedMesh(trunkG,L({color:0x4a3826}),n),c1=new T.InstancedMesh(coneG,L({color:0xffffff,flatShading:true}),pines.length),c2=new T.InstancedMesh(coneG,c1.material,pines.length),
   blob=new T.InstancedMesh(new T.IcosahedronGeometry(1,Qc.lod>=2?1:0),L({color:0xffffff,flatShading:true}),broad.length);
  tr.forEach((t,i)=>{setI(trunk,i,t.x,t.y-.1,t.z,t.s,(t.b?2.6:3)*t.s,t.s);circles.push({x:t.x,z:t.z,r:.18+.14*t.s})});
  pines.forEach((t,i)=>{const s=t.s,w=t.w,hh=t.hh;setI(c1,i,t.x,t.y+1.1*s*hh,t.z,1.9*s*w,3.4*s*hh,1.9*s*w,rr(0,6));setI(c2,i,t.x,t.y+3*s*hh,t.z,1.4*s*w,2.9*s*hh,1.4*s*w,rr(0,6));
   const cc=col.setHSL(.36+rr(-.03,.03),.35,.13+rr(0,.07));c1.setColorAt(i,cc);c2.setColorAt(i,cc)});
  broad.forEach((t,i)=>{const s=t.s,w=t.w,hh=t.hh;setI(blob,i,t.x,t.y+3.4*s*hh,t.z,2*s*w,1.7*s*hh,2*s*w,rr(0,6));blob.setColorAt(i,R()<.12?col.setHSL(.1,.55,.3):col.setHSL(.2+rr(-.03,.03),.4,.2+rr(0,.1)))});
  [trunk,c1,c2,blob].forEach(m=>{m.castShadow=SH;m.instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true;const tl=tileIM(m);if(m===trunk)occluders.push(...tl);else VEG.push(...tl)})}
 /* Beta 0.4.0-pre9: forest undergrowth (ferns in the forest interior) and fallen logs; fixed counts so every preset is identical */
 {const place=(x,z,onForest,f0)=>onForest(x,z)&&roadDist(x,z)>4&&!villageBlocked(x,z)&&!settleCore(x,z)&&flatNS(x,z)<.05;
  const fernG=new T.ConeGeometry(.6,1,5);fernG.translate(0,.5,0);const fern=new T.InstancedMesh(fernG,L({color:0xffffff,flatShading:true}),900);let fi=0;
  for(let a=0;fi<900&&a<900*40;a++){const x=rr(-MAP_H+6,MAP_H-6),z=rr(-MAP_H+6,MAP_H-6);if(!place(x,z,(X,Z)=>forestAt(X,Z)>.6))continue;const sc=rr(.5,1);setI(fern,fi,x,H(x,z)+.02,z,sc,sc*rr(.6,1.2),sc,rr(0,6));fern.setColorAt(fi,col.setHSL(.27+rr(-.03,.03),.45,rr(.13,.24)));fi++}
  fern.count=fi;fern.instanceMatrix.needsUpdate=true;if(fern.instanceColor)fern.instanceColor.needsUpdate=true;fern.castShadow=false;VEG.push(...tileIM(fern));
  const logG=new T.CylinderGeometry(.16,.2,2.6,6);logG.rotateZ(Math.PI/2);const logs=new T.InstancedMesh(logG,L({color:0x4a3826}),160);let li=0;
  for(let a=0;li<160&&a<160*40;a++){const x=rr(-MAP_H+6,MAP_H-6),z=rr(-MAP_H+6,MAP_H-6);if(!place(x,z,(X,Z)=>forestAt(X,Z)>.55))continue;setI(logs,li,x,H(x,z)+.16,z,1,1,1,rr(0,6.28));li++}
  logs.count=li;logs.instanceMatrix.needsUpdate=true;logs.castShadow=SH;VEG.push(...tileIM(logs))}
 /* rocks, bushes, grass */
 {const mk=(geo,mat,cnt,place,sh,occ)=>{const im=new T.InstancedMesh(geo,mat,cnt);let i=0;for(let a=0;i<cnt&&a<cnt*20;a++){const x=rr(-MAP_H+6,MAP_H-6),z=rr(-MAP_H+6,MAP_H-6);if(place(x,z,i,im))i++}im.count=i;im.instanceMatrix.needsUpdate=true;if(im.instanceColor)im.instanceColor.needsUpdate=true;im.castShadow=sh;const tl=tileIM(im);if(!occ)VEG.push(...tl);return tl};
  const rk=mk(new T.DodecahedronGeometry(1,0),L({color:0xffffff,flatShading:true}),WORLD.rocks*2,(x,z,i,im)=>{if(flat(x,z)>.1)return 0;const s=rr(.5,2.3),y=H(x,z),sx=s*rr(1,1.5),sy=s*rr(.6,1),sz=s*rr(1,1.5);setI(im,i,x,y-s*.25,z,sx,sy,sz,rr(0,6),rr(-.3,.3),rr(-.3,.3));
   im.setColorAt(i,col.setHSL(.1,.06,rr(.28,.45)));if(s>.9)circles.push({x,z,r:s*.95,top:y-s*.25+sy*.7,climb:true});return 1},SH,true);occluders.push(...rk);
  mk(new T.IcosahedronGeometry(1,0),L({color:0xffffff,flatShading:true}),WORLD.bushes*2,(x,z,i,im)=>{if(flat(x,z)>.05)return 0;const s=rr(.5,1.1);setI(im,i,x,H(x,z)+s*.3,z,s,s*.7,s,rr(0,6));im.setColorAt(i,col.setHSL(.22+rr(-.05,.05),.4,rr(.15,.27)));return 1},SH);
  const gg=new T.ConeGeometry(.08,.6,4);gg.translate(0,.3,0);
  mk(gg,L({color:0xffffff}),WORLD.grass*2,(x,z,i,im)=>{if(flat(x,z)>.5)return 0;setI(im,i,x,H(x,z),z,rr(.8,1.6),rr(.7,1.8),rr(.8,1.6),rr(0,6),rr(-.3,.3),rr(-.3,.3));im.setColorAt(i,col.setHSL(.2+rr(-.04,.04),.4,rr(.2,.38)));return 1},false)}
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
 /* range */
 addBox(0,FY,-58,34,.2,5,mWood);addBox(0,FY+3,-58,34,.2,5.6,mRoof,{col:false});
 for(const sx of[-16,16])for(const sz of[-60.3,-55.7])addBox(sx,FY,sz,.25,3,.25,mWood);
 addBox(-8,FY+.2,-56.5,6,.8,.5,mWood);addBox(8,FY+.2,-56.5,6,.8,.5,mWood);
 addBox(0,FY-.5,-140,60,4.5,6,mDirt);
 const front=cvs(128,200,(g,w,h)=>{g.fillStyle='#cdbf94';g.fillRect(0,0,w,h);g.fillStyle='#2a2a22';g.beginPath();g.arc(64,50,24,0,7);g.fill();g.fillRect(24,80,80,120);g.strokeStyle='#cdbf94';g.lineWidth=3;for(const r of[10,22,34]){g.beginPath();g.arc(64,130,r,0,7);g.stroke()}g.strokeStyle='#000';g.lineWidth=6;g.strokeRect(0,0,w,h)}),
  fMat=L({map:front}),sMat=L({color:0x6a4a2a});
 for(const z of[-80,-100,-120])for(const x of[-12,0,12]){const y=H(x,z),hinge=new T.Group();hinge.position.set(x,y+.5,z);world.add(hinge);
  const board=new T.Mesh(new T.BoxGeometry(.85,1.5,.06),[sMat,sMat,sMat,sMat,fMat.clone(),sMat]);board.position.y=.8;board.castShadow=SH;hinge.add(board);
  for(const px of[-.4,.4]){const p=new T.Mesh(BOX,sMat);p.scale.set(.07,.5,.07);p.position.set(x+px,y+.25,z-.05);world.add(p)}
  const t={hinge,board,mat:board.material[4],state:0,ang:0,t:0,fl:0};board.userData.t=t;targets.push(t)}

 /* ===== faction bases: identification, spawn markers and the Warsaw Pact base ===== */
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
 const roadMat={paved:L({color:0x5d5b55,side:T.DoubleSide}),dirt:L({color:0x7d6b4d,side:T.DoubleSide}),track:L({color:0x6e6248,side:T.DoubleSide}),street:L({color:0x66635a,side:T.DoubleSide})},HW={paved:3.2,dirt:2.4,track:1.6,street:3};
 function ribbon(polys,hw){const pos=[],idx=[];let vi=0;
  for(const pl of polys){const pts=densify(pl,2);
   for(let i=0;i<pts.length;i++){const a=pts[Math.max(0,i-1)],c=pts[Math.min(pts.length-1,i+1)],x=pts[i][0],z=pts[i][1];
    let dx=c[0]-a[0],dz=c[1]-a[1];const L=Math.hypot(dx,dz)||1;dx/=L;dz/=L;const nx=-dz*hw,nz=dx*hw;
    pos.push(x+nx,H(x+nx,z+nz)+.07,z+nz,x-nx,H(x-nx,z-nz)+.07,z-nz);
    if(i<pts.length-1)idx.push(vi,vi+2,vi+1,vi+1,vi+2,vi+3);vi+=2}}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();return g}
 for(const t of['paved','dirt','track','street']){const list=ROADS.filter(r=>r.t===t);if(!list.length)continue;
  const m=new T.Mesh(ribbon(list.map(r=>r.p),HW[t]),roadMat[t]);m.receiveShadow=SH;world.add(m)}
 /* ===== Beta 0.3.5: 1980s Central/Eastern European village buildings =====
    Each building is a single-storey enterable shell: four collision walls with a real door gap in the footprint,
    a plank floor (visual), a steep tile roof, small windows and a chimney. Doors are open gaps, not solid walls. */
 const PLASTER=[0xd8cba9,0xc9b07f,0xb8b3a0,0xd6bfa0,0xa7b0a0,0xc7b59c].map(c=>L({color:c,map:tWall}));
 const TILE=[0x8a4a33,0x7a3f2c,0x5e3b2e].map(c=>L({color:c,map:tRoof,side:T.DoubleSide}));
 const mPlinth=L({color:0x6b675c,map:tWall}),mBrick=L({color:0x8c4b3a,map:tWall}),mDoorW=L({color:0x5a3b22,map:tWood}),mGlass=L({color:0x22303a}),mFloor=L({color:0x6e5536,map:tWood}),mBarnW=L({color:0x6a4b30,map:tWood});
 function shell(x,y,z,w,d,h,mat,doorSide,doorW){const t=.35,hw=w/2,hd=d/2,sy=y+.02;
  const seg=(cx,cz,sx,sz)=>addBox(cx,y,cz,sx,h,sz,mat);
  const wallN=(zc)=>{};
  /* along-x walls (north/south) and along-z walls (east/west); the door side gets a gap */
  const gapHalf=doorW/2;
  const front=(side)=>side===1; /* side 1: +z, 0: -z, 2: +x, 3: -x */
  for(const sd of[0,1,2,3]){const alongX=sd<2,pos=sd%2===0?-1:1;
   const L0=alongX?w:d;const cen=alongX?[x,z+pos*(hd-t/2)]:[x+pos*(hw-t/2),z];
   if(sd===doorSide){const half=L0/2;const aOff=(half-gapHalf);
    const a=[-half,-gapHalf],b=[gapHalf,half];
    for(const[u0,u1]of[a,b]){if(u1-u0<=.05)continue;const m=(u0+u1)/2,len=u1-u0;
     if(alongX)seg(cen[0]+m,cen[1],len,t);else seg(cen[0],cen[1]+m,t,len)}
    const dx=alongX?0:0;
    /* lintel and door leaf: visual only */
    if(alongX)addBox(cen[0],y+2.15,cen[1],doorW,h-2.15,t,mat,{col:false,occ:false,cast:false});
    else addBox(cen[0],y+2.15,cen[1],t,h-2.15,doorW,mat,{col:false,occ:false,cast:false});
    if(alongX)addBox(cen[0],y,cen[1]+(pos*.02),doorW*.92,2.05,.08,mDoorW,{col:false,occ:false,cast:false});
    else addBox(cen[0]+(pos*.02),y,cen[1],.08,2.05,doorW*.92,mDoorW,{col:false,occ:false,cast:false});
   }else{
    if(alongX)seg(cen[0],cen[1],L0,t);else seg(cen[0],cen[1],t,L0)}
  }
  addBox(x,sy,z,w-.2,.04,d-.2,mFloor,{col:false,occ:false,cast:false});
 }
 function windows(x,y,z,w,d,h,doorSide,n){for(const sd of[0,1,2,3]){if(sd===doorSide&&n<2)continue;const alongX=sd<2,pos=sd%2===0?-1:1,L0=alongX?w:d,k=Math.max(1,Math.min(n,Math.floor(L0/2.2)));
   for(let i=0;i<k;i++){const u=-L0/2+(i+.5)*L0/k;if(sd===doorSide&&Math.abs(u)<1.2)continue;
    if(alongX)addBox(x+u,y+1.15,z+pos*(d/2+.02),.8,1.0,.06,mGlass,{col:false,occ:false,cast:false});
    else addBox(x+pos*(w/2+.02),y+1.15,z+u,.06,1.0,.8,mGlass,{col:false,occ:false,cast:false})}}}
/* Beta 0.3.75 interior furniture: a few pieces per house against the walls, kept clear of the doorway corridor (barns get hay bales) */
 const mFurWood=L({color:0x6b4a2c,map:tWood}),mFurPaint=L({color:0xd9d0b8}),mFurCloth=[0x5a6b4a,0x7a4a3a,0x4a5a72,0x8a7a4a].map(c=>L({color:c})),mFurMetal=L({color:0x6d7178}),mHay=L({color:0xb7a255});
 const mFurDark=L({color:0x3e2c1a}),mFurWoodP=L({color:0x6b4a2c}),mFurLight=L({color:0xb8a27a}),mFurWhite=L({color:0xe6e1d3}),mFurBrass=L({color:0xa08c4a}),mFurOil=L({color:0x9fb88f}),mFurRug=[0x7a3a2e,0x3e5a6a,0x8a7040].map(c=>L({color:c})),mFurJar=[0x8a3a2a,0x3a6a3a,0xc9a040,0x6a4a2a].map(c=>L({color:c})),mFurBook=[0x2a4a6a,0x6a2a2a,0x2a5a2a,0xa08a3a].map(c=>L({color:c})),mFurPic=[0x4a6a7a,0x9a6a3a,0x5a7a4a,0xb0a070].map(c=>L({color:c}));
 /* Beta 0.3.8 furniture: multi-part pieces merged into one mesh per material; solid pieces get a footprint collider */
 const FB=new Map(),AXY=new T.Vector3(0,1,0);
 const fbAdd=(g,mat,m)=>{const q=g.toNonIndexed();q.applyMatrix4(m);let e=FB.get(mat);if(!e){e={p:[],n:[]};FB.set(mat,e)}const a=q.attributes.position.array,n=q.attributes.normal.array;for(let i=0;i<a.length;i++)e.p.push(a[i]);for(let i=0;i<n.length;i++)e.n.push(n[i]);q.dispose();g.dispose()};
 const fbFlush=()=>{for(const[mat,e]of FB){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(e.p,3));g.setAttribute('normal',new T.Float32BufferAttribute(e.n,3));const m=new T.Mesh(g,mat);m.castShadow=m.receiveShadow=SH;world.add(m);occluders.push(m)}FB.clear()};
 const fpiece=(cx,y,cz,rot,fn)=>{const M=new T.Matrix4().compose(new T.Vector3(cx,y,cz),new T.Quaternion().setFromAxisAngle(AXY,rot?Math.PI/2:0),new T.Vector3(1,1,1));
  const part=(geo,mat,ox,oy,oz,ry)=>{geo.applyMatrix4(new T.Matrix4().compose(new T.Vector3(ox,oy,oz),new T.Quaternion().setFromAxisAngle(AXY,ry||0),new T.Vector3(1,1,1)));fbAdd(geo,mat,M)};
  fn((sx,sy,sz,mat,ox,oy,oz,ry)=>part(new T.BoxGeometry(sx,sy,sz),mat,ox,oy,oz,ry),(rt,rb,h,seg,mat,ox,oy,oz)=>part(new T.CylinderGeometry(rt,rb,h,seg),mat,ox,oy,oz,0))};
 /* Beta 0.4.0-pre11 interior helpers: a = position along the door's wall, c = across the room, k = door side (0 north, 1 south, 2 west, 3 east) */
 const roomBox=(x,y,z,k,a,c,A,Hh,C,mat,o)=>{const[px,pz]=k<2?[x+a,z+c]:[x+c,z+a];return addBox(px,y,pz,k<2?A:C,Hh,k<2?C:A,mat,o)};
 const farC=(bx,bz,k,inset)=>{const D=k<2?bz:bx,s=k%2===0?-1:1;return -s*(D/2-inset)};
 function barnGear(x,y,z,bx,bz,k){ /* a cart and sacks on the far side of barns and farm buildings */
  roomBox(x,y+.7,z,k,3,0,2.2,.1,1.2,mFurWoodP,{occ:false});
  for(const a of[-1,1])for(const c of[-.5,.5])roomBox(x,y+.02,z,k,3+a,c,.12,.68,.12,mFurDark,{col:false,occ:false});
  roomBox(x,y+.02,z,k,-3,0,.9,.6,.6,mFurLight);roomBox(x,y+.62,z,k,-3,0,.8,.5,.6,mFurLight)}
 function workshopInside(x,y,z,bx,bz,k){ /* a workbench with vice, a pegboard of tools and crates */
  roomBox(x,y+.02,z,k,0,farC(bx,bz,k,.6),3.6,.85,.8,mFurWoodP);
  roomBox(x,y+.87,z,k,0,farC(bx,bz,k,.6),3.7,.06,.9,mFurLight,{col:false,occ:false});
  roomBox(x,y+.93,z,k,1.2,farC(bx,bz,k,.6),.3,.18,.22,mFurMetal,{col:false,occ:false});
  roomBox(x,y+1.1,z,k,0,farC(bx,bz,k,.04),3.2,1.2,.04,mFurWoodP,{col:false,occ:false});
  for(let i=0;i<5;i++)roomBox(x,y+1.25+(i%2)*.4,z,k,-1.2+i*.6,farC(bx,bz,k,.08),.1,.4,.04,mFurMetal,{col:false,occ:false});
  roomBox(x,y+.02,z,k,-3,0,.9,.9,.9,mFurLight);roomBox(x,y+.92,z,k,-3,0,.8,.7,.8,mFurLight)}
 function furnish(x,y,z,bx,bz,doorSide,barn){
  if(barn){for(const[u,v]of[[-bx/2+1,-bz/2+1],[-bx/2+1,bz/2-1],[bx/2-1.4,-bz/2+1]]){addBox(x+u,y+.02,z+v,1.2,.7,.8,mHay,{col:false,occ:false})}barnGear(x,y,z,bx,bz,doorSide);return}
  const hx=bx/2-.5,hz=bz/2-.5,placed=[];
  const corridor=(cx,cz,w,d)=>{ /* does the footprint overlap the strip in front of the doorway? */
   const k=doorSide;let x0,x1,z0,z1;
   if(k===0){x0=x-.9;x1=x+.9;z0=z-bz/2;z1=z-bz/2+4.2}else if(k===1){x0=x-.9;x1=x+.9;z0=z+bz/2-4.2;z1=z+bz/2}
   else if(k===2){x0=x-bx/2;x1=x-bx/2+4.2;z0=z-.9;z1=z+.9}else{x0=x+bx/2-4.2;x1=x+bx/2;z0=z-.9;z1=z+.9}
   return cx+w/2>x0-.5&&cx-w/2<x1+.5&&cz+d/2>z0-.5&&cz-d/2<z1+.5};
  const overlaps=(cx,cz,w,d)=>placed.some(q=>Math.abs(cx-q[0])<(w+q[2])/2+.3&&Math.abs(cz-q[1])<(d+q[3])/2+.3);
  const defs=[
   {n:'wardrobe',w:1.2,d:.55,h:1.9,p:.8,wall:true,solid:true,draw:bx=>{bx(1.2,.08,.55,mFurDark,0,.04,0);bx(1.2,1.8,.55,mFurWoodP,0,.98,0);bx(.56,1.7,.03,mFurLight,-.29,.95,.29);bx(.56,1.7,.03,mFurLight,.29,.95,.29);bx(.035,.24,.03,mFurBrass,-.04,.95,.32);bx(.035,.24,.03,mFurBrass,.04,.95,.32);bx(1.26,.06,.6,mFurDark,0,1.91,0)}},
   {n:'bed',w:2,d:.95,h:.6,p:.7,wall:true,solid:true,draw:bx=>{const cl=mFurCloth[Math.floor(R()*4)];bx(2,.16,.95,mFurWoodP,0,.2,0);for(const sx of[-1,1])for(const sz of[-1,1])bx(.08,.2,.08,mFurDark,sx*.92,.1,sz*.4);bx(1.9,.14,.85,mFurWhite,0,.39,.05);bx(1.92,.06,.6,cl,0,.5,.2);bx(.66,.1,.28,mFurWhite,0,.5,-.3);bx(2,.62,.07,mFurWoodP,0,.5,-.46)}},
   {n:'table',w:1.2,d:.8,h:.75,p:.85,wall:false,solid:true,draw:(bx,cy)=>{bx(1.2,.05,.8,mFurLight,0,.725,0);bx(1.14,.008,.74,mFurOil,0,.75,0);for(const sx of[-1,1])for(const sz of[-1,1])bx(.06,.7,.06,mFurDark,sx*.54,.35,sz*.34);if(R()<.5){cy(.05,.06,.03,10,mFurBrass,.35,.79,-.15);cy(.012,.012,.18,6,mFurBrass,.35,.9,-.15);cy(.05,.16,.16,12,mFurWhite,.35,.99,-.15)}}},
   {n:'stove',w:.6,d:.6,h:.9,p:.6,wall:true,solid:true,draw:(bx,cy)=>{bx(.6,.84,.6,mFurWhite,0,.44,0);bx(.6,.04,.6,mFurDark,0,.88,0);for(const sx of[-1,1])for(const sz of[-1,1])cy(.075,.075,.02,12,mFurDark,sx*.15,.91,sz*.15);bx(.46,.36,.02,mFurDark,0,.42,.305);bx(.36,.03,.04,mFurBrass,0,.62,.33);for(const sx of[-.2,-.07,.07,.2])cy(.025,.025,.035,8,mFurBrass,sx,.8,.31)}},
   {n:'shelf',w:1,d:.35,h:1.7,p:.5,wall:true,solid:true,draw:(bx,cy)=>{bx(1,1.7,.35,mFurLight,0,.85,0);bx(.94,1.64,.02,mFurDark,0,.85,-.16);for(const y of[.42,.84,1.26]){bx(.94,.03,.33,mFurWoodP,0,y,0);for(let k=0;k<3;k++)cy(.05,.05,.13,8,mFurJar[Math.floor(R()*4)],-.3+k*.3+(R()-.5)*.06,y+.08,.04);bx(.1,.2,.22,mFurBook[Math.floor(R()*4)],.36,y+.12,.02);bx(.1,.2,.22,mFurBook[Math.floor(R()*4)],.25,y+.12,.02)}}},
   {n:'chair',w:.45,d:.45,h:.9,p:.7,wall:false,solid:false,draw:bx=>{bx(.42,.05,.42,mFurWoodP,0,.46,0);for(const sx of[-1,1])for(const sz of[-1,1])bx(.04,.44,.04,mFurDark,sx*.18,.22,sz*.18);for(const sx of[-1,1])bx(.04,.48,.04,mFurDark,sx*.18,.7,-.2);bx(.4,.08,.03,mFurWoodP,0,.82,-.2);bx(.4,.07,.03,mFurWoodP,0,.66,-.2)}},
   {n:'chair',w:.45,d:.45,h:.9,p:.5,wall:false,solid:false,draw:bx=>{bx(.42,.05,.42,mFurWoodP,0,.46,0);for(const sx of[-1,1])for(const sz of[-1,1])bx(.04,.44,.04,mFurDark,sx*.18,.22,sz*.18);for(const sx of[-1,1])bx(.04,.48,.04,mFurDark,sx*.18,.7,-.2);bx(.4,.08,.03,mFurWoodP,0,.82,-.2);bx(.4,.07,.03,mFurWoodP,0,.66,-.2)}}];
  for(const pc of defs){if(R()>pc.p)continue;let done=false;
   for(let t=0;t<30&&!done;t++){let cx,cz;
    if(pc.wall){const side=Math.floor(R()*4);if(side===doorSide)continue;const u=(R()*2-1);
     if(side===0){cx=x+u*hx;cz=z-hz+pc.d/2}else if(side===1){cx=x+u*hx;cz=z+hz-pc.d/2}else if(side===2){cx=x-hx+pc.d/2;cz=z+u*hz}else{cx=x+hx-pc.d/2;cz=z+u*hz}
    }else{cx=x+(R()*2-1)*(hx-.4);cz=z+(R()*2-1)*(hz-.4)}
    const w=pc.w,d=pc.d;
    if(Math.abs(cx-x)+w/2>hx+.05||Math.abs(cz-z)+d/2>hz+.05)continue;
    if(corridor(cx,cz,w,d)||overlaps(cx,cz,w,d))continue;
    const rot=pc.w>pc.d&&R()<.5;const ww=rot?d:w,dd=rot?w:d;
    fpiece(cx,y+.02,cz,rot,pc.draw);
    if(pc.solid)boxes.push({x0:cx-ww/2,x1:cx+ww/2,z0:cz-dd/2,z1:cz+dd/2,top:y+.02+pc.h});
    placed.push([cx,cz,ww,dd]);done=true}
  }
  /* decoration only: a rug on the floor and a picture on one wall (no collision, never in the doorway corridor) */
  if(R()<.55){const rot=R()<.5,cx=x+(R()*2-1)*(hx-1),cz=z+(R()*2-1)*(hz-1);fpiece(cx,y+.02,cz,rot,(b2,cy)=>b2(1.6,.02,2.2,mFurRug[Math.floor(R()*3)],0,.01,0))}
  if(R()<.7){const sides=[0,1,2,3].filter(s=>s!==doorSide),s=sides[Math.floor(R()*sides.length)],u=R()*2-1;let cx,cz;
   if(s===0){cx=x+u*(hx-.4);cz=z-hz+.03}else if(s===1){cx=x+u*(hx-.4);cz=z+hz-.03}else if(s===2){cx=x-hx+.03;cz=z+u*(hz-.4)}else{cx=x+hx-.03;cz=z+u*(hz-.4)}
   const cv=mFurPic[Math.floor(R()*mFurPic.length)];
   fpiece(cx,y+1.45,cz,s>=2,(b2)=>{b2(.62,.52,.03,mFurDark,0,0,0);b2(.5,.4,.035,cv,0,0,0)})}
 }
 function house(x,y,z,o){const{w,d,h,rot,doorSide,tile,plaster,doorW=1.1,chimney=true,ext=false,barn=false,win=2}=o;
  const bx=rot?d:w,bz=rot?w:d,alongX=bx>=bz,mat=barn?mBarnW:plaster;
  HOUSES.push({x,z,bx,bz,doorSide,doorW,barn,y});
  shell(x,y,z,bx,bz,h,mat,doorSide,doorW);
  if(!barn)windows(x,y,z,bx,bz,h,doorSide,win);
  furnish(x,y,z,bx,bz,doorSide,barn);
  /* plinth: a darker base course around the house (visual only) */
  if(!barn){for(const[dx2,dz2,sx,sz]of[[0,bz/2+.05,bx+.1,.1],[0,-bz/2-.05,bx+.1,.1],[bx/2+.05,0,.1,bz+.1],[-bx/2-.05,0,.1,bz+.1]])addBox(x+dx2,y,z+dz2,sx,.35,sz,mPlinth,{col:false,occ:false,cast:false})}
  /* steep pitched roof: ridge along the long axis, pitch about 40 degrees */
  const span=(alongX?bz:bx)+.9,len=(alongX?bx:bz)+.8,rise=span*(barn?.5:.46);
  gable(x,y+h,z,span,rise,len,TILE[tile],alongX);
  if(chimney&&!barn){const cx=x+(alongX?bx*.25:0),cz=z+(alongX?0:bz*.25);addBox(cx,y+h+rise*.35,cz,.6,rise*1.4,.6,mBrick,{col:false,occ:false,cast:false})}
  if(ext&&!barn){const o=doorSide^1,sg=o%2===0?-1:1;if(o<2)addBox(x-bx*.2,y,z+sg*(bz/2+1.6),3.6,h*.62,3.2,mat);else addBox(x+sg*(bx/2+1.6),y,z+bz*.2,3.2,h*.62,3.6,mat)}
 }
 /* Beta 0.4.0-pre3: villages built from VILLAGE_PLANS: a dirt lane along the street, then the homes and barn facing it */
 /* Beta 0.4.0-pre4: back-yard fence and shed from the village plan (collision boxes for both) */
 const mFence=L({color:0x7a6a4a}),mShed=L({color:0x6b5a40}),mSign=L({color:0x2f5a3a});
 const yardOf=(v,hm)=>{const alongX=v.alongX;
  if(hm.fence){const f=hm.fence,y=H(f.x,f.z);addBox(f.x,y,f.z,alongX?hm.w+2:.12,1.1,alongX?.12:hm.w+2,mFence)}
  if(hm.shed){const{x,z}=hm.shed,y=H(x,z);addBox(x,y,z,alongX?2.6:2.2,2.0,alongX?2.2:2.6,mShed);gable(x,y+2.0,z,(alongX?2.2:2.6)+.5,1.0,2.6+.4,TILE[0],alongX)}};
 const trackRibbon=(ax,az,bx,bz)=>{const mx=(ax+bx)/2,mz=(az+bz)/2,hm0=H(mx,mz),tl=Math.hypot(bx-ax,bz-az),tg=new T.PlaneGeometry(tl,3.2,24,1);tg.rotateX(-Math.PI/2);tg.rotateY(Math.atan2(-(bz-az),bx-ax));const tp=tg.attributes.position;for(let k=0;k<tp.count;k++)tp.setY(k,H(mx+tp.getX(k),mz+tp.getZ(k))-hm0+.05);tp.needsUpdate=true;tg.computeVertexNormals();add(new T.Mesh(tg,L({color:0x6e5d40})),false,true).position.set(mx,hm0,mz)};
 for(const v of VILLAGE_PLANS){const cx=v.s.x,cz=v.s.z,h0=H(cx,cz),Lh=Math.hypot(v.lane[2]-v.lane[0],v.lane[3]-v.lane[1])/2;
  const lg=new T.PlaneGeometry(2*Lh,3.6,48,1);lg.rotateX(-Math.PI/2);if(!v.alongX)lg.rotateY(Math.PI/2);
  const lp=lg.attributes.position;for(let k=0;k<lp.count;k++)lp.setY(k,H(cx+lp.getX(k),cz+lp.getZ(k))-h0+.05);lp.needsUpdate=true;lg.computeVertexNormals();
  add(new T.Mesh(lg,L({color:0x6e5d40})),false,true).position.set(cx,h0,cz);
  for(const hm of v.homes){const y=H(hm.x,hm.z);house(hm.x,y,hm.z,{w:hm.w,d:hm.d,h:hm.h,rot:hm.rot,doorSide:hm.doorSide,tile:Math.floor(hm.ti*TILE.length),plaster:PLASTER[Math.floor(hm.pi*PLASTER.length)],doorW:1.1,ext:hm.ext,chimney:hm.chimney,win:hm.win});yardOf(v,hm)}
  if(v.shop){const sh=v.shop,y=H(sh.x,sh.z);house(sh.x,y,sh.z,{w:sh.w,d:sh.d,h:sh.h,rot:sh.rot,doorSide:sh.doorSide,tile:Math.floor(sh.ti*TILE.length),plaster:PLASTER[1],doorW:1.6,ext:false,chimney:false,win:sh.win});
   /* Beta 0.4.0-pre10: shop interior: a counter across the room from the door, and shelves on the side walls */
   {const bx=sh.rot?sh.d:sh.w,bz=sh.rot?sh.w:sh.d,k=sh.doorSide,cw=Math.min(bx-3.2,4.2);
    if(k<2){addBox(sh.x,y+.02,sh.z+(k===0?bz/2-1.5:-bz/2+1.5),cw,1,.7,mFurLight);addBox(sh.x,y+.02+1,sh.z+(k===0?bz/2-1.5:-bz/2+1.5),cw,.06,.8,mFurWoodP,{col:false,occ:false});
     for(const sx of[-1,1])addBox(sh.x+sx*(bx/2-.35),y+.02,sh.z+(k===0?bz/2-3.2:-bz/2+3.2),.7,1.9,2.2,mFurWoodP)}
    else{addBox(sh.x+(k===2?bx/2-1.5:-bx/2+1.5),y+.02,sh.z,.7,1,cw,mFurLight);addBox(sh.x+(k===2?bx/2-1.5:-bx/2+1.5),y+.02+1,sh.z,.8,.06,cw,mFurWoodP,{col:false,occ:false});
     for(const sz of[-1,1])addBox(sh.x+(k===2?bx/2-3.2:-bx/2+3.2),y+.02,sh.z+sz*(bz/2-.35),2.2,1.9,.7,mFurWoodP)}}
   const sgx=sh.x-v.nx*sh.sd*(sh.d/2+.1),sgz=sh.z-v.nz*sh.sd*(sh.d/2+.1),sgs=v.alongX?[3.4,.5,.15]:[.15,.5,3.4];addBox(sgx,y+2.7,sgz,sgs[0],sgs[1],sgs[2],mSign,{col:false,occ:false,cast:false})}
  if(v.connector){const c=v.connector;trackRibbon(c[0],c[1],c[2],c[3])}
  if(v.connector2){const c=v.connector2;trackRibbon(c[0],c[1],c[2],c[3])}
  if(v.square){const q=v.square,y=H(q.x,q.z),mPave=L({color:0x8a8478}),mWell=L({color:0x7d7a70});
   addBox(q.x,y+.08,q.z,14,.04,14,mPave,{col:false,occ:false,cast:false});
   const wl=add(new T.Mesh(new T.CylinderGeometry(1.1,1.1,1,14),mWell),true,true);wl.position.set(q.x,y+.5,q.z);circles.push({x:q.x,z:q.z,r:1.4});
   for(const[dx2,dz2]of[[4.5,4.5],[-4.5,-4.5]])addBox(q.x+dx2,y+.08,q.z+dz2,.5,.45,2.2,mFurWoodP)}
  if(v.workshop){const w=v.workshop,y=H(w.x,w.z);house(w.x,y,w.z,{w:w.w,d:w.d,h:w.h,rot:w.rot,doorSide:w.doorSide,tile:Math.floor(w.ti*TILE.length),plaster:PLASTER[Math.floor(w.pi*PLASTER.length)],doorW:1.3,ext:false,chimney:false,win:w.win});
   workshopInside(w.x,y,w.z,w.rot?w.d:w.w,w.rot?w.w:w.d,w.doorSide);
   const sgx=w.x-v.nx*w.sd*(w.d/2+.1),sgz=w.z-v.nz*w.sd*(w.d/2+.1),sgs=v.alongX?[2.6,.45,.15]:[.15,.45,2.6];addBox(sgx,y+2.7,sgz,sgs[0],sgs[1],sgs[2],mSign,{col:false,occ:false,cast:false})}
  if(v.barn){const b=v.barn,y=H(b.x,b.z);house(b.x,y,b.z,{w:12,d:6.5,h:4.2,rot:b.rot,doorSide:b.doorSide,tile:Math.floor(R()*TILE.length),plaster:PLASTER[0],doorW:2.6,barn:true,chimney:false})}
  if(v.farm){const f=v.farm,y=H(f.x,f.z),ux2=v.ux,uz2=v.uz,nx2=v.nx*f.side,nz2=v.nz*f.side;
   house(f.x,y,f.z,{w:14,d:7,h:4.6,rot:f.rot,doorSide:f.doorSide,tile:Math.floor(R()*TILE.length),plaster:PLASTER[0],doorW:2.6,barn:true,chimney:false});
   const sx=f.x+ux2*10,sz=f.z+uz2*10,ssy=H(sx,sz);const sm=L({color:0xa8a89a});const silo=add(new T.Mesh(new T.CylinderGeometry(1.3,1.3,6,16),sm),true,true);silo.position.set(sx,ssy+3,sz);circles.push({x:sx,z:sz,r:1.4});
   for(let k=0;k<3;k++){const hx=f.x-ux2*9+nx2*-6+ux2*k*1.2,hz=f.z-uz2*9+nz2*-6+uz2*k*1.2,hy=H(hx,hz);addBox(hx,hy,hz,1.0,.8,1.0,mHay)}
   trackRibbon(v.lane[2],v.lane[3],f.x,f.z)}
 }
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
 fbFlush();
}
