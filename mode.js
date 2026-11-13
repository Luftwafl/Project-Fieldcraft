/* ---------- wallet, gunsmith, conquest (single player), scope overlay and full map ---------- */
/* Beta 0.5.0: optics are off (the player is modelling the scopes). Set to true to bring the red dot and scopes back: buying, equipping and the models all follow it. */
const SCOPES_ON=false;
const SCOPES=[
 {id:'iron',name:'Iron sights (standard)',price:0,zoom:1,dot:false,desc:'The standard rear and front sights. Always owned.'},
 {id:'dot',name:'1x red dot',price:400,zoom:1,dot:true,desc:'A red dot at normal magnification. Quick to put on target.'},
 {id:'s3',name:'3x scope',price:900,zoom:3,dot:false,desc:'Magnifies the view three times while aiming down sights.'},
 {id:'s6',name:'6x scope',price:1800,zoom:6,dot:false,desc:'Magnifies the view six times. Narrow field of view.'}];
const MONEY={kill:100,capture:200,winMatch:1000,lossMatch:250};
const WALLET_KEY='fc2_wallet';
/* Each rifle that can take an optic is a separate gun: its own owned optics and equipped optic.
   Gunsmith is only reached from the class menu, for the primary weapon of the chosen faction and class. */
const GUN_IDS=['m16a2','m60e3','ak74','rpk74'];
function cleanGuns(src){const out={};if(src&&typeof src==='object')for(const k of Object.keys(src)){if(!/^[a-z0-9]{2,12}$/.test(k)||Object.keys(out).length>=20)continue;
 const g=src[k]||{},o={owned:{iron:true},eq:'iron'};for(const s of SCOPES)if(g.owned&&g.owned[s.id])o.owned[s.id]=true;
 if(SCOPES.some(s=>s.id===g.eq)&&o.owned[g.eq])o.eq=g.eq;out[k]=o}return out}
/* older saves kept one scope list for everything: copy it to each gun once */
function migrateLegacy(d,j){for(const id of GUN_IDS){const g=d.guns[id]||{owned:{iron:true},eq:'iron'};
 for(const s of SCOPES)if(j.owned[s.id])g.owned[s.id]=true;if(SCOPES.some(s=>s.id===j.eq)&&g.owned[j.eq])g.eq=j.eq;d.guns[id]=g}}
function walletFrom(j){const d={cash:0,guns:{},stats:{kills:0,captures:0,wins:0,matches:0}};
 if(j&&typeof j==='object'){d.cash=Math.max(0,Math.floor(+j.cash||0));if(j.stats&&typeof j.stats==='object')Object.assign(d.stats,j.stats);
  d.guns=cleanGuns(j.guns);if(j.owned&&typeof j.owned==='object'&&!j.guns)migrateLegacy(d,j)}
 return d}
function loadWallet(){try{return walletFrom(JSON.parse(localStorage.getItem(WALLET_KEY)||'null'))}catch(e){return walletFrom(null)}}
let WALLET=loadWallet();
function saveWallet(){try{localStorage.setItem(WALLET_KEY,JSON.stringify(WALLET))}catch(e){}accSaveSoon()}
function earn(n,why){WALLET.cash+=n;saveWallet();if(why)setNotice(why+'  +$'+n,2.2)}
const primId=()=>FACTIONS[sel.f].prim[sel.c];
const gunW=id=>{if(!WALLET.guns[id])WALLET.guns[id]={owned:{iron:true},eq:'iron'};return WALLET.guns[id]};
const scopeFor=id=>{if(!SCOPES_ON)return SCOPES[0];const g=gunW(id);return SCOPES.find(s=>s.id===g.eq)||SCOPES[0]};
const scopeDef=()=>scopeFor(primId());
function buyScope(id,gid){if(!SCOPES_ON)return false;const s=SCOPES.find(x=>x.id===id),g=gunW(gid);if(!s||g.owned[id]||WALLET.cash<s.price)return false;WALLET.cash-=s.price;g.owned[id]=true;saveWallet();return true}
function equipScope(id,gid){if(!SCOPES_ON)return false;const g=gunW(gid);if(!g.owned[id])return false;g.eq=id;saveWallet();return true}
/* optics on the gun model: a red dot or a scope on the rifle's sight rail, only the equipped one is shown */
const OPT_MOUNT={dot:.03,s3:.042,s6:.042};
function buildOptic(kind,L){const g=new T.Group(),G=GM;const BLK2=new T.MeshStandardMaterial({color:0x111311,roughness:.6,metalness:.2,side:T.DoubleSide});const LENS=new T.MeshStandardMaterial({color:0x0b1d2a,roughness:.05,metalness:.2,transparent:true,opacity:.3,depthWrite:false});
 if(kind==='dot'){pm(g,bg(.036,.05,.085),G.blk,0,0,0);pm(g,bg(.03,.012,.06),G.blk,0,-.03,0);
  pm(g,new T.CircleGeometry(.014,16),LENS,0,0,-.0425-.001,0,Math.PI,0);pm(g,new T.CircleGeometry(.014,16),LENS,0,0,.0425+.001,0,0,0);return g}
 const r=.018,cy=Math.PI/2;
 pm(g,new T.CylinderGeometry(r,r,L,14,1,true),BLK2,0,0,0,cy,0,0);                                  /* main tube */
 pm(g,new T.CylinderGeometry(r*1.35,r*1.35,.04,14,1,true),BLK2,0,0,-L/2+.02,cy,0,0);              /* objective bell */
 pm(g,new T.CylinderGeometry(r*1.2,r*1.2,.03,14,1,true),BLK2,0,0,L/2-.015,cy,0,0);                /* eyepiece ring */
 pm(g,new T.CircleGeometry(r*1.25,16),LENS,0,0,-L/2-.002,0,Math.PI,0);                       /* front lens */
 pm(g,new T.CircleGeometry(r*1.05,16),LENS,0,0,L/2+.002,0,0,0);                              /* rear lens */
 pm(g,new T.CylinderGeometry(.008,.008,.035,8),G.blk,0,r+.012,0);                             /* elevation turret */
 pm(g,bg(.035,.012,.05),G.blk,0,-r-.004,0);                                                   /* mount */
 return g}
/* build the optic models once for each rifle, hanging them on the sight line (root space) */
for(const id of GUN_IDS){const m=WM[id];if(!m)continue;const og=new T.Group();og.position.set(0,m.sight[1],m.sight[2]);m.root.add(og);
 m.adsBase=m.adsPos.slice();m.optics={};
 const parts={dot:buildOptic('dot'),s3:buildOptic('s3',.2),s6:buildOptic('s6',.27)};
 for(const k in parts){parts[k].position.y=OPT_MOUNT[k];parts[k].visible=false;og.add(parts[k]);m.optics[k]=parts[k]}}
/* show the optic that the gun has equipped and raise the aim point to match it */
const OPT_LEN={s3:.2,s6:.27},EYE_RELIEF_SCOPE=.09;
function applyOptic(id){const m=WM[id];if(!m||!m.optics)return;const k=scopeFor(id).id;const key=k==='iron'?null:k;
 for(const n in m.optics)m.optics[n].visible=(n===key);
 m.adsPos[0]=m.adsBase[0];m.adsPos[1]=m.adsBase[1]-(key?OPT_MOUNT[key]:0);m.adsPos[2]=m.adsBase[2];
 /* a scope is held at real eye relief: the eyepiece sits about 9 cm from the eye, not at the iron-sight distance */
 if(OPT_LEN[key])m.adsPos[2]=-EYE_RELIEF_SCOPE-(m.sight[2]+OPT_LEN[key]/2)}
/* aiming: the primary weapon's ADS field of view follows the equipped scope */
/* scopes magnify while aiming, with no lens overlay: the view is only zoomed. The scope models are placeholders until the player's own models replace them. */
function adsFovFor(base){const s=scopeDef();return s.zoom>1?70/s.zoom:base}
function scopeHud(){const s=scopeDef(),prim=W.cur===0;const dot=document.getElementById('dotov');
 if(dot)dot.classList.toggle('on',prim&&W.adsK>.5&&s.dot)}
/* Gunsmith screen (layout follows the reference photo). Only the optic slot works in this build; the other slots are drawn but locked. */
const GSM_SLOTS=[
 {id:'optic',name:'Optic',x:22,y:6,ax:40,ay:44,live:SCOPES_ON},
 {id:'hand',name:'Handguard',x:50,y:6,ax:62,ay:47},
 {id:'muzzle',name:'Muzzle',x:78,y:6,ax:88,ay:47},
 {id:'stock',name:'Stock',x:22,y:74,ax:16,ay:50},
 {id:'grip',name:'Grip',x:50,y:74,ax:42,ay:57},
 {id:'mag',name:'Magazine',x:78,y:74,ax:56,ay:58}];
let GSM_SLOT='optic',GSM_PICK=null;
function renderGunsmith(){
 const gid=primId(),d=WD[gid],g=gunW(gid),cur=scopeFor(gid);
 document.getElementById('gGunName').textContent=d.name.toUpperCase();
 document.getElementById('gCash').textContent=WALLET.cash.toLocaleString('en-US');
 document.getElementById('gStatRows').innerHTML=[['Fire mode',d.modes.join(', ')],['Fire rate',d.rpm+' RPM'],['Caliber',d.cal],['Capacity',d.mag],['Muzzle velocity',d.vel+' m/s'],['Optic',cur.name]]
  .map(r=>'<div class="gs-row"><span>'+r[0]+'</span><b>'+r[1]+'</b></div>').join('');
 const st=WALLET.stats;document.getElementById('gStats').textContent='Kills '+st.kills+'  /  Captures '+st.captures+'  /  Wins '+st.wins+' of '+st.matches+' matches';
 const optTop=cur.id==='iron'?'':(cur.dot?'<rect x="50" y="6" width="14" height="5" rx="1" fill="#1d1f1d"/>':'<rect x="40" y="2" width="30" height="7" rx="2" fill="#1d1f1d"/>');
 document.getElementById('gGun').innerHTML='<svg viewBox="0 0 120 40" preserveAspectRatio="xMidYMid meet" fill="#c9cdbd" aria-hidden="true">'+(ICONS[gid]||ICONS.ak74)+optTop+'</svg>';
 /* slots and leader lines */
 const SL=document.getElementById('gSlots'),LN=document.getElementById('gLines');SL.innerHTML='';LN.innerHTML='';
 for(const s of GSM_SLOTS){
  const b=document.createElement('button');b.type='button';b.className='gs-slot'+(s.live?'':' lock')+(GSM_SLOT===s.id?' sel':'');
  b.style.left=(s.x-14)+'%';b.style.top=s.y+'%';
  const sm=document.createElement('small');sm.textContent=s.name;const bb=document.createElement('b');bb.textContent=s.live?cur.name:'Not in this build';
  b.appendChild(sm);b.appendChild(bb);
  b.onclick=()=>{GSM_SLOT=s.id;GSM_PICK=null;renderGunsmith()};SL.appendChild(b);
  const ln=document.createElementNS('http://www.w3.org/2000/svg','line');
  ln.setAttribute('x1',s.x);ln.setAttribute('y1',s.y<50?21:74);ln.setAttribute('x2',s.ax);ln.setAttribute('y2',s.ay);LN.appendChild(ln)}
 /* change-attachment panel for the chosen slot */
 const slot=GSM_SLOTS.find(x=>x.id===GSM_SLOT);
 document.getElementById('gSlotName').textContent=slot.name.toUpperCase();
 const L=document.getElementById('gList');L.innerHTML='';
 if(slot.live){
  for(const s of SCOPES){
   const owned=!!g.owned[s.id],eq=g.eq===s.id,can=owned||WALLET.cash>=s.price;
   const t=document.createElement('button');t.type='button';t.className='gs-tile'+(eq?' eq':'')+(GSM_PICK===s.id?' pick':'')+(!owned&&!can?' poor':'');
   const name=document.createElement('b');name.textContent=s.name;const stt=document.createElement('span');stt.className=eq?'st':'pr';
   if(eq){const q=document.createElement('i');q.className='sq';stt.appendChild(q);stt.appendChild(document.createTextNode('EQUIPPED'))}
   else if(owned){stt.className='st';stt.textContent='OWNED'}
   else stt.textContent='$'+s.price.toLocaleString('en-US');
   t.appendChild(name);t.appendChild(stt);
   t.onclick=()=>{GSM_PICK=s.id;if(!owned&&can)buyScope(s.id,gid);if(g.owned[s.id]&&g.eq!==s.id)equipScope(s.id,gid);applyOptic(gid);renderGunsmith()};
   L.appendChild(t)}
  const p=SCOPES.find(x=>x.id===(GSM_PICK||g.eq))||SCOPES[0];
  document.getElementById('gDesc').textContent=p.name+': '+p.desc+(p.price&&!g.owned[p.id]?' Price $'+p.price.toLocaleString('en-US')+'.':'');
 }else{
  document.getElementById('gDesc').textContent='The '+slot.name.toLowerCase()+' slot is drawn for the layout. This build has no parts for it yet.';
 }}

/* ---------- conquest, single player (the same rules as the multiplayer server, see conquest.js) ---------- */
let CQS=null,MATCH=null;
function cqBeginSP(){CQS=cqNew(CQ_POINTS);MATCH={kills:0,captures:0,money:0};cqHud(CQS);cqHide(false)}
function cqUnitsSP(){const u=[];for(const c of CH.all)if(c.kind==='soldier')u.push({team:c.team,x:c.x,z:c.z,alive:c.state!=='dead'});
 if(P.hp>0)u.push({team:CH.playerTeam,x:P.x,z:P.z,alive:true});return u}
function cqUpdateSP(dt){if(!CQS||CQS.over)return;const ev=cqStep(CQS,cqUnitsSP(),dt);
 for(const e of ev){if(e.type==='capture'){if(e.team===CH.playerTeam){MATCH.captures++;WALLET.stats.captures++;MATCH.money+=MONEY.capture;earn(MONEY.capture,'CAPTURED '+e.name)}else setNotice(e.name+' TAKEN BY THE ENEMY',2.5)}}
 cqHud(CQS);if(CQS.over)cqEndSP()}
function cqEndSP(){const win=CQS.over.winner===CH.playerTeam,m=win?MONEY.winMatch:MONEY.lossMatch;
 MATCH.money+=m;WALLET.stats.matches++;if(win)WALLET.stats.wins++;earn(m,win?'MATCH WON':'MATCH LOST');
 pause();view('');cqShowResults({winner:CQS.over.winner,you:{kills:MATCH.kills,captures:MATCH.captures,money:MATCH.money},win,mp:false})}
function onPlayerKill(c){if(!MATCH||NET.on)return;if(c.kind==='soldier'){MATCH.kills++;WALLET.stats.kills++;earn(MONEY.kill,'KILL')}}

/* results panel shared by single and multiplayer */
function cqShowResults(r){const el=document.getElementById('matchend');const name=t=>t==='nato'?'NATO':'WARSAW PACT';
 document.getElementById('meTitle').textContent=r.win?'VICTORY':'DEFEAT';
 document.getElementById('meWin').textContent=name(r.winner)+' holds the field';
 document.getElementById('meYou').innerHTML='Kills <b>'+r.you.kills+'</b>&nbsp;&nbsp;Captures <b>'+r.you.captures+'</b>&nbsp;&nbsp;Earned <b>$'+r.you.money.toLocaleString('en-US')+'</b>';
 document.getElementById('meAgain').style.display=r.mp?'none':'';
 el.classList.add('on')}
function cqHide(){const el=document.getElementById('matchend');if(el)el.classList.remove('on')}
/* top bar: tickets and the three points (controller colour; a bar shows capture progress) */
function cqHud(S){const el=document.getElementById('cq');if(!el||!S)return;
 document.getElementById('cqCash').textContent='$'+WALLET.cash.toLocaleString('en-US');const t=(v)=>Math.ceil(v);document.getElementById('cqN').textContent=t(S.tickets.nato);document.getElementById('cqW').textContent=t(S.tickets.wp);
 const row=document.getElementById('cqP');if(row.childElementCount!==S.points.length){row.innerHTML='';for(const p of S.points){const d=document.createElement('div');d.className='cqpt';d.innerHTML='<span></span><i></i>';row.appendChild(d)}}
 S.points.forEach((p,i)=>{const d=row.children[i];d.querySelector('span').textContent=p.name;d.className='cqpt '+(p.owner||'none');d.querySelector('i').style.width=(p.capTeam?Math.round(p.prog*100):0)+'%';d.dataset.cap=p.capTeam||''})}

let SHOOTER=null;
/* minimap: allies (and the capture points) inside the round map */
function allyDots(g,toM,C){const S=CQS||(NET&&NET.on&&NET.cq)||null;
 if(S)for(const p of S.points){const[x,y]=toM(p.x,p.z);g.beginPath();g.arc(x,y,5,0,7);g.fillStyle=p.owner==='nato'?'#6f9be0':p.owner==='wp'?'#e05a4a':'#c8c8b0';g.fill();g.strokeStyle='#10130a';g.lineWidth=1;g.stroke()}
 for(const a of allyMarks()){const[x,y]=toM(a.x,a.z);g.beginPath();g.arc(x,y,a.leader?4.5:3.2,0,7);g.fillStyle=CH.playerTeam==='nato'?'#8fb0ff':'#ff8a7a';g.fill();g.strokeStyle='#10130a';g.lineWidth=1;g.stroke();
  if(a.leader){g.strokeStyle='#ffd35a';g.lineWidth=1.5;g.beginPath();g.arc(x,y,7,0,7);g.stroke()}}}
/* full map: the whole battlefield with capture points, bases and allies. Enemies are not shown. */
let FMAP=false;
function allyMarks(){const out=[];for(const c of CH.all)if(c.kind==='soldier'&&c.team===CH.playerTeam&&c.state!=='dead')out.push({x:c.x,z:c.z,leader:!!c.isLeader,name:''});
 if(NET&&NET.on)for(const a of NET.players.values())if(a.id!==NET.id&&a.alive&&a.team===CH.playerTeam)out.push({x:a.x,z:a.z,leader:false,name:a.name,human:true});return out}
function toggleFullMap(){if(state!=='play'&&!FMAP)return;FMAP=!FMAP;const el=document.getElementById('fmap');el.classList.toggle('on',FMAP);
 if(FMAP){clearInput();if(document.pointerLockElement)document.exitPointerLock();drawFullMap()}else if(!touch)lock()}
function drawFullMap(){if(!FMAP)return;const cv=document.getElementById('fmc');const size=Math.floor(Math.min(innerWidth*.9,innerHeight*.82));
 if(cv.width!==size){cv.width=size;cv.height=size}
 const g=cv.getContext('2d'),C=size;if(!mmBase)mmBase=buildMinimapBase();g.drawImage(mmBase,0,0,C,C);
 const px=x=>(x+MAP_H)/(2*MAP_H)*C,pz=z=>(z+MAP_H)/(2*MAP_H)*C,pr=r=>r*C/(2*MAP_H),col=t=>t==='nato'?'#6f9be0':t==='wp'?'#e05a4a':'#c8c8b0';
 g.font='bold 12px sans-serif';g.textAlign='center';g.textBaseline='middle';
 for(const b of[['NATO',BASES.nato],['WARSAW PACT',BASES.wp]]){g.fillStyle='#f0ecd0';g.fillText(b[0],px(b[1].x),pz(b[1].z)-14)}
 const S=CQS||(NET&&NET.on&&NET.cq)||null;
 if(S)for(const p of S.points){const x=px(p.x),z=pz(p.z),r=pr(CQ.R);g.beginPath();g.arc(x,z,r,0,7);g.fillStyle=p.owner==='nato'?'rgba(111,155,224,.35)':p.owner==='wp'?'rgba(224,90,74,.35)':'rgba(200,200,176,.2)';g.fill();
  g.lineWidth=2;g.strokeStyle=col(p.owner);g.stroke();
  if(p.capTeam){g.beginPath();g.arc(x,z,r+4,-Math.PI/2,-Math.PI/2+Math.PI*2*p.prog);g.strokeStyle=col(p.capTeam);g.lineWidth=3;g.stroke()}
  g.fillStyle='#f0ecd0';g.font='bold 13px sans-serif';g.fillText(p.name,x,z);g.font='bold 12px sans-serif'}
 for(const a of allyMarks()){const x=px(a.x),z=pz(a.z);g.beginPath();g.arc(x,z,a.leader?6:4.5,0,7);g.fillStyle=CH.playerTeam==='nato'?'#8fb0ff':'#ff8a7a';g.fill();
  g.lineWidth=1.5;g.strokeStyle='#10130a';g.stroke();if(a.leader){g.strokeStyle='#ffd35a';g.lineWidth=2;g.beginPath();g.arc(x,z,9,0,7);g.stroke()}
  if(a.human&&a.name){g.fillStyle='#f0ecd0';g.font='11px sans-serif';g.fillText(a.name,x,z-9);g.font='bold 12px sans-serif'}}
 g.save();g.translate(px(P.x),pz(P.z));g.rotate(Math.atan2(-Math.sin(P.yaw),-Math.cos(P.yaw))+Math.PI);g.fillStyle='#ffd35a';g.beginPath();g.moveTo(0,-9);g.lineTo(6,6);g.lineTo(0,3);g.lineTo(-6,6);g.closePath();g.fill();g.restore();
 const lg=document.getElementById('fmLegend');if(lg)lg.textContent='Blue and red dots: your side. Gold ring: squad leader. Enemy positions are not shown.'}

/* ---------- inventory (I), admin panel (O), room chat (T) ---------- */
let INV=false;
const CHAT={on:false,max:40};
const invEsc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const uiLock=()=>FMAP||INV||CHAT.on||document.getElementById('admPanel').classList.contains('on');
function toggleInv(){if(!INV&&state!=='play')return;INV=!INV;document.getElementById('inv').classList.toggle('on',INV);
 if(INV){clearInput();invRender();if(document.pointerLockElement)document.exitPointerLock()}}
function invRender(){const L=document.getElementById('invBody');if(!L||!W||!W.slots)return;
 let h='<div class="inv-sec"><div class="inv-h">LOADOUT</div>';
 W.slots.forEach((s,i)=>{h+=`<div class="inv-row${i===W.cur?' cur':''}"><span>${i===0?'PRIMARY':'SIDEARM'}</span><b>${invEsc(s.def.name)}</b><i>${s.mag} / ${s.res}</i></div>`});
 h+='</div><div class="inv-sec"><div class="inv-h">SUPPLIES</div>';
 h+=`<div class="inv-row"><span>MEDKITS</span><b>${P.kits} of ${DMG.MAX_KITS}</b></div>`;
 h+=`<div class="inv-row"><span>CASH</span><b>$${WALLET.cash.toLocaleString('en-US')}</b></div></div>`;
 if(ACC.admin||NET.admin){h+='<div class="inv-sec"><div class="inv-h">ADMIN: ANY GUN, INTO THE ACTIVE SLOT</div><div class="inv-guns">';
  for(const id in WD)h+=`<button class="mb" data-gun="${invEsc(id)}">${invEsc(WD[id].name)}</button>`;h+='</div></div>'}
 L.innerHTML=h;
 L.querySelectorAll('[data-gun]').forEach(b=>{b.onclick=()=>adminGive(b.dataset.gun)})}
function adminGive(id){if(!(ACC.admin||NET.admin)||state!=='play'||!W||!W.slots)return;const d=WD[id];if(!d)return;
 const n=(d.reserveMags||SIDE_MAGS)*d.mag;
 W.slots[W.cur]={id,def:d,mag:d.mag,res:n,resMax:n,mi:Math.max(0,d.modes.indexOf('AUTO'))};
 Object.assign(W,{act:'draw',t:0,ads:false,adsK:0,trig:false,dry:false});
 if(W.cur===0)applyOptic(id);showModel(W.cur);invRender();setNotice('GOT '+d.name,1.6)}
function openChat(){if(!NET.on||CHAT.on)return;CHAT.on=true;clearInput();
 document.getElementById('chatBox').classList.add('on');document.getElementById('chatLog').classList.add('open');
 if(document.pointerLockElement)document.exitPointerLock();
 const i=document.getElementById('chatIn');i.value='';setTimeout(()=>i.focus(),0)}
function closeChat(){if(!CHAT.on)return;CHAT.on=false;document.getElementById('chatBox').classList.remove('on');
 document.getElementById('chatLog').classList.remove('open');document.getElementById('chatIn').blur()}
function chatKey(e){e.stopPropagation();
 if(e.key==='Enter'){e.preventDefault();const t=e.target.value.trim();if(t)netSend({type:'chat',text:t.slice(0,160)});e.target.value='';closeChat()}
 else if(e.key==='Escape'){e.preventDefault();closeChat()}}
function chatAdd(name,team,text){const L=document.getElementById('chatLog');if(!L)return;const r=document.createElement('div');
 r.className='cl-line '+(team==='nato'?'nato':'wp');const b=document.createElement('b');b.textContent=String(name)+': ';
 const s=document.createElement('span');s.textContent=String(text);r.append(b,s);L.appendChild(r);
 while(L.childElementCount>CHAT.max)L.firstChild.remove()}
function chatClear(){const L=document.getElementById('chatLog');if(L)L.textContent=''}
function openAdmin(){if(!NET.admin){setNotice('ADMIN ONLY',1.2);return}netAdminToggle();
 if(document.getElementById('admPanel').classList.contains('on')&&document.pointerLockElement)document.exitPointerLock()}

/* ---------- class list with icons, and the equipment steppers (magazines, pistol mags, first aid kits) ---------- */
const POUCH_MAX=18;
const CLS_GROUP={rifleman:'INFANTRY',assault:'INFANTRY',support:'SUPPORT'};
const CLS_ICON={
 rifleman:'<svg viewBox="0 0 24 24"><path d="M5 5l14 14M19 5L5 19" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
 assault:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5" stroke="currentColor" stroke-width="2"/></svg>',
 support:'<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="4" cy="12" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="14" cy="12" r="2"/><circle cx="19" cy="12" r="2"/><path d="M2 8h20M2 16h20" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>'};
const EQ_RANGE={mags:[1,10],pmags:[0,6],kits:[0,DMG.MAX_KITS]};
const pouchUse=()=>sel.mags+sel.pmags+sel.kits;
function renderClassList(){const L=document.getElementById('rlist');if(!L)return;L.innerHTML='';let last=null;
 for(const id in CLASSES){const g=CLS_GROUP[id]||'OTHER';
  if(g!==last){const h=document.createElement('div');h.className='rl-h';h.textContent=g;L.appendChild(h);last=g}
  const b=document.createElement('button');b.className='mb tab';b.dataset.c=id;
  b.innerHTML='<span class="ic">'+CLS_ICON[id]+'</span><span class="nm">'+CLASSES[id].name+'</span><span class="st"></span>';L.appendChild(b)}}
function eqStep(k,d){const[lo,hi]=EQ_RANGE[k],cur=sel[k],n=Math.max(lo,Math.min(hi,cur+d));
 if(n>cur&&pouchUse()+(n-cur)>POUCH_MAX)return;sel[k]=n;kitShow();renderEquip()}
function renderEquip(){const el=document.getElementById('eqRows');if(!el)return;const L=setLoad();
 for(const b of document.querySelectorAll('.tab')){const s=b.querySelector('.st');if(s)s.textContent=b.dataset.c===sel.c?'SELECTED':''}
 const F=FACTIONS[sel.f],P1=WD[F.prim[sel.c]],S1=WD[F.side],used=pouchUse();
 const rows=[['mags','MAGAZINES',P1.mag+' rounds each',sel.mags],['pmags','PISTOL MAGAZINES',S1.mag+' rounds each',sel.pmags],['kits','FIRST AID KITS','1 use each',sel.kits]];
 el.innerHTML=rows.map(([k,n,s,v])=>{const[lo,hi]=EQ_RANGE[k];
   return '<div class="eq-row"><div class="lb"><b>'+n+'</b><small>'+s+'</small></div>'+
   '<button class="mb" data-k="'+k+'" data-d="-1"'+(v<=lo?' disabled':'')+'>&minus;</button><span class="val">'+v+'</span>'+
   '<button class="mb" data-k="'+k+'" data-d="1"'+(v>=hi||used>=POUCH_MAX?' disabled':'')+'>+</button></div>'}).join('')+
  '<div class="pouch-h"><span>POUCHES</span><span>'+used+' / '+POUCH_MAX+'</span></div><div class="pouch-bar">'+
  Array.from({length:POUCH_MAX},(_,i)=>'<i class="'+(i<used?'on':'')+'"></i>').join('')+'</div>'+
  '<div class="pouch-h"><span>WEIGHT</span><span>'+L.kg.toFixed(1)+' KG</span></div>'+
  '<div class="pouch-h"><span>WALK -'+L.p.walk.toFixed(0)+'%</span><span>SPRINT -'+L.p.sprint.toFixed(0)+'%  JUMP -'+L.p.jump.toFixed(0)+'%</span></div>'}
function eqInit(){const el=document.getElementById('eqRows');if(!el)return;
 el.addEventListener('click',e=>{const b=e.target.closest('[data-k]');if(b&&!b.disabled)eqStep(b.dataset.k,+b.dataset.d)})}

/* ---------- weight: what you carry slows walking, sprinting and jumping (stamina is gone) ---------- */
const GUN_KG={m16a2:0.6,m60e3:1.0,m9:0.2,ak74:0.6,rpk74:0.8,makarov:0.2};
const KIT_KG=0.25, BASE_KG={rifleman:0.43,assault:0.4,support:0.5}; /* webbing, helmet, canteen; support adds the radio */
const magKg=d=>d.kind==='pistol'?0.38:0.37; /* per magazine, from the role screen */
function loadKg(){const F=FACTIONS[sel.f],pid=F.prim[sel.c],sid=F.side;
 return (GUN_KG[pid]||0)+(GUN_KG[sid]||0)+sel.mags*magKg(WD[pid])+sel.pmags*magKg(WD[sid])+sel.kits*KIT_KG+(BASE_KG[sel.c]||2)}
/* penalties start above 4 kg. At 7.2 kg: walking -4 %, sprinting -6 %, jumping -3.2 % */
const loadPen=kg=>({walk:Math.min(40,4/3.2*Math.max(0,kg-4)),sprint:Math.min(60,6/3.2*Math.max(0,kg-4)),jump:Math.min(30,Math.max(0,kg-4))});
let LOAD={kg:0,walk:1,sprint:1,jump:1,p:{walk:0,sprint:0,jump:0}};
function setLoad(){const kg=loadKg(),p=loadPen(kg);LOAD={kg,walk:1-p.walk/100,sprint:1-p.sprint/100,jump:1-p.jump/100,p};return LOAD}

/* ---------- AFK nudge: after 10 minutes with no input, the character takes a short step ---------- */
let idleT=0,nudgeT=0,nudgeF=0,nudgeS=0;const AFK_NUDGE_S=600;
const idleReset=()=>{idleT=0};
for(const ev of['keydown','mousedown','mousemove','pointerdown','touchstart','wheel'])window.addEventListener(ev,idleReset,{capture:true,passive:true});
function idleUpdate(dt){
 if(state!=='play'){idleT=0;nudgeT=0;nudgeF=nudgeS=0;return}
 if(nudgeT>0){nudgeT-=dt;if(nudgeT<=0){nudgeT=0;nudgeF=nudgeS=0}return}
 idleT+=dt;
 if(idleT>=AFK_NUDGE_S){idleT=0;const a=Math.random()*Math.PI*2;nudgeF=Math.cos(a);nudgeS=Math.sin(a);nudgeT=0.8}
}
