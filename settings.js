/* ============ settings (persisted, defensively validated) ============ */
const STAGE=2;
const DEFBINDS={fwd:'KeyW',back:'KeyS',left:'KeyA',right:'KeyD',fire:'Mouse0',ads:'Mouse2',reload:'KeyR',slot1:'Digit1',slot2:'Digit2',cycle:'KeyQ',mode:'KeyF',sprint:'ShiftLeft',jump:'Space',pause:'KeyP',use:'KeyE',cam:'KeyV',crouch:'KeyC',prone:'KeyZ',leanL:'KeyX',leanR:'KeyG',map:'KeyM'};
const ACTS=[['fwd','Move forward'],['back','Move backward'],['left','Strafe left'],['right','Strafe right'],['fire','Fire'],['ads','Aim down sights (toggle)'],['reload','Reload'],['slot1','Primary weapon'],['slot2','Secondary weapon'],['cycle','Cycle weapon'],['mode','Fire mode'],['sprint','Sprint'],['jump','Jump / climb sandbags and rocks'],['pause','Pause'],['use','Enter / leave truck'],['cam','Truck camera (1st / 3rd person)'],['crouch','Crouch / stand up'],['prone','Prone / get up'],['leanL','Lean left'],['leanR','Lean right'],['map','Full map (hold to see allies)']];
const SET_KEY='fc2_set',SET_VER=2;
const defaultSettings=()=>({v:SET_VER,q:'med',master:.8,wpn:1,fx:1,mute:false,mouse:1,touch:1,fps:false,res:1,shadow:true,view:1,leanMode:'hold',binds:Object.assign({},DEFBINDS),more:{}});
const SET=defaultSettings();
const MAX_KEYS=6;
const codesOf=a=>[SET.binds[a],...((SET.more&&SET.more[a])||[])].filter(Boolean);
function setSlot(a,idx,code){const m=(SET.more&&SET.more[a])||[];if(idx===-1){if(codesOf(a).length<MAX_KEYS)m.push(code)}else if(idx===0)SET.binds[a]=code;else m[idx-1]=code;if(!SET.more)SET.more={};if(m.length)SET.more[a]=m;else delete SET.more[a]}
function removeSlot(a,idx){if(!SET.more)SET.more={};const m=SET.more[a]||[];if(idx>0)m.splice(idx-1,1);else if(m.length)SET.binds[a]=m.shift();if(m.length)SET.more[a]=m;else delete SET.more[a]}
function applyBind(a,idx,code,owner){const old=idx>=0?codesOf(a)[idx]:null,oc=codesOf(owner),j=oc.indexOf(code);
 if(old&&!oc.includes(old)){if(j===0)SET.binds[owner]=old;else SET.more[owner][j-1]=old}
 else removeSlot(owner,j);
 setSlot(a,idx,code)}
function loadSettings(){const c=(v,a,b)=>Math.max(a,Math.min(b,v)),num=(v,a,b,d)=>typeof v==='number'&&isFinite(v)?c(v,a,b):d;
 try{const raw=store.get(SET_KEY);if(!raw)return;const j=JSON.parse(raw);if(!j||typeof j!=='object'||Array.isArray(j))return;
  SET.master=num(j.master,0,1,SET.master);SET.wpn=num(j.wpn,0,1,SET.wpn);SET.fx=num(j.fx,0,1,SET.fx);SET.mouse=num(j.mouse,.3,2.5,1);SET.touch=num(j.touch,.3,2.5,1);
  SET.res=num(j.res,.5,1,1);SET.view=num(j.view,.6,1.3,1);
  if(typeof j.mute==='boolean')SET.mute=j.mute;if(j.leanMode==='hold'||j.leanMode==='toggle')SET.leanMode=j.leanMode;if(typeof j.fps==='boolean')SET.fps=j.fps;if(typeof j.shadow==='boolean')SET.shadow=j.shadow;
  if(j.q==='low'||j.q==='med'||j.q==='high')SET.q=j.q;
  if(j.binds&&typeof j.binds==='object'){const ok=/^(Key[A-Z]|Digit\d|Arrow(Up|Down|Left|Right)|Mouse[0-4]|Shift(Left|Right)|Control(Left|Right)|Alt(Left|Right)|Space|Tab|Enter|Backspace|Numpad\w+|F\d{1,2}|Bracket(Left|Right)|Semicolon|Quote|Comma|Period|Slash|Backslash|Minus|Equal|Backquote)$/,b=Object.assign({},DEFBINDS);
   for(const a in DEFBINDS)if(typeof j.binds[a]==='string'&&ok.test(j.binds[a])&&j.binds[a]!=='Escape')b[a]=j.binds[a];
   if(new Set(Object.values(b)).size===Object.keys(b).length)SET.binds=b;if(j.more&&typeof j.more==='object'&&!Array.isArray(j.more)){const seen=new Set(Object.values(b)),m={};for(const a in DEFBINDS){const arr=Array.isArray(j.more[a])?j.more[a]:[],keep=[];for(const k of arr.slice(0,MAX_KEYS-1))if(typeof k==='string'&&ok.test(k)&&k!=='Escape'&&!seen.has(k)){keep.push(k);seen.add(k)}if(keep.length)m[a]=keep}SET.more=m}}}catch(e){Object.assign(SET,defaultSettings())}}
loadSettings();
const saveSet=()=>store.set(SET_KEY,JSON.stringify(SET));
