const $=id=>document.getElementById(id);
const showErr=m=>{$('load').classList.add('hide');const e=$('err');e.classList.remove('hide');e.textContent='ERROR\n'+m};
addEventListener('error',e=>showErr((e.message||'script error')+(e.lineno?' (line '+e.lineno+')':'')));
addEventListener('unhandledrejection',e=>showErr(String(e.reason&&e.reason.message||e.reason)));
let T=null;
for(const u of['https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js','https://unpkg.com/three@0.160.0/build/three.module.js']){try{T=await import(u);break}catch(e){console.warn(e)}}
if(!T){showErr('Could not load Three.js from the CDN.\nCheck your internet connection and reload the page.');throw new Error('three load failed')}
await new Promise(r=>setTimeout(r,30));

/* ============ setup ============ */
const touch=matchMedia('(pointer:coarse)').matches;if(touch)document.body.classList.add('touch');
const store={get:k=>{try{return localStorage.getItem(k)}catch(e){return null}},set:(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}}};
