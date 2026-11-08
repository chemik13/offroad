// Busy servers: the main server answers 502 ("at capacity") for everything, a mirror works.
// Expect: route still builds, via the mirror, per-area progress shown.
const {chromium}=require('playwright');
function fakeOSM(){const els=[];let id=1;const la0=30.45,lo0=34.65,st=0.004,n=90;const nid=(i,j)=>i*1000+j+1;
 for(let i=0;i<n;i++)for(let j=0;j<n-1;j++){els.push({type:'way',id:id++,nodes:[nid(i,j),nid(i,j+1)],geometry:[{lat:la0+i*st,lon:lo0+j*st},{lat:la0+i*st,lon:lo0+(j+1)*st}],tags:{highway:'track',tracktype:'grade2'}});
 els.push({type:'way',id:id++,nodes:[nid(j,i),nid(j+1,i)],geometry:[{lat:la0+j*st,lon:lo0+i*st},{lat:la0+(j+1)*st,lon:lo0+i*st}],tags:{highway:'track',tracktype:'grade3'}});}
 return {elements:els};}
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:400,height:860}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
 const data=JSON.stringify(fakeOSM());const calls={};const hit=n=>calls[n]=(calls[n]||0)+1;
 await p.route(/overpass-api\.de/,r=>{hit('de');r.fulfill({status:502,body:'# 502 Gateway Timeout\nserver at capacity'})});
 await p.route(/private\.coffee/,r=>{hit('coffee');r.fulfill({status:429,body:'rate limited'})});
 await p.route(/kumi/,async r=>{hit('kumi');await new Promise(x=>setTimeout(x,300));r.fulfill({status:200,contentType:'application/json',body:data})});
 await p.route(/mail\.ru/,r=>{hit('ru');r.fulfill({status:504,body:'timeout'})});
 await p.route(/nominatim|wikimedia|wikidata|functions\/v1|open-meteo/,r=>r.fulfill({status:200,contentType:'application/json',body:'{}'}));
 await p.route(/tile\.|arcgis|fonts/,r=>r.abort());
 await p.goto('file://'+process.argv[2]);
 const seen=new Set();const t0=Date.now();
 await p.fill('#prompt','3 שעות ממצפה רמון');await p.click('#goBtn');
 for(let i=0;i<60;i++){await p.waitForTimeout(500);const s=await p.textContent('#status');if(s)seen.add(s.replace(/\d+ שנ׳/,'N שנ׳'));if(!(await p.evaluate(()=>document.getElementById('results').hidden)))break;}
 console.log('results shown:',!(await p.evaluate(()=>document.getElementById('results').hidden)),'in',((Date.now()-t0)/1000).toFixed(1)+'s');
 console.log('statuses:',[...seen].slice(0,6));console.log('calls',JSON.stringify(calls));
 console.log(errs.join('\n')||'no page errors');await b.close();})();
