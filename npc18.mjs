import {open} from './lib.mjs';
const {b,p,errs}=await open({ctx:{viewport:{width:1100,height:640}}});
await p.click('#s-home .nav [data-go=mode]');await p.click('#pveBtn');await p.click('[data-f=nato]');await p.click('#bDeploy');
await p.waitForTimeout(200);await p.evaluate(()=>__fc.setLocked(true));
await p.waitForFunction(()=>__fc.W.act==='ready',null,{timeout:40000});
await p.evaluate(()=>{const c=__fc.CH.all.find(o=>o.kind==='soldier'&&o.team!==__fc.sel?.f&&o.state!=='dead');const P=__fc.P;
 const t=c||__fc.CH.all[0];P.x=t.x-Math.sin(0)*0;P.z=t.z-7;P.y=__fc.H(P.x,P.z)+0;P.yaw=0;P.pitch=0;});
await p.waitForTimeout(2500);await p.screenshot({path:'/home/claude/test/npc18.png'});
console.log('errors',errs.length?errs.slice(0,3):'none');await b.close();
