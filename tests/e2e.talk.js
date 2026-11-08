// Conversation mode: fake speech in/out, mocked Claude. Turn 1: Claude asks a question. Turn 2: plans.
// Turn 3: a change by voice (must send tool_result first). "זהו" ends.
const {chromium}=require('playwright');
function fakeOSM(){const els=[];let id=1;const la0=30.45,lo0=34.65,st=0.004,n=90;const nid=(i,j)=>i*1000+j+1;
 for(let i=0;i<n;i++)for(let j=0;j<n-1;j++){els.push({type:'way',id:id++,nodes:[nid(i,j),nid(i,j+1)],geometry:[{lat:la0+i*st,lon:lo0+j*st},{lat:la0+i*st,lon:lo0+(j+1)*st}],tags:{highway:'track',tracktype:'grade2'}});
 els.push({type:'way',id:id++,nodes:[nid(j,i),nid(j+1,i)],geometry:[{lat:la0+j*st,lon:lo0+i*st},{lat:la0+(j+1)*st,lon:lo0+i*st}],tags:{highway:'track',tracktype:'grade3'}});}
 els.push({type:'node',id:id++,lat:30.62,lon:34.82,tags:{tourism:'viewpoint',name:'מצפור אחד'}});
 return {elements:els};}
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:400,height:860}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
 const data=JSON.stringify(fakeOSM());const bodies=[];
 await p.route(/overpass|kumi|coffee|mail\.ru/,r=>r.fulfill({status:200,contentType:'application/json',body:data}));
 await p.route(/githubusercontent/,r=>r.fulfill({status:404,body:''}));
 await p.route(/functions\/v1\/api/,r=>{const path=new URL(r.request().url()).pathname;
  if(path.endsWith('/claude')){const body=JSON.parse(r.request().postData());bodies.push(body);const n=bodies.length;
   const resp=n===1?{content:[{type:'text',text:'בכיף. כמה זמן יש לכם?'}],stop_reason:'end_turn'}
    :n===2?{content:[{type:'text',text:'מתכנן מסלול ממצפה רמון.'},{type:'tool_use',id:'tu1',name:'route_request',input:{loop:false,duration_hours:3,difficulty:'medium',poi_types:['viewpoint'],start:{name:'מצפה רמון',lat:30.6097,lon:34.8017},summary_he:'3 שעות'}}],stop_reason:'tool_use'}
    :{content:[{type:'tool_use',id:'tu2',name:'route_request',input:{loop:false,duration_hours:1.5,difficulty:'medium',poi_types:[],start:{name:'מצפה רמון',lat:30.6097,lon:34.8017},summary_he:'קצר יותר'}}],stop_reason:'tool_use'};
   return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(resp)});}
  if(path.endsWith('/overpass'))return r.fulfill({status:200,contentType:'application/json',body:data});
  r.fulfill({status:path.includes('/tiles/')?404:200,contentType:'application/json',body:'{}'});});
 await p.route(/nominatim|wikimedia|wikidata|open-meteo/,r=>r.fulfill({status:200,contentType:'application/json',body:'{}'}));
 await p.route(/tile\.|arcgis|fonts/,r=>r.abort());
 await p.addInitScript(()=>{localStorage.setItem('groupCode','abc');
  const lines=['אני רוצה טיול ממצפה רמון','שלוש שעות','תקצר את זה','זהו'];let n=0;window.__spoken=[];
  class FakeSR{start(){const me=this;const k=n++;if(k<lines.length){setTimeout(()=>me.onresult&&me.onresult({resultIndex:0,results:[Object.assign([{transcript:lines[k]}],{isFinal:true})]}),200);}}stop(){setTimeout(()=>this.onend&&this.onend(),5);}}
  Object.defineProperty(window,'webkitSpeechRecognition',{value:FakeSR,configurable:true});Object.defineProperty(window,'SpeechRecognition',{value:FakeSR,configurable:true});
  const synth={speaking:false,speak(u){if(u.text)window.__spoken.push(u.text);setTimeout(()=>u.onend&&u.onend(),50);},cancel(){},getVoices(){return [{lang:'he-IL',name:'Carmit'}];}};
  Object.defineProperty(window,'speechSynthesis',{value:synth,configurable:true});
  Object.defineProperty(window,'SpeechSynthesisUtterance',{value:function(t){this.text=t;},configurable:true});});
 await p.goto('file://'+process.argv[2]);
 await p.click('#talkBtn');
 for(let i=0;i<60;i++){await p.waitForTimeout(500);if(!(await p.evaluate(()=>document.getElementById('talkDlg').open)))break;}
 console.log('claude calls',bodies.length,'status',await p.textContent('#status'),'log',await p.evaluate(()=>document.getElementById('talkLog').textContent),'errs',errs);
 console.log('turn3 first block',JSON.stringify(bodies[2]?bodies[2].messages[bodies[2].messages.length-1].content[0]:null).slice(0,120));
 console.log('spoken:');for(const s of await p.evaluate(()=>window.__spoken))console.log('  -',s);
 console.log('dialog open',await p.evaluate(()=>document.getElementById('talkDlg').open),'| route km',await p.evaluate(()=>current&&Math.round(current.res.results[0].len/1000)));
 console.log(errs.join('\n')||'no page errors');await b.close();})();
