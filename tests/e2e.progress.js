// Live progress: the card shows what was understood and the step in progress; a change keeps the old trip on screen.
const {chromium}=require('playwright');
const CL={content:[{type:'tool_use',id:'t',name:'route_request',input:{loop:false,days:2,difficulty:'medium',poi_types:['nightcamp'],summary_he:'יומיים ממצפה רמון',start:{name:'מצפה רמון',lat:30.61,lon:34.80},max_km_per_day:100}}],stop_reason:'tool_use'};
function fakeOSM(){const els=[];let id=1;const la0=30.3,lo0=34.6,st=0.01,n=60;const nid=(i,j)=>i*1000+j+1;
 for(let i=0;i<n;i++)for(let j=0;j<n;j++){if(j+1<n)els.push({type:'way',id:id++,nodes:[nid(i,j),nid(i,j+1)],geometry:[{lat:la0+i*st,lon:lo0+j*st},{lat:la0+i*st,lon:lo0+(j+1)*st}],tags:{highway:'track',tracktype:'grade2'}});if(i+1<n)els.push({type:'way',id:id++,nodes:[nid(i,j),nid(i+1,j)],geometry:[{lat:la0+i*st,lon:lo0+j*st},{lat:la0+(i+1)*st,lon:lo0+j*st}],tags:{highway:'track',tracktype:'grade2'}});}
 for(const [nm,la,lo] of [['חניון לילה א',30.32,35.18],['חניון לילה ב',30.88,35.18],['חניון לילה ג',30.31,34.62]])els.push({type:'node',id:id++,lat:la,lon:lo,tags:{tourism:'camp_site',name:nm,operator:'רשות הטבע והגנים'}});return {elements:els};}
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:400,height:860}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
 const data=JSON.stringify(fakeOSM());
 await p.route(/overpass|kumi|coffee|mail\.ru/,async r=>{await new Promise(x=>setTimeout(x,1500));r.fulfill({status:200,contentType:'application/json',body:data})});
 await p.route(/functions\/v1\/api/,async r=>{const path=new URL(r.request().url()).pathname;if(path.endsWith('/claude')){await new Promise(x=>setTimeout(x,1500));return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(CL)});}r.fulfill({status:404,contentType:'application/json',body:'{}'});});
 await p.route(/nominatim|wikimedia|wikidata|open-meteo|githubusercontent/,r=>r.fulfill({status:404,contentType:'application/json',body:'{}'}));
 await p.route(/tile\.|arcgis|fonts/,r=>r.abort());
 await p.addInitScript(()=>localStorage.setItem('groupCode','abc'));
 await p.goto('file://'+process.argv[2]);
 await p.fill('#prompt','יומיים ממצפה רמון');await p.click('#goBtn');
 await p.waitForTimeout(700);
 const a=await p.evaluate(()=>({card:!document.getElementById('planCard').hidden,on:document.querySelector('.pc-steps li.on')?.textContent}));
 await p.waitForTimeout(1600);
 const b2=await p.evaluate(()=>({sum:document.querySelector('.pc-sum').textContent,on:document.querySelector('.pc-steps li.on')?.textContent,ok:document.querySelectorAll('.pc-steps li.ok').length}));
 await p.screenshot({path:process.argv[3]});
 await p.waitForFunction(()=>!busy,null,{timeout:60000});
 const c=await p.evaluate(()=>({st:document.getElementById('status').textContent.slice(0,120),results:!document.getElementById('results').hidden,card:!document.getElementById('planCard').hidden}));
 // a change: results stay visible, dimmed
 await p.evaluate(()=>{document.querySelector('#diffSeg button:nth-child(3)').click();});await p.waitForTimeout(200);
 const d=await p.evaluate(()=>({results:!document.getElementById('results').hidden,working:document.getElementById('results').classList.contains('working')}));
 await p.waitForFunction(()=>!busy,null,{timeout:60000});
 console.log(JSON.stringify({a,b:b2,c,d}));console.log(errs.join('\n')||'no page errors');await b.close();})();
