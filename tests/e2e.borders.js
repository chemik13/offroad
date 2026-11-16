// Long journey abroad: country borders and crossings, direction arrows, the full-screen map drawer,
// daily driving hours as a planning limit, hotels as nights, and the steps card while a trip is changed.
const {chromium}=require('playwright');
function grid(la0,lo0,la1,lo1){const els=[];const st=0.008;const I0=Math.ceil(la0/st),I1=Math.floor(la1/st)+1,J0=Math.ceil(lo0/st),J1=Math.floor(lo1/st)+1;const nid=(i,j)=>i*100000+j;const P=(i,j)=>({lat:+(i*st).toFixed(6),lon:+(j*st).toFixed(6)});
 for(let i=I0;i<=I1;i++)for(let j=J0;j<J1;j++)els.push({type:'way',id:2*nid(i,j),nodes:[nid(i,j),nid(i,j+1)],geometry:[P(i,j),P(i,j+1)],tags:{highway:'track',tracktype:'grade2'}});
 for(let j=J0;j<=J1;j++)for(let i=I0;i<I1;i++)els.push({type:'way',id:2*nid(i,j)+1,nodes:[nid(i,j),nid(i+1,j)],geometry:[P(i,j),P(i+1,j)],tags:{highway:'track',tracktype:'grade2'}});
 return els;}
const line=(a,b,n=200)=>Array.from({length:n+1},(_,i)=>[a[1]+(b[1]-a[1])*i/n,a[0]+(b[0]-a[0])*i/n]);
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1300,height:820}});const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='warning')console.log('WARN',m.text().slice(0,300))});
 let tileReq=0,osrmReq=0,campReq=0;
 await p.route(/overpass/,async r=>{const body=r.request().postData()||'';const q=decodeURIComponent((body.split('data=')[1]||'').replace(/\+/g,' '));
  if(/hotel\|motel/.test(q)){const pts=[...q.matchAll(/around:12000,([\d.]+),([\d.]+)\)/g)].map(m=>[+m[1],+m[2]]);let id=900000;return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({elements:pts.flatMap(([a,o])=>[{type:'node',id:id++,lat:a+0.02,lon:o+0.01,tags:{tourism:'motel',name:'Motel '+id,website:'motel.example'}},{type:'way',id:id++,center:{lat:a-0.03,lon:o},tags:{tourism:'hotel',name:'Ξενοδοχείο',stars:'3'}}])})});}
  if(/around/.test(q)){campReq++;const pts=[...q.matchAll(/camp_site\|caravan_site\)\$"\]\(around:15000,([\d.]+),([\d.]+)\)/g)].map(m=>[+m[1],+m[2]]);
   const els=[];let id=1;for(const [a,o] of pts){els.push({type:'node',id:id++,lat:a+0.03,lon:o+0.02,tags:{tourism:'camp_site',name:'Camping Lago '+id}});els.push({type:'node',id:id++,lat:a+0.01,lon:o,tags:{amenity:'fuel',name:'Fuel '+id}});els.push({type:'node',id:id++,lat:a-0.01,lon:o,tags:{shop:'supermarket',name:'Market '+id}});}
   return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({elements:els})});}
  tileReq++;const m=q.match(/\(([\d.]+),([\d.]+),([\d.]+),([\d.]+)\)/);return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({elements:grid(+m[1],+m[2],+m[3],+m[4])})});});
 await p.route(/router\.project-osrm\.org/,r=>{osrmReq++;const pts=r.request().url().split('/driving/')[1].split('?')[0].split(';').map(s=>s.split(',').map(Number)).map(([lo,la])=>[la,lo]);
  let coords=[],legs=[];for(let i=0;i<pts.length-1;i++){const seg=line(pts[i],pts[i+1]);coords.push(...(i?seg.slice(1):seg));const km=Math.hypot(pts[i][0]-pts[i+1][0],(pts[i][1]-pts[i+1][1])*0.7)*111;legs.push({distance:km*1000*1.25,duration:km*1.25/70*3600});}
  r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({code:'Ok',routes:[{geometry:{coordinates:coords},legs}]})});});
 await p.route(/nominatim/,r=>{const u=decodeURIComponent(r.request().url());const ll=/Thessaloniki|סלוניקי/.test(u)?['40.64','22.94']:/Ohrid|אוכריד/.test(u)?['41.11','20.80']:/Bled/.test(u)?['46.37','14.11']:['46.41','11.84'];
  r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(/reverse/.test(u)?{address:{country_code:'it'}}:[{lat:ll[0],lon:ll[1],display_name:'x'}])});});
 await p.route(/borders\.json/,r=>r.fulfill({status:200,contentType:'application/json',body:require('fs').readFileSync(__dirname+'/../borders.json')}));
 await p.route(/open-meteo|wikimedia|wikidata|functions\/v1|githubusercontent/,r=>r.fulfill({status:404,contentType:'application/json',body:'{}'}));
 await p.route(/tile\.|arcgis|fonts/,r=>r.abort());
 await p.goto('file://'+process.argv[2]);
 const ok=(c,t)=>console.log(c?'PASS':'FAIL',t);
 const P={start:{name:'Thessaloniki',lat:40.64,lon:22.94,country:'GR'},end:{name:'Dolomites',lat:46.41,lon:11.84,country:'IT'},via:[{name:'Ohrid',lat:41.11,lon:20.80,country:'MK'},{name:'Bled',lat:46.37,lon:14.11,country:'SI'}],days:3,resupply_every_days:2,country:'IT',loop:false};
 const plan=async extra=>{await p.evaluate(x=>run(true,x),{...P,...extra});await p.waitForFunction(()=>!busy,null,{timeout:120000});await p.waitForTimeout(900);
  return p.evaluate(()=>{const r=current?.res?.results?.[0];return r&&{days:r.days.length,hrs:r.days.map(d=>+d.hrs.toFixed(1)),off:Math.round((r.len-r.asph)/r.len*100),nights:r.days.map(d=>d.camp?(d.camp.hotel||'camp'):null),issues:(r.issues||[]).join(' | '),err:lastRunErr}});};
 await p.fill('#prompt','מסלוניקי לדולומיטים');
 // 1. borders and crossings
 const a=await plan({});
 const bx=await p.evaluate(()=>({pins:[...document.querySelectorAll('.borderpin')].map(e=>e.textContent),cards:[...document.querySelectorAll('.dcross')].map(e=>e.textContent),layer:map.hasLayer(borderLayer),shapes:borderLayer.getLayers().length,warn:document.querySelector('.xwarn')?.textContent||'',arrows:document.querySelectorAll('.rarrow').length}));
 ok(bx.pins.length>=3&&bx.pins[0].startsWith('GR'),'border crossings on the map: '+bx.pins.join(', '));
 ok(bx.cards.length===bx.pins.length,'each crossing is in its day card: '+bx.cards[0]);
 ok(bx.layer&&bx.shapes>50,'countries and borders drawn ('+bx.shapes+' shapes)');
 ok(await p.evaluate(()=>{const b=map.getPane('borders'),t=map.getPane('tilePane');return b.parentElement===t.parentElement&&+getComputedStyle(b).zIndex>+getComputedStyle(t).zIndex&&document.querySelectorAll('.cclabel').length>20}),'the colours sit above the map tiles, in the same pane group, with country names');
 ok(/ביקורת גבולות/.test(bx.warn),'non-Schengen crossings are called out: '+bx.warn.slice(0,90));
 // 2. arrows follow the route's direction (it runs north-west: they point up and left)
 const ar=await p.evaluate(()=>[...document.querySelectorAll('.rarrow')].map(e=>+e.style.transform.match(/-?\d+/)[0]));
 ok(bx.arrows>3&&ar.filter(d=>d<=0&&d>=-120).length>ar.length*0.7,'direction arrows along the route ('+bx.arrows+'): '+ar.slice(0,6).join(','));
 await p.screenshot({path:(process.argv[3]||'/tmp/bx')+'-trip.png'});
 // 3. the panel is a drawer
 await p.click('.fullctl a');await p.waitForTimeout(400);
 const d1=await p.evaluate(()=>({off:document.body.classList.contains('drawer-off'),left:document.getElementById('sheet').getBoundingClientRect().left,vw:innerWidth,back:getComputedStyle(document.getElementById('drawerBack')).display}));
 ok(d1.off&&d1.left>=d1.vw&&d1.back!=='none','full-screen map: the panel slides away, a button brings it back');
 await p.screenshot({path:(process.argv[3]||'/tmp/bx')+'-full.png'});
 await p.click('#drawerBack');await p.waitForTimeout(400);
 ok(await p.evaluate(()=>!document.body.classList.contains('drawer-off')&&document.getElementById('sheet').getBoundingClientRect().left<innerWidth),'the panel comes back');
 // 4. driving hours a day: the days are counted by them, and no day runs far over
 const h=await plan({days:null,hours_per_day:6});
 ok(h.days>a.days&&Math.max(...h.hrs)<=6*1.08*1.07+0.3,`6 hours a day: ${h.days} days (was ${a.days}), longest ${Math.max(...h.hrs)} h`);
 const h2=await plan({days:3,hours_per_day:8});
 ok(/שעות נהיגה/.test(h2.issues),'3 days is too few for 8 hours a day: said so. '+h2.issues.slice(0,120));
 ok(await p.evaluate(()=>!document.getElementById('hpdRow').hidden&&document.getElementById('hpdSeg').dataset.v==='8'),'the hours control shows the trip\'s value');
 // 5. hotels and motels
 const ht=await plan({lodging:'hotel'});
 ok(ht.nights.filter(Boolean).every(x=>x!=='camp'),'lodging=hotel: every night under a roof: '+ht.nights.join(','));
 const hn=await p.evaluate(()=>({pin:!!document.querySelector('.nightpin'),sub:document.querySelector('.dns')?.textContent,links:[...document.querySelectorAll('.daycard .plinks a')].map(x=>x.textContent).join('|'),name:document.querySelector('.dnt')?.textContent}));
 ok(/Booking/.test(hn.links)&&/מוטל|מלון/.test(hn.sub||''),'a hotel night: '+hn.name+' · '+hn.sub);
 const mx=await plan({lodging:'mix',hotel_every_days:2});
 ok(mx.nights[1]&&mx.nights[1]!=='camp','lodging=mix, a hotel every 2 nights: '+mx.nights.join(','));
 // 6. a change shows the steps card, with what is being changed
 await p.evaluate(()=>{pendingChange='לינה: קמפינג';current.p.lodging='camp';window.__seen=null;const t=setInterval(()=>{const c=document.getElementById('planCard');if(!c.hidden&&!window.__seen)window.__seen={head:c.querySelector('.pc-head').textContent,steps:c.querySelectorAll('.pc-steps li').length,top:c.getBoundingClientRect().top,dim:document.getElementById('results').classList.contains('working')};if(!busy&&window.__seen)clearInterval(t);},30);run(false);});
 await p.waitForFunction(()=>!busy,null,{timeout:120000});
 const ch=await p.evaluate(()=>window.__seen);
 ok(ch&&/משנה את הטיול/.test(ch.head)&&/לינה: קמפינג/.test(ch.head)&&ch.steps>=3&&ch.dim,'changing a trip shows the steps and what is changing: '+JSON.stringify(ch));
 ok(await p.evaluate(()=>document.getElementById('planCard').hidden&&!document.getElementById('recent')),'the card goes when done; no recent-trips list on the new-trip screen');
 console.log(errs.join('\n')||'no page errors');await b.close();})();
