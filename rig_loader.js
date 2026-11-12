/* ---------- Rifleman rigs, per faction (0.4.0 pre-release 17, update 5): decode once, then build a fresh rig for each soldier ---------- */
const RIG_SRC={wp:{gltf:()=>RIG_WP_GLTF,bin:()=>RIG_WP_BIN,atlas:()=>RIG_WP_ATLAS},nato:{gltf:()=>RIG_NATO_GLTF,bin:()=>RIG_NATO_BIN,atlas:()=>RIG_NATO_ATLAS}};
const RIG_DATA={};
/* geometry and atlas are decoded once per faction and shared by every soldier of that faction */
function rigDecode(team){
 if(RIG_DATA[team])return RIG_DATA[team];
 const src=RIG_SRC[team],gj=src.gltf();
 const bytes=Uint8Array.from(atob(src.bin()),c=>c.charCodeAt(0));
 const dv=new DataView(bytes.buffer);
 const CS={5126:4,5123:2,5125:4,5121:1},CN={SCALAR:1,VEC2:2,VEC3:3,VEC4:4},CA={5126:Float32Array,5123:Uint16Array,5125:Uint32Array,5121:Uint8Array};
 const readAcc=i=>{const a=gj.accessors[i],bv=gj.bufferViews[a.bufferView],n=CN[a.type],sz=CS[a.componentType];
  const base=(bv.byteOffset||0)+(a.byteOffset||0),stride=bv.byteStride||sz*n,out=new CA[a.componentType](a.count*n);
  const get=p=>a.componentType===5126?dv.getFloat32(p,true):a.componentType===5123?dv.getUint16(p,true):a.componentType===5125?dv.getUint32(p,true):dv.getUint8(p);
  for(let k=0;k<a.count;k++)for(let c=0;c<n;c++)out[k*n+c]=get(base+k*stride+c*sz);
  return out};
 const geos=gj.meshes.map(m=>{const p=m.primitives[0],geo=new T.BufferGeometry();
  geo.setAttribute('position',new T.BufferAttribute(readAcc(p.attributes.POSITION),3));
  if(p.attributes.NORMAL!==undefined)geo.setAttribute('normal',new T.BufferAttribute(readAcc(p.attributes.NORMAL),3));
  if(p.attributes.TEXCOORD_0!==undefined)geo.setAttribute('uv',new T.BufferAttribute(readAcc(p.attributes.TEXCOORD_0),2));
  if(p.indices!==undefined)geo.setIndex(new T.BufferAttribute(readAcc(p.indices),1));
  return geo});
 const tex=new T.TextureLoader().load(src.atlas());tex.flipY=false;tex.colorSpace=T.SRGBColorSpace;
 RIG_DATA[team]={gltf:gj,geos,mat:L({map:tex,alphaTest:.05})};return RIG_DATA[team]}
/* hit part and damage zone from the node chain (the mesh's own name and its ancestors) */
function rigTag(chain){const has=re=>chain.some(n=>re.test(n));
 if(has(/Helmet|Chinstrap|SSh68|PASGT/))return{part:'head',zone:'head'};
 if(has(/Head|Neck/))return{part:'head',zone:null};
 if(has(/[Vv]est/))return{part:'body',zone:'vest'};
 if(has(/Arm|Hand|hand|[Ss]leeve|thumb|Leg|thigh|calf|boot|Shin|Foot|sole/))return{part:'limb',zone:null};
 return{part:'body',zone:null}}
/* two-bone arm: the shoulder (arm node), elbow and hand reach the target H, with the elbow bending toward the pole */
const RIG_DOWN=new T.Vector3(0,-1,0);
function rigLimb(R,i,H,pole){const arm=R.arms[i],fore=R.fore[i],hand=R.hand[i];
 const S=arm.position.clone(),r1=fore.position.clone().normalize(),L1=fore.position.length(),r2=hand.position.clone().normalize(),L2=hand.position.length();
 const d=H.clone().sub(S),D=Math.min(d.length(),(L1+L2)*.999),u=d.clone().normalize();
 const a=(L1*L1-L2*L2+D*D)/(2*D),h=Math.sqrt(Math.max(0,L1*L1-a*a));
 const pp=pole.clone().addScaledVector(u,-pole.dot(u)).normalize();
 const E=S.clone().addScaledVector(u,a).addScaledVector(pp,h);
 arm.quaternion.setFromUnitVectors(r1,E.clone().sub(S).normalize());
 const inv=arm.quaternion.clone().invert();
 fore.quaternion.setFromUnitVectors(r2,H.clone().sub(E).normalize().applyQuaternion(inv))}
/* the rifle: stock on the shoulder, muzzle up when carried, level and at the cheek when aiming. Hands go to the grip and handguard */
function rigPose(R,aim){
 const gun=R.gun,axis=(aim?new T.Vector3(-.2,.02,-.98):new T.Vector3(-.22,.42,-.88)).normalize();
 gun.quaternion.setFromUnitVectors(new T.Vector3(0,0,-1),axis);
 const Q=gun.quaternion,contact=aim?new T.Vector3(.16,1.52,.02):new T.Vector3(.17,1.40,0);
 const A=R.anchor,origin=contact.sub(A.stock.clone().applyQuaternion(Q));
 gun.position.copy(origin);
 const grip=A.grip.clone().applyQuaternion(Q).add(origin);
 const fg=A.fg.clone().applyQuaternion(Q).add(origin);
 rigLimb(R,1,grip,new T.Vector3(.6,-.5,.5));   /* trigger hand (left): pistol grip */
 rigLimb(R,0,fg,new T.Vector3(-.6,-.5,.5));    /* support hand (right): handguard */
 for(const h of R.head){h.rotation.set(aim?-.08:0,aim?-.12:0,0)} /* cheek to the stock: head turns and tips down */
}
/* one soldier's rig: a new node tree on the faction's shared geometry, with its rifle */
function rigBuild(team,cls){
 const D=rigDecode(team),gj=D.gltf,N=gj.nodes,objs=[],meshes=[],parent=[];
 N.forEach((n,i)=>(n.children||[]).forEach(c=>{parent[c]=i}));
 N.forEach(n=>{const o=n.mesh!==undefined?new T.Mesh(D.geos[n.mesh],D.mat):new T.Object3D();
  o.name=n.name||'';
  if(n.translation)o.position.fromArray(n.translation);
  if(n.rotation)o.quaternion.fromArray(n.rotation);
  if(n.scale)o.scale.fromArray(n.scale);
  objs.push(o)});
 N.forEach((n,i)=>(n.children||[]).forEach(c=>objs[i].add(objs[c])));
 const root=new T.Group();root.name='rig-'+team;
 for(const s of gj.scenes[0].nodes)root.add(objs[s]);
 N.forEach((n,i)=>{if(n.mesh===undefined)return;
  const chain=[];for(let k=i;k!==undefined;k=parent[k])chain.push(N[k].name||'');
  const t=rigTag(chain),m=objs[i];m.userData.part=t.part;if(t.zone)m.userData.zone=t.zone;
  m.castShadow=false;m.receiveShadow=false;meshes.push(m)});
 const byName=nm=>objs[N.findIndex(n=>n.name===nm)];
 const wid=FACTIONS[team].prim[cls],gun=new T.Group();gun.name='rig-gun';
 const gb=WM[wid].body.clone();gun.add(gb);root.add(gun);
 /* anchors from the rifle's real bounds (its body is normalised in scale): butt, grip and handguard */
 const bb=new T.Box3().setFromObject(gb),cx=(bb.min.x+bb.max.x)/2,cy=(bb.min.y+bb.max.y)/2;
 const anchor={stock:new T.Vector3(cx,cy,bb.max.z),grip:new T.Vector3(cx,bb.min.y+.05,bb.max.z-.32),fg:new T.Vector3(cx,bb.min.y+.175,bb.min.z+.39)}; /* pistol grip and forend, measured on the M16 body */
 gb.traverse(m=>{if(m.isMesh){m.castShadow=false;m.receiveShadow=false;m.userData.part='body';meshes.push(m)}});
 const R={root,meshes,gun,anchor,arms:[byName('RightArm'),byName('LeftArm')],fore:[byName('RightForeArm'),byName('LeftForeArm')],
  hand:[byName('RightHand'),byName('LeftHand')],head:[byName('Head'),byName('Helmet')],legs:[byName('RightLeg'),byName('LeftLeg')]};
 R.pose=aim=>rigPose(R,aim);
 return R}
