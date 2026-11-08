// Weather: mocked Open-Meteo. Multi-day trip shows a row per day + a night row per camp, and raises
// rain / wind / cold / sunset warnings; map tap shows a point forecast.
const {chromium}=require('playwright');
function fakeOSM(){const els=[];let id=1;const la0=30.25,lo0=34.45,st=0.008,n=90;const nid=(i,j)=>i*1000+j+1;let s=3;const r=()=>{s=(s*16807)%2147483647;return s/2147483647};
 for(let i=0;i<n;i++)for(let j=0;j<n-1;j++){els.push({type:'way',id:id++,nodes:[nid(i,j),nid(i,j+1)],geometry:[{lat:la0+i*st,lon:lo0+j*st},{lat:la0+i*st,lon:lo0+(j+1)*st}],tags:{highway:'track',tracktype:'grade'+(1+Math.floor(r()*4))}});
 els.push({type:'way',id:id++,nodes:[nid(j,i),nid(j+1,i)],geometry:[{lat:la0+j*st,lon:lo0+i*st},{lat:la0+(j+1)*st,lon:lo0+i*st}],tags:{highway:'track',tracktype:'grade'+(1+Math.floor(r()*4))}});}
 for(let k=0;k<12;k++)els.push({type:'node',id:id++,lat:la0+r()*n*st,lon:lo0+r()*n*st,tags:{tourism:'camp_site',name:'חניון לילה '+k,operator:'רשות הטבע והגנים'}});
 return {elements:els};}
function fakeWx(url){const u=new URL(url);const lats=u.searchParams.get('latitude').split(',');const from=u.searchParams.get('start_date'),to=u.searchParams.get('end_date');
 const days=[];for(let d=new Date(from+'T12:00:00Z');d<=new Date(to+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+1))days.push(d.toISOString().slice(0,10));
 const one=(k)=>{const hours=[];for(const d of days)for(let h=0;h<24;h++)hours.push(d+'T'+String(h).padStart(2,'0')+':00');
  return {daily:{time:days,weather_code:days.map((_,i)=>i===1?63:1),temperature_2m_max:days.map(()=>24),temperature_2m_min:days.map(()=>9),precipitation_sum:days.map((_,i)=>i===1?6.5:0),precipitation_probability_max:days.map((_,i)=>i===1?80:5),wind_speed_10m_max:days.map(()=>20),wind_gusts_10m_max:days.map(()=>35),sunrise:days.map(d=>d+'T06:12'),sunset:days.map(d=>d+'T16:43')},
   hourly:{time:hours,temperature_2m:hours.map(h=>+h.slice(11,13)<6||+h.slice(11,13)>=20?4:18),precipitation:hours.map(()=>0),precipitation_probability:hours.map(()=>10),wind_gusts_10m:hours.map(()=>50),weather_code:hours.map(()=>1)}};};
 return lats.length>1?lats.map((_,k)=>one(k)):one(0);}
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:400,height:860}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
 const data=JSON.stringify(fakeOSM());let wxCalls=0;
 await p.route(/overpass/,r=>r.fulfill({status:200,contentType:'application/json',body:data}));
 await p.route(/open-meteo/,r=>{wxCalls++;r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(fakeWx(r.request().url()))})});
 await p.route(/nominatim|wikimedia|wikidata|functions\/v1/,r=>r.fulfill({status:200,contentType:'application/json',body:'{}'}));
 await p.route(/tile\.|arcgis|fonts/,r=>r.abort());
 await p.goto('file://'+process.argv[2]);
 await p.fill('#prompt','יומיים ממצפה רמון');await p.click('#goBtn');await p.waitForTimeout(3500);
 console.log('wx rows',await p.$$eval('.wxrow',x=>x.map(e=>e.textContent.replace(/\s+/g,' ').trim())));
 console.log('warns',await p.$$eval('.warn',x=>x.map(e=>e.textContent.slice(0,70))));
 // camp popup
 await p.evaluate(()=>{const m=[];markLayer.eachLayer(l=>{if(l.getPopup&&l.getPopup()&&/לילה/.test(l.getPopup().getContent().textContent||''))m.push(l)});m[0]&&m[0].openPopup();});
 await p.waitForTimeout(500);console.log('camp popup',await p.evaluate(()=>{const e=document.querySelector('.leaflet-popup .wxpop');return e&&e.textContent}));
 // map tap forecast
 await p.evaluate(()=>map.fire('click',{latlng:L.latLng(30.6,34.8)}));await p.click('.popbtns button[data-a=w]');await p.waitForTimeout(500);
 console.log('point',await p.evaluate(()=>document.querySelector('.leaflet-popup .wxpop').textContent.slice(0,140)));
 await p.screenshot({path:process.argv[3]||'/tmp/wx.png',fullPage:false});
 console.log('wx calls',wxCalls);console.log(errs.join('\n')||'no page errors');await b.close();})();
