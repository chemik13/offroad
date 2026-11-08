// Elevation profile: mocked Open-Meteo elevation with a steep ramp; checks SVG, stats and steep markers.
const {chromium}=require('playwright');
function fakeOSM(){const els=[];let id=1;const la0=30.25,lo0=34.45,st=0.008,n=60;const nid=(i,j)=>i*1000+j+1;
 for(let i=0;i<n;i++)for(let j=0;j<n-1;j++){els.push({type:'way',id:id++,nodes:[nid(i,j),nid(i,j+1)],geometry:[{lat:la0+i*st,lon:lo0+j*st},{lat:la0+i*st,lon:lo0+(j+1)*st}],tags:{highway:'track',tracktype:'grade2'}});
 els.push({type:'way',id:id++,nodes:[nid(j,i),nid(j+1,i)],geometry:[{lat:la0+j*st,lon:lo0+i*st},{lat:la0+(j+1)*st,lon:lo0+i*st}],tags:{highway:'track',tracktype:'grade2'}});}
 return {elements:els};}
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:400,height:860}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
 const data=JSON.stringify(fakeOSM());let ec=0;
 await p.route(/overpass/,r=>r.fulfill({status:200,contentType:'application/json',body:data}));
 await p.route(/open-meteo\.com\/v1\/elevation/,r=>{ec++;const u=new URL(r.request().url());const la=u.searchParams.get('latitude').split(',').map(Number);
  r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({elevation:la.map(a=>Math.round(800+Math.max(0,(a-30.35))*30000))})})});
 await p.route(/api\.open-meteo\.com\/v1\/forecast|nominatim|wikimedia|wikidata|functions\/v1|githubusercontent/,r=>r.fulfill({status:404,contentType:'application/json',body:'{}'}));
 await p.route(/tile\.|arcgis|fonts/,r=>r.abort());
 await p.goto('file://'+process.argv[2]);
 await p.evaluate(()=>{const s=document.querySelector('#start');});
 await p.fill('#prompt','מסלול 30 ק״מ ממצפה רמון');await p.click('#goBtn');await p.waitForTimeout(4000);
 const ok=await p.evaluate(()=>({svg:!!document.querySelector('#elev svg'),txt:document.querySelector('#elev').textContent.replace(/\s+/g,' ').slice(0,200),steep:elevLayer?elevLayer.getLayers().length:-1,res:document.querySelector('#result')?.textContent.slice(0,120)}));
 console.log('elev calls',ec,JSON.stringify(ok));
 await p.evaluate(()=>document.querySelector('#elev').scrollIntoView());await p.waitForTimeout(300);await p.screenshot({path:process.argv[3]||'/tmp/elev.png'});
 console.log(errs.join('\n')||'no page errors');await b.close();
 if(!ok.svg)process.exit(1);})();
