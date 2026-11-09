// Claude's first reply is cut off (max_tokens) mid route_request with only the start: never plan from it, ask again.
const {chromium}=require('playwright');
const CUT={content:[{type:'text',text:'מתכנן…'},{type:'tool_use',id:'t1',name:'route_request',input:{start:{name:'Thessaloniki',lat:40.64,lon:22.94},country:'GR'}}],stop_reason:'max_tokens'};
const FULL={content:[{type:'tool_use',id:'t2',name:'route_request',input:{loop:false,days:15,difficulty:'medium',poi_types:['nightcamp'],summary_he:'מסלוניקי לדולומיטים',country:'GR',start:{name:'Thessaloniki',lat:40.64,lon:22.94},end:{name:'Cortina d\'Ampezzo',lat:46.54,lon:12.14},max_km_per_day:100}}],stop_reason:'tool_use'};
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:400,height:860}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
 const bodies=[];let n=0;
 await p.route(/functions\/v1\/api/,r=>{const path=new URL(r.request().url()).pathname;if(path.endsWith('/claude')){bodies.push(r.request().postDataJSON());return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(n++?FULL:CUT)});}r.fulfill({status:404,contentType:'application/json',body:'{}'});});
 await p.route(/overpass|kumi|coffee|mail\.ru|osrm|nominatim|wikimedia|wikidata|open-meteo|githubusercontent/,r=>r.fulfill({status:503,contentType:'application/json',body:'{}'}));
 await p.route(/tile\.|arcgis|fonts/,r=>r.abort());
 await p.addInitScript(()=>{localStorage.setItem('groupCode','abc');window.planOverlandHit=0;});
 await p.goto('file://'+process.argv[2]);
 await p.evaluate(()=>{const o=window.planOverland;window.planOverland=undefined;});
 await p.fill('#prompt','תתכנן לי טיול מסלוניקי לדולומיטים לא יותר מ70-100 ק״מ ביום');await p.click('#goBtn');
 for(let i=0;i<40;i++){await p.waitForTimeout(500);if(n>=2&&await p.inputValue('#pEnd').catch(()=>''))break;}
 const last=bodies[bodies.length-1];
 console.log('claude calls',n,'max_tokens',bodies[0].max_tokens,'retry msg:',JSON.stringify(last.messages.slice(-1)[0].content).slice(0,60),'no dangling tool_use:',!JSON.stringify(last.messages).includes('"t1"'));
 console.log('end field',await p.inputValue('#pEnd'),'days',await p.inputValue('#pDays').catch(()=>'?'));
 console.log(errs.join('\n')||'no page errors');await b.close();})();
