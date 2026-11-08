// "Open in Off-Road": with Web Share (phone) the GPX goes to the share sheet; without it, it downloads.
const {chromium,devices}=require('playwright');
function fakeOSM(){const els=[];let id=1;const la0=30.45,lo0=34.65,st=0.004,n=90;const nid=(i,j)=>i*1000+j+1;
 for(let i=0;i<n;i++)for(let j=0;j<n-1;j++){els.push({type:'way',id:id++,nodes:[nid(i,j),nid(i,j+1)],geometry:[{lat:la0+i*st,lon:lo0+j*st},{lat:la0+i*st,lon:lo0+(j+1)*st}],tags:{highway:'track',tracktype:'grade2'}});
 els.push({type:'way',id:id++,nodes:[nid(j,i),nid(j+1,i)],geometry:[{lat:la0+j*st,lon:lo0+i*st},{lat:la0+(j+1)*st,lon:lo0+i*st}],tags:{highway:'track',tracktype:'grade3'}});}
 return {elements:els};}
(async()=>{const b=await chromium.launch();const data=JSON.stringify(fakeOSM());
for(const mode of ['share','download']){
 const ctx=await b.newContext({...devices['iPhone 13'],acceptDownloads:true});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.route(/overpass|kumi|coffee|mail\.ru/,r=>r.fulfill({status:200,contentType:'application/json',body:data}));
 await p.route(/nominatim|wikimedia|wikidata|functions\/v1|open-meteo/,r=>r.fulfill({status:200,contentType:'application/json',body:'{}'}));
 await p.route(/tile\.|arcgis|fonts/,r=>r.abort());
 if(mode==='share') await p.addInitScript(()=>{navigator.canShare=()=>true;navigator.share=async d=>{window.__shared={name:d.files[0].name,type:d.files[0].type,size:d.files[0].size,head:(await d.files[0].text()).slice(0,120)};};});
 else await p.addInitScript(()=>{navigator.canShare=undefined;navigator.share=undefined;});
 await p.goto('file://'+process.argv[2]);
 await p.fill('#prompt','3 שעות ממצפה רמון');await p.click('#goBtn');await p.waitForFunction(()=>!document.getElementById('results').hidden,null,{timeout:20000});
 if(mode==='share'){await p.click('#offroadBtn');await p.waitForTimeout(300);console.log('share →',JSON.stringify(await p.evaluate(()=>window.__shared)),'| hint:',await p.textContent('#orHint'));}
 else{const [dl]=await Promise.all([p.waitForEvent('download'),p.click('#offroadBtn')]);console.log('download →',dl.suggestedFilename(),'| hint:',await p.textContent('#orHint'));}
 console.log(errs.join('\n')||'no page errors');await ctx.close();}
await b.close();})();
