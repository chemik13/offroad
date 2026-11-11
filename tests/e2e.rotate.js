// the map turns: buttons, Shift+arrows, compass back to north; the route still draws and fits
const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const pg=await b.newPage({viewport:{width:1300,height:850}});
const errs=[];pg.on('pageerror',e=>errs.push(e.message));
await pg.route(/fonts\.g|opentopomap|arcgis|tile\.openstreetmap/,r=>r.abort());
await pg.goto('file://'+process.argv[2]);
let fails=0;const ok=(c,t)=>{console.log((c?'PASS ':'FAIL ')+t);if(!c)fails++;};
ok(await pg.evaluate(()=>typeof map.setBearing==='function'),'rotation available');
await pg.click('.rotctl a[title="סיבוב ימינה"]'); await pg.click('.rotctl a[title="סיבוב ימינה"]');
ok(Math.round(await pg.evaluate(()=>map.getBearing()))===40,'buttons turn the map');
await pg.click('#map'); await pg.keyboard.down('Shift'); await pg.keyboard.press('ArrowLeft'); await pg.keyboard.up('Shift');
ok(Math.round(await pg.evaluate(()=>map.getBearing()))===25,'Shift+arrow turns');
await pg.click('.rotctl a[title="צפון למעלה"]');
ok(Math.round(await pg.evaluate(()=>map.getBearing()))===0,'compass: north up');
await pg.evaluate(()=>map.setBearing(60));
const r=await pg.evaluate(async()=>{const P={country:'IL',start:{name:'מצפה רמון',lat:30.6097,lon:34.8013,researched:true,country:'IL'},loop:true,duration_hours:2,difficulty:'medium',military_mode:'auto',via:[]};await run(true,P);return {res:!!current?.res?.results?.length,paths:document.querySelectorAll('.leaflet-overlay-pane path').length};});
ok(r.res&&r.paths>0,'plans and draws while turned ('+r.paths+' paths)');
await pg.screenshot({path:process.argv[3]||'/tmp/rot.png'});
console.log(errs.join('\n')||'no page errors');console.log(fails||errs.length?'FAILED':'ALL PASS');await b.close();})();
