/* ---------- multiplayer client: server browser, relay of position, shots and hits, remote players, admin panel ---------- */
const NET={mode:'sp',on:false,ws:null,url:'',room:'',roomName:'',id:null,admin:false,players:new Map(),avatars:new Map(),cq:null,sendT:0,cqT:0,
 match:{captures:0},target:null,lastNotice:0};
const NET_DEF_URL='ws://localhost:8080';
function netWsUrl(base){let u=String(base||'').trim();if(!u)return null;if(/^https:/i.test(u))u=u.replace(/^https:/i,'wss:');else if(/^http:/i.test(u))u=u.replace(/^http:/i,'ws:');else if(!/^wss?:/i.test(u))u='ws://'+u;return u.replace(/\/+$/,'')}
function netHttpUrl(ws){return ws.replace(/^wss:/i,'https:').replace(/^ws:/i,'http:')}
function netPrefs(){const u=document.getElementById('srvUrl');
 // Opened from a server's own address (http/https): that server is the one to join.
 if(/^https?:$/.test(location.protocol))u.value=location.host;
 else if(!u.value)u.value=localStorage.getItem('fc2_server')||NET_DEF_URL;
}
async function netList(){netPrefs();const note=document.getElementById('srvNote'),L=document.getElementById('srvList');const ws=netWsUrl(document.getElementById('srvUrl').value);
 if(!ws){note.textContent='Enter a server address.';return}
 try{localStorage.setItem('fc2_server',document.getElementById('srvUrl').value.trim())}catch(e){}
 note.textContent='Looking for servers at '+netHttpUrl(ws)+' ...';L.innerHTML='';
 try{const ctl=new AbortController(),tm=setTimeout(()=>ctl.abort(),6000);const r=await fetch(netHttpUrl(ws)+'/servers',{signal:ctl.signal});clearTimeout(tm);
  const j=await r.json();note.textContent=j.servers.length+' servers. Pick one to join.';
  for(const s of j.servers){const b=document.createElement('button');b.className='mb srv';const full=s.players>=s.max;
   b.innerHTML='<span class="sn"></span><span class="sp"></span>';b.querySelector('.sn').textContent=s.name;b.querySelector('.sp').textContent=s.players+' / '+s.max+(full?'  FULL':'');
   b.disabled=full;b.onclick=()=>{NET.target={url:ws,room:s.id,name:s.name};NET.mode='mp';view('faction','servers')};L.appendChild(b)}
 }catch(e){note.textContent='Could not reach that server. Check the address, and that the server is running.'}}
function netConnect(){if(!NET.target)return false;if(!ACC.token){setNotice('LOG IN TO PLAY PVP',3);return false}
 netLeave(true);NET.on=false;NET.id=null;NET.url=NET.target.url;NET.room=NET.target.room;
 let ws;try{ws=new WebSocket(NET.url)}catch(e){setNotice('CANNOT OPEN THAT SERVER ADDRESS',3);return false}
 NET.ws=ws;
 ws.onopen=()=>{ws.send(JSON.stringify({type:'join',room:NET.room,token:ACC.token,team:sel.f,cls:sel.c}))};
 ws.onmessage=(e)=>{let m;try{m=JSON.parse(e.data)}catch(err){return}netMsg(m)};
 ws.onclose=()=>{if(NET.ws!==ws)return;const was=NET.on;NET.ws=null;NET.on=false;netClearAvatars();netSetAdmin(false);
  if(was||state==='play'){setNotice('DISCONNECTED FROM THE SERVER',4);toFaction()}};
 ws.onerror=()=>{};
 return true}
function netLeave(quiet){const ws=NET.ws;NET.ws=null;NET.on=false;netClearAvatars();netSetAdmin(false);closeChat();chatClear();if(ws){try{ws.close()}catch(e){}}
 if(!quiet){NET.mode='sp'}}
function netSend(m){if(NET.ws&&NET.ws.readyState===1)NET.ws.send(JSON.stringify(m))}
function netMsg(m){
 switch(m.type){
  case 'welcome':{NET.id=m.id;NET.roomName=m.room.name;NET.cq=m.cq;NET.match={captures:0};netSetAdmin(!!m.admin);NET.on=true;
   auInit();auOn();deploy();enterPlay();setNotice('JOINED '+m.room.name,3);break}
  case 'error':{setNotice(m.msg.toUpperCase(),4);netLeave(true);NET.on=false;toFaction();break}
  case 'kicked':{setNotice(m.reason.toUpperCase(),4);netLeave(true);toFaction();break}
  case 'world':{NET.cq=m.cq;NET.players=new Map(m.players.map(p=>[p.id,p]));netSyncAvatars();
   if(FMAP)drawFullMap();if(NET.admin&&document.getElementById('admPanel').classList.contains('on'))netAdminRender();break}
  case 'shot':{const o=m.o,d=m.d;if(!o||!d)break;const a=new T.Vector3(o[0],o[1],o[2]),b=new T.Vector3(o[0]+d[0]*160,o[1]+d[1]*160,o[2]+d[2]*160);spawnTracer(a,b);break}
  case 'hurt':{hurtPlayer({wpn:m.wpn==='pistol'?'pistol':'rifle',part:['head','chest','larm','rarm','lleg','rleg'].includes(m.part)?m.part:undefined,dmg:m.dmg,wname:m.wname,name:m.byName,byId:m.by,from:Number.isFinite(+m.fx)?{x:+m.fx,z:+m.fz}:null});break}
  case 'reviving':{P.reviver=m.on?m.byName:null;updDown();break}
  case 'revived':{reviveNow(m.byName);break}
  case 'notice':{if(state==='play')setNotice(m.text,2.5);break}
  case 'chat':{chatAdd(m.name,m.team,m.text);break}
  case 'chat':{chatAdd(m.name,m.team,m.text);break}
  case 'cqevent':{if(m.team===CH.playerTeam)NET.match.captures++;setNotice(m.name+(m.team===CH.playerTeam?' CAPTURED':' TAKEN BY THE ENEMY'),2.5);break}
  case 'matchend':{const mine=NET.players.get(NET.id)||{kills:0};const win=m.winner===CH.playerTeam;const kills=(m.players.find(p=>p.id===NET.id)||{}).kills||0;
   const caps=NET.match.captures;const money=kills*MONEY.kill+caps*MONEY.capture+(win?MONEY.winMatch:MONEY.lossMatch);
   earn(money,win?'MATCH WON':'MATCH LOST');WALLET.stats.matches++;WALLET.stats.kills+=kills;WALLET.stats.captures+=caps;if(win)WALLET.stats.wins++;saveWallet();
   cqShowResults({winner:m.winner,win,you:{kills,captures:caps,money},mp:true});break}
  case 'matchstart':{cqHide();NET.match={captures:0};if(state==='play')setNotice(m.why||'NEW MATCH',2.5);break}
 }}
/* remote players: a model per player on the other side, moved to the last reported position */
function netSyncAvatars(){if(!NET.on)return;const seen=new Set();
 for(const p of NET.players.values()){if(p.id===NET.id)continue;seen.add(p.id);let av=NET.avatars.get(p.id);
  if(!av||av.team!==p.team||av.cls!==p.cls){if(av)scene.remove(av.g);const g=buildSoldier(p.team,p.cls);scene.add(g);av=NET.avatars.set(p.id,{g,team:p.team,cls:p.cls,id:p.id,x:p.x,y:p.y,z:p.z,yaw:p.yaw,alive:p.alive,name:p.name}).get(p.id)}
  av.tx=p.x;av.ty=p.y;av.tz=p.z;av.tyaw=p.yaw;av.alive=p.alive;av.name=p.name;av.stance=p.stance;av.hp=p.hp;av.down=!!p.down}
 for(const[id,av]of NET.avatars)if(!seen.has(id)){scene.remove(av.g);NET.avatars.delete(id)}}
function netClearAvatars(){for(const av of NET.avatars.values())scene.remove(av.g);NET.avatars.clear();NET.players=new Map()}
function netAvatarFrame(dt){for(const av of NET.avatars.values()){if(av.tx===undefined)continue;const k=Math.min(1,dt*12);
  av.x+=(av.tx-av.x)*k;av.y+=(av.ty-av.y)*k;av.z+=(av.tz-av.z)*k;let dy=av.tyaw-av.yaw;dy=Math.atan2(Math.sin(dy),Math.cos(dy));av.yaw+=dy*k;
  av.g.position.set(av.x,av.y,av.z);av.g.rotation.y=av.yaw+Math.PI;av.g.visible=av.alive;av.g.scale.y=av.stance==='crouch'?.7:1}}
/* per frame: send own state 10 times a second, move remote players, refresh the top bar every 0.25 s */
function netUpdate(dt){if(!NET.on)return;NET.sendT+=dt;if(NET.sendT>=.1){NET.sendT=0;
  netSend({type:'state',x:P.x,y:P.y,z:P.z,yaw:P.yaw,pitch:P.pitch,stance:P.stance,alive:P.hp>0,hp:P.hp,down:!!P.down,cls:sel.c})}
 netAvatarFrame(dt);NET.cqT+=dt;if(NET.cqT>=.25){NET.cqT=0;if(NET.cq)cqHud(NET.cq)}}
/* bullets: the shooter's own shots are sent to the room; a bullet that reaches a player on the other side is reported as a hit */
function netShot(o,d){netSend({type:'shot',o:[o.x,o.y,o.z],d:[d.x,d.y,d.z]})}
function netBulletHit(cur,d,best,b){if(!NET.on)return null;let bestT=best,hit=null;
 for(const av of NET.avatars.values()){if(!av.alive||av.team===CH.playerTeam)continue;
  const px=cur.x-av.x,pz=cur.z-av.z,a=d.x*d.x+d.z*d.z;if(a<1e-9)continue;const bb=2*(px*d.x+pz*d.z),c=px*px+pz*pz-.36;const disc=bb*bb-4*a*c;if(disc<0)continue;
  const t=(-bb-Math.sqrt(disc))/(2*a);if(t<0||t>=bestT)continue;const y=cur.y+d.y*t-av.y;if(y<0||y>1.85)continue;
  bestT=t;hit={av,t,head:y>1.45,part:y>1.45?'head':y>.95?'chest':(Math.random()<.5?'lleg':'rleg')}}
 return hit}
function netConfirmHit(h){const cur=curS();netSend({type:'hit',target:h.av.id,dmg:h.head?100:40,part:h.part,wpn:cur&&cur.def.kind==='pistol'?'pistol':'rifle',wname:cur?cur.def.name:'RIFLE'})}
function netSetAdmin(on){NET.admin=on;document.getElementById('admBtn').style.display=on?'':'none';if(!on)document.getElementById('admPanel').classList.remove('on')}
function netAdminRender(){const L=document.getElementById('admList');L.innerHTML='';
 for(const p of NET.players.values()){if(p.id===NET.id)continue;const r=document.createElement('div');r.className='adm-row';
  r.innerHTML='<span></span><button class="mb kick">KICK</button>';r.querySelector('span').textContent=p.name+'  ('+(p.team==='nato'?'NATO':'WP')+')  '+p.kills+' K / '+p.deaths+' D';
  r.querySelector('button').onclick=()=>netSend({type:'admin',action:'kick',target:p.id});L.appendChild(r)}
 if(!L.childElementCount)L.textContent='No other players.'}
function netAdminToggle(){const el=document.getElementById('admPanel');el.classList.toggle('on');if(el.classList.contains('on'))netAdminRender()}

/* PVP: find the fullest server that still has room, and go to team and role selection for it. */
function netBase(){return /^https?:/.test(location.protocol)?location.origin:netHttpUrl(netWsUrl(localStorage.getItem('fc2_server')||NET_DEF_URL))}
async function pvpStart(){const note=document.getElementById('modeNote');
 if(!ACC.token){note.textContent='PVP needs an account. Log in or create one on the main menu.';return}
 if(ACC.local){note.textContent='PVP needs an account on a server. This browser-only account can play PVE.';return}
 note.textContent='Finding a server...';
 try{const ctl=new AbortController(),tm=setTimeout(()=>ctl.abort(),6000);const r=await fetch(netBase()+'/servers',{signal:ctl.signal});clearTimeout(tm);
  const j=await r.json();const open=j.servers.filter(s=>s.players<s.max).sort((a,b)=>b.players-a.players);
  if(!open.length){note.textContent='No server has room right now. Try again in a moment.';return}
  const s=open[0];NET.target={url:netWsUrl(netBase()),room:s.id,name:s.name};NET.mode='mp';
  note.textContent='';view('faction','mode');setNotice('JOINING '+s.name.toUpperCase(),2)
 }catch(e){note.textContent='No server answered. Open the game from a server address, for example http://localhost:8080.'}}
