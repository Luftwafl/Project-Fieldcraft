
/* ============ factions, classes, weapon data ============ */
 const FACTIONS={
 nato:{id:'nato',name:'NATO',base:'nato',sleeve:0x5a5a3a,uni:0x596238,web:0x4a4632,helm:0x4b4f36,side:'m9',prim:{rifleman:'m16a2',assault:'m60e3',support:'m16a2'}},
 wp:{id:'wp',name:'WARSAW PACT',base:'wp',sleeve:0x5a613b,uni:0x6d6a48,web:0x4d4129,helm:0x5a5d55,side:'makarov',prim:{rifleman:'ak74',assault:'rpk74',support:'ak74'}}};
/* Class-limit framework: limits are configured here but NOT enforced (single human player, no teams in Stage 2). */
const CLASSES={
 rifleman:{name:'Rifleman',limit:Infinity,mags:5,gear:{nato:'M1956-pattern webbing, 2 ammunition pouches, canteen',wp:'Leather belt and Y-straps, 2 AK pouches, flask'}},
 assault:{name:'Assault',limit:2,mags:5,gear:{nato:'Light webbing, 2 compact pouches, canteen, assault pack',wp:'Bandolier, 1 AK pouch, flask, assault pack'}},
 support:{name:'Support',limit:2,mags:7,gear:{nato:'Webbing, 4 ammunition pouches, canteen, field radio',wp:'Belt and Y-straps, 4 AK pouches, flask, field radio'}}};
const SIDE_MAGS=3,ENFORCE_CLASS_LIMITS=false;
const classAvailable=(cls,teamCounts={})=>!ENFORCE_CLASS_LIMITS||(teamCounts[cls]||0)<CLASSES[cls].limit;
/* Weapon configuration. kick = pitch kick per shot (rad), side = random yaw kick, rec = visual recovery rate,
   hip/ads = spread half-angle (rad), mov = extra spread while moving, er = eye relief for ADS, hipPos = viewmodel hip position. */
const WD={
 /* vel = muzzle velocity (m/s), mass = projectile mass (kg); energy E = 1/2 m v^2 drives penetration */
 m16a2:{name:'M16A2',cal:'5.56x45mm',kind:'rifle',mag:30,rpm:800,modes:['SEMI','AUTO'],dm:0,reload:2.6,draw:.5,hol:.3,kick:.0085,side:.0024,rec:6.5,hip:.016,ads:.0012,mov:.014,adsFov:60,er:.26,hipPos:[.17,-.2,-.38],snd:{f:4300,g:.85,len:.16,th:115},fl:1,vel:930,mass:.0040,build:()=>buildM16(false)},
 m60e3:{name:'M60E3',cal:'7.62x51mm',kind:'rifle',mag:100,rpm:550,modes:['AUTO'],dm:0,reload:6.0,draw:.7,hol:.45,kick:.016,side:.005,rec:4.5,hip:.024,ads:.0024,mov:.02,adsFov:58,er:.3,hipPos:[.17,-.2,-.38],snd:{f:2400,g:1.05,len:.22,th:70},fl:1.5,vel:850,mass:.0095,reserveMags:3,build:buildM60},
 m9:{name:'Beretta M9',cal:'9x19mm',kind:'pistol',mag:15,rpm:400,modes:['SEMI'],dm:0,reload:2.0,draw:.35,hol:.22,kick:.02,side:.005,rec:9,hip:.013,ads:.0018,mov:.012,adsFov:64,er:.4,hipPos:[.1,-.14,-.34],snd:{f:3000,g:.9,len:.12,th:140},fl:.8,vel:380,mass:.0075,build:build1911},
 ak74:{name:'AK-74',cal:'5.45x39mm',kind:'rifle',mag:30,rpm:650,modes:['SEMI','AUTO'],dm:0,reload:2.8,draw:.5,hol:.3,kick:.0125,side:.0038,rec:5.8,hip:.019,ads:.0015,mov:.016,adsFov:60,er:.3,hipPos:[.17,-.2,-.38],snd:{f:2900,g:1,len:.18,th:90},fl:1.2,vel:900,mass:.0034,build:()=>buildAK(false)},
 rpk74:{name:'RPK-74',cal:'5.45x39mm',kind:'rifle',mag:45,rpm:600,modes:['AUTO'],dm:0,reload:3.0,draw:.6,hol:.4,kick:.0125,side:.0045,rec:5,hip:.022,ads:.0017,mov:.02,adsFov:58,er:.3,hipPos:[.17,-.2,-.38],snd:{f:2900,g:1.02,len:.19,th:88},fl:1.3,vel:900,mass:.0034,build:buildRPK},
 makarov:{name:'Makarov PM',cal:'9x18mm',kind:'pistol',mag:8,rpm:380,modes:['SEMI'],dm:0,reload:1.9,draw:.32,hol:.2,kick:.019,side:.0048,rec:9.5,hip:.015,ads:.002,mov:.012,adsFov:64,er:.4,hipPos:[.1,-.14,-.34],snd:{f:3500,g:.78,len:.1,th:150},fl:.7,vel:315,mass:.0063,build:buildMak}};
const MODE_LABEL={SEMI:'SEMI-AUTO',AUTO:'FULL AUTO'};

/* ============ first-person weapon models (procedural) ============ */
const GM={blk:L({color:0x1d1f21}),stl:L({color:0x373b3d}),gry:L({color:0x54595a}),wd:L({color:0x84552b}),wd2:L({color:0x5a371b}),pl:L({color:0x3a2a20}),skin:L({color:0xc39a7b}),slv:L({color:0x4a5133})};
const bg=(w,h,d)=>new T.BoxGeometry(w,h,d),cg=(a,b,l,s=8)=>{const g=new T.CylinderGeometry(a,b,l,s);g.rotateX(Math.PI/2);return g};
function pm(g,geo,mat,x,y,z,rx=0,ry=0,rz=0){const m=new T.Mesh(geo,mat);m.position.set(x,y,z);m.rotation.set(rx,ry,rz);g.add(m);return m}
const Zv=new T.Vector3(0,0,1);
function limb(g,a,b,w,mat){const A=new T.Vector3(...a),B=new T.Vector3(...b),d=B.clone().sub(A),len=d.length(),m=new T.Mesh(bg(w,w*.9,len),mat);m.position.copy(A).addScaledVector(d,.5);m.quaternion.setFromUnitVectors(Zv,d.normalize());g.add(m);return m}
/* rear ears + front post; the sight line (y = sy) is parallel to the bore, so ADS alignment is exact */
function sightSet(g,sy,zr,zf,gap,fh){const k=GM.blk,e=gap/2+.0025;
 pm(g,bg(.005,.026,.01),k,-e,sy+.003,zr);pm(g,bg(.005,.026,.01),k,e,sy+.003,zr);pm(g,bg(gap+.01,.006,.01),k,0,sy-.011,zr);pm(g,bg(.005,fh,.005),k,0,sy-fh/2,zf)}
function hands(root,o){const A=new T.Group();root.add(A);
 pm(A,bg(.056,.062,.09),GM.skin,...o.rh);limb(A,o.rh,o.rE,.085,GM.slv);
 const lh=new T.Group();A.add(lh);pm(lh,bg(.058,.05,.1),GM.skin,...o.lh);limb(lh,o.lh,o.lE,.085,GM.slv);return{arms:A,lh}}
function magGroup(b,x,y,z,parts){const g=new T.Group();g.position.set(x,y,z);b.add(g);for(const p of parts)pm(g,...p);return g}
function finish(root,b,arms,lh,mag,o){return{root,body:b,arms,lh,mag,magHome:mag.position.clone(),lhTo:o.lhTo,sight:o.sight,front:o.front,muz:o.muz,slide:o.slide||null}}

function buildM16(carb){const root=new T.Group(),b=new T.Group();root.add(b);const G=GM,sy=.098;
 pm(b,bg(.044,.054,.27),G.blk,0,0,0);pm(b,bg(.04,.07,.17),G.blk,0,-.06,.05);pm(b,bg(.024,.026,.2),G.blk,0,.05,-.005);pm(b,bg(.03,.04,.045),G.blk,0,.066,.095);
 pm(b,bg(.008,.032,.1),G.blk,0,-.098,.015);pm(b,bg(.034,.1,.05),G.blk,0,-.125,.098,-.3);
 let zf,mz,lz;
 if(!carb){pm(b,cg(.034,.034,.3,3),G.gry,0,.006,-.27,0,0,Math.PI);pm(b,cg(.0075,.0075,.5),G.stl,0,.012,-.38);pm(b,cg(.011,.011,.07,6),G.blk,0,.012,-.66);
  pm(b,bg(.022,.04,.035),G.blk,0,.03,-.54);zf=-.54;mz=-.7;lz=-.26;pm(b,bg(.042,.085,.3),G.blk,0,-.025,.27,.07)}
 else{pm(b,cg(.028,.028,.2,8),G.gry,0,.008,-.2);pm(b,cg(.0075,.0075,.3),G.stl,0,.012,-.27);pm(b,cg(.013,.013,.14,8),G.blk,0,.012,-.38);pm(b,cg(.016,.016,.03,6),G.blk,0,.012,-.455);
  pm(b,bg(.022,.04,.035),G.blk,0,.03,-.29);zf=-.29;mz=-.47;lz=-.19;pm(b,bg(.036,.045,.2),G.stl,0,.0,.23);pm(b,bg(.04,.085,.022),G.blk,0,-.022,.35,.1)}
 sightSet(b,sy,.095,zf,.01,.05);
 const mag=magGroup(b,0,-.11,-.035,[[bg(.032,.105,.065),G.blk,0,0,0],[bg(.036,.012,.07),G.gry,0,-.055,0]]);
 const h=hands(root,{rh:[0,-.12,.1],rE:[.07,-.3,.55],lh:[0,-.05,lz],lE:[-.3,-.3,.5]});
 return finish(root,b,h.arms,h.lh,mag,{lhTo:[0,-.03,-lz-.04],sight:[0,sy,.095],front:[0,sy,zf],muz:[0,.012,mz]})}

function buildAK(skel){const root=new T.Group(),b=new T.Group();root.add(b);const G=GM,sy=.092;
 pm(b,bg(.046,.075,.3),G.stl,0,0,0);pm(b,bg(.04,.022,.3),G.gry,0,.048,0);
 pm(b,bg(.044,.03,.2),G.wd,0,.04,-.265);pm(b,bg(.05,.045,.23),G.wd,0,-.012,-.27);pm(b,cg(.011,.011,.14),G.stl,0,.052,-.45);
 pm(b,cg(.009,.009,.42),G.stl,0,.014,-.5);pm(b,bg(.018,.055,.03),G.stl,0,.036,-.62);pm(b,cg(.013,.013,.06,6),G.blk,0,.014,-.7,0,0,0);
 pm(b,bg(.028,.04,.05),G.stl,0,.062,-.125);sightSet(b,sy,-.125,-.64,.014,.05);
 pm(b,bg(.036,.095,.05),G.pl,0,-.12,.095,-.3);pm(b,bg(.008,.032,.1),G.blk,0,-.098,.015);
 if(!skel)pm(b,bg(.04,.1,.3),G.wd,0,-.03,.29,.08);
 else{pm(b,bg(.012,.014,.3),G.stl,0,.005,.3,.02);pm(b,bg(.012,.014,.3),G.stl,0,-.07,.3,.12);pm(b,bg(.034,.1,.012),G.stl,0,-.035,.455,.08)}
 const mag=magGroup(b,0,-.075,-.05,[[bg(.03,.075,.066),G.stl,0,0,0,.12],[bg(.03,.07,.066),G.stl,0,-.07,-.018,.35],[bg(.032,.065,.068),G.stl,0,-.126,-.05,.6]]);
 const h=hands(root,{rh:[0,-.12,.1],rE:[.07,-.3,.55],lh:[0,-.055,-.27],lE:[-.3,-.3,.5]});
 return finish(root,b,h.arms,h.lh,mag,{lhTo:[0,-.04,.24],sight:[0,sy,-.125],front:[0,sy,-.64],muz:[0,.014,-.74]})}

function build1911(){const root=new T.Group(),b=new T.Group(),sl=new T.Group();root.add(b);b.add(sl);const G=GM,sy=.055;
 pm(sl,bg(.031,.034,.2),G.stl,0,.026,-.02);sightSet(sl,sy,.072,-.118,.008,.014);
 pm(b,bg(.03,.028,.19),G.stl,0,-.006,-.005);pm(b,cg(.008,.008,.05),G.blk,0,.026,-.135);pm(b,bg(.008,.022,.06),G.blk,0,-.03,-.03);
 pm(b,bg(.033,.105,.056),G.wd2,0,-.082,.062,-.2);pm(b,bg(.01,.02,.014),G.blk,0,.0,.098);
 const mag=magGroup(b,0,-.14,.07,[[bg(.024,.1,.04),G.stl,0,.045,0],[bg(.03,.012,.048),G.gry,0,-.005,0]]);
 const h=hands(root,{rh:[0,-.08,.062],rE:[.08,-.3,.5],lh:[-.03,-.075,.04],lE:[-.22,-.3,.5]});
 return finish(root,b,h.arms,h.lh,mag,{lhTo:[.02,-.03,.0],sight:[0,sy,.072],front:[0,sy,-.118],muz:[0,.026,-.15],slide:sl})}

function buildMak(){const root=new T.Group(),b=new T.Group(),sl=new T.Group();root.add(b);b.add(sl);const G=GM,sy=.05;
 pm(sl,bg(.026,.03,.155),G.stl,0,.02,-.02);sightSet(sl,sy,.052,-.09,.007,.014);
 pm(b,bg(.026,.028,.15),G.stl,0,-.004,-.012);pm(b,bg(.007,.022,.07),G.blk,0,-.028,-.025);
 pm(b,bg(.03,.09,.05),G.pl,0,-.07,.05,-.38);
 const mag=magGroup(b,0,-.118,.065,[[bg(.022,.085,.036),G.stl,0,.04,0],[bg(.028,.01,.044),G.gry,0,-.004,0]]);
 const h=hands(root,{rh:[0,-.07,.05],rE:[.08,-.3,.5],lh:[-.028,-.07,.03],lE:[-.22,-.3,.5]});
 return finish(root,b,h.arms,h.lh,mag,{lhTo:[.02,-.03,.0],sight:[0,sy,.052],front:[0,sy,-.09],muz:[0,.022,-.1],slide:sl})}

const WM={};
for(const id in WD){const d=WD[id],m=d.build();m.adsPos=[-m.sight[0],-m.sight[1],-d.er-m.sight[2]];m.root.visible=false;WM[id]=m}

/* HUD silhouettes (simple vector icons, muzzle to the right) */
function buildM60(){const root=new T.Group(),b=new T.Group();root.add(b);const G=GM,sy=.07,zr=-.1,zf=-.66;
 pm(b,bg(.05,.08,.34),G.blk,0,0,0);pm(b,bg(.036,.02,.3),G.gry,0,.05,0);pm(b,bg(.02,.03,.1),G.blk,0,.058,-.02);
 pm(b,bg(.044,.04,.22),G.wd,0,.005,-.27);pm(b,cg(.016,.016,.5),G.stl,0,.012,-.5);pm(b,bg(.03,.05,.06),G.stl,0,.0,-.66);
 sightSet(b,sy,zr,zf,.014,.04);
 limb(b,[0,-.02,-.55],[-.05,-.12,-.5],.012,G.stl);limb(b,[0,-.02,-.55],[.05,-.12,-.5],.012,G.stl);
 pm(b,bg(.036,.085,.26),G.wd,0,-.01,.28);pm(b,bg(.036,.095,.05),G.pl,0,-.12,.095,-.3);
 const mag=magGroup(b,0,-.06,-.02,[[bg(.05,.1,.16),G.gry,-.055,-.01,-.02],[bg(.02,.05,.16),G.stl,.02,-.03,-.02]]);
 const h=hands(root,{rh:[0,-.12,.1],rE:[.07,-.3,.55],lh:[0,-.04,-.3],lE:[-.3,-.3,.5]});
 return finish(root,b,h.arms,h.lh,mag,{lhTo:[0,-.04,.24],sight:[0,sy,zr],front:[0,sy,zf],muz:[0,.012,-.78]})}
function buildRPK(){const m=buildAK(false),G=GM,b=m.body;
 pm(b,cg(.009,.009,.16),G.stl,0,.014,-.83);limb(b,[0,-.03,-.6],[-.05,-.16,-.56],.012,G.stl);limb(b,[0,-.03,-.6],[.05,-.16,-.56],.012,G.stl);
 pm(m.mag,bg(.03,.05,.066),G.stl,0,-.16,-.04,.5);m.muz=[0,.014,-.84];return m}
const ICONS={
 m16a2:'<rect x="2" y="13" width="22" height="9" rx="1.5"/><rect x="24" y="12" width="26" height="10"/><rect x="28" y="8" width="18" height="4"/><path d="M50 12h24l1 8H50z"/><rect x="74" y="14.5" width="30" height="2.6"/><rect x="102" y="13" width="12" height="5.4"/><rect x="95" y="9" width="2.4" height="6"/><rect x="37" y="22" width="7" height="15" rx="1"/><path d="M26 22h6l3 12h-6z"/>',
 m60e3:'<path d="M2 12h22l-3 11H2z"/><rect x="24" y="12" width="28" height="9"/><rect x="52" y="13" width="22" height="9"/><rect x="52" y="10" width="30" height="3"/><rect x="74" y="14.5" width="30" height="2.4"/><rect x="102" y="13.4" width="8" height="4.6"/><rect x="96" y="9" width="3" height="6"/><path d="M38 21h9l6 8 1 8h-8l-3-9z"/><path d="M26 21h6l3 12h-6z"/>',
 m9:'<rect x="28" y="12" width="52" height="8" rx="1"/><rect x="32" y="20" width="44" height="5"/><path d="M33 25h13l-4 14H30z"/><rect x="78" y="14" width="6" height="3"/><rect x="26" y="9" width="3" height="4"/><rect x="76" y="9" width="2.4" height="3.4"/><rect x="48" y="25" width="2" height="6"/>',
 ak74:'<path d="M2 12h22l-3 11H2z"/><rect x="24" y="12" width="28" height="9"/><rect x="52" y="13" width="22" height="9"/><rect x="52" y="10" width="30" height="3"/><rect x="74" y="14.5" width="30" height="2.4"/><rect x="102" y="13.4" width="8" height="4.6"/><rect x="96" y="9" width="3" height="6"/><path d="M38 21h9l6 8 1 8h-8l-3-9z"/><path d="M26 21h6l3 12h-6z"/>',
 rpk74:'<rect x="1" y="12" width="3" height="13"/><rect x="4" y="12.5" width="21" height="2"/><rect x="4" y="19" width="21" height="2"/><rect x="24" y="12" width="28" height="9"/><rect x="52" y="13" width="22" height="9"/><rect x="52" y="10" width="30" height="3"/><rect x="74" y="14.5" width="30" height="2.4"/><rect x="102" y="13.4" width="8" height="4.6"/><rect x="96" y="9" width="3" height="6"/><path d="M38 21h9l6 8 1 8h-8l-3-9z"/><path d="M26 21h6l3 12h-6z"/>',
 makarov:'<rect x="34" y="13" width="44" height="8" rx="2"/><rect x="36" y="21" width="38" height="4.5"/><path d="M36 25h12l-6 13H29z"/><rect x="76" y="15" width="5" height="3"/><rect x="32" y="10" width="3" height="3.4"/><rect x="73" y="10" width="2.4" height="3.4"/><rect x="50" y="25" width="2" height="6"/>'};
/* builders for the Beta 0.2.5 roster (silhouettes reuse the closest existing icon; see README) */
