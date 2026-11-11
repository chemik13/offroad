const {chromium}=require('playwright');
function fakeOSM(){const els=[];let id=1;const la0=30.25,lo0=34.45,st=0.008,n=90;const nid=(i,j)=>i*1000+j+1;let s=3;const r=()=>{s=(s*16807)%2147483647;return s/2147483647};
 for(let i=0;i<n;i++)for(let j=0;j<n-1;j++){els.push({type:'way',id:id++,nodes:[nid(i,j),nid(i,j+1)],geometry:[{lat:la0+i*st,lon:lo0+j*st},{lat:la0+i*st,lon:lo0+(j+1)*st}],tags:{highway:'track',tracktype:'grade'+(1+Math.floor(r()*4))}});
 els.push({type:'way',id:id++,nodes:[nid(j,i),nid(j+1,i)],geometry:[{lat:la0+j*st,lon:lo0+i*st},{lat:la0+(j+1)*st,lon:lo0+i*st}],tags:{highway:'track',tracktype:'grade'+(1+Math.floor(r()*4))}});}
 for(let k=0;k<12;k++)els.push({type:'node',id:id++,lat:la0+r()*n*st,lon:lo0+r()*n*st,tags:{tourism:'viewpoint',name:'תצפית '+k}});for(let k=0;k<12;k++)els.push({type:'node',id:id++,lat:la0+r()*n*st,lon:lo0+r()*n*st,tags:{tourism:'camp_site',name:'חניון לילה '+k,operator:'רשות הטבע והגנים',drinking_water:'yes'}});
 return {elements:els};}
(async()=>{
const b=await chromium.launch();const p=await b.newPage({acceptDownloads:true,viewport:{width:400,height:860}});
const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message));
const data=JSON.stringify(fakeOSM());const DB=[];let n=0;
await p.route(/overpass/,r=>r.fulfill({status:200,contentType:'application/json',body:data}));
await p.route(/nominatim/,r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
await p.route(/wikimedia|wikidata/,r=>r.fulfill({status:200,contentType:'application/json',body:'{}'}));
await p.route(/functions\/v1\/api/,async r=>{const u=new URL(r.request().url());const path=u.pathname.replace(/^.*\/api/,'');const m=r.request().method();const body=r.request().postData();const J=(o,s=200)=>r.fulfill({status:s,contentType:'application/json',body:JSON.stringify(o)});
 if(path==='/health')return J({ok:true,claude:false,group:true});
 if(r.request().headers()['x-group-code']!=='abc')return J({error:'קוד קבוצה שגוי'},401);
 if(path==='/parse')return J({error:'no key'},503);
 if(path==='/routes'&&m==='GET')return J({routes:DB.map(({coords,waypoints,params,prompt,...x})=>x)});
 if(path==='/routes'&&m==='POST'){const b=JSON.parse(body);const row={...b,id:'00000000-0000-0000-0000-00000000000'+(++n),created_at:new Date().toISOString(),driven:false,tags:[]};DB.unshift(row);const {coords,waypoints,params,prompt,...x}=row;return J({route:x},201);}
 const mm=path.match(/^\/routes\/(.+)$/);
 if(mm&&m==='GET')return J({route:DB.find(x=>x.id===mm[1])});
 if(mm&&m==='PATCH'){const x=DB.find(x=>x.id===mm[1]);Object.assign(x,JSON.parse(body));const {coords,waypoints,params,prompt,...y}=x;return J({route:y});}
 if(mm&&m==='DELETE'){DB.splice(DB.findIndex(x=>x.id===mm[1]),1);return J({ok:true});}
 return J({error:'nf'},404);});
await p.route(/tile|arcgis/,r=>r.abort());
await p.addInitScript(()=>{localStorage.setItem('groupCode','abc');localStorage.setItem('nick','חמי');});
await p.goto('file://'+process.argv[2]);
const st=async t=>console.log(t,JSON.stringify(await p.evaluate(()=>({status:$('status').textContent,results:!$('results').hidden,name:$('routeName').value,saveRowHidden:$('saveRow').hidden,savedTag:$('savedTag').hidden?null:$('savedTag').textContent,savedActions:!$('savedActions').hidden,legend:$('legend').textContent.slice(0,60)}))));
await p.fill('#prompt','יומיים ממצפה רמון עם תצפית');await p.click('#goBtn');await p.waitForTimeout(4000);await st('multi');
console.log('chips',await p.$$eval('#dayChips button',x=>x.map(e=>e.textContent)));
console.log('dayplan',await p.$$eval('.dayrow',x=>x.map(e=>e.textContent)));
const ch=await p.$$('#dayChips button'); if(ch[2]){await ch[2].click();await p.waitForTimeout(300);console.log('day2 stats',await p.$eval('#stats',e=>e.textContent.replace(/\s+/g,' ')));}
for(const lab of ['GPX יום 1','GPX כל הטיול']){const btn=p.locator('button.fly3d',{hasText:lab}).first();const [dl]=await Promise.all([p.waitForEvent('download'),btn.click()]);const f=await dl.path();const x=require('fs').readFileSync(f,'utf8');console.log('dl',await p.evaluate(()=>dayGpxFile(0).name),'trk',(x.match(/<trk>/g)||[]).length,'pts',(x.match(/<trkpt/g)||[]).length,'wpt',(x.match(/<wpt/g)||[]).length);}
await p.click('#saveBtn');await p.waitForTimeout(400);console.log('saved days',JSON.stringify(DB[0]&&DB[0].stats.days&&DB[0].stats.days.map(d=>[d.from,d.to,d.len,d.camp&&d.camp.name])));
await p.click('#libBtn');await p.waitForTimeout(300);await p.click('.litem');await p.waitForTimeout(500);
console.log('loaded chips',await p.$$eval('#dayChips button',x=>x.map(e=>e.textContent)));
const ch2=await p.$$('#dayChips button'); if(ch2[1]){await ch2[1].click();await p.waitForTimeout(300);}
await p.screenshot({path:process.argv[4]});
console.log(errs.join('\n')||'no page errors');await b.close();})();
