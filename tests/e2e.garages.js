// Toyota garages near the route: markers + a list with details; the checkbox / map button take them off and put them back
const {chromium}=require('playwright');(async()=>{const errs=[];
const b=await chromium.launch();const p=await b.newPage({viewport:{width:420,height:900}});p.on('pageerror',e=>errs.push(e.message));
await p.route(/functions\/v1\/api/,async r=>{const u=new URL(r.request().url());const path=u.pathname.replace(/^.*\/api/,'');const J=(o,s=200)=>r.fulfill({status:s,contentType:'application/json',body:JSON.stringify(o)});
 if(path==='/health')return J({ok:true,claude:true,group:true});return J({error:'nf'},404);});
await p.route(/tile|arcgis|israelhiking|nominatim|open-meteo|wikimedia|wikidata|githubusercontent/,r=>r.abort());
let hits=0;
await p.route(/offroad\/data\/toyota\.json/,r=>{hits++;r.fulfill({contentType:'application/json',body:JSON.stringify({built:'2026-11-15T00:00:00Z',items:[
 [39.64,20.84,{name:'Toyota Ioannina',kind:'repair',addr:'Dodonis 5',city:'Ioannina',phone:'+30 2651 000000',website:'www.toyota-ioannina.gr',hours:'Mo-Fr 08:00-16:00'}],
 [39.60,20.40,{name:'Toyota <West>',kind:'dealer'}],
 [41.5,23.5,{name:'Toyota Far',kind:'dealer'}]]})});});
await p.addInitScript(()=>{localStorage.setItem('groupCode','abc');localStorage.setItem('accAll','1');localStorage.setItem('nick','חמי');});
await p.goto('file://'+process.argv[2]);await p.waitForTimeout(500);
const ok=(c,t)=>{console.log((c?'PASS ':'FAIL ')+t);if(!c)process.exitCode=1;};
await p.evaluate(()=>{const coords=[[39.66,20.85],[39.62,20.7],[39.58,20.5],[39.55,20.3]];
 showSaved({id:'t1',trip_id:'t1',version:1,name:'בדיקה',params:{start:{name:'Ioannina',lat:39.66,lon:20.85},end:{name:'West',lat:39.55,lon:20.3},days:1,loop:false},coords,waypoints:[],
  stats:{len:50000,hrs:2,maxD:1,byD:[50000,0,0,0,0,0],runs:[[0,3]],asph:50000}});});
await p.waitForTimeout(1200);
const st=()=>p.evaluate(()=>({n:document.querySelectorAll('.safeic.gar').length,items:[...document.querySelectorAll('#garages .garitem')].map(x=>x.textContent),html:document.querySelector('#garages').innerHTML,chk:document.querySelector('#garChk')?.checked,off:document.querySelector('.garctl a').classList.contains('off')}));
let t=await st();
ok(t.n===2&&t.items.length===2,'two garages near the way, the far one left out ('+t.n+')');
ok(/Toyota Ioannina/.test(t.items[0])&&/מוסך/.test(t.items[0])&&/Dodonis 5, Ioannina/.test(t.items[0])&&/Mo-Fr/.test(t.items[0])&&/tel:\+302651000000/.test(t.html)&&/https:\/\/www\.toyota-ioannina\.gr/.test(t.html),'details: '+t.items[0].slice(0,90));
ok(/Toyota &lt;West&gt;/.test(t.html)&&/waze\.com/.test(t.html),'names escaped, navigation links');
ok(/maps\/search\/Toyota\+service\/@39\.66/.test(t.html)&&(t.html.match(/gargoogle/g)||[]).length===1,'live Google Maps search links');
await p.click('#garChk');await p.waitForTimeout(300);t=await st();
ok(t.n===0&&t.items.length===0&&t.chk===false&&t.off,'checkbox takes them off the map and the list');
await p.click('.garctl a');await p.waitForTimeout(300);t=await st();
ok(t.n===2&&t.chk===true&&!t.off&&hits===1,'map button puts them back; the file is fetched once ('+hits+')');
await p.click('.safeic.gar');await p.waitForTimeout(300);
ok(await p.evaluate(()=>/Toyota/.test(document.querySelector('.garpop')?.textContent||'')),'tapping a marker opens its details');
console.log(errs.join('\n')||'no page errors');if(errs.length)process.exitCode=1;await b.close();})();
