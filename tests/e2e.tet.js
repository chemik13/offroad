// Group preferred tracks (e.g. TET): one upload, the planner prefers trails on them. Real tiles (Israel), mock API.
const {chromium}=require('playwright');const fs=require('fs');(async()=>{const b=await chromium.launch();const pg=await b.newPage();
const errs=[];pg.on('pageerror',e=>errs.push(e.message));
await pg.route(/fonts\.g|opentopomap|arcgis|tile\.openstreetmap/,r=>r.abort());
const TR=[];
await pg.route(/functions\/v1\/api/,async r=>{const u=new URL(r.request().url()),path=u.pathname.replace(/^.*\/api/,''),m=r.request().method();const J=(o,st=200)=>r.fulfill({status:st,contentType:'application/json',body:JSON.stringify(o)});
  if(path==='/health')return J({ok:true,claude:false,group:true});
  if(path==='/tracks'&&m==='GET')return J({tracks:TR.map(t=>u.searchParams.get('full')==='1'?t:{name:t.name,km:t.km,created_at:t.created_at})});
  if(path==='/tracks'&&m==='POST'){const b=JSON.parse(r.request().postData());const i=TR.findIndex(t=>t.name===b.name);const row={...b,created_at:new Date().toISOString()};if(i>=0)TR[i]=row;else TR.push(row);return J({ok:true},201);}
  const d=path.match(/^\/tracks\/(.+)$/);if(d&&m==='DELETE'){const n=decodeURIComponent(d[1]);const i=TR.findIndex(t=>t.name===n);if(i>=0)TR.splice(i,1);return J({ok:true});}
  return J({error:'nf'},404);});
await pg.addInitScript(()=>{localStorage.setItem('groupCode','abc');localStorage.setItem('nick','חמי');});
await pg.goto('file://'+process.argv[2]);
let fails=0;const ok=(c,t)=>{console.log((c?'PASS ':'FAIL ')+t);if(!c)fails++;};
const P={country:'IL',start:{name:'מצפה רמון',lat:30.6097,lon:34.8013,researched:true,country:'IL'},loop:true,duration_hours:3,difficulty:'medium',military_mode:'auto',via:[]};
const first=await pg.evaluate(async P=>{await run(true,P);const rs=current.res.results;return rs.map(r=>({len:r.len,tet:r.tet||0,coords:r.coords}));},P);
const alt=first[first.length-1];
const gpx='<?xml version="1.0"?><gpx version="1.1"><trk><name>t</name><trkseg>'+alt.coords.map(c=>`<trkpt lat="${c[0]}" lon="${c[1]}"></trkpt>`).join('')+'</trkseg></trk></gpx>';
fs.writeFileSync(process.argv[3]+'/tet-test.gpx',gpx);
await pg.evaluate(()=>{$('settingsBtn').click();$('tetBox').open=true;});
await pg.setInputFiles('#tetFile',process.argv[3]+'/tet-test.gpx');
await pg.waitForFunction(()=>/מסלולים ·/.test($('tetState').textContent),null,{timeout:20000});
console.log(await pg.evaluate(()=>$('tetState').textContent));
await pg.evaluate(()=>$('closeSettings').click());
const second=await pg.evaluate(async P=>{await run(true,P);const r=current.res.results[0];return {tet:r.tet||0,len:r.len,info:[...document.querySelectorAll('#warns *')].map(x=>x.textContent).filter(t=>/TET/.test(t)).slice(0,1)};},P);
console.log(JSON.stringify({firstTet:first.map(x=>x.tet), second}));
ok(first.every(x=>!x.tet),'no TET before import');
ok(second.tet>alt.len*0.2,'after import the chosen route runs on the TET track ('+Math.round(second.tet/1000)+' km)');
ok(TR.length===1&&TR[0].created_by==='חמי','uploaded once to the group server');
await pg.evaluate(async()=>{$('settingsBtn').click();$('tetBox').open=true;await tetShow();const b=document.querySelector('#tetList button');b.click();b.click();});
await pg.waitForTimeout(800);
ok(TR.length===0&&/עוד לא הועלו/.test(await pg.evaluate(()=>$('tetState').textContent)),'remove (with confirm) deletes it for everyone');
console.log(errs.join('\n')||'no page errors');console.log(fails?'FAILED '+fails:'ALL PASS');await b.close();})();
