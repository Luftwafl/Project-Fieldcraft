import {createRequire} from 'module';
const require=createRequire('/opt/npm-tools/node_modules/');
export const {chromium}=require('playwright');
import fs from 'fs';
export const three=fs.readFileSync('/home/claude/test/three.module.js','utf8');
export async function open(opts={}){
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox','--autoplay-policy=no-user-gesture-required']});
  const ctx=await b.newContext(opts.ctx||{viewport:{width:640,height:360}});
  const p=await ctx.newPage();await p.addInitScript(()=>{try{localStorage.setItem('fc2_set',JSON.stringify({q:'low'}))}catch(e){}});
  const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message));p.on('console',m=>{if(m.type()==='error'||m.type()==='warning')errs.push(m.type()+': '+m.text())});
  await p.route('**/three.module.js',r=>r.fulfill({body:three,contentType:'text/javascript'}));
  await p.goto('file://'+(process.env.F||'/home/claude/s2/dist/index.html')+'');
  await p.waitForFunction(()=>window.__fc&&document.getElementById('load').classList.contains('hide'),null,{timeout:60000});
  return {b,p,errs};
}
