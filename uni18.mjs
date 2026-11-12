import {open} from './lib.mjs';
for(const f of['nato','wp']){
const {b,p,errs}=await open({ctx:{viewport:{width:1100,height:640}}});
await p.click('#s-home .nav [data-go=mode]');await p.click('#pveBtn');await p.click(`[data-f=${f}]`);await p.waitForTimeout(2000);await p.screenshot({path:`/home/claude/test/uni_${f}.png`});
console.log(f,'errors',errs.length?errs.slice(0,3):'none');await b.close();}
