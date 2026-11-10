// Real network (OSRM, prebuilt tiles, Nominatim), Claude's answer given as a preset. Prints timing per phase.
const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch(process.env.HTTPS_PROXY?{proxy:{server:process.env.HTTPS_PROXY}}:{});const p=await b.newPage({viewport:{width:1400,height:900},ignoreHTTPSErrors:true});if(process.env.DBG)p.on('console',m=>{if(/day|piece/.test(m.text()))console.log('C',m.text().slice(0,160))});const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.route(/tile\.|arcgis|fonts|opentopomap|openstreetmap\.org\/\d/,r=>r.abort());
 await p.route(/overpass|kumi|coffee|mail\.ru/,r=>r.abort());
 await p.route(/project-osrm/,async r=>{try{const resp=await r.fetch({timeout:60000});await r.fulfill({response:resp,headers:{...resp.headers(),'access-control-allow-origin':'*'}});}catch(e){console.log('osrm relay fail',e.message);r.abort();}});
 await p.goto('file://'+process.argv[2]);
 const P={start:{name:'Thessaloniki',lat:40.64,lon:22.94,country:'GR'},loop:true,days:21,max_km_per_day:100,offroad_share:0.35,night_near_water:true,resupply_every_days:2,country:'GR',difficulty:'medium',poi_types:['nightcamp'],summary_he:'test',
  via:[{name:'Zagori',lat:39.88,lon:20.75},{name:'Igoumenitsa',lat:39.505,lon:20.265,ferry_to_next:true,ferry_hours:26},{name:'Venezia',lat:45.44,lon:12.32},{name:'Passo Giau',lat:46.48,lon:12.05},{name:'Lago di Braies',lat:46.69,lon:12.08},{name:'Venezia porto',lat:45.43,lon:12.31,ferry_to_next:true,ferry_hours:26},{name:'Igoumenitsa port',lat:39.50,lon:20.26},{name:'Meteora',lat:39.71,lon:21.63}]};
 const t0=Date.now();let last='';
 const iv=setInterval(async()=>{try{const st=await p.textContent('#status');if(st!==last){last=st;console.log(((Date.now()-t0)/1000).toFixed(0)+'s',st.slice(0,90));}}catch{}},500);
 await p.evaluate(P=>run(true,P),P);
 await p.waitForFunction(()=>!busy,null,{timeout:600000});clearInterval(iv);
 const o=await p.evaluate(()=>{const r=current?.res?.results?.[0];return r?{days:r.days?.length,km:Math.round(r.len/1000),off:Math.round((r.len-r.asph)/r.len*100)+'%',hrs:Math.round(r.hrs),dayKm:r.days.map(d=>Math.round(d.len/1000)+'/'+Math.round((d.off||0)/1000)+(d.camp?.ferry?'⛴':'')).join(' '),ferries:r.pois.filter(x=>/מעבורת/.test(x.name)).map(x=>x.name+' | '+x.note),camps:r.days.map(d=>d.camp?.name).filter(Boolean).slice(0,25),issues:r.issues}:document.querySelector('#status').textContent});
 console.log('TOTAL',((Date.now()-t0)/1000).toFixed(0)+'s');console.log(JSON.stringify(o,null,1));
 await p.screenshot({path:process.argv[3]||'/tmp/real.png'});console.log(errs.join('\n')||'no page errors');await b.close();})();
