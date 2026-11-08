// Editing a themed multi-day trip: stops list, remove/move a stop, add a stop from the map, refine in words,
// per-day colours, firing-zone switch without a date.
const {chromium}=require('playwright');
function fakeOSM(){const els=[];let id=1;const la0=29.5,lo0=34.6,st=0.02,ni=95,nj=26;const nid=(i,j)=>i*1000+j+1;
 for(let i=0;i<ni;i++)for(let j=0;j<nj;j++){if(j+1<nj)els.push({type:'way',id:id++,nodes:[nid(i,j),nid(i,j+1)],geometry:[{lat:la0+i*st,lon:lo0+j*st},{lat:la0+i*st,lon:lo0+(j+1)*st}],tags:{highway:'track',tracktype:'grade2'}});
 if(i+1<ni)els.push({type:'way',id:id++,nodes:[nid(i,j),nid(i+1,j)],geometry:[{lat:la0+i*st,lon:lo0+j*st},{lat:la0+(i+1)*st,lon:lo0+j*st}],tags:{highway:'track',tracktype:'grade2'}});}
 for(const [n,la,lo] of [['חניון לילה בארות',30.588,34.889],['חניון לילה עין אבדת',30.85,34.78],['חניון לילה נחל פארן',30.05,34.95],['חניון לילה שחורת',29.63,34.93]])els.push({type:'node',id:id++,lat:la,lon:lo,tags:{tourism:'camp_site',name:n,operator:'רשות הטבע והגנים'}});
 return {elements:els};}
const P1={loop:false,days:4,difficulty:'medium',vehicle:'raised',poi_types:['nightcamp'],summary_he:'מבצע עובדה',story_he:'סיפור',end:{name:'אילת',lat:29.555,lon:34.951},start:{name:'באר שבע',lat:31.25,lon:34.79},via:[{name:'מצפה רמון',lat:30.61,lon:34.80,note:'ראס רמון'},{name:'נחל פארן',lat:30.10,lon:34.95,note:'ציר'}]};
let claudeCalls=[];
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:400,height:860}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
 const data=JSON.stringify(fakeOSM());
 await p.route(/overpass|kumi|coffee|mail\.ru|raw\.githubusercontent/,r=>/githubusercontent/.test(r.request().url())?r.fulfill({status:404,body:''}):r.fulfill({status:200,contentType:'application/json',body:data}));
 await p.route(/functions\/v1\/api/,r=>{const path=new URL(r.request().url()).pathname;
  if(path.endsWith('/claude')){const body=JSON.parse(r.request().postData());claudeCalls.push(body.messages[0].content.slice(0,60));
   const input=claudeCalls.length===1?P1:{...P1,via:[{name:'מצפה רמון',lat:30.61,lon:34.80},{name:'עין עבדת',lat:30.828,lon:34.767,note:'נוסף'}],summary_he:'הוספתי עין עבדת'};
   return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({content:[{type:'tool_use',id:'t',name:'route_request',input}],stop_reason:'tool_use'})});}
  if(path.endsWith('/overpass'))return r.fulfill({status:200,contentType:'application/json',body:data});
  if(path.includes('/tiles/'))return r.fulfill({status:r.request().method()==='PUT'?200:404,contentType:'application/json',body:'{}'});
  r.fulfill({status:200,contentType:'application/json',body:'{"routes":[]}'});});
 await p.route(/nominatim|wikimedia|wikidata|open-meteo/,r=>r.fulfill({status:200,contentType:'application/json',body:'{}'}));
 await p.route(/tile\.|arcgis|fonts/,r=>r.abort());
 await p.addInitScript(()=>localStorage.setItem('groupCode','abc'));
 await p.goto('file://'+process.argv[2]);
 const wait=async()=>{for(let i=0;i<120;i++){await p.waitForTimeout(500);if(!(await p.evaluate(()=>document.getElementById('goBtn').disabled))&&!(await p.evaluate(()=>document.getElementById('results').hidden)))return;}};
 const stops=()=>p.$$eval('.stop .tx',x=>x.map(e=>e.childNodes[0].textContent));
 await p.fill('#prompt','4 ימים בעקבות מבצע עובדה');await p.click('#goBtn');await wait();
 console.log('1 stops',await stops(),'| date field',JSON.stringify(await p.inputValue('#pDate')),'| milsw',await p.$$eval('.milsw button[aria-pressed=true]',x=>x.map(e=>e.textContent)));
 console.log('  end of route lat',await p.evaluate(()=>{const r=current.res.results[0];return r.coords[r.coords.length-1][0].toFixed(3)}),'| day dots',await p.$$eval('.daydot',x=>x.length),'| prompt h',await p.evaluate(()=>$('prompt').offsetHeight));
 await p.click('.stop:nth-of-type(3) .bt button[title="להסיר"]');await p.waitForTimeout(300);await wait();console.log('2 after remove',await stops());
 await p.evaluate(()=>{map.fire('click',{latlng:L.latLng(30.3,34.9)})});await p.click('.popbtns button[data-a=v]');await p.waitForTimeout(300);await wait();console.log('3 after add from map',await stops());
 await p.fill('#refineIn','תוסיף עצירה בעין עבדת');await p.click('#refineBtn');await p.waitForTimeout(500);await wait();console.log('4 after refine',await stops(),'| understood',(await p.textContent('#understood')).slice(0,40),'| claude calls',claudeCalls.length);
 await p.click('.milsw button:nth-of-type(3)');await p.waitForTimeout(300);await wait();console.log('5 mil switch',await p.$$eval('.milsw button[aria-pressed=true]',x=>x.map(e=>e.textContent)),await p.inputValue('#pMil'));
 await p.screenshot({path:process.argv[3]});
 console.log(errs.join('\n')||'no page errors');await b.close();})();
