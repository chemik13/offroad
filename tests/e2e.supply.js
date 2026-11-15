// fuel stations and supermarkets beside the route: markers from a close zoom, each layer with its own switch (panel and map button)
const {chromium}=require('playwright');(async()=>{const errs=[];
const b=await chromium.launch();const p=await b.newPage({viewport:{width:420,height:900}});p.on('pageerror',e=>errs.push(e.message));
await p.route(/functions\/v1\/api/,async r=>{const u=new URL(r.request().url());const path=u.pathname.replace(/^.*\/api/,'');const J=(o,s=200)=>r.fulfill({status:s,contentType:'application/json',body:JSON.stringify(o)});
 if(path==='/health')return J({ok:true,claude:true,group:true});return J({error:'nf'},404);});
await p.route(/tile|arcgis|israelhiking|nominatim|open-meteo|wikimedia|wikidata|githubusercontent/,r=>r.abort());
await p.addInitScript(()=>{localStorage.setItem('groupCode','abc');localStorage.setItem('accAll','1');localStorage.setItem('nick','חמי');});
await p.goto('file://'+process.argv[2]);await p.waitForTimeout(500);
const ok=(c,t)=>{console.log((c?'PASS ':'FAIL ')+t);if(!c)process.exitCode=1;};
await p.evaluate(()=>{window.asked=0;poisFromTiles=async(pts,rad)=>{window.asked++;return{camps:[],miss:[],supply:[
  {kind:'fuel',name:'Eni',lat:39.661,lon:20.84,diesel:'yes',petrol:'yes',lpg:'yes',hours:'24/7'},{kind:'fuel',name:'Shell <x>',lat:39.60,lon:20.601,diesel:'',lpg:'',petrol:''},
  {kind:'fuel',name:'Far fuel',lat:39.9,lon:20.6},{kind:'food',name:'Lidl',lat:39.659,lon:20.851,hours:'Mo-Sa 08:00-21:00'},{kind:'food',name:'Mini',lat:39.58,lon:20.5,small:true}]};};
 const line=(a,b,n)=>Array.from({length:n+1},(_,i)=>[a[0]+(b[0]-a[0])*i/n,a[1]+(b[1]-a[1])*i/n]);const coords=line([39.66,20.85],[39.55,20.3],60);
 showSaved({id:'t1',trip_id:'t1',version:1,name:'בדיקה',params:{start:{name:'Ioannina',lat:39.66,lon:20.85},end:{name:'West',lat:39.55,lon:20.3},days:1,loop:false},coords,waypoints:[],stats:{len:50000,hrs:2,maxD:1,byD:[50000,0,0,0,0,0],runs:[[0,61]],asph:50000}});});
await p.waitForTimeout(1000);
const st=()=>p.evaluate(()=>({f:document.querySelectorAll('.safeic.fuel').length,l:document.querySelectorAll('.safeic.fuel.lpg').length,s:document.querySelectorAll('.safeic.food').length,sum:document.querySelector('details[data-k=supply] .accsum').textContent,txt:document.querySelector('#supply').textContent,z:map.getZoom(),d:supData&&[supData.fuel.length,supData.food.length]}));
let t=await st();
ok(t.d&&t.d[0]===2&&t.d[1]===2&&/2 תחנות · 2 סופרים/.test(t.sum),'beside the way only: '+t.sum+' (far one left out)');
await p.evaluate(()=>map.setView([39.66,20.845],13,{animate:false}));await p.waitForTimeout(400);t=await st();
ok(t.f===1&&t.l===1&&t.s===1,'close up: the markers on screen ('+[t.f,t.s]+'), LPG station ringed');
await p.evaluate(()=>map.setView([39.6,20.6],8,{animate:false}));await p.waitForTimeout(400);t=await st();
ok(t.f===0&&t.s===0,'far out: no markers');
await p.evaluate(()=>map.setView([39.61,20.72],10,{animate:false}));await p.waitForTimeout(400);t=await st();
ok(t.f===2&&t.s===2,'zoom 10: all four');
await p.locator('.safeic.fuel.lpg').dispatchEvent('click');await p.waitForTimeout(300);
ok(await p.evaluate(()=>/סולר · בנזין · גז \(LPG\)/.test(document.querySelector('.garpop')?.textContent||'')&&/24\/7/.test(document.querySelector('.garpop').textContent)),'station popup: the fuels sold and the hours');
await p.evaluate(()=>map.closePopup());
await p.click('input[data-sup=food]');await p.waitForTimeout(500);t=await st();
ok(t.f===2&&t.s===0&&/^2 תחנות$/.test(t.sum)&&await p.evaluate(()=>document.querySelector('.garctl a.sfood').classList.contains('off')),'supermarkets off from the panel: '+t.sum);
await p.click('.garctl a.sfuel');await p.waitForTimeout(500);t=await st();
ok(t.f===0&&t.s===0&&t.sum==='כבוי','fuel off from the map button: '+t.sum);
await p.click('.garctl a.sfood');await p.waitForTimeout(600);t=await st();
ok(t.s===2&&t.f===0&&/2 סופרים/.test(t.sum),'supermarkets back on');
ok(await p.evaluate(()=>document.querySelector('#supply').innerHTML.indexOf('<x>')<0),'names escaped');
console.log(errs.join('\n')||'no page errors');if(errs.length)process.exitCode=1;await b.close();})();
