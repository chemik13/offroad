// Long journey abroad (Thessaloniki -> Dolomites): must switch to road legs + off-road pieces + campsites,
// not try to download a 1000 km corridor. OSRM and Overpass are mocked.
const {chromium}=require('playwright');
function grid(la0,lo0,la1,lo1){const els=[];const st=0.008;const I0=Math.ceil(la0/st),I1=Math.floor(la1/st)+1,J0=Math.ceil(lo0/st),J1=Math.floor(lo1/st)+1;const nid=(i,j)=>i*100000+j;const P=(i,j)=>({lat:+(i*st).toFixed(6),lon:+(j*st).toFixed(6)});
 for(let i=I0;i<=I1;i++)for(let j=J0;j<J1;j++)els.push({type:'way',id:2*nid(i,j),nodes:[nid(i,j),nid(i,j+1)],geometry:[P(i,j),P(i,j+1)],tags:{highway:'track',tracktype:'grade2'}});
 for(let j=J0;j<=J1;j++)for(let i=I0;i<I1;i++)els.push({type:'way',id:2*nid(i,j)+1,nodes:[nid(i,j),nid(i+1,j)],geometry:[P(i,j),P(i+1,j)],tags:{highway:'track',tracktype:'grade2'}});
 return els;}
const line=(a,b,n=200)=>Array.from({length:n+1},(_,i)=>[a[1]+(b[1]-a[1])*i/n,a[0]+(b[0]-a[0])*i/n]);
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:400,height:860}});const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='warning')console.log('WARN',m.text().slice(0,300))});
 let tileReq=0,osrmReq=0,campReq=0;
 await p.route(/overpass/,async r=>{const body=r.request().postData()||'';const q=decodeURIComponent((body.split('data=')[1]||'').replace(/\+/g,' '));
  if(/around/.test(q)){campReq++;const pts=[...q.matchAll(/camp_site\|caravan_site\)\$"\]\(around:15000,([\d.]+),([\d.]+)\)/g)].map(m=>[+m[1],+m[2]]);
   const els=[];let id=1;for(const [a,o] of pts){els.push({type:'node',id:id++,lat:a+0.03,lon:o+0.02,tags:{tourism:'camp_site',name:'Camping Lago '+id}});els.push({type:'node',id:id++,lat:a+0.01,lon:o,tags:{amenity:'fuel',name:'Fuel '+id}});els.push({type:'node',id:id++,lat:a-0.01,lon:o,tags:{shop:'supermarket',name:'Market '+id}});}
   return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({elements:els})});}
  tileReq++;const m=q.match(/\(([\d.]+),([\d.]+),([\d.]+),([\d.]+)\)/);return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({elements:grid(+m[1],+m[2],+m[3],+m[4])})});});
 await p.route(/router\.project-osrm\.org/,r=>{osrmReq++;const pts=r.request().url().split('/driving/')[1].split('?')[0].split(';').map(s=>s.split(',').map(Number)).map(([lo,la])=>[la,lo]);
  let coords=[],legs=[];for(let i=0;i<pts.length-1;i++){const seg=line(pts[i],pts[i+1]);coords.push(...(i?seg.slice(1):seg));const km=Math.hypot(pts[i][0]-pts[i+1][0],(pts[i][1]-pts[i+1][1])*0.7)*111;legs.push({distance:km*1000*1.25,duration:km*1.25/70*3600});}
  r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({code:'Ok',routes:[{geometry:{coordinates:coords},legs}]})});});
 await p.route(/nominatim/,r=>{const u=decodeURIComponent(r.request().url());if(/Oxya/.test(u))return r.fulfill({status:200,contentType:'application/json',body:'[]'});const ll=/Thessaloniki|סלוניקי/.test(u)?['40.64','22.94']:/Ohrid|אוכריד/.test(u)?['41.11','20.80']:/Bled/.test(u)?['46.37','14.11']:['46.41','11.84'];
  r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(/reverse/.test(u)?{address:{country_code:'it'}}:[{lat:ll[0],lon:ll[1],display_name:'x'}])});});
 await p.route(/open-meteo|wikimedia|wikidata|functions\/v1|githubusercontent/,r=>r.fulfill({status:404,contentType:'application/json',body:'{}'}));
 await p.route(/tile\.|arcgis|fonts/,r=>r.abort());
 await p.goto('file://'+process.argv[2]);
 // simulate a smart-parse result (what Claude returns) through the params form path
 await p.evaluate(()=>{window.__p={start:{name:'Thessaloniki',lat:40.64,lon:22.94,country:'GR'},end:{name:'Dolomites',lat:46.41,lon:11.84,country:'IT'},via:[{name:'Ohrid',lat:41.11,lon:20.80,country:'MK'},{name:'Oxya Viewpoint'},{name:'Bled',lat:46.37,lon:14.11,country:'SI'}],days:3,night_near_water:true,resupply_every_days:2,country:'IT',loop:false};});
 const t0=Date.now();
 await p.fill('#prompt','תתכנן לי טיול מסלוניקי לדולומיטים לא יותר מ70-100 ק״מ ביום, שינה על שפת אגמים');await p.evaluate(()=>run(true,window.__p));
 await p.waitForFunction(()=>!busy,null,{timeout:120000});
 const o=await p.evaluate(()=>{const r=current?.res?.results?.[0];return {status:document.querySelector('#status')?.textContent.slice(0,300),overland:r?.overland,days:r?.days?.length,km:r&&Math.round(r.len/1000),pois:r?.pois.map(x=>x.type+':'+x.name).slice(0,20),dayKm:r?.days?.map(d=>Math.round(d.len/1000)+'/'+Math.round((d.off||0)/1000)).join(' '),stats:document.querySelector('#stats').textContent.replace(/\s+/g,' ').slice(0,200),chips:document.querySelector('#dayChips').textContent.slice(0,120),warn:[...document.querySelectorAll('.warn')].map(x=>x.textContent.slice(0,80))[0],title:document.querySelector('#thTitle').textContent}});
 console.log(JSON.stringify(o,null,1),'\ntiles',tileReq,'osrm',osrmReq,'campq',campReq,'ms',Date.now()-t0);
 await p.screenshot({path:process.argv[3]||'/tmp/ov.png'});
 console.log(errs.join('\n')||'no page errors');await b.close();if(!o.overland||!(o.days>1))process.exit(1);})();
