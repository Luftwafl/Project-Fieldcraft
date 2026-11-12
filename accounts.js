/* Project Fieldcraft accounts: register, log in, and save each account's wallet (cash, owned scopes, equipped scope, stats).
   Passwords are stored as scrypt hashes with a random salt. Accounts are kept in accounts.json next to this file.
   A login gives a random token; the game sends it when joining a server, so the server knows who is playing. */
const crypto=require('crypto'),fs=require('fs'),path=require('path');
/* DATA_DIR (set on a hosted server) is where accounts.json is kept; it must be on a disk that survives restarts. */
const DATA_DIR=process.env.DATA_DIR||__dirname;try{fs.mkdirSync(DATA_DIR,{recursive:true})}catch(e){}
const FILE=path.join(DATA_DIR,'accounts.json');
const SCOPE_IDS=['iron','dot','s3','s6'];
const NAME_RE=/^[A-Za-z0-9_]{3,16}$/;
let db={accounts:{}};
try{const j=JSON.parse(fs.readFileSync(FILE,'utf8'));if(j&&j.accounts&&typeof j.accounts==='object')db=j}catch(e){}
let saveT=null;
/* write the accounts file now (also called on shutdown, so the last save is not lost) */
function flush(){clearTimeout(saveT);saveT=null;try{const tmp=FILE+'.tmp';fs.writeFileSync(tmp,JSON.stringify(db));fs.renameSync(tmp,FILE);return true}catch(e){console.log('Could not save accounts: '+e.message);return false}}
function save(){clearTimeout(saveT);saveT=setTimeout(flush,300)}
if(!process.env.DATA_DIR)console.log('WARNING: DATA_DIR is not set. Accounts are kept in '+FILE+' and are lost when a host without a persistent disk restarts.');
else console.log('Accounts are kept in '+FILE);
const lower=s=>String(s).toLowerCase();
const num=(v,d=0)=>Number.isFinite(+v)&&+v>=0?+v:d;
/* per-gun optics: each gun (weapon id) has its own owned optics and equipped optic */
function cleanGun(g){const o={owned:{iron:true},eq:'iron'};if(!g||typeof g!=='object')return o;
 for(const id of SCOPE_IDS)if(g.owned&&g.owned[id])o.owned[id]=true;
 if(SCOPE_IDS.includes(g.eq)&&o.owned[g.eq])o.eq=g.eq;return o}
function cleanWallet(w){
 const out={cash:0,guns:{},stats:{kills:0,captures:0,wins:0,matches:0}};
 if(!w||typeof w!=='object')return out;
 out.cash=Math.floor(num(w.cash));
 if(w.guns&&typeof w.guns==='object')for(const k of Object.keys(w.guns))if(/^[a-z0-9]{2,12}$/.test(k)&&Object.keys(out.guns).length<20)out.guns[k]=cleanGun(w.guns[k]);
 if(w.stats&&typeof w.stats==='object')for(const k of Object.keys(out.stats))out.stats[k]=Math.floor(num(w.stats[k]));
 return out}
function hashPw(pw,salt){return crypto.scryptSync(pw,salt,64).toString('hex')}
function newToken(acc){const t=crypto.randomBytes(32).toString('hex');acc.token=t;save();return t}
function register(name,pw){
 name=String(name||'').trim();pw=String(pw||'');
 if(!NAME_RE.test(name))return{code:400,error:'Names are 3 to 16 letters, numbers or underscores.'};
 if(pw.length<6||pw.length>200)return{code:400,error:'Passwords are 6 to 200 characters.'};
 if(db.accounts[lower(name)])return{code:409,error:'That name is taken.'};
 const salt=crypto.randomBytes(16).toString('hex');
 const acc={name,salt,hash:hashPw(pw,salt),wallet:cleanWallet(null),token:null};
 db.accounts[lower(name)]=acc;const token=newToken(acc);
 return{code:200,token,name,wallet:acc.wallet}}
function login(name,pw){
 const acc=db.accounts[lower(String(name||'').trim())];
 if(!acc)return{code:401,error:'Wrong name or password.'};
 const h=Buffer.from(hashPw(String(pw||''),acc.salt),'hex'),want=Buffer.from(acc.hash,'hex');
 if(h.length!==want.length||!crypto.timingSafeEqual(h,want))return{code:401,error:'Wrong name or password.'};
 const token=newToken(acc);
 return{code:200,token,name:acc.name,wallet:acc.wallet}}
function byToken(token){if(!token||typeof token!=='string'||token.length!==64)return null;
 for(const acc of Object.values(db.accounts))if(acc.token&&acc.token===token)return acc;return null}
function putWallet(token,wallet){const acc=byToken(token);if(!acc)return false;acc.wallet=cleanWallet(wallet);save();return true}
function logout(token){const acc=byToken(token);if(acc){acc.token=null;save()}}
module.exports={register,login,byToken,putWallet,logout,cleanWallet,flush};
