// a trip saved before sailing times were kept: opening it looks the ferry up once, shows the clock, and saves it for everyone;
// campsites without a website get the booking links
const {chromium}=require('playwright');(async()=>{const errs=[];
const b=await chromium.launch();const p=await b.newPage({viewport:{width:420,height:900}});p.on('pageerror',e=>errs.push(e.message));
let claude=0,patch=null;
await p.route(/functions\/v1\/api/,async r=>{const u=new URL(r.request().url());const path=u.pathname.replace(/^.*\/api/,'');const m=r.request().method();const J=(o,s=200)=>r.fulfill({status:s,contentType:'application/json',body:JSON.stringify(o)});
 if(path==='/health')return J({ok:true,claude:true,group:true});
 if(path==='/claude'){claude++;return J({content:[{type:'web_search_tool_result',content:[{url:'https://www.example-ferries.com/igoumenitsa-ancona'}]},{type:'text',text:'{"depart":"21:30","hours":20.5,"operator":"Grimaldi Lines, Superfast","freq":"כמעט כל יום","url":"https://www.example-ferries.com/igoumenitsa-ancona"}'}]});}
 if(/^\/routes\/[^/]+$/.test(path)&&m==='PATCH'){patch=JSON.parse(r.request().postData());return J({route:{id:'t1'}});}
 return J({error:'nf'},404);});
await p.route(/tile|arcgis|israelhiking|nominatim|open-meteo|wikimedia|wikidata|githubusercontent/,r=>r.abort());
await p.addInitScript(()=>{localStorage.setItem('groupCode','abc');localStorage.setItem('nick','חמי');});
await p.goto('file://'+process.argv[2]);await p.waitForTimeout(500);
const ok=(c,t)=>{console.log((c?'PASS ':'FAIL ')+t);if(!c)process.exitCode=1;};
await p.evaluate(()=>{const A=[39.50,20.26],B=[43.62,13.51];const coords=[[39.66,20.85],[39.58,20.5],A,B,[44.0,12.9],[44.27,11.72]];
 showSaved({id:'t1',trip_id:'t1',version:1,name:'בדיקה',params:{start:{name:'Ioannina',lat:39.66,lon:20.85},end:{name:'Riolo',lat:44.27,lon:11.72},days:2,loop:false,date:'2027-06-10'},coords,
  waypoints:[{type:'via',name:'⛴ מעבורת: Igoumenitsa ← Ancona',lat:A[0],lon:A[1],note:'מעבורת ביום 2: כ-725 ק"מ בים, כ-16:00 שעות שיט.'},{type:'nightcamp',name:'Camping Test',lat:44.27,lon:11.72,auth:'קמפינג רשמי'}],
  stats:{len:300000,hrs:6,maxD:1,byD:[300000,0,0,0,0,0],runs:[[0,3],[-2,1],[0,2]],overland:true,asph:300000,days:[{from:0,to:2,len:70000,off:0,hrs:2,camp:{name:'⛴ לילה על המעבורת',lat:A[0],lon:A[1],type:'nightcamp',auth:'מעבורת לילה'}},{from:2,to:5,len:230000,off:0,hrs:4,camp:null}]}});});
await p.waitForTimeout(1500);
const t=await p.evaluate(()=>({sub:[...document.querySelectorAll('#dayPlan .dns')].map(x=>x.textContent),sched:[...document.querySelectorAll('#dayPlan .dsched')].map(x=>x.textContent),fer:current.res.results[0].days[0].camp.fer,links:[...document.querySelectorAll('#dayPlan .plinks a')].map(a=>a.textContent)}));
ok(claude===1,'one lookup, by itself ('+claude+')');
ok(t.fer&&!t.fer.est&&Math.abs(t.fer.depart-21.5)<0.01&&Math.abs(t.fer.arrive-18)<0.01,'clock: sails 21:30, lands 18:00 ('+JSON.stringify(t.fer&&[t.fer.depart,t.fer.arrive,t.fer.hours])+')');
ok(/Grimaldi/.test(t.sub.join(' '))&&/21:30/.test(t.sub.join(' '))&&/^Igoumenitsa/.test(t.sub[0]),'ferry card: '+t.sub[0]);
ok(/הפלגה 21:30/.test(t.sched[0]||'')&&/ירידה מהמעבורת ~18:00/.test(t.sched[1]||''),'day clocks: '+t.sched.join(' | '));
ok(t.links.includes('דף ההפלגה והזמנה'),'booking page link (only a site the search returned)');
ok(patch&&patch.stats.days[0].camp.fer.ops==='Grimaldi Lines, Superfast','saved with the trip for everyone');
await p.evaluate(()=>render(0,null));await p.waitForTimeout(500);ok(claude===1,'not looked up again');
const cl=await p.evaluate(()=>{const c={type:'nightcamp',name:'Camping Lago Azzurro',lat:44.27,lon:11.72,auth:'קמפינג רשמי'};return [...placeLinks(c).querySelectorAll('a')].map(a=>a.textContent+' '+(a.getAttribute('href')||'').slice(0,60));});
ok(cl.some(x=>/Pitchup/.test(x))&&cl.some(x=>/park4night\.com\/en\/search\?lat=44\.27/.test(x))&&cl.some(x=>/חפש את אתר/.test(x)),'campsite without a site: '+cl.map(x=>x.split(' http')[0]).join(', '));
console.log(errs.join('\n')||'no page errors');if(errs.length)process.exitCode=1;await b.close();})();
