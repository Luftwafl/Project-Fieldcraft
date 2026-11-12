/* ---------- accounts. With the game served by a server, accounts live on the server and follow you to other browsers.
   Without a reachable server (for example the game file opened directly), an account is kept in this browser only:
   PVE and the Gunsmith work, PVP needs a server account. ---------- */
const ACC={token:null,name:null,admin:false,local:false};
const ACC_KEY='fc2_acc',LOCAL_KEY='fc2_local_accounts';
const NAME_OK=/^[A-Za-z0-9_]{3,16}$/;
function accBase(){if(/^https?:/.test(location.protocol))return location.origin;let v=null;try{v=localStorage.getItem('fc2_server')}catch(e){}return v?netHttpUrl(netWsUrl(v)):null}
function accLoad(){try{const j=JSON.parse(localStorage.getItem(ACC_KEY)||'null');if(j&&j.token){ACC.token=j.token;ACC.name=j.name||null;ACC.local=!!j.local;ACC.admin=false}}catch(e){}}
function accStore(){try{if(ACC.token)localStorage.setItem(ACC_KEY,JSON.stringify({token:ACC.token,name:ACC.name,local:ACC.local}));else localStorage.removeItem(ACC_KEY)}catch(e){}}
function localAccounts(){try{return JSON.parse(localStorage.getItem(LOCAL_KEY)||'{}')||{}}catch(e){return{}}}
function saveLocalAccounts(o){try{localStorage.setItem(LOCAL_KEY,JSON.stringify(o))}catch(e){}}
function hexOf(buf){return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('')}
async function pwHash(pw,salt){
 if(window.crypto&&crypto.subtle){const enc=new TextEncoder();const k=await crypto.subtle.importKey('raw',enc.encode(pw),'PBKDF2',false,['deriveBits']);
  return hexOf(await crypto.subtle.deriveBits({name:'PBKDF2',salt:enc.encode(salt),iterations:100000,hash:'SHA-256'},k,256))}
 /* no crypto.subtle on this page (plain-HTTP address): a weak salted hash, so local passwords are only lightly protected */
 let h=2166136261;const s=salt+pw;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0}
 return 'fnv'+h.toString(16)}
async function localAuth(create,name,pw){
 const all=localAccounts(),key=name.toLowerCase();
 if(create){
  if(!NAME_OK.test(name))throw new Error('Names are 3 to 16 letters, numbers or underscores.');
  if(pw.length<6)throw new Error('Passwords are 6 or more characters.');
  if(all[key])throw new Error('That name is taken in this browser.');
  const salt=hexOf(crypto.getRandomValues(new Uint8Array(16)));
  all[key]={name,salt,hash:await pwHash(pw,salt),wallet:null};saveLocalAccounts(all);
  return{token:'local:'+key,name,admin:false,local:true,wallet:null}}
 const a=all[key];if(!a)throw new Error('Wrong name or password.');
 if(await pwHash(pw,a.salt)!==a.hash)throw new Error('Wrong name or password.');
 return{token:'local:'+key,name:a.name,admin:false,local:true,wallet:a.wallet}}
async function accCall(path,opts){opts=opts||{};const base=accBase();if(!base){const e=new Error('no server');e.status=0;throw e}
 const h={'Content-Type':'application/json'};if(ACC.token)h.Authorization='Bearer '+ACC.token;
 const r=await fetch(base+path,{method:opts.method||'GET',headers:h,body:opts.body?JSON.stringify(opts.body):undefined});
 let j={};try{j=await r.json()}catch(e){}
 if(!r.ok)throw Object.assign(new Error(j.error||'The server did not answer.'),{status:r.status});return j}
function accApply(j){ACC.token=j.token||ACC.token;ACC.name=j.name;ACC.admin=!!j.admin;ACC.local=!!j.local;accStore();
 if(j.wallet)WALLET=walletFrom(j.wallet)}
let accT=null;
function accSaveSoon(){if(!ACC.token)return;
 if(ACC.local){const all=localAccounts(),a=all[(ACC.name||'').toLowerCase()];if(a){a.wallet=WALLET;saveLocalAccounts(all)}return}
 if(!accBase())return;clearTimeout(accT);
 accT=setTimeout(()=>{accCall('/account/wallet',{method:'PUT',body:{wallet:WALLET}}).catch(e=>{if(e.status===401)accLogout(true)})},800)}
async function accSubmit(create){const name=document.getElementById('accName').value.trim(),pw=document.getElementById('accPass').value,msg=document.getElementById('accMsg');
 if(!name||!pw){msg.textContent='Enter a name and a password.';return}
 msg.textContent=create?'Creating account...':'Logging in...';
 const local=WALLET;
 try{let j=null;
  if(accBase()){try{j=await accCall(create?'/account/register':'/account/login',{method:'POST',body:{name,password:pw}})}
   catch(e){if(e.status)throw e;/* no server answered: use this browser instead */}}
  if(!j)j=await localAuth(create,name,pw);
  accApply(j);
  if(create){WALLET=local;accSaveSoon()}  /* a new account starts with this browser's progress */
  document.getElementById('accPass').value='';
  msg.textContent=j.local?'Account created in this browser. Saves stay here; PVE and the Gunsmith work, PVP needs a server account.':'Logged in as '+ACC.name+'. Your progress is saved to this account.';
  renderAccount()}
 catch(e){msg.textContent=e.message}}
function accLogout(silent){if(ACC.token&&!ACC.local&&accBase())accCall('/account/logout',{method:'POST'}).catch(()=>{});
 ACC.token=null;ACC.name=null;ACC.admin=false;ACC.local=false;accStore();renderAccount();
 if(!silent)document.getElementById('accMsg').textContent='Logged out. Progress made now stays in this browser only.'}
async function accRestore(){accLoad();if(!ACC.token){renderAccount();return}
 if(ACC.local){const a=localAccounts()[(ACC.name||'').toLowerCase()];if(a)accApply({token:ACC.token,name:a.name,local:true,wallet:a.wallet});else accLogout(true);renderAccount();return}
 if(!accBase()){renderAccount();return}
 try{const j=await accCall('/account');accApply({token:ACC.token,name:j.name,admin:j.admin,wallet:j.wallet})}catch(e){if(e.status===401)accLogout(true)}
 renderAccount()}
function renderAccount(){const inn=!!ACC.token;
 document.getElementById('accForm').style.display=inn?'none':'';document.getElementById('accIn').style.display=inn?'':'none';
 document.getElementById('accWho').textContent=inn?'Logged in as '+ACC.name+(ACC.admin?' (admin)':'')+(ACC.local?' - this browser only':'')+'. Cash $'+WALLET.cash.toLocaleString('en-US')+'.':''}
function accSrvBoxInit(){const box=document.getElementById('accSrvBox'),inp=document.getElementById('accSrv');if(!box||!inp)return;
 const fromFile=!/^https?:/.test(location.protocol);box.style.display=fromFile?'':'none';
 let v='';try{v=localStorage.getItem('fc2_server')||''}catch(e){}inp.value=v;
 inp.onchange=()=>{try{localStorage.setItem('fc2_server',inp.value.trim())}catch(e){}}}
accSrvBoxInit();
accRestore();
