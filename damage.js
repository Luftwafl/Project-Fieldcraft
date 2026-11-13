/* ---------- damage, armour, bleeding, downed, revive and medkits (0.4.5) ----------
   Every hit has a place: head, chest, arm or leg (a blast is spread). Armour:
   - helmet: stops the first HELM_HITS pistol rounds to the head. Rifle rounds go through, so a rifle head shot is always lethal.
   - vest: stops the first VEST_HITS rifle rounds to the chest. A round that gets through the vest is a chest wound.
   Wounds bleed: each arm or leg wound bleeds slowly, a chest wound bleeds hard. Blood is P.hp (100).
   At DOWN_BLOOD the player is downed for DOWN_T seconds. Bleeding continues while downed; a hit while downed is fatal.
   A downed player is revived by a teammate holding MED next to them for REVIVE_T seconds (one of the medic's kits).
   Pressing MED on yourself treats the most severe wound: one kit per wound. */
const DMG={MAX_BLOOD:100,DOWN_BLOOD:50,REVIVE_BLOOD:50,DOWN_T:60,HELM_HITS:3,VEST_HITS:4,BLEED_LIMB:.6,BLEED_CHEST:1.5,
 CHEST_BLOOD:20,LIMB_BLOOD:{rifle:8,pistol:4},REVIVE_T:5,REVIVE_R:2.5,MAX_KITS:6,DEF_KITS:2};
const PART_W=[['head',.08],['chest',.5],['larm',.1],['rarm',.1],['lleg',.11],['rleg',.11]];
const PART_NAME={head:'HEAD',chest:'CHEST',larm:'LEFT ARM',rarm:'RIGHT ARM',lleg:'LEFT LEG',rleg:'RIGHT LEG',blast:'BLAST'};
const LIMBS=['larm','rarm','lleg','rleg'];
const DTH_POS={head:[60,22],chest:[60,72],larm:[27,76],rarm:[93,76],lleg:[49,142],rleg:[71,142]};
const pickPart=()=>{let r=Math.random();for(const[p,w]of PART_W){r-=w;if(r<0)return p}return 'chest'};
const bleedRate=()=>P.wounds.reduce((s,w)=>s+w.rate,0);
const mostSevere=()=>P.wounds.reduce((b,w,k)=>(b<0||w.rate>P.wounds[b].rate)?k:b,-1);

/* a new life: full blood, both kits, helmet and vest fresh, no wounds */
function dmgReset(kits){P.hp=DMG.MAX_BLOOD;P.down=false;P.downT=0;P.reviver=null;P.reviveSent=false;P.reviveProg=0;P.reviveTo=null;
 P.helm=DMG.HELM_HITS;P.vest=DMG.VEST_HITS;P.wounds=[];P.hits=[];P.kits=Math.max(0,Math.min(DMG.MAX_KITS,kits==null?DMG.DEF_KITS:kits));
 hideDown();hideDeath()}

/* h: {wpn:'rifle'|'pistol'|'frag', part, dmg, from:{x,z}, name, wname, byId}. A plain number is a legacy rifle hit. */
function hurtPlayer(h){
 if(P.hp<=0)return;
 CH.stats.playerHits++;
 if(typeof h==='number')h={wpn:'rifle',dmg:h};
 const part=h.part||pickPart(),from=h.from||null;
 /* the player faces (-sin yaw, -cos yaw): a shot from behind the player has a negative dot product */
 const behind=!!from&&((from.x-P.x)*-Math.sin(P.yaw)+(from.z-P.z)*-Math.cos(P.yaw))<0;
 const rec={part,wpn:h.wpn||'rifle',behind,stopped:null,by:h.name||'ENEMY SOLDIER',wname:h.wname||null,byId:h.byId||null,
  dist:from?Math.round(Math.hypot(from.x-P.x,from.z-P.z)):null};
 P.hits.push(rec);
 if(part==='head'){
  if(P.down||rec.wpn!=='pistol'||P.helm<=0)return kill(rec);
  P.helm--;rec.stopped='helmet';setNotice('HELMET STOPPED A PISTOL ROUND  ('+P.helm+' LEFT)',1.5);
 }else if(part==='chest'){
  if(!P.down&&rec.wpn==='rifle'&&P.vest>0){P.vest--;rec.stopped='vest';setNotice('VEST STOPPED A ROUND  ('+P.vest+' LEFT)',1.5)}
  else{if(P.down)return kill(rec);P.hp-=DMG.CHEST_BLOOD;P.wounds.push({part:'chest',rate:DMG.BLEED_CHEST});setNotice('CHEST WOUND - BLEEDING',2)}
 }else if(part==='blast'){
  if(P.down)return kill(rec);
  P.hp-=(h.dmg||0)*.5;if((h.dmg||0)>=35)P.wounds.push({part:LIMBS[Math.floor(Math.random()*4)],rate:DMG.BLEED_LIMB});
  setNotice('BLAST INJURY',2);
 }else{ /* arm or leg: no armour, the wound bleeds */
  if(P.down)return kill(rec);
  P.hp-=DMG.LIMB_BLOOD[rec.wpn]||4;P.wounds.push({part,rate:DMG.BLEED_LIMB});setNotice(PART_NAME[part]+' WOUND - BLEEDING',2)}
 if(P.hp<=0)return kill(rec);
 if(!P.down&&P.hp<=DMG.DOWN_BLOOD)goDown();
}
function kill(rec){P.hp=0;playerDied(rec)}

function goDown(){P.down=true;P.downT=DMG.DOWN_T;P.reviver=null;P.reviveProg=0;clearInput();W.trig=false;showDown()}
/* a teammate's revive: back on their feet with at least REVIVE_BLOOD, the wounds still open */
function reviveNow(by){if(!P.down)return;P.down=false;P.downT=0;P.reviver=null;P.hp=Math.max(P.hp,DMG.REVIVE_BLOOD);hideDown();setNotice('REVIVED BY '+by,3)}

/* per frame while playing: bleeding, the downed timer, reviving a teammate, the screens */
function dmgTick(dt){
 if(P.hp<=0)return;
 if(P.down){clearInput();P.downT-=dt;P.hp-=bleedRate()*dt;
  if(P.hp<=0)return kill({part:'bleed',wpn:'bleed',cause:'BLOOD LOSS',by:'',behind:false,stopped:null,dist:null});
  if(P.downT<=0)return kill({part:'bleed',wpn:'bleed',cause:'BLEED OUT - NOT REVIVED',by:'',behind:false,stopped:null,dist:null});
  updDown();return}
 const r=bleedRate();
 if(r>0){P.hp-=r*dt;if(P.hp<=0)return kill({part:'bleed',wpn:'bleed',cause:'BLOOD LOSS',by:'',behind:false,stopped:null,dist:null});
  if(P.hp<=DMG.DOWN_BLOOD)return goDown()}
 setClassFlag($('bleedV'),'on',r>0);
 reviveTick(dt);
}
function setClassFlag(el,c,on){if(el&&el.classList.contains(c)!==on)el.classList.toggle(c,on)}

/* the nearest downed teammate within reach, or null (multiplayer only) */
function nearestDownedAlly(){if(!NET.on)return null;let best=null,bd=DMG.REVIVE_R;
 for(const av of NET.avatars.values()){if(!av.down||av.team!==CH.playerTeam)continue;const d=Math.hypot(av.x-P.x,av.z-P.z);if(d<=bd){bd=d;best=av}}
 return best}
/* holding MED next to a downed teammate: after REVIVE_T seconds, one of this player's kits revives them */
function reviveTick(dt){
 if(!NET.on||P.hp<=0||P.down)return;
 const tgt=down('med')&&P.kits>0?nearestDownedAlly():null;
 if(!tgt){if(P.reviveSent)netSend({type:'revive',target:P.reviveTo,on:false});P.reviveSent=false;P.reviveProg=0;P.reviveTo=null;return}
 if(P.reviveTo!==tgt.id){if(P.reviveSent)netSend({type:'revive',target:P.reviveTo,on:false});P.reviveTo=tgt.id;P.reviveSent=false;P.reviveProg=0}
 P.reviveProg+=dt;
 if(P.reviveProg<DMG.REVIVE_T){if(!P.reviveSent){P.reviveSent=true;netSend({type:'revive',target:tgt.id,on:true})}return}
 P.kits--;P.reviveProg=0;P.reviveSent=false;netSend({type:'revive',target:tgt.id,done:true});setNotice('REVIVED '+tgt.name,2.5);P.reviveTo=null}

/* MED pressed on yourself: treats the most severe wound and uses one kit */
function useKit(){
 if(P.down||P.hp<=0)return;
 if(nearestDownedAlly())return; /* next to a downed teammate: holding MED revives them instead */
 if(P.kits<=0){setNotice('NO MEDKITS',1.5);return}
 if(!P.wounds.length){setNotice('NO WOUNDS TO TREAT',1.5);return}
 const w=P.wounds.splice(mostSevere(),1)[0];P.kits--;
 setNotice('TREATED '+PART_NAME[w.part]+'  -  '+P.kits+' KIT'+(P.kits===1?'':'S')+' LEFT',2.5)}

/* HUD line and the medkit count */
function dmgHudText(){return 'BLOOD '+Math.max(0,Math.ceil(P.hp))+'  KITS '+P.kits+'  HELM '+P.helm+'  VEST '+P.vest+(bleedRate()>0?'  BLEEDING '+bleedRate().toFixed(1)+'/S':'')}
function kitShow(){const n=$('kitN');if(n)n.textContent=String(sel.kits);const b=$('bmedN');if(b&&P)b.textContent=String(P.kits||0)}
function kitStep(d){sel.kits=Math.max(0,Math.min(DMG.MAX_KITS,sel.kits+d));kitShow()}

/* ---------- downed screen ---------- */
const ARC_LEN=100;
function showDown(){$('dnScr').classList.add('on');updDown(true)}
function hideDown(){const el=$('dnScr');if(el)el.classList.remove('on')}
function updDown(force){const el=$('dnScr');if(!el||!el.classList.contains('on')&&!force)return;
 const arc=$('dnArc'),num=$('dnNum'),lab=$('dnLab'),sub=$('dnSub'),near=$('dnNear');
 if(P.reviver){ /* a teammate is working on you: green ring, a cross */
  setT(sub,'BEING REVIVED BY '+P.reviver.toUpperCase());setT(num,'+');setT(lab,'REVIVING');arc.setAttribute('class','dn-fg ok');arc.setAttribute('stroke-dashoffset',0);
 }else{
  setT(sub,'BLEEDING OUT');setT(num,String(Math.max(0,Math.ceil(P.downT))));setT(lab,'SECONDS');arc.setAttribute('class','dn-fg');
  arc.setAttribute('stroke-dashoffset',String(ARC_LEN*(1-Math.max(0,P.downT)/DMG.DOWN_T)))}
 if(NET.on){const a=[...NET.avatars.values()].filter(v=>v.team===CH.playerTeam&&v.alive!==false);let best=null,bd=1e9;
  for(const v of a){const d=Math.hypot(v.x-P.x,v.z-P.z);if(d<bd){bd=d;best=v}}
  setT(near,best?'NEAREST TEAMMATE  |  '+Math.round(bd)+' m':'NO TEAMMATES NEARBY')}
 else setT(near,'NO TEAMMATES NEARBY')}
/* give up: the player dies where they lie */
function giveUp(){if(P.down&&P.hp>0)kill({part:'bleed',wpn:'bleed',cause:'GAVE UP',by:'',behind:false,stopped:null,dist:null})}

/* ---------- death screen ---------- */
function showDeath(rec){
 const svgNS='http://www.w3.org/2000/svg',dots=$('dthDots');dots.innerHTML='';
 document.querySelectorAll('#dthFig [data-p]').forEach(e=>e.classList.remove('hl'));
 P.hits.forEach((h,i)=>{const[x,y]=DTH_POS[h.part]||DTH_POS.chest;const c=document.createElementNS(svgNS,'circle');
  c.setAttribute('cx',x+((i*7)%9-4));c.setAttribute('cy',y+((i*5)%9-4));c.setAttribute('r',4.2);c.setAttribute('class',h.stopped?'dd-stop':'dd-hit');dots.appendChild(c);
  const sh=document.querySelector('#dthFig [data-p="'+h.part+'"]');if(sh)sh.classList.add('hl')});
 const n=P.hits.length,beh=P.hits.filter(h=>h.behind).length,stp=P.hits.filter(h=>h.stopped).length;
 const parts=[n+(n===1?' HIT':' HITS')];if(beh)parts.push(beh+' FROM BEHIND');if(stp)parts.push(stp+' STOPPED BY ARMOR');
 $('dthStat').textContent=n?parts.join('  |  '):'NO HITS';
 const r=rec||{};
 const fatal=r.wpn==='bleed'?'':(r.part==='blast'?'BLAST INJURY':'GUNSHOT WOUND');
 $('dthCause').textContent=r.wpn==='bleed'?(r.cause||'BLOOD LOSS'):fatal;
 $('dthWhere').textContent=r.wpn==='bleed'?(r.cause==='GAVE UP'?'SURRENDERED ON THE GROUND':'BLED OUT ON THE GROUND'):(PART_NAME[r.part]||'')+(r.behind?', FROM BEHIND':'');
 const wep=r.wname||(r.wpn==='pistol'?'PISTOL':r.wpn==='frag'?'GRENADE':'RIFLE');
 $('dthBy').textContent=r.wpn==='bleed'?'':'KILLED BY '+(r.by||'UNKNOWN').toUpperCase()+'  |  '+wep.toUpperCase()+(r.dist!=null?'  |  '+r.dist+' m':'');
 $('dthScr').classList.add('on')}
function hideDeath(){const el=$('dthScr');if(el)el.classList.remove('on')}

/* the player is dead: the death screen, then the role menu */
function playerDied(rec){P.hp=0;P.down=false;P.reviver=null;hideDown();clearInput();W.trig=false;setState('menu');
 if(document.pointerLockElement)document.exitPointerLock();
 CH.stats.deaths++;
 if(NET.on)netSend({type:'died',by:rec&&rec.byId||0});
 $('clNote').textContent='KILLED IN ACTION. Choose a role to deploy again.';
 view('class','faction');
 showDeath(rec)}

/* screen buttons */
$('dnGive').onclick=giveUp;
$('dthOk').onclick=hideDeath;
