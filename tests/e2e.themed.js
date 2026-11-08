// Themed multi-day trip: Claude (mocked) searches, returns ordered stops with notes + story, no explicit start.
// Expect: start = first stop, 4 days split at authorized camps near each day's share, corridor-only download.
const {chromium}=require('playwright');
function fakeOSM(){const els=[];let id=1;const la0=29.5,lo0=34.6,st=0.02,ni=95,nj=26;const nid=(i,j)=>i*1000+j+1;let s=7;const r=()=>{s=(s*16807)%2147483647;return s/2147483647};
 for(let i=0;i<ni;i++)for(let j=0;j<nj;j++){if(j+1<nj)els.push({type:'way',id:id++,nodes:[nid(i,j),nid(i,j+1)],geometry:[{lat:la0+i*st,lon:lo0+j*st},{lat:la0+i*st,lon:lo0+(j+1)*st}],tags:{highway:'track',tracktype:'grade'+(1+Math.floor(r()*3))}});
 if(i+1<ni)els.push({type:'way',id:id++,nodes:[nid(i,j),nid(i+1,j)],geometry:[{lat:la0+i*st,lon:lo0+j*st},{lat:la0+(i+1)*st,lon:lo0+j*st}],tags:{highway:'track',tracktype:'grade'+(1+Math.floor(r()*3))}});}
 for(const [n,la,lo] of [['חניון לילה בארות',30.588,34.889],['חניון לילה נחל ציחור',30.25,34.85],['חניון לילה עין אבדת',30.85,34.78],['חניון לילה שחורת',29.63,34.93],['חניון לילה נחל פארן',30.05,34.95]])els.push({type:'node',id:id++,lat:la,lon:lo,tags:{tourism:'camp_site',name:n,operator:'רשות הטבע והגנים'}});
 return {elements:els};}
const CLAUDE={content:[{type:'server_tool_use',id:'s1',name:'web_search',input:{query:'מבצע עובדה מסלול'}},{type:'web_search_tool_result',tool_use_id:'s1',content:[]},
 {type:'tool_use',id:'t1',name:'route_request',input:{loop:false,days:4,difficulty:'medium',vehicle:'raised',poi_types:['nightcamp'],summary_he:'4 ימים בעקבות מבצע עובדה, מבאר שבע לאילת',story_he:'במרץ 1949 יצאו חטיבות הנגב וגולני לכבוש את דרום הנגב. חטיבת הנגב נעה דרך הר הנגב ומכתש רמון עד אום רשרש, שם הונף דגל הדיו.',
  end:{name:'אנדרטת דגל הדיו',lat:29.555,lon:34.951},via:[{name:'באר שבע',lat:31.25,lon:34.79,note:'נקודת היציאה של חטיבת הנגב'},{name:'מצפה רמון',lat:30.61,lon:34.80,note:'ראס רמון'},{name:'נחל פארן',lat:30.10,lon:34.95,note:'ציר ההתקדמות דרומה'}]}}],stop_reason:'tool_use'};
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:400,height:860}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
 const data=JSON.stringify(fakeOSM());let ov=0;
 await p.route(/overpass|kumi|coffee|mail\.ru/,r=>{ov++;r.fulfill({status:200,contentType:'application/json',body:data})});
 await p.route(/functions\/v1\/api/,r=>{const path=new URL(r.request().url()).pathname;if(path.endsWith('/claude'))return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(CLAUDE)});r.fulfill({status:404,contentType:'application/json',body:'{}'});});
 await p.route(/nominatim|wikimedia|wikidata|open-meteo/,r=>r.fulfill({status:200,contentType:'application/json',body:'{}'}));
 await p.route(/tile\.|arcgis|fonts/,r=>r.abort());
 await p.addInitScript(()=>localStorage.setItem('groupCode','abc'));
 await p.goto('file://'+process.argv[2]);
 await p.fill('#prompt','תכנן טיול של 4 ימים בעקבות מבצע עובדה, בינוני');await p.click('#goBtn');
 for(let i=0;i<120;i++){await p.waitForTimeout(1000);const st=await p.textContent('#status');if(i%10==0)console.log('t',i,st);if(!(await p.evaluate(()=>document.getElementById('results').hidden))||(/לא |נכשל/.test(st)))break;}
 console.log('status',await p.textContent('#status'));
 console.log('understood',(await p.textContent('#understood')).slice(0,120));
 console.log('start field',await p.inputValue('#pStart'));
 console.log('days',await p.$$eval('.dayrow',x=>x.map(e=>e.textContent.replace(/\s+/g,' ').slice(0,90))));
 console.log('pois',await p.$$eval('ul.pois li',x=>x.map(e=>e.textContent.slice(0,60))));
 console.log('overpass requests',ov,'tiles',await p.evaluate(()=>gcache&&gcache.keys.size));
 console.log(errs.join('\n')||'no page errors');await b.close();})();
