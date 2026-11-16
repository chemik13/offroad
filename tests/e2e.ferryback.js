// A ferry there and back: the way back marked on the arrival port (as Claude wrote it on 16.11) is repaired, not driven through the Balkans.
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
 const IG={name:'Igoumenitsa Port',lat:39.5003,lon:20.264,country:'GR',ferry_to_next:true,ferry_hours:17.5,ferry_depart:'21:30',ferry_operator:'Minoan Lines',ferry_freq:'כל יום',ferry_url:'https://www.minoan.it/'};
 const AN={name:'Ancona Port',lat:43.6203,lon:13.5029,country:'IT'};
 const AN0={...AN}, IG0={...IG};
 const P={start:{name:'Thessaloniki',lat:40.64,lon:22.94,country:'GR'},loop:true,via:[IG0,AN0,{name:'Passo Giau',lat:46.4833,lon:12.0517,country:'IT'},AN0,IG0],days:8,country:'IT'};
 await p.fill('#prompt','מסלוניקי לדולומיטים במעבורת הלוך וחזור');await p.evaluate(x=>run(true,x),P);await p.waitForFunction(()=>!busy,null,{timeout:150000});await p.waitForTimeout(500);
 const r=await p.evaluate(()=>{const r=current.res.results[0];return {err:lastRunErr,fer:r.segs.filter(s=>s.ferry).map(s=>[s.pts[0].map(x=>+x.toFixed(1)),s.pts[s.pts.length-1].map(x=>+x.toFixed(1))]),maxLat:Math.max(...r.coords.map(c=>c[0])),eastOfAdriatic:r.coords.filter(c=>c[0]>42.5&&c[1]>15.5).length,via:current.p.via.map(v=>v.name+(v.ferry_to_next?'⛴':'')),night:r.days.map(d=>d.camp?.ferry?'ferry':'')}});
 ok(!r.err&&r.fer.length===2,'two sailings: '+JSON.stringify(r.fer));
 ok(r.fer.some(f=>f[0][0]>43&&f[1][0]<40)&&r.fer.some(f=>f[0][0]<40&&f[1][0]>43),'one each way: Igoumenitsa -> Ancona and Ancona -> Igoumenitsa');
 ok(r.eastOfAdriatic===0,'no driving through the Balkans north of Albania ('+r.eastOfAdriatic+' points)');
 ok(!r.fer.some(f=>Math.abs(f[1][0]-40.6)<0.2&&Math.abs(f[1][1]-22.9)<0.2),'no "ferry" into Thessaloniki');
 ok(JSON.stringify(r.via)==JSON.stringify(['Igoumenitsa Port⛴','Ancona Port','Passo Giau','Ancona Port⛴','Igoumenitsa Port']),'the trip\'s settings are repaired too: '+r.via.join(' > '));
 // and planning it again from those settings gives the same two sailings (the same port object twice in the list, as a saved trip can have)
 await p.evaluate(()=>run(false));await p.waitForFunction(()=>!busy,null,{timeout:150000});
 const r2=await p.evaluate(()=>{const r=current.res.results[0];return {fer:r.segs.filter(s=>s.ferry).map(s=>[s.pts[0].map(x=>+x.toFixed(1)),s.pts[s.pts.length-1].map(x=>+x.toFixed(1))]),via:current.p.via.map(v=>v.name+(v.ferry_to_next?'⛴':''))}});
 ok(JSON.stringify(r2.fer)===JSON.stringify(r.fer)&&JSON.stringify(r2.via)===JSON.stringify(r.via),'again from the repaired settings: '+JSON.stringify(r2));
 // quick road transfers: home -> the port and the port -> home "as fast as possible": one day each, road only
 const F={...P,via:[{...IG,fast_from_prev:true},{...AN},{name:'Passo Giau',lat:46.4833,lon:12.0517,country:'IT'},{...AN,ferry_to_next:true,ferry_hours:17.5,ferry_operator:'Minoan Lines'},{...IG,ferry_to_next:false}],fast_to_end:true,days:8,hours_per_day:6};
 await p.evaluate(x=>run(true,x),F);await p.waitForFunction(()=>!busy,null,{timeout:150000});
 const q=await p.evaluate(()=>{const r=current.res.results[0];return {err:lastRunErr,days:r.days.map(d=>({km:Math.round(d.len/1000),h:+d.hrs.toFixed(1),off:Math.round((d.off||0)/1000),camp:d.camp?.ferry?'ferry':d.camp?'night':'end'}))}});
 const d1=q.days[0],last=q.days[q.days.length-1];
 ok(d1.camp==='ferry'&&d1.off<3,'day 1: straight to the port and onto the ferry, road only: '+JSON.stringify(d1));
 ok(last.off<3&&q.days.length===8,'last day: from the port home, road only, and the 8 days go to Italy: '+JSON.stringify(q.days.map(d=>d.km+'/'+d.off)));
 // without the marks nothing changes: the planner spreads the trip as before
 await p.evaluate(x=>run(true,x),{...P,days:8,hours_per_day:6});await p.waitForFunction(()=>!busy,null,{timeout:150000});
 const q0=await p.evaluate(()=>current.res.results[0].days.map(d=>d.camp?.ferry?'F':'.').join(''));
 const q0off=await p.evaluate(()=>current.res.results[0].days.map(d=>Math.round((d.off||0)/1000)));ok(q0off[0]>3||q0off[q0off.length-1]>3,'unmarked: the same days get trails as before: '+q0off.join(','));
 console.log(errs.join('\n')||'no page errors');await b.close();})();
