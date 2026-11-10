const {chromium}=require('playwright');
function fakeOSM(){const els=[];let id=1;const la0=30.45,lo0=34.65,st=0.004,n=90;const nid=(i,j)=>i*1000+j+1;let s=3;const r=()=>{s=(s*16807)%2147483647;return s/2147483647};
 for(let i=0;i<n;i++)for(let j=0;j<n-1;j++){els.push({type:'way',id:id++,nodes:[nid(i,j),nid(i,j+1)],geometry:[{lat:la0+i*st,lon:lo0+j*st},{lat:la0+i*st,lon:lo0+(j+1)*st}],tags:{highway:'track',tracktype:'grade'+(1+Math.floor(r()*4))}});
 els.push({type:'way',id:id++,nodes:[nid(j,i),nid(j+1,i)],geometry:[{lat:la0+j*st,lon:lo0+i*st},{lat:la0+(j+1)*st,lon:lo0+i*st}],tags:{highway:'track',tracktype:'grade'+(1+Math.floor(r()*4))}});}
 for(let k=0;k<12;k++)els.push({type:'node',id:id++,lat:la0+r()*n*st,lon:lo0+r()*n*st,tags:{tourism:'viewpoint',name:'תצפית '+k}});
 els.push({type:'node',id:id++,lat:30.589,lon:34.888,tags:{tourism:'camp_site',name:'בארות'}});
 return {elements:els};}
(async()=>{
const b=await chromium.launch();const p=await b.newPage({viewport:{width:400,height:860}});
const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message));p.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text())});
const data=JSON.stringify(fakeOSM());let overpassCalls=0;
await p.route(/overpass/,r=>{overpassCalls++;r.fulfill({status:200,contentType:'application/json',body:data})});
await p.route(/nominatim/,r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
await p.route(/wikimedia|wikidata/,r=>r.fulfill({status:200,contentType:'application/json',body:'{}'}));
await p.route(/tile|arcgis/,r=>r.abort());
await p.goto('file://'+process.argv[2]);
const state=async(tag)=>{const s=await p.evaluate(()=>({status:document.getElementById('status').textContent,results:!document.getElementById('results').hidden,tabs:[...document.querySelectorAll('#tabs button')].map(b=>b.textContent),lines:document.querySelectorAll('.leaflet-overlay-pane path').length,loop:document.getElementById('pLoop').value,start:document.getElementById('pStart').value,end:document.getElementById('pEnd').value}));console.log(tag,JSON.stringify(s));};
for (const [tag,prompt] of (process.argv[3]?JSON.parse(process.argv[3]):[['A','ממצפה רמון עד חניון בארות עם תצפית']])) {
 if(await p.isVisible('#newTripBtn'))await p.click('#newTripBtn');await p.fill('#prompt',prompt);await p.click('#goBtn');await p.waitForTimeout(2500);await state(tag+' prompt');
}
// rebuild with changed params
await p.click('#diffSeg button:nth-child(3)');await p.waitForTimeout(2500);await state('rebuild');
// switch tab
const t=await p.$$('#tabs button');if(t[1]){await t[1].click();await p.waitForTimeout(300);await state('tab2');}
await p.screenshot({path:process.argv[4]||'/tmp/x.png'});
console.log('overpass calls',overpassCalls);console.log(errs.join('\n'));await b.close();})();
