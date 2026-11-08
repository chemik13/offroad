// Tile cache: second plan in the same area must not hit Overpass; a reload must read tiles from IndexedDB;
// with a group code, tiles are pushed to the shared server cache and a fresh device reads them from there.
const {chromium}=require('playwright');
function fakeOSM(){const els=[];let id=1;const la0=30.45,lo0=34.65,st=0.004,n=90;const nid=(i,j)=>i*1000+j+1;let s=3;const r=()=>{s=(s*16807)%2147483647;return s/2147483647};
 for(let i=0;i<n;i++)for(let j=0;j<n-1;j++){els.push({type:'way',id:id++,nodes:[nid(i,j),nid(i,j+1)],geometry:[{lat:la0+i*st,lon:lo0+j*st},{lat:la0+i*st,lon:lo0+(j+1)*st}],tags:{highway:'track',tracktype:'grade'+(1+Math.floor(r()*4)),junk:'x'}});
 els.push({type:'way',id:id++,nodes:[nid(j,i),nid(j+1,i)],geometry:[{lat:la0+j*st,lon:lo0+i*st},{lat:la0+(j+1)*st,lon:lo0+i*st}],tags:{highway:'track',tracktype:'grade'+(1+Math.floor(r()*4))}});}
 for(let k=0;k<12;k++)els.push({type:'node',id:id++,lat:la0+r()*n*st,lon:lo0+r()*n*st,tags:{tourism:'viewpoint',name:'תצפית '+k}});
 return {elements:els};}
(async()=>{
const b=await chromium.launch();const data=JSON.stringify(fakeOSM());const server={};let overpass=0,puts=0,gets=0;
const setup=async(ctx,group)=>{const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.route(/overpass/,r=>{overpass++;r.fulfill({status:200,contentType:'application/json',body:data})});
 await p.route(/nominatim|wikimedia|wikidata/,r=>r.fulfill({status:200,contentType:'application/json',body:'{}'}));
 await p.route(/functions\/v1\/api/,async r=>{const u=new URL(r.request().url());const path=u.pathname.replace(/^.*\/api/,'');const m=r.request().method();
  const t=path.match(/^\/tiles\/(.+)$/);
  if(t&&m==='PUT'){puts++;server[t[1]]=r.request().postDataBuffer();return r.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'});}
  if(t&&m==='GET'){gets++;return server[t[1]]?r.fulfill({status:200,contentType:'application/octet-stream',body:server[t[1]]}):r.fulfill({status:404,contentType:'application/json',body:'{"error":"miss"}'});}
  if(path==='/parse')return r.fulfill({status:503,contentType:'application/json',body:'{}'});
  return r.fulfill({status:200,contentType:'application/json',body:'{}'});});
 await p.route(/tile\.|arcgis|fonts/,r=>r.abort());
 if(group) await p.addInitScript(()=>localStorage.setItem('groupCode','abc'));
 await p.goto('file://'+process.argv[2]);return {p,errs};};
const runPrompt=async(p,txt)=>{await p.fill('#prompt',txt);await p.click('#goBtn');await p.waitForTimeout(3000);return p.evaluate(()=>({ok:!document.getElementById('results').hidden,stat:current&&current.G&&current.G.cacheStat}));};
// device A (with group code)
const ctxA=await b.newContext();let {p,errs}=await setup(ctxA,true);
console.log('A1',JSON.stringify(await runPrompt(p,'3 שעות ממצפה רמון')),'overpass',overpass,'puts',puts);
console.log('A2 same area',JSON.stringify(await runPrompt(p,'לופ של 2 שעות ממצפה רמון')),'overpass',overpass);
await p.close();({p}=await setup(ctxA,true));
console.log('A3 after reload',JSON.stringify(await runPrompt(p,'3 שעות ממצפה רמון')),'overpass',overpass);
// device B: fresh browser, same group -> shared cache
const ctxB=await b.newContext();({p}=await setup(ctxB,true));
console.log('B1 fresh device',JSON.stringify(await runPrompt(p,'3 שעות ממצפה רמון')),'overpass',overpass,'server gets',gets);
console.log(errs.join('\n')||'no page errors');await b.close();})();
