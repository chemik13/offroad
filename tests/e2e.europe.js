// Europe: a 2-day trip in Romania (mocked OSM around the gazetteer point) ends days at official campsites,
// shows the abroad/country rules warning, never asks for Israeli weekly tiles, and no firing-zone UI.
const {chromium}=require('playwright');
function fakeOSM(){const els=[];let id=1;const la0=45.35,lo0=24.6,st=0.008,n=70;const nid=(i,j)=>i*1000+j+1;
 for(let i=0;i<n;i++)for(let j=0;j<n-1;j++){els.push({type:'way',id:id++,nodes:[nid(i,j),nid(i,j+1)],geometry:[{lat:la0+i*st,lon:lo0+j*st},{lat:la0+i*st,lon:lo0+(j+1)*st}],tags:{highway:'track',tracktype:'grade2',...(i===35?{motor_vehicle:'agricultural'}:{})}});
 els.push({type:'way',id:id++,nodes:[nid(j,i),nid(j+1,i)],geometry:[{lat:la0+j*st,lon:lo0+i*st},{lat:la0+(j+1)*st,lon:lo0+i*st}],tags:{highway:'track',tracktype:'grade2'}});}
 let s=7;const r=()=>{s=(s*16807)%2147483647;return s/2147483647};
 for(let k=0;k<10;k++)els.push({type:'node',id:id++,lat:la0+r()*n*st,lon:lo0+r()*n*st,tags:k%2?{tourism:'camp_site',name:'Camping '+k}:{tourism:'caravan_site'}});
 els.push({type:'way',id:id++,geometry:[[45.5,24.7],[45.5,24.8],[45.6,24.8],[45.6,24.7],[45.5,24.7]].map(([a,o])=>({lat:a,lon:o})),tags:{landuse:'military'}});
 return {elements:els};}
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:400,height:860}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
 const data=JSON.stringify(fakeOSM());let gh=0,rev=0;
 await p.route(/overpass/,r=>r.fulfill({status:200,contentType:'application/json',body:data}));
 await p.route(/open-meteo|wikimedia|wikidata|functions\/v1/,r=>r.fulfill({status:404,contentType:'application/json',body:'{}'}));
 await p.route(/githubusercontent/,r=>{gh++;r.fulfill({status:404,body:''})});
 await p.route(/nominatim.*reverse/,r=>{rev++;r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({address:{country_code:'ro'}})})});
 await p.route(/tile\.|arcgis|fonts/,r=>r.abort());
 await p.goto('file://'+process.argv[2]);
 await p.fill('#prompt','טיול 2 ימים ברומניה');await p.click('#goBtn');await p.waitForTimeout(6000);
 const o=await p.evaluate(()=>({status:document.querySelector('#status')?.textContent,days:[...document.querySelectorAll('.dayrow')].map(e=>e.textContent),warns:[...document.querySelectorAll('.warn')].map(e=>e.textContent.slice(0,260)),milsw:!!document.querySelector('.milsw'),
   agri:(()=>{const G=current?.G,r=current?.res.results[0];if(!G||!r)return -1;let k=0;for(const c of r.coords)if(Math.abs(c[0]-(45.35+35*0.008))<1e-6)k++;return k})()}));
 console.log(JSON.stringify(o,null,1),'static tile requests',gh,'reverse',rev);
 await p.screenshot({path:process.argv[3]||'/tmp/eu.png'});
 console.log(errs.join('\n')||'no page errors');await b.close();})();
