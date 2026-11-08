const {chromium,devices}=require('playwright');
function fakeOSM(){const els=[];let id=1;const la0=30.25,lo0=34.45,st=0.008,n=90;const nid=(i,j)=>i*1000+j+1;let s=3;const r=()=>{s=(s*16807)%2147483647;return s/2147483647};
 for(let i=0;i<n;i++)for(let j=0;j<n-1;j++){els.push({type:'way',id:id++,nodes:[nid(i,j),nid(i,j+1)],geometry:[{lat:la0+i*st,lon:lo0+j*st},{lat:la0+i*st,lon:lo0+(j+1)*st}],tags:{highway:'track',tracktype:'grade'+(1+Math.floor(r()*4))}});
 els.push({type:'way',id:id++,nodes:[nid(j,i),nid(j+1,i)],geometry:[{lat:la0+j*st,lon:lo0+i*st},{lat:la0+(j+1)*st,lon:lo0+i*st}],tags:{highway:'track',tracktype:'grade'+(1+Math.floor(r()*4))}});}
 for(let k=0;k<12;k++)els.push({type:'node',id:id++,lat:la0+r()*n*st,lon:lo0+r()*n*st,tags:{tourism:'viewpoint',name:'תצפית '+k}});
 for(let k=0;k<12;k++)els.push({type:'node',id:id++,lat:la0+r()*n*st,lon:lo0+r()*n*st,tags:{tourism:'camp_site',name:'חניון לילה '+k,operator:'רשות הטבע והגנים'}});
 return {elements:els};}
const LIST=process.argv[4]?process.argv[4].split(','):['iPhone SE','Galaxy S8','iPhone 15 Pro Max','Pixel 7','iPhone 13 landscape','iPad Mini'];
(async()=>{const b=await chromium.launch();const data=JSON.stringify(fakeOSM());
for(const dn of LIST){const ctx=await b.newContext({...devices[dn]});const p=await ctx.newPage();
 await p.route(/overpass/,r=>r.fulfill({status:200,contentType:'application/json',body:data}));
 await p.route(/nominatim|wikimedia|wikidata|functions\/v1/,r=>r.fulfill({status:200,contentType:'application/json',body:'{}'}));
 await p.route(/tile|arcgis|fonts/,r=>r.abort());
 await p.goto('file://'+process.argv[2]);
 await p.fill('#prompt','יומיים ממצפה רמון עם תצפית');await p.click('#goBtn');await p.waitForTimeout(3500);
 const m=await p.evaluate(()=>{const vw=innerWidth,vh=innerHeight;const over=[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&(r.right>vw+1||r.left<-1)&&!e.closest('.leaflet-pane,.examples,.daychips,.thumbs,.leaflet-control-container')}).map(e=>e.id||e.className||e.tagName).slice(0,6);
  const sh=document.getElementById('sheet').getBoundingClientRect();const hd=document.querySelector('header').getBoundingClientRect();
  return {vw,vh,docScroll:document.documentElement.scrollWidth>vw,over,sheetH:Math.round(sh.height),sheetTop:Math.round(sh.top),mapVisible:Math.round(sh.top-hd.bottom),headerH:Math.round(hd.height)};});
 console.log(dn.padEnd(20),JSON.stringify(m));
 await p.screenshot({path:process.argv[3]+'-'+dn.replace(/\s+/g,'_')+'.png'});await ctx.close();}
await b.close();})();
