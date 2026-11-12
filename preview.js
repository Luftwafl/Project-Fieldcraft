
/* ============ soldier model (class-selection preview; reusable for later AI stages) ============ */
/* uniform camo: canvas patterns drawn once per faction with a fixed seed, so every rebuild is identical.
   NATO: US woodland (M81) browns, olives, black and tan. Warsaw Pact: green leaf pattern (reference photo). */
function camoPattern(seed,base,blobs){let st=seed;const rnd=()=>(st=(st*16807)%2147483647)/2147483647;
 return cvs(256,256,(g,w,h)=>{g.fillStyle=base;g.fillRect(0,0,w,h);
  for(const[c,n,rmin,rv]of blobs){g.fillStyle=c;
   for(let i=0;i<n;i++){const x=rnd()*w,y=rnd()*h,r=rmin+rnd()*rv;const sh=[];
    for(let k=0;k<9;k++){const a=k/9*6.2832,q=r*(.55+rnd()*.6);sh.push([Math.cos(a)*q,Math.sin(a)*q])}
    for(const ox of[-w,0,w])for(const oy of[-h,0,h]){g.beginPath();sh.forEach(([dx,dy],k)=>{const px=x+ox+dx,py=y+oy+dy;k?g.lineTo(px,py):g.moveTo(px,py)});g.closePath();g.fill()}}}},2,2)}
const CAMO={
 nato:camoPattern(7,"#9a7f52",[["#c4ac7a",44,18,34],["#4f5e35",50,16,34],["#33261a",38,14,28],["#14110c",22,8,15]]),
 wp:camoPattern(11,"#58773a",[["#9ab75c",62,12,26],["#2b4a22",58,11,24],["#6d5f35",28,9,18],["#d3cc8c",20,5,10]])};
/* ============ gear: helmets and vests (0.4.0 pre-release 17, update 4) ============
   Every helmet piece is tagged userData.zone='head' and every vest piece userData.zone='vest',
   so the coming damage system can map a hit to armour: helmet, vest, or bare body. */
const HELM_PROFILE={
 nato:[[.158,0],[.166,.02],[.169,.07],[.167,.11],[.16,.135],[.143,.157],[.113,.173],[.064,.183],[0,.187]], /* PASGT: flatter, longer shell */
 wp:[[.152,0],[.158,.01],[.16,.05],[.156,.09],[.143,.12],[.12,.146],[.083,.163],[.042,.171],[0,.174]]};   /* SSh-68: rounder dome, flared lower rim */
const HGEO={};
/* a lathe of the profile: the shell itself, or the camo cover a little larger over it */
function helmetGeo(fk,cover){const k=fk+(cover?'c':'');if(!HGEO[k]){const s=cover?1.035:1,dy=cover?.006:0;
 HGEO[k]=new T.LatheGeometry(HELM_PROFILE[fk].map(([r,y])=>new T.Vector2(r*s,y*s+dy)),28)}return HGEO[k]}
const GEAR={};
/* materials per faction, built once: the camo, the shell under it, straps, plate, pouches and flaps */
function gearMats(fk){if(GEAR[fk])return GEAR[fk];const nato=fk==='nato';
 return GEAR[fk]={cam:L({map:CAMO[fk]}),shell:L({color:nato?0x3b4330:0x3f4a2e}),strap:L({color:0x1d1a14}),
  plate:L({color:nato?0x2f3424:0x3a3b2a}),pouch:L({color:nato?0x3c4330:0x4a4d37}),flap:L({color:nato?0x262b1e:0x3a2f22}),lea:L({color:0x4a3322})}}
/* helmet: base at y=0, sits on the head; returns a group the caller positions */
function gearHelmet(fk,gm){const g=new T.Group();
 const add=(geo,mat)=>{const m=new T.Mesh(geo,mat);m.userData.zone='head';g.add(m);return m};
 add(helmetGeo(fk,false),gm.shell);add(helmetGeo(fk,true),gm.cam);
 for(const s of[-1,1]){const st=add(bg(.014,.13,.012),gm.strap);st.position.set(s*.105,-.045,.108);st.rotation.x=.2}
 return g}
/* ---------- rounded body shapes (0.4.0 pre-release 17, update 4): no boxes on the body ---------- */
const UNIT={};
const TORSO_P=[[.15,-.26],[.2,-.2],[.215,-.08],[.22,.04],[.2,.16],[.16,.25],[.1,.3],[.001,.32]]; /* chest, waist, shoulders */
const VEST_P=[[.2,-.13],[.23,-.08],[.238,.04],[.218,.16],[.18,.25],[.12,.305],[.001,.335]];     /* same chest, a little proud of it */
function uSph(){return UNIT.s||(UNIT.s=new T.SphereGeometry(1,16,12))}
/* ellipsoid: a unit sphere scaled to radii rx, ry, rz at (x,y,z) */
function ell(mat,x,y,z,rx,ry,rz){const m=new T.Mesh(uSph(),mat);m.position.set(x,y,z);m.scale.set(rx,ry,rz);return m}
/* capsule from a to b with radius r: limbs, rounded at both ends */
function capMesh(a,b,r,mat){const A=new T.Vector3(...a),B=new T.Vector3(...b),d=B.clone().sub(A),len=Math.max(.001,d.length()-2*r);
 UNIT.c=UNIT.c||{};const k=r.toFixed(3)+'_'+len.toFixed(3);const geo=UNIT.c[k]||(UNIT.c[k]=new T.CapsuleGeometry(r,len,6,12));
 const m=new T.Mesh(geo,mat);m.position.copy(A).addScaledVector(d,.5);m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.clone().normalize());return m}
function rod(g,a,b,r,mat){const m=capMesh(a,b,r,mat);g.add(m);return m}
function lathe(key,prof){return UNIT[key]||(UNIT[key]=new T.LatheGeometry(prof.map(([r,y])=>new T.Vector2(r,y)),22))}
/* torso: the chest lathe, narrower front to back than side to side */
function torsoMesh(mat,x,y,z){const m=new T.Mesh(lathe('t',TORSO_P),mat);m.position.set(x,y,z);m.scale.set(1,1,.62);return m}
/* the vest shell: the same chest, slightly larger, so it sits on the torso */
function vestMesh(mat,y){const m=new T.Mesh(lathe('v',VEST_P),mat);m.position.set(0,y,0);m.scale.set(1,1,.68);return m}

/* vest at absolute coordinates on the torso (torso centre y=1.16): a chest shell with plate, straps and pouches on it */
function gearVest(g,fk,gm){const nato=fk==='nato';
 const v=m=>{m.userData.zone='vest';g.add(m);return m};
 v(vestMesh(gm.cam,1.16));
 if(nato){ /* plate carrier: camo shell, dark front plate, shoulder yokes, collar, four magazine pouches with flaps */
  v(ell(gm.plate,0,1.17,.17,.15,.17,.035));
  for(const s of[-1,1])v(ell(gm.cam,s*.17,1.38,0,.12,.05,.18));
  v(ell(gm.cam,0,1.42,0,.13,.05,.12));
  for(const x of[-.15,-.05,.05,.15]){v(ell(gm.pouch,x,1.05,.175,.04,.065,.025));v(ell(gm.flap,x,1.12,.175,.045,.018,.03))}
 }else{ /* chest rig: leaf camo shell, four pouches, leather straps over the shoulders */
  for(const s of[-1,1])v(ell(gm.lea,s*.12,1.28,.165,.035,.16,.015));
  for(const x of[-.16,-.05,.05,.16]){v(ell(gm.pouch,x,1.04,.18,.042,.07,.03));v(ell(gm.flap,x,1.12,.18,.047,.018,.034))}
 }}

function buildSoldier(fk,ck){
 const limb=(gg,a,b,w,m)=>rod(gg,a,b,w*.55,m); /* limbs are capsules */
 const F=FACTIONS[fk],nato=fk==='nato',g=new T.Group(),gm=gearMats(fk),u=gm.cam,web=L({color:F.web}),boot=L({color:0x1c1712}),dk=L({color:0x2b2f21}),G=GM;
 const part=(geo,mat,x,y,z,rx=0,ry=0,rz=0)=>pm(g,geo,mat,x,y,z,rx,ry,rz);
 if(RIG_SRC[fk]){const W=rigBuild(fk,ck);g.add(W.root);g.userData.rig=W;W.pose(false);return g}
 for(const s of[-1,1]){rod(g,[s*.1,.92,0],[s*.1,.5,0],.076,u);rod(g,[s*.1,.5,0],[s*.1,.2,0],.064,u);g.add(ell(boot,s*.1,.07,-.02,.085,.06,.135))}
 g.add(ell(u,0,.98,0,.19,.1,.13));g.add(torsoMesh(u,0,1.16,0));for(const s of[-1,1])g.add(ell(u,s*.22,1.38,0,.1,.09,.1));if(nato)for(const s of[-1,1])part(bg(.1,.11,.02),u,s*.1,1.2,.135); /* M81 BDU chest pockets */
 g.add(ell(web,0,.93,0,.18,.03,.11));
 gearVest(g,fk,gm);
 rod(g,[0,1.36,0],[0,1.47,0],.05,G.skin);part(new T.SphereGeometry(.105,12,9),G.skin,0,1.57,0);
 const hm=gearHelmet(fk,gm);hm.position.set(0,1.56,0);g.add(hm);
 if(!nato)part(new T.CylinderGeometry(.1,.11,.06,12),u,0,1.42,0); /* Soviet stand-up collar */
 if(!nato)part(new T.SphereGeometry(.04,8,6),L({color:0x3a3e2a}),.2,.93,.08); /* grenade on the belt */
 if(nato){ /* M1 helmet, H-harness, M1956 pouches + canteen */
  for(const s of[-1,1]){limb(g,[s*.13,1.4,-.13],[s*.11,.95,-.14],.05,web);limb(g,[s*.13,1.4,.13],[s*.1,.95,.14],.05,web)}
  const px=ck==='support'?[-.2,-.08,.08,.2]:[-.12,.12];
  for(const x of px)part(bg(ck==='assault'?.08:.1,.13,.06),web,x,.98,-.15);
  part(new T.CylinderGeometry(.045,.045,.15,10),L({color:0x5a5f3c}),.23,.88,.02);
 }else{ /* SSh-60, leather belt + Y-straps, AK pouches, flask */
  const lea=L({color:0x4a3322}),can=L({color:0x6a6540});
  g.add(ell(lea,0,.93,0,.18,.03,.11));
  for(const s of[-1,1]){limb(g,[s*.12,1.4,-.13],[s*.02,.95,-.14],.04,lea);limb(g,[s*.12,1.4,.13],[s*.02,.95,.14],.04,lea)}
  if(ck==='assault'){limb(g,[-.2,1.4,-.14],[.2,.99,-.14],.07,can);part(bg(.14,.12,.06),can,.12,.99,-.15)}
  else{const px=ck==='support'?[-.2,-.08,.08,.2]:[-.1,.1];for(const x of px)part(bg(.12,.12,.06),can,x,.99,-.15)}
  part(new T.CylinderGeometry(.04,.04,.16,10),L({color:0x5a6040}),.2,.86,.13);
  if(ck==='support')part(bg(.2,.18,.07),can,-.23,.88,-.02);
 }
 if(ck==='support'){part(bg(.2,.28,.1),dk,0,1.2,.17);part(new T.CylinderGeometry(.006,.006,.7,5),dk,.1,1.62,.18)}
 if(ck==='assault')part(bg(.28,.24,.1),L({color:nato?0x3f452d:0x4c5236}),0,1.22,.17);
 /* weapon held at the chest */
 const wid=F.prim[ck],w=WM[wid].body.clone();w.position.set(.06,1.17,-.22);w.rotation.x=-.12;g.add(w);
 const hip=new T.Mesh(bg(.05,.12,.1),L({color:0x2a2218}));hip.position.set(-.22,.86,-.02);g.add(hip); /* sidearm holster */
 /* arms: shoulder -> elbow -> hand on grip / handguard */
 const aw=.08;
 limb(g,[.22,1.38,0],[.3,1.12,.02],aw,u);limb(g,[.3,1.12,.02],[.06,1.05,-.12],aw*.9,u);g.add(ell(G.skin,.06,1.05,-.12,.045,.042,.05));
 limb(g,[-.22,1.38,0],[-.27,1.1,-.12],aw,u);limb(g,[-.27,1.1,-.12],[.06,1.1,-.46],aw*.9,u);g.add(ell(G.skin,.06,1.1,-.46,.045,.042,.05));
 return g}

const prev={scene:new T.Scene(),cam:new T.PerspectiveCamera(32,1,.1,50),key:'',cur:null,cache:{},t:0};
prev.scene.background=new T.Color(0x12150e);
prev.scene.add(new T.HemisphereLight(0xe6ecf4,0x4a5232,2.2));
{const dl=new T.DirectionalLight(0xfff1dc,2.4);dl.position.set(2,3,3);prev.scene.add(dl);
 const disc=new T.Mesh(new T.CylinderGeometry(1.05,1.15,.06,36),L({color:0x1f2418}));disc.position.y=-.03;prev.scene.add(disc);
 prev.cam.position.set(0,1.15,4.9);prev.cam.lookAt(0,.95,0)}
function setPreview(fk,ck){const k=fk+ck;if(prev.key===k)return;prev.key=k;if(prev.cur)prev.scene.remove(prev.cur);prev.cur=prev.cache[k]||(prev.cache[k]=buildSoldier(fk,ck));prev.scene.add(prev.cur)}
