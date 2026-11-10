// Entry gate: shown without a code; wrong code -> message; right code -> saved, gate gone; invite link logs in by itself.
const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const errs=[];
 const mk=async()=>{const p=await b.newPage({viewport:{width:390,height:844}});p.on('pageerror',e=>errs.push(e.message));
  await p.route(/functions\/v1\/api\/routes/,r=>r.fulfill({status:r.request().headers()['x-group-code']==='jeep4x4'?200:401,contentType:'application/json',body:r.request().headers()['x-group-code']==='jeep4x4'?'{"routes":[]}':'{"error":"x"}'}));
  await p.route(/tile\.|arcgis|fonts|githubusercontent|functions\/v1\/api\/health/,r=>r.abort());return p;};
 const p=await mk();await p.goto('file://'+process.argv[2]+'#code=');await p.waitForTimeout(300);
 const shown=await p.isVisible('#gate');
 await p.fill('#gateCode','nope');await p.click('#gateGo');await p.waitForTimeout(400);const msg=await p.textContent('#gateMsg');
 await p.fill('#gateCode','jeep4x4');await p.fill('#gateNick','דני');await p.click('#gateGo');await p.waitForTimeout(400);
 const after=await p.evaluate(()=>({gate:!document.getElementById('gate').hidden,code:localStorage.getItem('groupCode'),nick:localStorage.getItem('nick')}));
 await p.screenshot({path:process.argv[3]});
 const p2=await mk();await p2.goto('file://'+process.argv[2]+'#code=jeep4x4');await p2.waitForTimeout(600);
 const inv=await p2.evaluate(()=>({gate:!document.getElementById('gate').hidden,code:localStorage.getItem('groupCode'),hash:location.hash}));
 console.log(JSON.stringify({shown,msg,after,inv}));console.log(errs.join('\n')||'no page errors');await b.close();})();
