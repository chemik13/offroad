// Phone sheet: dragging the handle up settles at full height, down to the peek height; a tap still cycles.
const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:390,height:844},hasTouch:true});const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.route(/tile\.|arcgis|fonts|githubusercontent|supabase/,r=>r.abort());
 await p.goto('file://'+process.argv[2]);await p.waitForTimeout(300);
 const g=await p.locator('#grip').boundingBox();const x=g.x+g.width/2,y=g.y+g.height/2;
 const h=async()=>Math.round((await p.locator('#sheet').boundingBox()).height);
 const h0=await h();
 await p.mouse.move(x,y);await p.mouse.down();for(let k=1;k<=10;k++)await p.mouse.move(x,y-k*40);await p.mouse.up();await p.waitForTimeout(400);
 const up=await h(),cls1=await p.getAttribute('#sheet','class');
 await p.mouse.move(x,(await p.locator('#grip').boundingBox()).y+3);await p.mouse.down();for(let k=1;k<=16;k++)await p.mouse.move(x,(await p.locator('#grip').boundingBox()).y+k*45);await p.mouse.up();await p.waitForTimeout(400);
 const down=await h(),cls2=await p.getAttribute('#sheet','class');
 console.log(JSON.stringify({h0,up,cls1,down,cls2}));console.log(errs.join('\n')||'no page errors');await b.close();})();
