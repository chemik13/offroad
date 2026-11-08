const {chromium,devices}=require('playwright');
function fakeOSM(){const els=[];let id=1;const la0=30.25,lo0=34.45,st=0.008,n=70;const nid=(i,j)=>i*1000+j+1;
 for(let i=0;i<n;i++)for(let j=0;j<n-1;j++){els.push({type:'way',id:id++,nodes:[nid(i,j),nid(i,j+1)],geometry:[{lat:la0+i*st,lon:lo0+j*st},{lat:la0+i*st,lon:lo0+(j+1)*st}],tags:i===0?{highway:'secondary'}:{highway:'track',tracktype:'grade2'}});
 els.push({type:'way',id:id++,nodes:[nid(j,i),nid(j+1,i)],geometry:[{lat:la0+j*st,lon:lo0+i*st},{lat:la0+(j+1)*st,lon:lo0+i*st}],tags:{highway:'track',tracktype:'grade2'}});}
 for(let k=0;k<8;k++)els.push({type:'node',id:id++,lat:la0+0.02+k*0.045,lon:34.806,tags:{amenity:k%2?'drinking_water':'fuel',name:'תחנה '+k}});
 els.push({type:'way',id:id++,geometry:[[30.4,34.6],[30.4,34.9],[30.6,34.9],[30.6,34.6],[30.4,34.6]].map(([a,o])=>({lat:a,lon:o})),tags:{leisure:'nature_reserve'}});
 return {elements:els};}
(async()=>{const b=await chromium.launch();const data=JSON.stringify(fakeOSM());
for(const dn of ['Galaxy S8','iPhone SE','iPhone 15 Pro Max','iPhone 13 landscape','iPad Mini']){const ctx=await b.newContext({...devices[dn]});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.route(/overpass/,r=>r.fulfill({status:200,contentType:'application/json',body:data}));
 await p.route(/open-meteo\.com\/v1\/elevation/,r=>{const la=new URL(r.request().url()).searchParams.get('latitude').split(',').map(Number);r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({elevation:la.map((a,i)=>Math.round(800+Math.sin(a*300)*80))})})});
 await p.route(/api\.open-meteo\.com\/v1\/forecast|nominatim|wikimedia|wikidata|functions\/v1|githubusercontent/,r=>r.fulfill({status:404,contentType:'application/json',body:'{}'}));
 await p.route(/tile\.|arcgis|fonts/,r=>r.abort());
 await p.goto('file://'+process.argv[2]);
 await p.fill('#prompt','מסלול 60 ק״מ ממצפה רמון');await p.click('#goBtn');await p.waitForTimeout(4500);
 const o=await p.evaluate(()=>{const vw=document.documentElement.clientWidth;const bad=[];for(const id of ['safe','elev','warns','stats','sheet'])
   {const el=document.getElementById(id);if(!el)continue;for(const c of [el,...el.querySelectorAll('*')]){const r=c.getBoundingClientRect();if(r.width&&(r.right>vw+1||r.left<-1))bad.push(id+':'+c.tagName+'.'+c.className+' '+Math.round(r.left)+'-'+Math.round(r.right));}}
   return {vw,scrollW:document.documentElement.scrollWidth,bad:bad.slice(0,6)}});
 console.log(dn,JSON.stringify(o),errs.join('|'));
 await p.evaluate(()=>{document.getElementById('sheet').classList.add('full');document.querySelector('#safe').scrollIntoView({block:'start'})});await p.waitForTimeout(400);
 await p.screenshot({path:`${process.argv[3]}/mob_${dn.replace(/ /g,'_')}.png`});await ctx.close();}
await b.close();})();
