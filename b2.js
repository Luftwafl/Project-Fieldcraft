const HOUSES=[];
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
const mergeMeshes=(group)=>{const kids=group.children.filter(m=>m.isMesh),bk=new Map();
 for(const m of kids){m.updateMatrix();const g=m.geometry.clone();g.applyMatrix4(m.matrix);const q=g.index?g.toNonIndexed():g;if(q!==g)g.dispose();let e=bk.get(m.material);if(!e){e={p:[],n:[]};bk.set(m.material,e)}const a=q.attributes.position.array,n=q.attributes.normal.array;for(let i=0;i<a.length;i++)e.p.push(a[i]);for(let i=0;i<n.length;i++)e.n.push(n[i]);q.dispose()}
 for(const m of kids)group.remove(m);
 const out=[];for(const[mat,e]of bk){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(e.p,3));g.setAttribute('normal',new T.Float32BufferAttribute(e.n,3));const mm=new T.Mesh(g,mat);mm.castShadow=mm.receiveShadow=true;group.add(mm);out.push(mm)}
 return out};
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

/* ============ Beta 0.5.1 urban conquest map: 450 m x 450 m, flat ground, one connected city ============
   Street grid: 12 m streets on the lines STREET_C; 48 m blocks between them. Each block has a district letter (DISTRICT).
   Buildings are enterable: a ground door on the street side and floors joined by RAMPS (never stairs).
   Multi-storey buildings share one ramp shaft: the ramps alternate between the two lanes of the shaft and switch back on each landing. */
const MAP_H=225;
const STREET_C=[-180,-120,-60,0,60,120,180],STREET_HW=6,BLK_C=[-150,-90,-30,30,90,150],BLK_EDGE=24;
/* district per block. Rows: z from north (row 0) to south (row 5). Columns: x from west to east.
   N NATO compound  W Warsaw Pact compound  D downtown  M mid-rise offices  R residential  H houses
   S shops  K commercial  I industrial  G park */
const DISTRICT=['NHSMII','HRMDIK','RRDDKS','RRDDMS','HRGMSK','GHKSHW'];
const faceTo=(x,z,tx,tz)=>Math.atan2(-(tx-x),-(tz-z));   /* yaw that looks from (x,z) towards (tx,tz); forward = (-sin yaw, -cos yaw) */
const BASES={
 nato:{id:'nato',name:'NATO FORWARD BASE',x:-150,z:-150,radius:26,spawn:{id:'nato-player',x:-158,z:-158,yaw:0},aiSpawns:[{id:'nato-ai-1',x:-164,z:-162},{id:'nato-ai-2',x:-156,z:-164},{id:'nato-ai-3',x:-164,z:-154},{id:'nato-ai-4',x:-150,z:-166}]},
 wp:{id:'wp',name:'WARSAW PACT FORWARD BASE',x:150,z:150,radius:26,spawn:{id:'wp-player',x:158,z:158,yaw:0},aiSpawns:[{id:'wp-ai-1',x:164,z:162},{id:'wp-ai-2',x:156,z:164},{id:'wp-ai-3',x:164,z:154},{id:'wp-ai-4',x:150,z:166}]}};
BASES.nato.spawn.yaw=faceTo(BASES.nato.spawn.x,BASES.nato.spawn.z,BASES.wp.x,BASES.wp.z);
BASES.wp.spawn.yaw=faceTo(BASES.wp.spawn.x,BASES.wp.spawn.z,BASES.nato.x,BASES.nato.z);
/* building constants: a storey is FH tall; a ramp climbs one storey over RUN metres (slope 0.28, about 16 degrees) */
const FH=3.4,WT=.3,RUN=12,LAND=2.5,SHW=6.6,LZ=RUN+2*LAND,DW=1.8,DH=2.2,RW=1.65,ROOM_D=7,CORR_W=2.1,ROOM_DW=1.2;
const ROTK=[(x,z)=>[x,z],(x,z)=>[-z,x],(x,z)=>[-x,-z],(x,z)=>[z,-x]],DIRK={N:0,E:1,S:2,W:3};
const H=(x,z)=>FY;   /* the city is flat: every surface is at FY unless a box or a ramp is higher */
const Hraw=H,flat=()=>0,forestAt=()=>0,villageBlocked=()=>false,settleCore=()=>false;
const BOX1=new T.BoxGeometry(1,1,1),CANOPY_G=new T.IcosahedronGeometry(1,0),TRUNK_G=new T.CylinderGeometry(.14,.18,1,6);
/* per-map state, rebuilt by buildWorld (TRIGS, RESUPPLY, ROADS and VILLAGE_PLANS need the conquest points, so they are set there) */
let MAT=null,RAMPS=[],FOOT=[],TREES=[],BUSH=[],POST=[],CARS=[],CITY=[],RESUPPLY=[],ROADS=[],VILLAGE_PLANS=[];
const post=o=>POST.push(o);
/* a box in world space: col:false = visual only, occ:false = bullets pass through it */
function addBox(x,y,z,w,h,d,mat,o){const m=new T.Mesh(BOX1,mat);m.scale.set(w,h,d);m.position.set(x,y+h/2,z);m.castShadow=o?.cast??true;m.receiveShadow=true;world.add(m);
 if(!o||o.col!==false)boxes.push({x0:x-w/2,x1:x+w/2,z0:z-d/2,z1:z+d/2,top:y+h,bot:y});
 if(!o||o.occ!==false)occluders.push(m);return m}
/* a flat ground patch: walkable, no collision, no shadow casting */
function patch(x0,x1,z0,z1,mat,y){const m=new T.Mesh(BOX1,mat);m.scale.set(x1-x0,.04,z1-z0);m.position.set((x0+x1)/2,y,(z0+z1)/2);m.receiveShadow=true;world.add(m);return m}
function mkMats(){const tw=cvs(128,128,(g,w,h)=>{g.fillStyle='#dcdcdc';g.fillRect(0,0,w,h);g.fillStyle='#0003';for(let y=0;y<h;y+=16)g.fillRect(0,y,w,2);speckle(g,w,h,700,.3)},2,1);
 return{walls:[0x8d8a80,0x9a948a,0x7e7b72,0xa39f92,0x6f6d66].map(c=>L({color:c,map:tw})),
  slab:L({color:0x5e5c57}),roof:L({color:0x3f4246}),inner:L({color:0xc6c1b0}),
  wood:L({color:0x8a6840}),dark:L({color:0x2a3138}),glass:L({color:0x4f6e7c}),ramp:L({color:0x8f8c84,side:T.DoubleSide}),
  metal:L({color:0x4b514b}),asph:L({color:0x3d4044}),conc:L({color:0x9b988f}),lawn:L({color:0x5e7242}),
  sand:L({color:0xb0a47c}),tent:L({color:0x6c6f48,side:T.DoubleSide}),barrier:L({color:0x8e8b82}),
  cars:[0x6a2e2a,0x2e4a6a,0xb8b4a6,0x3a3f36,0x7a7a6e,0x8a6a2a].map(c=>L({color:c})),
  bark:L({color:0x4a3a2a}),leaf:L({color:0x4f6a34}),leaf2:L({color:0x5d7a3c}),
  blk:L({color:0x1d1f21}),yel:L({color:0xd8b84a}),white:L({color:0xdedbd0}),
  container:[0x7a3b2a,0x2f4f6a,0x5a6a3a].map(c=>L({color:c})),path:L({color:0xb5b1a4})}}
/* a ramp: a sloped slab whose top face is exactly the walking surface (no boxes are used for slopes) */
function wedgeGeo(A,B,hw,th){const dx=B.x-A.x,dz=B.z-A.z,L0=Math.hypot(dx,dz)||1,px=-dz/L0*hw,pz=dx/L0*hw;
 const a0=[A.x-px,A.y,A.z-pz],a1=[A.x+px,A.y,A.z+pz],b0=[B.x-px,B.y,B.z-pz],b1=[B.x+px,B.y,B.z+pz];
 const dn=p=>[p[0],p[1]-th,p[2]],a0d=dn(a0),a1d=dn(a1),b0d=dn(b0),b1d=dn(b1),v=[];
 const tri=(p,q,r)=>v.push(...p,...q,...r);
 tri(a0,a1,b1);tri(a0,b1,b0);tri(a0d,b1d,a1d);tri(a0d,b0d,b1d);
 tri(a0,b0,b0d);tri(a0,b0d,a0d);tri(a1,b1d,b1);tri(a1,a1d,b1d);
 tri(a0,a0d,a1);tri(a1,a0d,a1d);tri(b0,b1,b0d);tri(b1,b1d,b0d);
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.computeVertexNormals();return g}
/* one building. The local frame has its ground door on the north side (-z); ROTK turns it to face the street.
   sp: {W (x), D (z), S storeys, kind, fh, k (door side), wi (wall colour), roof, shaft} */
function bld(cx,cz,sp){
 const W=sp.W,D=sp.D,S=sp.S,fh=sp.fh||FH,R=ROTK[sp.k],mat=MAT.walls[sp.wi||0];
 const wp=(lx,lz)=>{const r=R(lx,lz);return[cx+r[0],cz+r[1]]};
 const bx=(lx0,lx1,lz0,lz1,y0,y1,m,o)=>{const a=wp(lx0,lz0),b=wp(lx1,lz1),x0=Math.min(a[0],b[0]),x1=Math.max(a[0],b[0]),z0=Math.min(a[1],b[1]),z1=Math.max(a[1],b[1]);return addBox((x0+x1)/2,y0,(z0+z1)/2,x1-x0,y1-y0,z1-z0,m,o)};
 const Y0=FY,top=Y0+fh*S,Lv=f=>Y0+fh*f,DL=-D/2,DR=D/2;
 const shaft=!!sp.shaft&&S>=2;
 const sxB=W/2-WT,sxA=sxB-SHW,mid=sxA+SHW/2,zMin=DL+WT,zMax=zMin+LZ,zLo=zMin+LAND,zHi=zMax-LAND;
 const doorX=shaft?mid:0,NR=shaft?S-1+(sp.roof?1:0):0;
 {const a=wp(-W/2,DL),b=wp(W/2,DR);FOOT.push({x0:Math.min(a[0],b[0]),x1:Math.max(a[0],b[0]),z0:Math.min(a[1],b[1]),z1:Math.max(a[1],b[1]),kind:sp.kind})}
 /* outer walls: collision is the full wall (boxes only, no mesh). The visible wall is cut by a hole at each window and at the ground door, and each window hole holds a glass pane that bullets break */
 const cbx=(lx0,lx1,lz0,lz1,y0,y1)=>{const p=wp(lx0,lz0),q=wp(lx1,lz1);boxes.push({x0:Math.min(p[0],q[0]),x1:Math.max(p[0],q[0]),z0:Math.min(p[1],q[1]),z1:Math.max(p[1],q[1]),top:y1,bot:y0})};
 cbx(-W/2,doorX-DW/2,DL,DL+WT,Y0,top);cbx(doorX+DW/2,W/2,DL,DL+WT,Y0,top);cbx(doorX-DW/2,doorX+DW/2,DL,DL+WT,Y0+DH,top);
 cbx(-W/2,W/2,DR-WT,DR,Y0,top);cbx(-W/2,-W/2+WT,DL,DR,Y0,top);cbx(W/2-WT,W/2,DL,DR,Y0,top);
 /* a facade as solid pieces round its holes (occluding and merged); axis 'x': the wall runs along x at c0..c1; axis 'z': along z. Columns with equal heights merge */
 const VIS={col:false,cast:false};
 const facadeVis=(axis,c0,c1,a0,a1,hs,y0,y1,m)=>{
  const xs=[a0,a1];for(const h of hs){if(h.s0>a0&&h.s0<a1)xs.push(h.s0);if(h.s1>a0&&h.s1<a1)xs.push(h.s1)}
  xs.sort((p,q)=>p-q);const cols=[];
  for(let i=0;i<xs.length-1;i++){const s0=xs[i],s1=xs[i+1];if(s1-s0<1e-6)continue;const sm=(s0+s1)/2;
   const cov=hs.filter(h=>sm>h.s0&&sm<h.s1).sort((p,q)=>p.y0-q.y0);
   const iv=[];let y=y0;for(const h of cov){if(h.y0>y)iv.push([y,h.y0]);y=Math.max(y,h.y1)}if(y<y1)iv.push([y,y1]);
   cols.push({s0,s1,iv})}
  const put=c=>{for(const[u,v]of c.iv){if(axis==='x')bx(c.s0,c.s1,c0,c1,u,v,m,VIS);else bx(c0,c1,c.s0,c.s1,u,v,m,VIS)}};
  let cur=null;
  for(const c of cols){if(cur&&Math.abs(cur.s1-c.s0)<1e-6&&JSON.stringify(cur.iv)===JSON.stringify(c.iv))cur.s1=c.s1;else{if(cur)put(cur);cur={s0:c.s0,s1:c.s1,iv:c.iv}}}
  if(cur)put(cur)};
 const gl={col:false,occ:true,cast:false};
 const hN=[],hS=[],hW=[],hE=[];
 for(let f=0;f<S;f++){const y0=Lv(f)+1.0,y1=Lv(f)+2.5;
  for(let lx=-W/2+1.6;lx<=W/2-1.5;lx+=3.2){
   if(!(f===0&&Math.abs(lx-doorX)<2.2)){hN.push({s0:lx-.7,s1:lx+.7,y0,y1});bx(lx-.7,lx+.7,DL+.12,DL+.18,y0,y1,MAT.glass,gl)}
   hS.push({s0:lx-.7,s1:lx+.7,y0,y1});bx(lx-.7,lx+.7,DR-.18,DR-.12,y0,y1,MAT.glass,gl)}
  for(let lz=DL+1.6;lz<=DR-1.5;lz+=3.2){hW.push({s0:lz-.7,s1:lz+.7,y0,y1});hE.push({s0:lz-.7,s1:lz+.7,y0,y1});
   bx(-W/2+.12,-W/2+.18,lz-.7,lz+.7,y0,y1,MAT.glass,gl);bx(W/2-.18,W/2-.12,lz-.7,lz+.7,y0,y1,MAT.glass,gl)}}
 hN.push({s0:doorX-DW/2,s1:doorX+DW/2,y0:Y0,y1:Y0+DH});
 facadeVis('x',DL,DL+WT,-W/2,W/2,hN,Y0,top,mat);facadeVis('x',DR-WT,DR,-W/2,W/2,hS,Y0,top,mat);
 facadeVis('z',-W/2,-W/2+WT,DL,DR,hW,Y0,top,mat);facadeVis('z',W/2-WT,W/2,DL,DR,hE,Y0,top,mat);
let rooms=[];
 if(shaft){
  /* the ramp tube: a solid wall in the ramp zone, openings onto the corridor at both landings */
  bx(sxA-WT,sxA,zLo,zHi,Y0,top,mat);
  for(let f=0;f<S;f++){bx(sxA-WT,sxA,zMin,zLo,Lv(f)+DH,Lv(f+1),mat);bx(sxA-WT,sxA,zHi,zMax,Lv(f)+DH,Lv(f+1),mat)}
  bx(mid-WT/2,mid+WT/2,zLo,zHi,Y0,top,mat);           /* divides the two ramp lanes */
  bx(sxA,sxB,zMax,zMax+WT,Y0,top,mat);                /* closes the south end of the tube */
  /* corridor west of the tube; rooms west of the corridor, each with a door onto it */
  const cA=sxA-WT-CORR_W,n=Math.max(1,Math.floor((D-2*WT)/ROOM_D)),zs=[];
  for(let i=0;i<=n;i++)zs.push(DL+WT+i*(D-2*WT)/n);
  for(let i=1;i<n;i++)bx(-W/2+WT,cA-WT,zs[i]-WT/2,zs[i]+WT/2,Y0,top,mat);
  for(let i=0;i<n;i++){const a=zs[i]+(i?WT/2:0),b=zs[i+1]-(i<n-1?WT/2:0),c=(zs[i]+zs[i+1])/2;
   bx(cA-WT,cA,a,c-ROOM_DW/2,Y0,top,mat);bx(cA-WT,cA,c+ROOM_DW/2,b,Y0,top,mat);bx(cA-WT,cA,c-ROOM_DW/2,c+ROOM_DW/2,Y0+DH,top,mat);
   rooms.push({x0:-W/2+WT,x1:cA-WT,z0:zs[i],z1:zs[i+1]})}
  /* floor slabs (walkable tops at each storey); the slab over a ramp lane is open, the landings stay solid */
  const xs=[-W/2+WT,sxA,mid,sxB,W/2-WT],zz=[DL+WT,zLo,zHi,DR-WT];
  for(let f=1;f<=S;f++){const hole=f<=NR?((f-1)%2===0?[sxA,mid]:[mid,sxB]):null;
   for(let i=0;i<xs.length-1;i++)for(let j=0;j<zz.length-1;j++){const xa=xs[i],xb=xs[i+1],za=zz[j],zb=zz[j+1],mx=(xa+xb)/2,mz=(za+zb)/2;
    if(hole&&mx>hole[0]&&mx<hole[1]&&mz>zLo&&mz<zHi)continue;
    bx(xa,xb,za,zb,Lv(f)-WT,Lv(f),MAT.slab)}}
  /* ramps: storey t up to t+1, alternating lanes; a landing is where two ramps meet at a storey */
  for(let t=0;t<NR;t++){const h=t%2===0,xc=h?(sxA+mid)/2:(mid+sxB)/2,zs0=h?zLo:zHi,ze=h?zHi:zLo;
   const a=wp(xc,zs0),b=wp(xc,ze),A={x:a[0],y:Lv(t),z:a[1]},B={x:b[0],y:Lv(t+1),z:b[1]};
   RAMPS.push({ax:A.x,az:A.z,bx:B.x,bz:B.z,yA:A.y,yB:B.y,hw:RW,L:Math.hypot(B.x-A.x,B.z-A.z)||1});
   const m=new T.Mesh(wedgeGeo(A,B,RW,.3),MAT.ramp);m.castShadow=m.receiveShadow=true;world.add(m)}
  /* roof: a parapet round the edge and rooftop equipment */
  if(sp.roof){bx(-W/2,W/2,DL,DL+WT,top,top+.9,mat);bx(-W/2,W/2,DR-WT,DR,top,top+.9,mat);bx(-W/2,-W/2+WT,DL,DR,top,top+.9,mat);bx(W/2-WT,W/2,DL,DR,top,top+.9,mat);
   bx(-W/2+1.6,-W/2+2.8,DR-4.2,DR-2.9,top,top+1.1,MAT.metal);bx(W/2-3.6,W/2-2.4,DL+2.6,DL+3.8,top,top+.8,MAT.metal)}
  /* furniture on every storey, one or two pieces per room, kept away from the door */
  for(let f=0;f<S;f++)for(const r of rooms){const rx=(r.x0+r.x1)/2,rz=(r.z0+r.z1)/2,y=Lv(f);
   if(sp.kind==='tower'||sp.kind==='office'){bx(rx-.6,rx+.7,rz-2.2,rz-1.4,y,y+.75,MAT.wood);bx(r.x0+.4,r.x0+.9,rz+1.6,rz+2.9,y,y+1.9,MAT.dark)}
   else{bx(rx-.9,rx+.9,rz-2.6,rz-1.4,y,y+.5,MAT.inner);bx(rx-.4,rx+.6,rz+1.4,rz+2.2,y,y+.75,MAT.wood)}}
 } else {
  /* single storey: a visual roof and a layout by kind (the door opens straight into the main room) */
  bx(-W/2+.15,W/2-.15,DL+.15,DR-.15,top,top+.25,MAT.roof,{col:false});
  if(sp.kind==='shop'||sp.kind==='kiosk'){
   bx(-W/2+WT,-W/2+.9,DL+.8,DR-.8,Y0,Y0+1.8,MAT.wood);bx(W/2-.9,W/2-WT,DL+.8,DR-.8,Y0,Y0+1.8,MAT.wood);   /* shelving */
   bx(-W/2+1.4,W/2-1.4,DL+2.2,DL+2.9,Y0,Y0+.95,MAT.wood);                                          /* counter */
   if(sp.kind==='shop'&&D>9){const pz=DR-3.5;bx(-W/2+WT,-.6,pz,pz+WT,Y0,top,mat);bx(.6,W/2-WT,pz,pz+WT,Y0,top,mat)}}
  else if(sp.kind==='house'){const pz=DL+D*.45;bx(-W/2+WT,-1.2,pz,pz+WT,Y0,top,mat);bx(1.2,W/2-WT,pz,pz+WT,Y0,top,mat);
   const zc=(pz+WT+DR-WT)/2;bx(W/6-WT/2,W/6+WT/2,pz+WT,zc-.6,Y0,top,mat);bx(W/6-WT/2,W/6+WT/2,zc+.6,DR-WT,Y0,top,mat);
   bx(-W/2+1.2,-W/2+2.9,DL+1.4,DL+3.0,Y0,Y0+.8,MAT.inner);bx(-W/2+1.2,-W/2+2.8,DR-3.2,DR-2.2,Y0,Y0+.6,MAT.wood);bx(W/6+.3,W/6+1.7,DR-3.2,DR-1.6,Y0,Y0+.75,MAT.wood)}
  else if(sp.kind==='big'){for(const lx of[-W/4,W/4])for(let lz=DL+3;lz<DR-3;lz+=5)bx(lx-.9,lx+.9,lz,lz+2.4,Y0,Y0+2.1,MAT.metal);
   bx(-W/2+1,-W/2+5,DL+1.6,DL+2.8,Y0,Y0+1,MAT.wood);bx(W/2-5,W/2-1,DL+1.6,DL+2.8,Y0,Y0+1,MAT.wood)}
  else if(sp.kind==='wh'){for(const lx of[-W/3,0,W/3])for(let lz=DL+4;lz<DR-4;lz+=6)bx(lx-1.1,lx+1.1,lz,lz+2.5,Y0,Y0+4.2,MAT.metal);
   bx(-W/2+.6,-W/2+2.4,DR-6,DR-3,Y0,Y0+1.1,MAT.wood)}
 }
 return{doorX,shaft,rooms,door:wp(doorX,DL+1.2),outside:wp(doorX,DL-2.2)}}
/* a building from a block offset. The door faces the street on the nearest block edge unless set */
function dirOf(ox,oz){if(Math.abs(ox)>Math.abs(oz))return ox<0?'W':'E';return oz<0?'N':'S'}
function placeBld(bcx,bcz,o){const dir=o.door||dirOf(o.ox,o.oz);
 const sp={W:o.W,D:o.D,S:o.S,kind:o.kind,fh:o.fh,roof:!!o.roof,shaft:!!o.shaft,k:DIRK[dir],wi:o.wi||0};
 const info=bld(bcx+o.ox,bcz+o.oz,sp);CITY.push({x:bcx+o.ox,z:bcz+o.oz,kind:o.kind,S:o.S,dir,W:o.W,D:o.D,shaft:info.shaft,door:info.door,outside:info.outside});return info}
/* ----- props ----- */
function pole(x,z,h,r){addBox(x-.1,FY,z-.1,.2,h,.2,MAT.metal,{col:false});circles.push({x,z,r:r||.25})}
function streetLight(x,z){pole(x,z,6.2,.25);addBox(x-.4,FY+6,z-.1,.8,.22,.22,MAT.metal,{col:false})}
function trafficLight(x,z){pole(x,z,4.6,.25);addBox(x-.25,FY+4.4,z-.15,.5,1.1,.3,MAT.blk,{col:false})}
function bench(x,z,yaw){const wide=Math.abs(Math.cos(yaw))>.5;addBox(x-(wide?.9:.25),FY,z-(wide?.25:.9),wide?1.8:.5,.5,wide?.5:1.8,MAT.wood)}
function bin(x,z){addBox(x-.35,FY,z-.35,.7,1.0,.7,MAT.metal)}
function barrier(x,z,len){addBox(x-len/2,FY,z-.3,len,.9,.6,MAT.barrier)}
function fence(x0,z0,x1,z1){const ax=Math.abs(z1-z0)<.01,len=Math.hypot(x1-x0,z1-z0),cx=(x0+x1)/2,cz=(z0+z1)/2;addBox(ax?cx-len/2:cx-.04,FY,ax?cz-.04:cz-len/2,ax?len:.08,1.4,ax?.08:len,MAT.metal,{occ:false})}
/* a car, rotated about the vertical axis. Collision: two circles at the axle line. wreck = dark and tilted. */
function car(x,z,yaw,wreck){const mt=wreck?MAT.blk:MAT.cars[(Math.abs(Math.round(x*7+z*3))%MAT.cars.length)],s=Math.sin(yaw),c=Math.cos(yaw);
 const put=(w,h,d,lx,ly,lz,m)=>{const me=new T.Mesh(BOX1,m);me.scale.set(w,h,d);me.rotation.y=yaw;me.position.set(x+lx*c+lz*s,FY+ly,z-lx*s+lz*c);me.castShadow=me.receiveShadow=true;world.add(me);occluders.push(me)};
 put(1.9,.7,4.4,0,.55,0,mt);put(1.7,.55,2.3,0,1.15,-.2,MAT.dark);
 circles.push({x:x+1.5*s,z:z+1.5*c,r:1.15},{x:x-1.5*s,z:z-1.5*c,r:1.15});CARS.push({x,z,yaw,wreck:!!wreck})}
function tree(x,z,s){TREES.push({x,z,s:s||1});circles.push({x,z,r:.32})}
function bush(x,z,s){BUSH.push({x,z,s:s||1})}
/* a base: a concrete wall round the 42 m block with one gate on the street side; tents, a hut, crates and sandbags inside */
function compound(cx,cz,gate){const h=2.0,t=1.0,g0=cz-4,g1=cz+4,wall=(x0,z0,x1,z1)=>addBox((x0+x1)/2,FY,(z0+z1)/2,x1-x0,h,z1-z0,MAT.barrier);
 wall(cx-21,cz-21,cx+21,cz-20);wall(cx-21,cz+20,cx+21,cz+21);
 if(gate==='E'){wall(cx-21,cz-21,cx-20,cz+21);wall(cx+20,cz-21,cx+21,g0);wall(cx+20,g1,cx+21,cz+21)}
 else{wall(cx+20,cz-21,cx+21,cz+21);wall(cx-21,cz-21,cx-20,g0);wall(cx-21,g1,cx-20,cz+21)}
 for(const[x,z]of[[cx+8,cz+8],[cx+14,cz+3]])addBox(x-2.8,FY,z-1.8,5.6,2.2,3.6,MAT.tent,{occ:true});
 addBox(cx+6,FY,cz-10,6,2.6,4,MAT.roof);
 for(let i=0;i<6;i++)addBox(cx-14+i*1.2,FY,cz+15,.9,.6,.9,MAT.sand);
 addBox(cx-17,FY,cz+17,1,1,1,MAT.wood);addBox(cx-15.6,FY,cz+17.4,.9,.9,.9,MAT.wood)}
/* one block: ground, buildings and props. Its meshes are merged into one mesh per material (fewer draw calls) */
function block(bi,bj,letter){const cx=BLK_C[bi],cz=BLK_C[bj],E=BLK_EDGE;
 let s=((bi+1)*7919+(bj+1)*104729)%2147483647;const rnd=()=>(s=(s*16807)%2147483647)/2147483647;
 const sv=world,occ0=occluders.length,G0=new T.Group();world=G0;
 const base=(letter==='G'||letter==='H'||letter==='R')?MAT.lawn:(letter==='N'||letter==='W')?MAT.sand:MAT.conc;
 patch(cx-E,cx+E,cz-E,cz+E,base,FY+.02);
 for(const sx of[-1,1])for(const sz of[-1,1])streetLight(cx+sx*(E-1.5),cz+sz*(E-1.5));
 const BD=[];const T1=o=>{const i=placeBld(cx,cz,o);BD.push(i.outside);return i};
 /* parked cars keep clear of every door approach in this block */
 const carSafe=(x,z,yaw,w)=>{if(BD.some(q=>Math.hypot(q[0]-x,q[1]-z)<4.6))return;car(x,z,yaw,w)};
 if(letter==='N'||letter==='W')compound(cx,cz,letter==='N'?'E':'W');
 if(letter==='D'){T1({ox:-6,oz:-4,W:20,D:22,S:8,kind:'tower',roof:true,shaft:true,wi:Math.floor(rnd()*5)});T1({ox:15,oz:-14,W:9,D:9,S:1,kind:'shop',wi:2});T1({ox:15,oz:4,W:9,D:12,S:1,kind:'shop',wi:1});
  if(Math.abs(cx)===30&&Math.abs(cz)===30)T1({ox:-Math.sign(cx)*17,oz:-Math.sign(cz)*17,W:6,D:6,S:1,kind:'kiosk',door:Math.sign(cx)>0?'W':'E',wi:3})}
 if(letter==='M'){T1({ox:-5,oz:0,W:20,D:22,S:5,kind:'office',roof:true,shaft:true,wi:4});T1({ox:15,oz:-14,W:9,D:9,S:1,kind:'shop',wi:0});T1({ox:15,oz:12,W:9,D:9,S:1,kind:'shop',wi:2})}
 if(letter==='R'){T1({ox:-8,oz:0,W:14,D:24,S:3,kind:'apt',roof:true,shaft:true,wi:Math.floor(rnd()*5)});T1({ox:12,oz:-14,W:9,D:8,S:1,kind:'house',wi:1});T1({ox:12,oz:12,W:9,D:8,S:1,kind:'house',wi:3})}
 if(letter==='H')for(const[ox,oz]of[[-12,-12],[12,-12],[-12,12],[12,12]])T1({ox,oz,W:9,D:8,S:1,kind:'house',wi:Math.floor(rnd()*5)});
 if(letter==='S')for(const ox of[-15.5,-5,5.5,16])T1({ox,oz:-14,W:10,D:8,S:1,kind:'shop',door:'N',wi:Math.floor(rnd()*5)});
 if(letter==='K'){T1({ox:-8,oz:0,W:26,D:32,S:1,kind:'big',fh:5,door:'W',wi:1});T1({ox:16,oz:-6,W:14,D:22,S:3,kind:'office',roof:true,shaft:true,wi:3})}
 if(letter==='I')T1({ox:0,oz:0,W:30,D:36,S:1,kind:'wh',fh:7,door:'N',wi:4});
 if(letter==='G')T1({ox:-16,oz:-14,W:6,D:5,S:1,kind:'kiosk',door:'S',wi:2});
 /* lots and yards, placed where no building stands */
 if(letter==='S'){patch(cx-19,cx+19,cz+6,cz+21,MAT.asph,FY+.03);car(cx-12,cz+12,0,false);car(cx-4,cz+15,0,false);car(cx+6,cz+12,0,true)}
 if(letter==='K'){patch(cx+7,cx+21,cz+8,cz+21,MAT.asph,FY+.03);car(cx+11,cz+13,0,false);car(cx+17,cz+16,0,false)}
 if(letter==='R'){patch(cx-19,cx-3,cz+14,cz+21,MAT.asph,FY+.03);car(cx-14,cz+17.5,Math.PI/2,false);car(cx-8,cz+17.5,Math.PI/2,false)}
 if(letter==='I'){barrier(cx+18,cz-9,4);barrier(cx+18,cz+9,4);for(const z of[-12,-4,4])addBox(cx+17.6,FY,cz+z-1.2,2.4,2.6,6,MAT.container[Math.abs(Math.round(z))%3]);
  fence(cx-22,cz-21,cx-22,cz+21);fence(cx+21,cz-21,cx+21,cz+21)}
 if(letter==='G'){patch(cx-3,cx+3,cz-22,cz+22,MAT.path,FY+.03);patch(cx-22,cx+22,cz-3,cz+3,MAT.path,FY+.03);
  for(let i=0;i<9;i++){const x=cx+(rnd()-.5)*38,z=cz+(rnd()-.5)*38;if(Math.abs(x-cx)>4||Math.abs(z-cz)>4)tree(x,z,.9+rnd()*.5)}
  for(let i=0;i<8;i++)bush(cx+(rnd()-.5)*40,cz+(rnd()-.5)*40,.8+rnd()*.5);bench(cx+8,cz+8,0);bench(cx-8,cz-8,Math.PI/2)}
 /* sidewalk furniture (on the outer 3 m ring) and parked cars in the street lane beside the block */
 if(letter==='D'||letter==='M'||letter==='S'){bench(cx+E-1.5,cz+8,0);bin(cx-E+1.5,cz-4);bin(cx+E-1.5,cz+4)}
 if(letter==='H'||letter==='R'||letter==='K'){tree(cx+E-1,cz,1+rnd()*.3);tree(cx-E+1,cz,1+rnd()*.3)}
 if(letter==='D'||letter==='M'||letter==='R'||letter==='S'||letter==='K'){
  if(rnd()<.8)carSafe(cx-E-2.2,cz+(rnd()-.5)*10,0,false);if(rnd()<.7)carSafe(cx+E+2.2,cz-6+rnd()*6,0,false);if(rnd()<.6)carSafe(cx+4+rnd()*6,cz-E-2.2,Math.PI/2,false);
  if(rnd()<.25)carSafe(cx+(rnd()-.5)*14,cz+E+2.2,Math.PI/2,true)}
 if(letter==='I'||letter==='N'||letter==='W'){if(rnd()<.6)carSafe(cx-E-2.2,cz+8,0,true)}
 world=sv;
 const mm=mergeMeshes(G0);for(const m of mm){m.castShadow=m.receiveShadow=true;if(m.material===MAT.glass)m.userData.glass=true}
 occluders.splice(occ0,occluders.length-occ0,...mm);world.add(...mm)}
/* streets: asphalt on each street line, dashed centre lines between the junctions */
function streets(){for(const c of STREET_C){patch(-186,186,c-STREET_HW,c+STREET_HW,MAT.asph,FY+.04);patch(c-STREET_HW,c+STREET_HW,-186,186,MAT.asph,FY+.04)}
 const dash=new T.InstancedMesh(BOX1,MAT.white,STREET_C.length*2*46),m4=new T.Matrix4(),q=new T.Quaternion(),sc=new T.Vector3(),p=new T.Vector3();let di=0;
 for(const c of STREET_C)for(const dir of[0,1])for(let t=-180;t<=180;t+=8){if(STREET_C.some(o=>Math.abs(o-t)<8))continue;
  const x=dir?c:t,z=dir?t:c;m4.compose(p.set(x,FY+.07,z),q,sc.set(dir?.15:2.4,.02,dir?2.4:.15));dash.setMatrixAt(di++,m4)}
 dash.count=di;dash.instanceMatrix.needsUpdate=true;dash.receiveShadow=true;world.add(dash)}
/* the map floor, the boundary walls (collision: nobody leaves the city) */
function ground(){const g=new T.PlaneGeometry(MAP_H*2,MAP_H*2);g.rotateX(-Math.PI/2);const m=new T.Mesh(g,MAT.lawn);m.position.y=FY;m.receiveShadow=true;world.add(m);
 const e=MAP_H-2,t=3,mE=MAT.walls[0];addBox(0,FY,-e,e*2+t,3,t,mE);addBox(0,FY,e,e*2+t,3,t,mE);addBox(-e,FY,0,t,3,e*2+t,mE);addBox(e,FY,0,t,3,e*2+t,mE)}
function ringAt(x,z,col,r0,r1){const m=new T.Mesh(new T.RingGeometry(r0,r1,36),new T.MeshBasicMaterial({color:col,transparent:true,opacity:.7,depthWrite:false}));m.rotation.x=-Math.PI/2;m.position.set(x,FY+.07,z);world.add(m)}
/* a base's flag and spawn marker (animated flags are kept in flags[]) */
function baseMarks(B){const flagTex=cvs(192,120,(g,w,h)=>{g.fillStyle=B.id==='nato'?'#1b3a73':'#a01c1c';g.fillRect(0,0,w,h);g.fillStyle='#f0f0f0';g.beginPath();g.arc(w/2,h/2,26,0,7);g.fill()});
 const pl=new T.Mesh(new T.CylinderGeometry(.06,.08,9,6),MAT.metal);pl.position.set(B.x+3,FY+4.5,B.z+2);post(pl);circles.push({x:B.x+3,z:B.z+2,r:.25});
 const f=new T.Mesh(new T.PlaneGeometry(2.9,1.8),new T.MeshBasicMaterial({map:flagTex,side:T.DoubleSide}));f.position.set(B.x+4.5,FY+7.8,B.z+2);f.userData.ph=flags.length*1.7;post(f);flags.push(f);
 const mk=new T.Mesh(new T.RingGeometry(1.15,1.45,32),new T.MeshBasicMaterial({color:B.id==='nato'?0x6f9be0:0xe05a4a,transparent:true,opacity:.8,depthWrite:false}));mk.rotation.x=-Math.PI/2;mk.position.set(B.spawn.x,FY+.08,B.spawn.z);post(mk)}
/* ----- the map ----- */
function buildWorld(){
 if(world){scene.remove(world);disposeG(world)}
 world=new T.Group();scene.add(world);boxes=[];circles=[];occluders=[];targets=[];flags=[];VEG=[];RAMPS=[];FOOT=[];TREES=[];BUSH=[];POST=[];CARS=[];CITY=[];seed=1337;
 MAT=mkMats();
 OCC_CAT=new Map();const cat=(m,c,R,col)=>OCC_CAT.set(m,{c,R,col});
 for(const m of MAT.walls)cat(m,'concrete',1e9,0xd8d2c0);cat(MAT.slab,'concrete',1e9,0xd8d2c0);cat(MAT.roof,'sheet',20000,0xffb050);
 cat(MAT.wood,'wood',1500,0xc9a06a);cat(MAT.sand,'sand',12000,0xcbbf98);cat(MAT.tent,'fabric',600,0xbfb9a0);cat(MAT.metal,'metal',40000,0xffb050);cat(MAT.barrier,'concrete',1e9,0xd8d2c0);
 ground();streets();
 for(let j=0;j<BLK_C.length;j++)for(let i=0;i<BLK_C.length;i++)block(i,j,DISTRICT[j][i]);
 /* trees and bushes as instanced meshes split into tiles for the distance cull; trunks collide through circles */
 if(TREES.length){const im=new T.InstancedMesh(CANOPY_G,MAT.leaf,TREES.length),tr=new T.InstancedMesh(TRUNK_G,MAT.bark,TREES.length),M4=new T.Matrix4(),Q=new T.Quaternion(),S3=new T.Vector3(),P3=new T.Vector3();
  TREES.forEach((t,i)=>{im.setMatrixAt(i,M4.compose(P3.set(t.x,FY+3.2*t.s,t.z),Q,S3.set(1.9*t.s,2.4*t.s,1.9*t.s)));tr.setMatrixAt(i,M4.compose(P3.set(t.x,FY+1.2*t.s,t.z),Q,S3.set(t.s,2.4*t.s,t.s)))});
  im.castShadow=tr.castShadow=true;im.receiveShadow=true;world.add(tr);VEG.push(...tileIM(im))}
 if(BUSH.length){const im=new T.InstancedMesh(CANOPY_G,MAT.leaf2,BUSH.length),M4=new T.Matrix4(),Q=new T.Quaternion(),S3=new T.Vector3(),P3=new T.Vector3();
  BUSH.forEach((b,i)=>im.setMatrixAt(i,M4.compose(P3.set(b.x,FY+.5*b.s,b.z),Q,S3.set(.9*b.s,.7*b.s,.9*b.s))));im.receiveShadow=true;world.add(im);VEG.push(...tileIM(im))}
 /* routes, triggers, resupply and capture-point rings: derived from the conquest points, so they are set here */
 RESUPPLY=[{id:'nato-base',name:'NATO BASE',x:BASES.nato.x,z:BASES.nato.z,r:3.2},{id:'wp-base',name:'WARSAW PACT BASE',x:BASES.wp.x,z:BASES.wp.z,r:3.2},...CQ_POINTS.map(p=>({id:'pt'+p.name,name:'POINT '+p.name,x:p.x,z:p.z,r:3.2}))];
 ROADS=[];for(const c of STREET_C){ROADS.push({t:'paved',p:[[-186,c],[186,c]]});ROADS.push({t:'paved',p:[[c,-186],[c,186]]})}
 VILLAGE_PLANS=[[-186,-60,186,-60],[-186,60,186,60],[-60,-186,-60,186],[60,-186,60,186]].map(l=>({lane:l}));
 for(const k of['nato','wp'])baseMarks(BASES[k]);
 for(const p of CQ_POINTS)ringAt(p.x,p.z,0x8fe0a0,2.6,3.1);
 for(const s of POST)world.add(s);POST.length=0}
