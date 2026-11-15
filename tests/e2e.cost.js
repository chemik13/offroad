// cost estimate: km and litres computed locally, prices from one lookup kept with the trip; settings recompute without a new lookup
const {chromium}=require('playwright');(async()=>{const errs=[];
const b=await chromium.launch();const p=await b.newPage({viewport:{width:420,height:900}});p.on('pageerror',e=>errs.push(e.message));
let claude=0,patch=null,ask='';
await p.route(/functions\/v1\/api/,async r=>{const u=new URL(r.request().url());const path=u.pathname.replace(/^.*\/api/,'');const m=r.request().method();const J=(o,s=200)=>r.fulfill({status:s,contentType:'application/json',body:JSON.stringify(o)});
 if(path==='/health')return J({ok:true,claude:true,group:true});
 if(path==='/claude'){const body=JSON.parse(r.request().postData());if(!/estimate travel costs/.test(body.system))return J({content:[{type:'text',text:'{"depart":"","operator":""}'}]});claude++;ask=body.messages[0].content;
  return J({content:[{type:'text',text:'Here: {"eur_ils":4,"days":["GR","IT"],"countries":{"GR":{"name":"יוון","petrol":2,"diesel":1.5,"lpg":1,"camp":30,"toll_eur":20,"toll_note":"כביש אגנטיה"},"IT":{"name":"איטליה","petrol":1.9,"diesel":1.8,"lpg":0,"camp":40,"toll_eur":0,"toll_note":""}},"borders":[],"ferries":[{"line":"Igoumenitsa -> Ancona","eur":400,"note":"רכב + 2 בתא"}],"notes":"מחירי מעבורת משתנים"}'}]});}
 if(/^\/routes\/[^/]+$/.test(path)&&m==='PATCH'){patch=JSON.parse(r.request().postData());return J({route:{id:'t1'}});}
 return J({error:'nf'},404);});
await p.route(/tile|arcgis|israelhiking|nominatim|open-meteo|wikimedia|wikidata|githubusercontent/,r=>r.abort());
await p.addInitScript(()=>{localStorage.setItem('groupCode','abc');localStorage.setItem('nick','חמי');});
await p.goto('file://'+process.argv[2]);await p.waitForTimeout(500);
const ok=(c,t)=>{console.log((c?'PASS ':'FAIL ')+t);if(!c)process.exitCode=1;};
await p.evaluate(()=>{const A=[39.50,20.26],B=[43.62,13.51];const line=(a,b,n)=>Array.from({length:n+1},(_,i)=>[a[0]+(b[0]-a[0])*i/n,a[1]+(b[1]-a[1])*i/n]);const c1=line([39.66,20.85],A,8),c2=line(B,[44.27,11.72],16);const coords=[...c1,...c2];
 showSaved({id:'t1',trip_id:'t1',version:1,name:'בדיקה',params:{start:{name:'Ioannina',lat:39.66,lon:20.85},end:{name:'Riolo',lat:44.27,lon:11.72},days:2,loop:false,date:'2027-06-10'},coords,
  waypoints:[{type:'nightcamp',name:'Camping Test',lat:44.27,lon:11.72,auth:'קמפינג רשמי'}],
  stats:{len:300000,hrs:6,maxD:1,byD:[300000,0,0,0,0,0],runs:[[0,9],[-2,1],[0,16]],overland:true,asph:300000,days:[{from:0,to:8,len:70000,off:0,hrs:2,camp:{name:'Camping Igo',lat:A[0],lon:A[1],type:'nightcamp',auth:'קמפינג רשמי'}},{from:8,to:25,len:130000,off:0,hrs:3,camp:null}]}});});
await p.waitForTimeout(800);
ok(await p.evaluate(()=>!!document.querySelector('#costGo')&&!document.querySelector('.costtab')),'button first, nothing looked up by itself ('+claude+')');
await p.click('#costGo');await p.waitForTimeout(1000);
const st=()=>p.evaluate(()=>({txt:document.querySelector('#cost').textContent,rows:[...document.querySelectorAll('.costtab tr')].map(x=>x.lastElementChild.textContent),k:costCalc(current.res.results[0],current.res.results[0].cost,costSet()),d:costDays(current.res.results[0])}));
let t=await st();
ok(claude===1&&/Day 2:/.test(ask)&&/Igoumenitsa|ferry|night: campsite "Camping Igo"/.test(ask)&&/2 people/.test(ask),'one lookup with the days and the nights');
const d0=t.d[0],d1=t.d[1],lit=(d0.road+d1.road)*13/100,fuel=d0.road*13/100*1.5+d1.road*13/100*1.8;
ok(Math.abs(t.k.litres-lit)<0.01&&Math.abs(t.k.fuel-fuel)<0.01&&d0.road>45&&d0.road<70&&d1.road>100&&d1.road<220,'fuel: road km of each day × its country price, sailing left out ('+Math.round(d0.road)+'+'+Math.round(d1.road)+' km, €'+Math.round(t.k.fuel)+')');
ok(t.k.nights===1&&Math.abs(t.k.camp-30)<0.01&&t.k.tolls===20&&Math.abs(t.k.ferries-400)<0.01&&Math.abs(t.k.total-(fuel+30+20+400))<0.01,'camp night in Greece, tolls, ferry, total: '+t.rows.join(' | '));
ok(/סה"כ לרכב/.test(t.txt)&&/₪/.test(t.txt)&&/לאדם/.test(t.txt)&&/יוון/.test(t.txt),'table with shekels and per person');
ok(patch&&patch.stats.cost&&patch.stats.cost.countries.GR.diesel===1.5,'kept with the trip');
await p.selectOption('#costFuel','petrol');await p.fill('#costCons','20');await p.press('#costCons','Tab');await p.waitForTimeout(300);t=await st();
ok(claude===1&&Math.abs(t.k.fuel-(d0.road*0.2*2+d1.road*0.2*1.9))<0.01,'fuel type and consumption recompute without a new lookup');
await p.selectOption('#costFuel','lpg');await p.waitForTimeout(300);t=await st();
ok(/אין מחיר גז/.test(t.txt)&&/איטליה/.test(t.txt),'a country with no price for that fuel is said');
ok(await p.evaluate(()=>[...document.querySelectorAll('#p4n a')].some(a=>/park4night\.com\/en\/search\?lat=/.test(a.href))&&document.querySelectorAll('#p4n a').length===2),'Park4night search per day');
console.log(errs.join('\n')||'no page errors');if(errs.length)process.exitCode=1;await b.close();})();
