const {chromium}=require('playwright');
function fakeOSM(){const els=[];let id=1;const la0=30.45,lo0=34.65,st=0.004,n=90;const nid=(i,j)=>i*1000+j+1;let s=3;const r=()=>{s=(s*16807)%2147483647;return s/2147483647};
 for(let i=0;i<n;i++)for(let j=0;j<n-1;j++){els.push({type:'way',id:id++,nodes:[nid(i,j),nid(i,j+1)],geometry:[{lat:la0+i*st,lon:lo0+j*st},{lat:la0+i*st,lon:lo0+(j+1)*st}],tags:{highway:'track',tracktype:'grade'+(1+Math.floor(r()*4))}});
 els.push({type:'way',id:id++,nodes:[nid(j,i),nid(j+1,i)],geometry:[{lat:la0+j*st,lon:lo0+i*st},{lat:la0+(j+1)*st,lon:lo0+i*st}],tags:{highway:'track',tracktype:'grade'+(1+Math.floor(r()*4))}});}
 for(let k=0;k<12;k++)els.push({type:'node',id:id++,lat:la0+r()*n*st,lon:lo0+r()*n*st,tags:{tourism:'viewpoint',name:'תצפית '+k}});
 return {elements:els};}
(async()=>{
const b=await chromium.launch();const p=await b.newPage({viewport:{width:400,height:860}});
const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message));
const data=JSON.stringify(fakeOSM());const DB=[],POSTS=[],PATCHES=[];let n=0;
await p.route(/overpass/,r=>r.fulfill({status:200,contentType:'application/json',body:data}));
await p.route(/nominatim/,r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
await p.route(/wikimedia|wikidata/,r=>r.fulfill({status:200,contentType:'application/json',body:'{}'}));
await p.route(/functions\/v1\/api/,async r=>{const u=new URL(r.request().url());const path=u.pathname.replace(/^.*\/api/,'');const m=r.request().method();const body=r.request().postData();const J=(o,s=200)=>r.fulfill({status:s,contentType:'application/json',body:JSON.stringify(o)});
 const slim=({coords,waypoints,params,prompt,...x})=>x;
 if(path==='/health')return J({ok:true,claude:false,group:true});
 if(r.request().headers()['x-group-code']!=='abc')return J({error:'קוד קבוצה שגוי'},401);
 if(path==='/routes'&&m==='GET'){const by={};for(const x of DB)(by[x.trip_id]||=[]).push(x);return J({routes:Object.values(by).map(v=>{v.sort((a,b)=>b.version-a.version);return {...slim(v[0]),versions:v.length};})});}
 if(path==='/routes'&&m==='POST'){const b=JSON.parse(body);const id='00000000-0000-0000-0000-'+String(++n).padStart(12,'0');let trip_id=id,version=1;
  if(b.trip_id){const v=DB.filter(x=>x.trip_id===b.trip_id);if(!v.length)return J({error:'nf'},404);trip_id=b.trip_id;version=Math.max(...v.map(x=>x.version))+1;}
  const row={...b,id,trip_id,version,created_at:new Date().toISOString(),driven:false,tags:[]};POSTS.push({trip_id:b.trip_id||null,change:b.change||null,name:b.name});DB.unshift(row);return J({route:slim(row)},201);}
 const vv=path.match(/^\/routes\/(.+)\/versions$/);
 if(vv){const one=DB.find(x=>x.id===vv[1]);return J({versions:DB.filter(x=>x.trip_id===one.trip_id).sort((a,b)=>b.version-a.version).map(x=>({id:x.id,version:x.version,change:x.change||null,created_at:x.created_at,created_by:x.created_by,stats:x.stats}))});}
 const mm=path.match(/^\/routes\/([^/]+)$/);
 if(mm&&m==='GET')return J({route:DB.find(x=>x.id===mm[1])});
 if(mm&&m==='PATCH'){const x=DB.find(x=>x.id===mm[1]);const b=JSON.parse(body);PATCHES.push(Object.keys(b));for(const k of ['name','driven'])if(k in b)DB.filter(y=>y.trip_id===x.trip_id).forEach(y=>y[k]=b[k]);Object.assign(x,b);return J({route:slim(x)});}
 if(mm&&m==='DELETE'){const x=DB.find(x=>x.id===mm[1]);for(let i=DB.length-1;i>=0;i--)if(DB[i].trip_id===x.trip_id)DB.splice(i,1);return J({ok:true});}
 return J({error:'nf'},404);});
await p.route(/tile|arcgis/,r=>r.abort());
await p.addInitScript(()=>{localStorage.setItem('groupCode','abc');localStorage.setItem('nick','חמי');});
await p.goto('file://'+process.argv[2]);
let fails=0;const ok=(c,t)=>{console.log((c?'PASS ':'FAIL ')+t);if(!c)fails++;};
const ui=()=>p.evaluate(()=>({ver:$('verBtn').hidden?null:$('verBtn').textContent,tag:$('savedTag').hidden?null:$('savedTag').textContent,save:$('saveBtn').textContent,tabs:$('tabs').querySelectorAll('button').length}));
const idle=()=>p.waitForFunction(()=>!$('goBtn').disabled,null,{timeout:60000});
await p.fill('#prompt','3 שעות ממצפה רמון עם תצפית');await p.click('#goBtn');await idle();await p.waitForTimeout(700);
let u=await ui();console.log(JSON.stringify(u));
ok(DB.length===1&&DB[0].version===1&&POSTS[0].trip_id===null,'new plan auto-saved as version 1');
ok(u.ver==='גרסה 1'&&/נשמר אוטומטית/.test(u.tag||'')&&u.save==='שינוי שם','UI shows saved v1');
if(u.tabs>1){await p.click('#tabs button:nth-child(2)');await p.waitForTimeout(1200);ok(PATCHES.some(k=>k.includes('coords')),'switching alternative updates the version');ok(DB.length===1,'no new version for alternative switch');}
await p.click('#diffSeg button:nth-child(3)');await idle();await p.waitForTimeout(700);
u=await ui();console.log(JSON.stringify(u));
ok(DB.length===2&&POSTS[1].trip_id===DB[1].trip_id&&/קושי/.test(POSTS[1].change||''),'difficulty change saved as version 2 with change text: '+POSTS[1]?.change);
ok(u.ver==='גרסה 2','chip shows version 2');
await p.fill('#routeName','הטיול של חמי');await p.click('#saveBtn');await p.waitForTimeout(400);
ok(DB.every(x=>x.name==='הטיול של חמי'),'rename applies to every version');
await p.click('#verBtn');await p.waitForTimeout(500);
const items=await p.$$eval('#verList button',x=>x.map(e=>e.textContent));console.log(items);
ok(items.length===2&&/גרסה 2/.test(items[0])&&/התכנון הראשון/.test(items[1]),'versions list newest first');
await p.click('#verList button:nth-child(2)');await p.waitForTimeout(600);
u=await ui();console.log(JSON.stringify(u));ok(u.ver==='גרסה 1','opened version 1');
await p.click('#diffSeg button:nth-child(1)');await idle();await p.waitForTimeout(700);
u=await ui();ok(DB.length===3&&DB[0].version===3&&u.ver==='גרסה 3','change from old version becomes version 3');
await p.click('#libBtn');await p.waitForTimeout(500);const lib=await p.$$eval('.litem',x=>x.map(e=>e.textContent));console.log(lib);
ok(lib.length===1&&/3 גרסאות/.test(lib[0]),'library shows one trip with 3 versions');
await p.click('#libClose');
await p.click('#newTripBtn');await p.fill('#prompt','2 שעות ממצפה רמון');await p.click('#goBtn');await idle();await p.waitForTimeout(700);
ok(new Set(DB.map(x=>x.trip_id)).size===2&&POSTS[POSTS.length-1].trip_id===null,'a new prompt is a new trip');
await p.click('#delBtn');await p.click('#delYes');await p.waitForTimeout(400);
ok(new Set(DB.map(x=>x.trip_id)).size===1&&DB.length===3,'delete removes only that trip');
await p.screenshot({path:process.argv[3]||'/tmp/v.png'});
console.log(errs.join('\n')||'no page errors');console.log(fails?'FAILED '+fails:'ALL PASS');await b.close();})();