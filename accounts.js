/* Project Fieldcraft accounts: register, log in, and save each account's wallet (cash, owned scopes, equipped scope, stats).
   Passwords are stored as scrypt hashes with a random salt. A login gives a random token; the game sends it when joining a
   server, so the server knows who is playing.
   Storage: a Postgres database when DATABASE_URL is set (survives any host restart), otherwise accounts.json in DATA_DIR
   (fine on your own PC; lost on a host without a persistent disk). The whole account list is loaded into memory at start-up,
   and changes are written back in the background. */
const crypto=require('crypto'),fs=require('fs'),path=require('path');
const DATABASE_URL=process.env.DATABASE_URL||'';
const DATA_DIR=process.env.DATA_DIR||__dirname;
const FILE=path.join(DATA_DIR,'accounts.json');
const SCOPE_IDS=['iron','dot','s3','s6'];
const NAME_RE=/^[A-Za-z0-9_]{3,16}$/;
const TABLE='fc_accounts';
let db={accounts:{}};
let pool=null;                 /* Postgres pool, when DATABASE_URL is set */
const dirty=new Set();         /* account keys changed since the last write */
let saveT=null;

/* load all accounts at start-up; a failed database connection stops the server rather than starting it empty */
async function init(){
 if(DATABASE_URL){
  const {Pool}=require('pg');
  pool=new Pool({connectionString:DATABASE_URL,ssl:/localhost|127\.0\.0\.1/.test(DATABASE_URL)?false:{rejectUnauthorized:false}});
  await pool.query(`CREATE TABLE IF NOT EXISTS ${TABLE} (name_key TEXT PRIMARY KEY, name TEXT NOT NULL, salt TEXT NOT NULL, hash TEXT NOT NULL, token TEXT, wallet JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
  const r=await pool.query(`SELECT name_key,name,salt,hash,token,wallet FROM ${TABLE}`);
  for(const row of r.rows)db.accounts[row.name_key]={name:row.name,salt:row.salt,hash:row.hash,token:row.token,wallet:cleanWallet(row.wallet)};
  console.log('Accounts: '+r.rows.length+' loaded from the database.');
  return}
 try{const j=JSON.parse(fs.readFileSync(FILE,'utf8'));if(j&&j.accounts&&typeof j.accounts==='object')db=j}catch(e){}
 try{fs.mkdirSync(DATA_DIR,{recursive:true})}catch(e){}
 if(!process.env.DATA_DIR)console.log('WARNING: DATA_DIR and DATABASE_URL are not set. Accounts are kept in '+FILE+' and are lost when a host without a persistent disk restarts.');
 else console.log('Accounts are kept in '+FILE);
}

const UPSERT=`INSERT INTO ${TABLE} (name_key,name,salt,hash,token,wallet,updated_at) VALUES ($1,$2,$3,$4,$5,$6,now())
 ON CONFLICT (name_key) DO UPDATE SET name=EXCLUDED.name,salt=EXCLUDED.salt,hash=EXCLUDED.hash,token=EXCLUDED.token,wallet=EXCLUDED.wallet,updated_at=now()`;

/* write changed accounts now (also awaited on shutdown, so the last change is not lost) */
async function flush(){clearTimeout(saveT);saveT=null;
 if(!dirty.size)return true;
 const keys=[...dirty];dirty.clear();
 try{
  if(pool){for(const k of keys){const a=db.accounts[k];if(a)await pool.query(UPSERT,[k,a.name,a.salt,a.hash,a.token,JSON.stringify(a.wallet)])}}
  else{const tmp=FILE+'.tmp';fs.writeFileSync(tmp,JSON.stringify(db));fs.renameSync(tmp,FILE)}
  return true}
 catch(e){keys.forEach(k=>dirty.add(k));console.log('Could not save accounts: '+e.message);clearTimeout(saveT);saveT=setTimeout(flush,5000);return false}}
function save(key){if(key)dirty.add(key);clearTimeout(saveT);saveT=setTimeout(flush,300)}

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
function newToken(key,acc){const t=crypto.randomBytes(32).toString('hex');acc.token=t;save(key);return t}
function register(name,pw){
 name=String(name||'').trim();pw=String(pw||'');
 if(!NAME_RE.test(name))return{code:400,error:'Names are 3 to 16 letters, numbers or underscores.'};
 if(pw.length<6||pw.length>200)return{code:400,error:'Passwords are 6 to 200 characters.'};
 if(db.accounts[lower(name)])return{code:409,error:'That name is taken.'};
 const salt=crypto.randomBytes(16).toString('hex');
 const acc={name,salt,hash:hashPw(pw,salt),wallet:cleanWallet(null),token:null};
 db.accounts[lower(name)]=acc;const token=newToken(lower(name),acc);
 return{code:200,token,name,wallet:acc.wallet}}
function login(name,pw){
 const key=lower(String(name||'').trim());const acc=db.accounts[key];
 if(!acc)return{code:401,error:'Wrong name or password.'};
 const h=Buffer.from(hashPw(String(pw||''),acc.salt),'hex'),want=Buffer.from(acc.hash,'hex');
 if(h.length!==want.length||!crypto.timingSafeEqual(h,want))return{code:401,error:'Wrong name or password.'};
 const token=newToken(key,acc);
 return{code:200,token,name:acc.name,wallet:acc.wallet}}
function keyOf(acc){for(const k in db.accounts)if(db.accounts[k]===acc)return k;return null}
function byToken(token){if(!token||typeof token!=='string'||token.length!==64)return null;
 for(const acc of Object.values(db.accounts))if(acc.token&&acc.token===token)return acc;return null}
function putWallet(token,wallet){const acc=byToken(token);if(!acc)return false;acc.wallet=cleanWallet(wallet);save(keyOf(acc));return true}
function logout(token){const acc=byToken(token);if(acc){acc.token=null;save(keyOf(acc))}}
module.exports={init,register,login,byToken,putWallet,logout,cleanWallet,flush};
