import {open} from './lib.mjs';
const {b,p}=await open({ctx:{viewport:{width:800,height:500}}});
await p.click('#s-home .nav [data-go=mode]');await p.click('#pveBtn');await p.click('[data-f=wp]');await p.click('#bDeploy');
await p.waitForTimeout(200);await p.evaluate(()=>__fc.setLocked(true));
await p.waitForFunction(()=>__fc.W.act==='ready',null,{timeout:40000});
const r=await p.evaluate(()=>{const F=__fc,P=F.P,o={},R=(k)=>F.dmgReset(k);
 const txt=id=>document.getElementById(id).textContent;
 /* 1: pistol to the head: helmet takes three, the fourth kills */
 R(2);for(let i=0;i<3;i++)F.hurtPlayer({wpn:'pistol',part:'head'});
 o.helmet3={alive:P.hp>0,helm:P.helm};
 F.hurtPlayer({wpn:'pistol',part:'head'});o.helmet4Dead=P.hp<=0;
 /* 2: rifle to the head goes through the helmet */
 R(2);F.hurtPlayer({wpn:'rifle',part:'head'});o.rifleHeadDead=P.hp<=0;
 /* 3: vest takes four rifle rounds to the chest, the fifth is a wound */
 R(2);for(let i=0;i<4;i++)F.hurtPlayer({wpn:'rifle',part:'chest'});
 o.vest4={hp:P.hp,vest:P.vest,wounds:P.wounds.length};
 F.hurtPlayer({wpn:'rifle',part:'chest'});o.vest5={hp:P.hp,wounds:P.wounds.map(w=>w.part+':'+w.rate)};
 /* 4: a pistol round to the chest is not stopped by the vest */
 R(2);F.hurtPlayer({wpn:'pistol',part:'chest'});o.pistolChest={hp:P.hp,vest:P.vest};
 /* 5: a leg wound bleeds, and nothing happens until blood is 50 */
 R(2);F.hurtPlayer({wpn:'rifle',part:'lleg'});o.leg={hp:P.hp,rate:+F.dmgHudText().length>0,wounds:P.wounds.length};
 F.dmgTick(10);o.legAfter10s={hp:+P.hp.toFixed(1),down:P.down};
 /* 6: at 50 blood the player is downed; the bleed-out timer runs out before the blood does */
 R(2);P.hp=55;F.hurtPlayer({wpn:'rifle',part:'larm'});o.downed={hp:+P.hp.toFixed(1),down:P.down,downT:P.downT};
 F.dmgTick(10);o.downT10={downT:+P.downT.toFixed(1),hp:+P.hp.toFixed(1),down:P.down};
 F.dmgTick(45);o.downT55={downT:+P.downT.toFixed(1),alive:P.hp>0};
 F.dmgTick(10);o.bledOut={dead:P.hp<=0,cause:txt('dthCause'),where:txt('dthWhere')};
 document.getElementById('dthScr').classList.remove('on');
 /* 7: a shot from behind is marked; the death screen counts it */
 R(2);P.yaw=0;P.x=P.x;F.hurtPlayer({wpn:'rifle',part:'chest',from:{x:P.x,z:P.z+5}});o.behind=P.hits[0].behind;
 R(2);F.hurtPlayer({wpn:'rifle',part:'chest',from:{x:P.x,z:P.z-5}});o.front=P.hits[0].behind;
 /* 8: medkits take the most severe wound first, one kit each */
 R(2);F.hurtPlayer({wpn:'rifle',part:'larm'});P.vest=0;F.hurtPlayer({wpn:'rifle',part:'chest'});
 F.useKit();o.kit1={kits:P.kits,wounds:P.wounds.map(w=>w.part)};
 F.useKit();o.kit2={kits:P.kits,wounds:P.wounds.length};
 F.useKit();o.kit3={kits:P.kits,wounds:P.wounds.length};
 R(0);F.hurtPlayer({wpn:'rifle',part:'larm'});F.useKit();o.noKits={kits:P.kits,wounds:P.wounds.length};
 /* 9: the death screen */
 R(2);F.hurtPlayer({wpn:'rifle',part:'head',name:'NATO SOLDIER',wname:'M16A2',from:{x:P.x,z:P.z+20}});
 o.death={on:document.getElementById('dthScr').classList.contains('on'),cause:txt('dthCause'),where:txt('dthWhere'),by:txt('dthBy'),stat:txt('dthStat'),dots:document.querySelectorAll('#dthDots circle').length};
 document.getElementById('dthScr').classList.remove('on');
 R(2);o.hudText=F.dmgHudText();o.kitsDefault=F.sel.kits;
 return o});
console.log(JSON.stringify(r,null,1));await b.close();
