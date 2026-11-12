/* Project Fieldcraft server.
   HTTP:  GET /             the game page (game.html next to this file)
          GET /servers      the list of servers (rooms) with player counts
          POST /account/register, /account/login, /account/logout
          GET /account, PUT /account/wallet   (Authorization: Bearer <token>)
   WS:    one connection per player; the join must carry the token from a login. JSON messages (see net.js in the game).
   Trust model: players report their own position, shots, hits and deaths. The server relays them,
   runs the capture-point rules (conquest.js) from reported positions, keeps the scores and enforces admin rights.
   It does NOT check hits or movement, so it is not cheat-proof. */
const http=require('http'),fs=require('fs'),path=require('path');
const {WebSocketServer}=require('ws');
const {CQ,CQ_POINTS,cqNew,cqStep}=require('./conquest.js');
const accounts=require('./accounts.js');

// Fallback configuration if config.json is missing
let cfg;
const configPath = path.join(__dirname,'config.json');
try {
  cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (e) {
  console.log('config.json not found. Creating a default configuration...');
  cfg = {
    port: 8080,
    admins: [],
    servers: [
      { name: "Fieldcraft Central", max: 16 }
    ]
  };
  try {
    fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2));
  } catch (err) {
    console.log('Could not auto-write default config.json, using defaults in memory.');
  }
}

const PORT=+process.env.PORT||cfg.port||8080;
const ADMINS=new Set((cfg.admins||[]).map(s=>String(s).trim().toLowerCase()));
const TEAMS=['nato','wp'],CLASSES=['rifleman','assault','support'];
const RESTART_DELAY=15;
let nextId=1;
const rooms=(cfg.servers||[{name:'Default Room',max:16}]).map((s,i)=>({id:'s'+(i+1),name:s.name,max:s.max||16,players:new Map(),cq:cqNew(CQ_POINTS),stats:{},ended:0,events:[],captures:{nato:0,wp:0}}));
const roomById=id=>rooms.find(r=>r.id===id);
function send(ws,msg){if(ws&&ws.readyState===1)ws.send(JSON.stringify(msg))}
function roomSend(room,msg){for(const p of room.players.values())send(p.ws,msg)}

// The game page is served from game.html next to this file, so players only need the server's address.
let GAME_HTML=null;
try{GAME_HTML=fs.readFileSync(path.join(__dirname,'game.html'),'utf8')}catch(e){console.log('No game.html next to server.js: the game page will not be served.')}

function readJson(req,limit=16384){return new Promise((resolve,reject)=>{let n=0,chunks=[];
 req.on('data',c=>{n+=c.length;if(n>limit){reject(new Error('too big'));req.destroy()}else chunks.push(c)});
 req.on('end',()=>{try{resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}'))}catch(e){reject(e)}});req.on('error',reject)})}
function json(res,code,obj){res.writeHead(code,{'Content-Type':'application/json'});res.end(JSON.stringify(obj))}
function bearer(req){const h=req.headers.authorization||'';return h.startsWith('Bearer ')?h.slice(7):''}

async function accountRoute(req,res){
 const url=req.url.split('?')[0];
 try{
  if(req.method==='POST'&&url==='/account/register'){const b=await readJson(req);const r=accounts.register(b.name,b.password);
   return r.code===200?json(res,200,{token:r.token,name:r.name,admin:ADMINS.has(r.name.toLowerCase()),wallet:r.wallet}):json(res,r.code,{error:r.error}),true}
  if(req.method==='POST'&&url==='/account/login'){const b=await readJson(req);const r=accounts.login(b.name,b.password);
   return r.code===200?json(res,200,{token:r.token,name:r.name,admin:ADMINS.has(r.name.toLowerCase()),wallet:r.wallet}):json(res,r.code,{error:r.error}),true}
  if(req.method==='GET'&&url==='/account'){const acc=accounts.byToken(bearer(req));if(!acc)return json(res,401,{error:'Log in again.'}),true;
   return json(res,200,{name:acc.name,admin:ADMINS.has(acc.name.toLowerCase()),wallet:acc.wallet}),true}
  if(req.method==='PUT'&&url==='/account/wallet'){const b=await readJson(req,32768);
   return accounts.putWallet(bearer(req),b.wallet)?json(res,200,{ok:true}):json(res,401,{error:'Log in again.'}),true}
  if(req.method==='POST'&&url==='/account/logout'){accounts.logout(bearer(req));return json(res,200,{ok:true}),true}
 }catch(e){return json(res,400,{error:'Bad request.'}),true}
 return false}

const httpSrv=http.createServer(async (req,res)=>{
 res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');res.setHeader('Access-Control-Allow-Methods','GET, POST, PUT, OPTIONS');
 if(req.method==='OPTIONS'){res.writeHead(204);res.end();return}
 if(req.url.startsWith('/account')&&await accountRoute(req,res))return;
 if(req.url==='/servers'||req.url==='/servers/'){
  return json(res,200,{game:'Project Fieldcraft',version:'0.4.5',servers:rooms.map(r=>({id:r.id,name:r.name,map:'Central Europe',mode:'Conquest',players:r.players.size,max:r.max,ended:r.ended>0}))})}
 if(req.method==='GET'&&(req.url==='/'||req.url==='/index.html')&&GAME_HTML){
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(GAME_HTML);return}
 res.writeHead(200,{'Content-Type':'text/plain'});res.end('Project Fieldcraft server. Open the game at this address, or GET /servers for the server list.');
});
const wss=new WebSocketServer({server:httpSrv});

wss.on('connection',(ws)=>{
 ws.isAlive=true;ws.on('pong',()=>{ws.isAlive=true});
 let me=null,room=null;
 ws.on('message',(raw)=>{
  let m;try{m=JSON.parse(raw)}catch(e){return}
  if(!m||typeof m!=='object')return;
  if(!me){
   if(m.type!=='join')return;
   room=roomById(m.room);
   if(!room){send(ws,{type:'error',msg:'No such server'});ws.close();return}
   const acc=accounts.byToken(String(m.token||''));
   if(!acc){send(ws,{type:'error',msg:'Log in before joining a server'});ws.close();return}
   if(room.players.size>=room.max){send(ws,{type:'error',msg:'Server is full'});ws.close();return}
   for(const p of room.players.values())if(p.name===acc.name){send(ws,{type:'error',msg:'You are already on this server'});ws.close();return}
   const team=TEAMS.includes(m.team)?m.team:'nato',cls=CLASSES.includes(m.cls)?m.cls:'rifleman';
   const name=acc.name,admin=ADMINS.has(name.toLowerCase());
   me={id:nextId++,ws,name,team,cls,admin,x:0,y:0,z:0,yaw:0,pitch:0,stance:'stand',alive:true,hp:100,kills:0,deaths:0};
   room.players.set(me.id,me);
   send(ws,{type:'welcome',id:me.id,admin,room:{id:room.id,name:room.name},cq:room.cq});
   roomSend(room,{type:'notice',text:name+(admin?' (admin)':'')+(team==='nato'?' joined NATO':' joined WARSAW PACT')});
   return;
  }
  switch(m.type){
   case 'state':{ /* own position and status; the room sees it on the next world update */
    const n=(v,d=0)=>Number.isFinite(+v)?+v:d;
    me.x=n(m.x);me.y=n(m.y);me.z=n(m.z);me.yaw=n(m.yaw);me.pitch=n(m.pitch);me.stance=['stand','crouch','prone'].includes(m.stance)?m.stance:'stand';
    me.alive=!!m.alive;me.hp=n(m.hp,100);me.down=!!m.down;me.cls=CLASSES.includes(m.cls)?m.cls:me.cls;break}
   case 'shot':{ /* a shot for everyone else to see (tracer) */
    const o=Array.isArray(m.o)&&m.o.length===3?m.o.map(v=>+v||0):null,d=Array.isArray(m.d)&&m.d.length===3?m.d.map(v=>+v||0):null;
    if(o&&d)for(const p of room.players.values())if(p!==me)send(p.ws,{type:'shot',from:me.id,o,d});break}
   case 'hit':{ /* the shooter reports a hit; the server only relays it to the target, who applies it */
    const t=room.players.get(+m.target);if(!t||t===me||t.team===me.team||!t.alive)break;
    send(t.ws,{type:'hurt',dmg:Math.min(100,Math.max(0,+m.dmg||0)),part:['head','chest','larm','rarm','lleg','rleg'].includes(m.part)?m.part:null,wpn:m.wpn==='pistol'?'pistol':'rifle',wname:String(m.wname||'').slice(0,20),fx:me.x,fz:me.z,by:me.id,byName:me.name});break}
   case 'revive':{ /* a medic holds MED next to a downed teammate: the progress goes to that player, who is revived on done */
    const t=room.players.get(+m.target);if(!t||t===me||t.team!==me.team||!t.down)break;
    if(m.done){t.down=false;send(t.ws,{type:'revived',byName:me.name});break}
    send(t.ws,{type:'reviving',byName:me.name,on:!!m.on});break}
   case 'died':{ /* a player reports its own death; the server scores it */
    if(me.alive===false&&me.deathReported)break;
    me.alive=false;me.deathReported=true;me.deaths++;const k=room.players.get(+m.by);
    if(k&&k!==me&&k.team!==me.team){k.kills++;roomSend(room,{type:'notice',text:k.name+' eliminated '+me.name})}
    setTimeout(()=>{me.deathReported=false},1500);break}
   case 'admin':{ /* admin actions: checked here, not in the browser */
    if(!me.admin)break;
    if(m.action==='kick'){const t=room.players.get(+m.target);if(t&&t!==me){send(t.ws,{type:'kicked',reason:'Removed by an admin'});t.ws.close()}}
    else if(m.action==='restart'){restartMatch(room,'Admin restarted the match')}
    break}
  }
 });
 ws.on('close',()=>{if(room&&me){room.players.delete(me.id);roomSend(room,{type:'notice',text:me.name+' left'})}});
});

function restartMatch(room,why){room.cq=cqNew(CQ_POINTS);room.ended=0;for(const p of room.players.values()){p.kills=0;p.deaths=0}
 room.captures={nato:0,wp:0};roomSend(room,{type:'matchstart',why})}

/* 10 times a second: send each room the world; 4 times a second: run the capture rules */
let lastCQ=Date.now();
setInterval(()=>{
 const now=Date.now(),dt=(now-lastCQ)/1000;lastCQ=now;
 for(const room of rooms){
  const units=[];for(const p of room.players.values())if(p.alive&&p.hp>0)units.push({team:p.team,x:p.x,z:p.z,alive:true});
  if(!room.cq.over){const ev=cqStep(room.cq,units,dt);
   for(const e of ev){if(e.type==='capture'){room.captures[e.team]++;roomSend(room,{type:'cqevent',kind:'capture',point:e.point,name:e.name,team:e.team})}
    if(e.type==='win'){room.ended=now;roomSend(room,{type:'matchend',winner:e.team,reason:e.reason,
     players:[...room.players.values()].map(p=>({id:p.id,name:p.name,team:p.team,kills:p.kills,deaths:p.deaths})),captures:room.captures,restartIn:RESTART_DELAY})}}}
  if(room.ended&&now-room.ended>RESTART_DELAY*1000)restartMatch(room,'New match');
  const world={type:'world',t:now,cq:room.cq,players:[...room.players.values()].map(p=>({id:p.id,name:p.name,team:p.team,cls:p.cls,admin:p.admin,down:!!p.down,
   x:p.x,y:p.y,z:p.z,yaw:p.yaw,pitch:p.pitch,stance:p.stance,alive:p.alive,hp:p.hp,kills:p.kills,deaths:p.deaths}))};
  roomSend(room,world);
 }
},100);
setInterval(()=>{for(const room of rooms)for(const p of room.players.values()){if(!p.ws.isAlive){p.ws.terminate();continue}p.ws.isAlive=false;p.ws.ping()}},15000);

httpSrv.listen(PORT,()=>{
 console.log('Project Fieldcraft server listening on port '+PORT);
 console.log('Servers: '+rooms.map(r=>r.name).join(' | '));
 console.log('Admins: '+[...ADMINS].join(', ')+'. An admin is any account with one of these names; register these names yourself before others can.');
});
