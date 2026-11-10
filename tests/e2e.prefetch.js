// Background prefetch: typing a known place starts the download; pressing "build" reuses it.
// Mirror race: a slow mirror must not delay the answer from a fast one.
const {chromium}=require('playwright');
function fakeOSM(){const els=[];let id=1;const la0=30.45,lo0=34.65,st=0.004,n=90;const nid=(i,j)=>i*1000+j+1;let s=3;const r=()=>{s=(s*16807)%2147483647;return s/2147483647};
 for(let i=0;i<n;i++)for(let j=0;j<n-1;j++){els.push({type:'way',id:id++,nodes:[nid(i,j),nid(i,j+1)],geometry:[{lat:la0+i*st,lon:lo0+j*st},{lat:la0+i*st,lon:lo0+(j+1)*st}],tags:{highway:'track',tracktype:'grade'+(1+Math.floor(r()*4))}});
 els.push({type:'way',id:id++,nodes:[nid(j,i),nid(j+1,i)],geometry:[{lat:la0+j*st,lon:lo0+i*st},{lat:la0+(j+1)*st,lon:lo0+i*st}],tags:{highway:'track',tracktype:'grade'+(1+Math.floor(r()*4))}});}
 return {elements:els};}
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:400,height:860}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
 const data=JSON.stringify(fakeOSM());const calls=[];
 await p.route(/overpass-api\.de/,async r=>{calls.push('de');await new Promise(x=>setTimeout(x,1500));r.fulfill({status:200,contentType:'application/json',body:data}).catch(()=>{})});
 await p.route(/kumi/,async r=>{calls.push('kumi');await new Promise(x=>setTimeout(x,8000));r.fulfill({status:200,contentType:'application/json',body:data}).catch(()=>{})});
 await p.route(/mail\.ru/,r=>{calls.push('ru');r.fulfill({status:200,contentType:'application/json',body:data})});
 await p.route(/nominatim|wikimedia|wikidata|functions\/v1|open-meteo/,r=>r.fulfill({status:200,contentType:'application/json',body:'{}'}));
 await p.route(/tile\.|arcgis|fonts/,r=>r.abort());
 await p.goto('file://'+process.argv[2]);
 await p.type('#prompt','3 שעות ממצפה רמון עם תצפית',{delay:20});
 await p.waitForTimeout(1300);console.log('while typing → status:',await p.textContent('#status'),'| calls',calls.join(','));
 await p.waitForTimeout(2000);console.log('after prefetch → status:',await p.textContent('#status'));
 const t0=Date.now();await p.click('#goBtn');await p.waitForFunction(()=>!document.getElementById('results').hidden,null,{timeout:20000});
 console.log('build took ms',Date.now()-t0,'| overpass calls total',calls.join(','),'| stat',JSON.stringify(await p.evaluate(()=>current.G.cacheStat)));
 // foreground fetch with slow kumi: must finish ~1.5s (de wins), not 8s
 await p.evaluate(()=>{gcache=null;memTiles.clear();idb.clear();});
 await p.click('#newTripBtn');const t1=Date.now();await p.fill('#prompt','3 שעות ממצפה רמון');await p.click('#goBtn');await p.waitForTimeout(200);
 await p.waitForFunction(()=>!document.getElementById('results').hidden && !document.getElementById('goBtn').disabled,null,{timeout:20000});
 console.log('fresh download with race took ms',Date.now()-t1);
 console.log(errs.join('\n')||'no page errors');await b.close();})();
