/* ---------- wallet, gunsmith, conquest (single player), scope overlay and full map ---------- */
const SCOPES=[
 {id:'iron',name:'Iron sights (standard)',price:0,zoom:1,dot:false,desc:'The standard rear and front sights. Always owned.'},
 {id:'dot',name:'1x red dot',price:400,zoom:1,dot:true,desc:'A red dot at normal magnification. Quick to put on target.'},
 {id:'s3',name:'3x scope',price:900,zoom:3,dot:false,desc:'Magnifies the view three times while aiming down sights.'},
 {id:'s6',name:'6x scope',price:1800,zoom:6,dot:false,desc:'Magnifies the view six times. Narrow field of view.'}];
const MONEY={kill:100,capture:200,winMatch:1000,lossMatch:250};
const WALLET_KEY='fc2_wallet';
function loadWallet(){const d={cash:0,owned:{iron:true},eq:'iron',stats:{kills:0,captures:0,wins:0,matches:0}};
 try{const j=JSON.parse(localStorage.getItem(WALLET_KEY)||'null');if(j&&typeof j==='object'){d.cash=Math.max(0,+j.cash||0);
  if(j.owned&&typeof j.owned==='object')for(const k in j.owned)if(SCOPES.some(s=>s.id===k))d.owned[k]=true;
  if(SCOPES.some(s=>s.id===j.eq&&d.owned[s.id]))d.eq=j.eq;if(j.stats&&typeof j.stats==='object')Object.assign(d.stats,j.stats)}}catch(e){}
 return d}
let WALLET=loadWallet();
function saveWallet(){try{localStorage.setItem(WALLET_KEY,JSON.stringify(WALLET))}catch(e){}accSaveSoon()}
function earn(n,why){WALLET.cash+=n;saveWallet();if(why)setNotice(why+'  +$'+n,2.2)}
const scopeDef=()=>SCOPES.find(s=>s.id===WALLET.eq)||SCOPES[0];
function buyScope(id){const s=SCOPES.find(x=>x.id===id);if(!s||WALLET.owned[id]||WALLET.cash<s.price)return false;WALLET.cash-=s.price;WALLET.owned[id]=true;saveWallet();return true}
function equipScope(id){if(!WALLET.owned[id])return false;WALLET.eq=id;saveWallet();return true}
/* aiming: the primary weapon's ADS field of view follows the equipped scope */
function adsFovFor(base){const s=scopeDef();return s.zoom>1?70/s.zoom:base}
function scopeHud(){const s=scopeDef(),prim=W.cur===0;const sc=document.getElementById('scopeov'),dot=document.getElementById('dotov');
 if(sc)sc.classList.toggle('on',prim&&W.adsK>.85&&s.zoom>1);if(dot)dot.classList.toggle('on',prim&&W.adsK>.5&&s.dot)}
function renderGunsmith(){document.getElementById('gCash').textContent='$'+WALLET.cash.toLocaleString('en-US');const L=document.getElementById('gList');L.innerHTML='';
 for(const s of SCOPES){const row=document.createElement('div');row.className='gun-row';const owned=!!WALLET.owned[s.id],eq=WALLET.eq===s.id;
  row.innerHTML='<div class="gi"><b></b><span></span></div>';row.querySelector('b').textContent=s.name;row.querySelector('span').textContent=s.desc;
  const btn=document.createElement('button');btn.className='mb gbtn';
  if(eq){btn.textContent='EQUIPPED';btn.classList.add('sel');btn.disabled=true}
  else if(owned){btn.textContent='EQUIP';btn.onclick=()=>{equipScope(s.id);renderGunsmith()}}
  else{btn.textContent='BUY  $'+s.price.toLocaleString('en-US');btn.disabled=WALLET.cash<s.price;btn.onclick=()=>{if(buyScope(s.id))renderGunsmith()}}
  row.appendChild(btn);L.appendChild(row)}
 const st=WALLET.stats;document.getElementById('gStats').textContent='Kills '+st.kills+'  -  Captures '+st.captures+'  -  Matches won '+st.wins+' of '+st.matches}

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
/* top bar: tickets and the five points (controller colour; a bar shows capture progress) */
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
/* full map: the whole battlefield with capture points, bases, allies and trucks. Enemies are not shown. */
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
 for(let i=0;i<TRUCKS.length;i++){const t=TRUCKS[i];if(!t.g)continue;g.fillStyle=i===0?'#c9bd6a':'#d0785a';g.fillRect(px(t.x)-4,pz(t.z)-6,8,12)}
 g.save();g.translate(px(P.x),pz(P.z));g.rotate(Math.atan2(-Math.sin(P.yaw),-Math.cos(P.yaw))+Math.PI);g.fillStyle='#ffd35a';g.beginPath();g.moveTo(0,-9);g.lineTo(6,6);g.lineTo(0,3);g.lineTo(-6,6);g.closePath();g.fill();g.restore();
 const lg=document.getElementById('fmLegend');if(lg)lg.textContent='Blue and red dots: your side. Gold ring: squad leader. Enemy positions are not shown.'}
