const E = require('../src/engine.js');
let id=1; const els=[]; const n=60, la0=30.5, lo0=34.7, step=0.005;
const nid=(i,j)=>i*1000+j+1;
let rnd=7; const r=()=>{rnd=(rnd*16807)%2147483647;return rnd/2147483647};
for(let i=0;i<n;i++) for(let j=0;j<n-1;j++){ // horizontal & vertical ways
  const g1=[{lat:la0+i*step,lon:lo0+j*step},{lat:la0+i*step,lon:lo0+(j+1)*step}];
  els.push({type:'way',id:id++,nodes:[nid(i,j),nid(i,j+1)],geometry:g1,tags:{highway:'track',tracktype:'grade'+(1+Math.floor(r()*5))}});
  const g2=[{lat:la0+j*step,lon:lo0+i*step},{lat:la0+(j+1)*step,lon:lo0+i*step}];
  els.push({type:'way',id:id++,nodes:[nid(j,i),nid(j+1,i)],geometry:g2,tags:{highway:i%15==0?'unclassified':'track',tracktype:'grade'+(1+Math.floor(r()*5))}});
}
for(let k=0;k<15;k++) els.push({type:'node',id:id++,lat:la0+r()*n*step,lon:lo0+r()*n*step,tags:{tourism:'viewpoint',name:'תצפית '+k}});
els.push({type:'way',id:id++,tags:{landuse:'military'},geometry:[{lat:30.6,lon:34.8},{lat:30.6,lon:34.85},{lat:30.65,lon:34.85},{lat:30.65,lon:34.8},{lat:30.6,lon:34.8}]});
let t=Date.now(); const G=E.buildGraph(els); console.log('graph',G.N,G.E,'mil edges',G.eMil.reduce((a,b)=>a+b,0),Date.now()-t,'ms');
const p=E.parseLocal('לופ של 3 שעות ממצפה רמון עם תצפית, בינוני, ג׳יפ מוגבה');
console.log(p);
const fac=E.factors(G,p); const s=E.nearestNode(G,30.63,34.83,fac); console.log('start node',s,'(should be -1 if in mil? no, we snap outside)');
const s2=E.nearestNode(G,30.55,34.75,fac);
t=Date.now(); const res=E.plan(G,p,{s:s2,e:-1,vias:[]},m=>console.log(' ..',m));
console.log('plan ms',Date.now()-t,'target km',res.L/1000);
for(const r of res.results) console.log('route km',(r.len/1000).toFixed(1),'hrs',r.hrs.toFixed(2),'maxD',r.maxD,'reuse km',(r.reuse/1000).toFixed(1),'pois',r.pois.map(x=>x.name),'mil',r.mil, 'closed', r.coords[0]+''===r.coords[r.coords.length-1]+'');
const p2={...p,loop:false,poi_types:['viewpoint'],duration_hours:null};
const e=E.nearestNode(G,30.7,34.95,fac);
const r2=E.plan(G,p2,{s:s2,e,vias:[]});
for(const r of r2.results) console.log('AB km',(r.len/1000).toFixed(1),'pois',r.pois.length);
const gpx=E.toGPX(res.results[0],'בדיקה'); console.log(gpx.slice(0,300)); console.log('trkpts',(gpx.match(/trkpt /g)||[]).length);
console.log(E.parseLocal('מסלול קשה מאזור הר חריף עד עין עקב עם מעיין, נעילות, בלי כביש'));
