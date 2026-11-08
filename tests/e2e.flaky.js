// Flaky OSM: every server fails the first request for each area, then works. Long themed trip must still complete
// (second round), and the relay path must be used when a group code is set.
const {chromium}=require('playwright');
function fakeOSM(){const els=[];let id=1;const la0=29.5,lo0=34.6,st=0.02,ni=95,nj=26;const nid=(i,j)=>i*1000+j+1;
 for(let i=0;i<ni;i++)for(let j=0;j<nj;j++){if(j+1<nj)els.push({type:'way',id:id++,nodes:[nid(i,j),nid(i,j+1)],geometry:[{lat:la0+i*st,lon:lo0+j*st},{lat:la0+i*st,lon:lo0+(j+1)*st}],tags:{highway:'track',tracktype:'grade2'}});
 if(i+1<ni)els.push({type:'way',id:id++,nodes:[nid(i,j),nid(i+1,j)],geometry:[{lat:la0+i*st,lon:lo0+j*st},{lat:la0+(i+1)*st,lon:lo0+j*st}],tags:{highway:'track',tracktype:'grade2'}});}
 for(const [n,la,lo] of [['חניון לילה בארות',30.588,34.889],['חניון לילה עין אבדת',30.85,34.78],['חניון לילה נחל פארן',30.05,34.95],['חניון לילה שחורת',29.63,34.93]])els.push({type:'node',id:id++,lat:la,lon:lo,tags:{tourism:'camp_site',name:n,operator:'רשות הטבע והגנים'}});
 return {elements:els};}
const CLAUDE={content:[{type:'tool_use',id:'t1',name:'route_request',input:{loop:false,days:4,difficulty:'medium',vehicle:'raised',poi_types:['nightcamp'],summary_he:'בדיקה',end:{name:'אילת',lat:29.555,lon:34.951},via:[{name:'באר שבע',lat:31.25,lon:34.79},{name:'מצפה רמון',lat:30.61,lon:34.80}]}}],stop_reason:'tool_use'};
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:400,height:860}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
 const data=JSON.stringify(fakeOSM());const seenQ=new Set();const hits={};const hit=n=>hits[n]=(hits[n]||0)+1;
 const flaky=(name)=>async r=>{hit(name);const body=r.request().postData()||'';const key=body.slice(0,400);if(!seenQ.has(key)){seenQ.add(key);return r.fulfill({status:504,body:'busy'});}r.fulfill({status:200,contentType:'application/json',body:data});};
 await p.route(/overpass|kumi|coffee|mail\.ru/,flaky('direct'));
 await p.route(/functions\/v1\/api/,async r=>{const path=new URL(r.request().url()).pathname;
  if(path.endsWith('/claude'))return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(CLAUDE)});
  if(path.endsWith('/overpass')){hit('relay');return r.fulfill({status:200,contentType:'application/json',body:data});}
  if(path.includes('/tiles/'))return r.fulfill({status:r.request().method()==='PUT'?200:404,contentType:'application/json',body:'{}'});
  r.fulfill({status:200,contentType:'application/json',body:'{"routes":[]}'});});
 await p.route(/nominatim|wikimedia|wikidata|open-meteo/,r=>r.fulfill({status:200,contentType:'application/json',body:'{}'}));
 await p.route(/tile\.|arcgis|fonts/,r=>r.abort());
 await p.addInitScript(()=>localStorage.setItem('groupCode','abc'));
 await p.goto('file://'+process.argv[2]);
 const t0=Date.now();await p.fill('#prompt','4 ימים בעקבות מבצע עובדה');await p.click('#goBtn');
 for(let i=0;i<150;i++){await p.waitForTimeout(1000);if(!(await p.evaluate(()=>document.getElementById('results').hidden)))break;const s=await p.textContent('#status');if(/עמוסים|נכשל/.test(s)){console.log('status',s);break;}}
 console.log('results',!(await p.evaluate(()=>document.getElementById('results').hidden)),'in',Math.round((Date.now()-t0)/1000)+'s','hits',JSON.stringify(hits));
 console.log('days',await p.$$eval('.dayrow',x=>x.map(e=>e.textContent.replace(/\s+/g,' ').slice(0,50))));
 console.log(errs.join('\n')||'no page errors');await b.close();})();
