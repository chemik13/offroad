// microphone: tap = listen, tap again = stop (and plan with what was said)
const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.addInitScript(()=>{window.__recs=0;const F=class{constructor(){window.__recs++;window.__rec=this;}start(){setTimeout(()=>this.onresult&&this.onresult({resultIndex:0,results:[Object.assign([{transcript:'יום במדבר'}],{isFinal:true})]}),100);}stop(){setTimeout(()=>this.onend&&this.onend(),10);}};for(const k of ['SpeechRecognition','webkitSpeechRecognition'])Object.defineProperty(window,k,{value:F,configurable:true,writable:true});});
await p.route(/tile|arcgis|israelhiking|functions\/v1/,r=>r.abort());
await p.goto('file://'+process.argv[2]);await p.waitForTimeout(500);
let planned=0;await p.exposeFunction('__planned',()=>planned++);await p.evaluate(()=>{window.run=()=>window.__planned();});
const ok=(c,t)=>{console.log((c?'PASS ':'FAIL ')+t);if(!c)process.exitCode=1;};
const mic=p.locator('#micBtn');
await mic.click();await p.waitForTimeout(300);
ok(await mic.evaluate(e=>e.classList.contains('on')),'mic on after first tap');
const v=await p.inputValue('#prompt');ok(v.includes('יום במדבר'),'speech written to the box: '+v);
await mic.click();await p.waitForTimeout(300);
ok(!(await mic.evaluate(e=>e.classList.contains('on'))),'mic off after second tap');
const n=await p.evaluate(()=>window.__recs);ok(n===1,'no second recogniser started ('+n+')');
console.log(errs.join('\n')||'no page errors');await b.close();})();
