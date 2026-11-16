// The second trip-screen layout (?ux=2): summary line, day strip on the map, four tabs, notes behind one chip.
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
 await p.addInitScript(()=>localStorage.setItem('ux','2'));
 await p.goto('file://'+process.argv[2]);
 const ok=(c,t)=>console.log(c?'PASS':'FAIL',t);
 const P={start:{name:'Thessaloniki',lat:40.64,lon:22.94,country:'GR'},end:{name:'Dolomites',lat:46.41,lon:11.84,country:'IT'},via:[{name:'Ohrid',lat:41.11,lon:20.80,country:'MK'},{name:'Bled',lat:46.37,lon:14.11,country:'SI'}],days:4,country:'IT',loop:false};
 await p.fill('#prompt','מסלוניקי לדולומיטים');await p.evaluate(x=>run(true,x),P);await p.waitForFunction(()=>!busy,null,{timeout:120000});await p.waitForTimeout(900);
 const vis=sel=>p.evaluate(s=>{const e=document.querySelector(s);return !!e&&e.getClientRects().length>0},sel);
 const a=await p.evaluate(()=>({sum:[...document.querySelectorAll('#sumLine>div')].map(d=>d.textContent),strip:[...document.querySelectorAll('#dayStrip button')].map(b=>b.textContent),stripBox:document.getElementById('dayStrip').getBoundingClientRect(),sheetLeft:document.getElementById('sheet').getBoundingClientRect().left,tab:document.getElementById('sheet').dataset.tab,chip:document.getElementById('warnChip').textContent,cards:[...document.querySelectorAll('.daycard')].filter(c=>c.getClientRects().length).length}));
 ok(a.sum.length>=4&&/ימים/.test(a.sum[0])&&/שטח/.test(a.sum.join()),'summary line: '+a.sum.join(' | '));
 ok(a.strip.length===5&&a.stripBox.right<=a.sheetLeft&&a.stripBox.width>100,'day strip on the map, clear of the panel: '+a.strip.join(' '));
 ok(a.tab==='days'&&a.cards===4,'days tab first, all '+a.cards+' day cards');
 ok(/דברים לבדוק|דבר אחד/.test(a.chip)&&!(await vis('#warns')),'notes folded behind a chip: '+a.chip);
 await p.click('#warnChip');ok(await vis('#warns .warn, #warns li'),'the chip opens the notes');await p.click('#warnChip');
 await p.click('#dayStrip button:nth-child(3)');await p.waitForTimeout(700);
 const d=await p.evaluate(()=>({scope:document.querySelector('#sumLine .scope')?.textContent,cards:[...document.querySelectorAll('.daycard')].filter(c=>c.getClientRects().length).length,dom:document.getElementById('dayPlan').innerHTML.slice(0,300),sel:document.querySelector('#dayStrip [aria-pressed=true]')?.textContent,day:current.day}));
 ok(d.day===1&&d.cards===1&&/יום 2/.test(d.scope||''),'a day from the strip: the map and one card for it: '+JSON.stringify(d));
 for(const [t,sel] of [['before','.acc[data-k=checklist]'],['road','.acc[data-k=p4n], .acc[data-k=garages], .acc[data-k=supply]'],['set','#diffSeg']]){await p.click(`#uxTabs button[data-t=${t}]`);ok(await vis(sel)&&!(await vis('.daycard')),'tab '+t+' shows its own boxes only');}
 ok(await vis('#params')&&await p.evaluate(()=>!!document.querySelector('.uxp[data-t=set] #saveRow')),'settings tab holds save and advanced settings');
 ok(await vis('#offroadBtn')&&await vis('#refineIn'),'main buttons and the change box stay in view on every tab');
 await p.click('#dayStrip button:first-child');await p.waitForTimeout(600);
 ok(await p.evaluate(()=>current.day==null&&document.getElementById('sheet').dataset.tab==='days'),'"all" on the strip: back to the whole trip');
 await p.click('.fullctl a');await p.waitForTimeout(400);
 ok(await vis('#dayStrip')&&await p.evaluate(()=>document.getElementById('dayStrip').getBoundingClientRect().bottom<innerHeight-50),'full-screen map keeps the day strip');
 await p.screenshot({path:(process.argv[3]||'/tmp/ux2')+'.png'});
 await p.click('#drawerBack');await p.click('#newTripBtn');ok(!(await vis('#dayStrip')),'new trip: the strip goes');
 // the step-by-step builder writes the request and plans from it
 await p.click('#wizOpen');ok(await vis('#wzStart')&&!(await vis('#prompt')),'step by step: the first screen replaces the text box');
 await p.fill('#wzStart','Thessaloniki');await p.fill('#wzEnd','Dolomites');await p.click('#wzNext');
 for(let i=0;i<3;i++)await p.click('#wzMore');await p.click('#wzHpd button:nth-child(4)');await p.click('#wzNext');await p.click('#wzLodge button:nth-child(3)');
 const sayTxt=await p.textContent('#wzSay');
 ok(/4 ימים מ-Thessaloniki ל-Dolomites/.test(sayTxt)&&/עד 6 שעות נהיגה ביום/.test(sayTxt)&&/מלונות ומוטלים/.test(sayTxt),'the request it writes: '+sayTxt);
 await p.click('#wzNext');await p.waitForTimeout(300);
 ok(await p.evaluate(t=>document.getElementById('prompt').value===t&&document.getElementById('wiz').hidden&&(busy||!!current),sayTxt),'"build" puts it in the request box and starts planning');
 await p.waitForFunction(()=>!busy,null,{timeout:120000});
 const wp=await p.evaluate(()=>current&&{hpd:current.p.hours_per_day,lodging:current.p.lodging,days:current.p.days,start:current.p.start?.name,end:current.p.end?.name,over:!!current.res.results[0].overland,nights:current.res.results[0].days.map(d=>d.camp?.hotel||null),err:lastRunErr});
 ok(wp&&wp.hpd===6&&wp.lodging==='hotel'&&wp.start==='Thessaloniki'&&wp.end==='Dolomites'&&wp.over,'without the smart reading the answers still plan the trip: '+JSON.stringify(wp));
 ok(await p.evaluate(()=>/חשב/.test(document.getElementById('sumCost')?.textContent||'')===hasGroup()),'cost not worked out yet: the summary line offers it (with a group code)');
 console.log(errs.join('\n')||'no page errors');await b.close();})();
