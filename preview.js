
/* ============ soldier model (class-selection preview; reusable for later AI stages) ============ */
/* 1980s woodland (M81-style) pattern: drawn once on a canvas with a fixed seed, so every rebuild is identical */
let camoSeed=7;const camoRnd=()=>(camoSeed=(camoSeed*16807)%2147483647)/2147483647;
const camoTex=cvs(256,256,(g,w,h)=>{g.fillStyle='#6b6a3e';g.fillRect(0,0,w,h);
 for(const[c,n]of[['#4d6b35',70],['#6e5530',60],['#a48f5e',45],['#2a2a20',30]]){g.fillStyle=c;
  for(let i=0;i<n;i++){const x=camoRnd()*w,y=camoRnd()*h,r=8+camoRnd()*22;g.beginPath();
   for(let k=0;k<7;k++){const a=k/7*6.2832,q=r*(.6+camoRnd()*.5),px=x+Math.cos(a)*q,py=y+Math.sin(a)*q;k?g.lineTo(px,py):g.moveTo(px,py)}
   g.closePath();g.fill()}}},2,2);
function buildSoldier(fk,ck){
 const F=FACTIONS[fk],nato=fk==='nato',g=new T.Group(),u=nato?L({map:camoTex}):L({color:F.uni}),web=L({color:F.web}),boot=L({color:0x1c1712}),helm=nato?L({map:camoTex}):L({color:F.helm}),dk=L({color:0x2b2f21}),G=GM;
 const part=(geo,mat,x,y,z,rx=0,ry=0,rz=0)=>pm(g,geo,mat,x,y,z,rx,ry,rz);
 for(const s of[-1,1]){part(bg(.15,.82,.17),u,s*.1,.5,0);part(bg(.16,.12,.27),boot,s*.1,.06,-.045)}
 part(bg(.42,.5,.24),u,0,1.16,0);if(nato)for(const s of[-1,1])part(bg(.1,.11,.02),u,s*.1,1.2,.135); /* M81 BDU chest pockets */part(bg(.45,.07,.26),web,0,.92,0);
 part(bg(.09,.08,.09),G.skin,0,1.44,0);part(new T.SphereGeometry(.105,12,9),G.skin,0,1.57,0);
 const hr=nato?.145:.138;
 const hg=new T.SphereGeometry(hr,14,8,0,Math.PI*2,0,Math.PI/2);if(nato)hg.scale(1.02,.82,1.1); /* PASGT: flatter, longer shell */
 part(hg,helm,0,1.6,0);
 part(new T.CylinderGeometry(hr+(nato?.05:.045),hr+(nato?.055:.02),nato?.014:.03,18),helm,0,1.6,0); /* SSh-68 flared rim */
 if(!nato)part(new T.CylinderGeometry(.1,.11,.06,12),u,0,1.42,0); /* Soviet stand-up collar */
 if(nato){ /* M1 helmet, H-harness, M1956 pouches + canteen */
  for(const s of[-1,1]){limb(g,[s*.13,1.4,-.13],[s*.11,.95,-.14],.05,web);limb(g,[s*.13,1.4,.13],[s*.1,.95,.14],.05,web)}
  const px=ck==='support'?[-.2,-.08,.08,.2]:[-.12,.12];
  for(const x of px)part(bg(ck==='assault'?.08:.1,.13,.06),web,x,.98,-.15);
  part(new T.CylinderGeometry(.045,.045,.15,10),L({color:0x5a5f3c}),.23,.88,.02);
 }else{ /* SSh-60, leather belt + Y-straps, AK pouches, flask */
  const lea=L({color:0x4a3322}),can=L({color:0x6a6540});
  part(bg(.46,.04,.27),lea,0,.93,0);
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
 limb(g,[.22,1.38,0],[.3,1.12,.02],aw,u);limb(g,[.3,1.12,.02],[.06,1.05,-.12],aw*.9,u);part(bg(.07,.07,.09),G.skin,.06,1.05,-.12);
 limb(g,[-.22,1.38,0],[-.27,1.1,-.12],aw,u);limb(g,[-.27,1.1,-.12],[.06,1.1,-.46],aw*.9,u);part(bg(.07,.07,.1),G.skin,.06,1.1,-.46);
 return g}

const prev={scene:new T.Scene(),cam:new T.PerspectiveCamera(32,1,.1,50),key:'',cur:null,cache:{},t:0};
prev.scene.background=new T.Color(0x12150e);
prev.scene.add(new T.HemisphereLight(0xe6ecf4,0x4a5232,2.2));
{const dl=new T.DirectionalLight(0xfff1dc,2.4);dl.position.set(2,3,3);prev.scene.add(dl);
 const disc=new T.Mesh(new T.CylinderGeometry(1.05,1.15,.06,36),L({color:0x1f2418}));disc.position.y=-.03;prev.scene.add(disc);
 prev.cam.position.set(0,1.15,4.9);prev.cam.lookAt(0,.95,0)}
function setPreview(fk,ck){const k=fk+ck;if(prev.key===k)return;prev.key=k;if(prev.cur)prev.scene.remove(prev.cur);prev.cur=prev.cache[k]||(prev.cache[k]=buildSoldier(fk,ck));prev.scene.add(prev.cur)}
