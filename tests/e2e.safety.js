// Safety card: fuel & water near the route, distance to asphalt, nature-reserve warning (mocked OSM).
const {chromium}=require('playwright');
function fakeOSM(){const els=[];let id=1;const la0=30.25,lo0=34.45,st=0.008,n=70;const nid=(i,j)=>i*1000+j+1;
 for(let i=0;i<n;i++)for(let j=0;j<n-1;j++){const asph=i===0;els.push({type:'way',id:id++,nodes:[nid(i,j),nid(i,j+1)],geometry:[{lat:la0+i*st,lon:lo0+j*st},{lat:la0+i*st,lon:lo0+(j+1)*st}],tags:asph?{highway:'secondary'}:{highway:'track',tracktype:'grade2'}});
 els.push({type:'way',id:id++,nodes:[nid(j,i),nid(j+1,i)],geometry:[{lat:la0+j*st,lon:lo0+i*st},{lat:la0+(j+1)*st,lon:lo0+i*st}],tags:{highway:'track',tracktype:'grade2'}});}
 for(let k=0;k<8;k++)els.push({type:'node',id:id++,lat:la0+0.02+k*0.045,lon:34.806,tags:{amenity:k%2?'drinking_water':'fuel',name:'תחנה '+k}});
 els.push({type:'way',id:id++,geometry:[[30.4,34.6],[30.4,34.9],[30.6,34.9],[30.6,34.6],[30.4,34.6]].map(([a,o])=>({lat:a,lon:o})),tags:{leisure:'nature_reserve',name:'שמורת בדיקה'}});
 return {elements:els};}
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:400,height:860}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
 const data=JSON.stringify(fakeOSM());
 await p.route(/overpass/,r=>r.fulfill({status:200,contentType:'application/json',body:data}));
 await p.route(/open-meteo|nominatim|wikimedia|wikidata|functions\/v1|githubusercontent/,r=>r.fulfill({status:404,contentType:'application/json',body:'{}'}));
 await p.route(/tile\.|arcgis|fonts/,r=>r.abort());
 await p.goto('file://'+process.argv[2]);
 await p.fill('#prompt','מסלול 60 ק״מ ממצפה רמון');await p.click('#goBtn');await p.waitForTimeout(4000);
 const o=await p.evaluate(()=>({types:[...new Set(current.G.pois.map(x=>x.type))],c0:current.res.results[0].coords[0],bb:L.latLngBounds(current.res.results[0].coords).toBBoxString(),safe:document.querySelector('#safe').textContent.replace(/\s+/g,' '),warns:[...document.querySelectorAll('.warn')].map(e=>e.textContent.slice(0,60)),icons:safeLayer?safeLayer.getLayers().length:0}));
 console.log(JSON.stringify(o,null,1));
 await p.evaluate(()=>document.querySelector('#safe').scrollIntoView());await p.screenshot({path:process.argv[3]||'/tmp/safe.png'});
 console.log(errs.join('\n')||'no page errors');await b.close();if(!/בטיחות/.test(o.safe))process.exit(1);})();
