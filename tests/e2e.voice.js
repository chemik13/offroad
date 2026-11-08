// Voice: a fake recognizer says a sentence in chunks with pauses, and ends on its own after each chunk
// (like iOS). Expect: every chunk kept, listening continues, route builds only after 3 s of silence.
const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.route(/tile\.|arcgis|fonts|overpass|kumi|coffee|mail|open-meteo|nominatim|wiki|functions|githubusercontent/,r=>r.abort());
 await p.addInitScript(()=>{
  const chunks=['טיול של יומיים','מצפה רמון עם חניון לילה','ועצירה לארוחת צהריים'];let n=0;window.__starts=0;window.__built=0;
  class FakeSR{constructor(){this.lang='';}start(){window.__starts++;const me=this;const k=n++;
    if(k<chunks.length){setTimeout(()=>me.onresult&&me.onresult({resultIndex:0,results:[Object.assign([{transcript:chunks[k].slice(0,6)}],{isFinal:false})]}),300);
     setTimeout(()=>me.onresult&&me.onresult({resultIndex:0,results:[Object.assign([{transcript:chunks[k]}],{isFinal:true})]}),900);}
    setTimeout(()=>me.onend&&me.onend(),1500);} // browser ends after every chunk
   stop(){setTimeout(()=>this.onend&&this.onend(),10);}}
  Object.defineProperty(window,'webkitSpeechRecognition',{value:FakeSR,configurable:true,writable:true});Object.defineProperty(window,'SpeechRecognition',{value:FakeSR,configurable:true,writable:true});});
 await p.goto('file://'+process.argv[2]);
 await p.evaluate(()=>{const o=run;window.run=(...a)=>{window.__built++;window.__builtText=document.getElementById('prompt').value;};});
 await p.click('#micBtn');
 for(const t of [2000,4000,6000,9500]){await p.waitForTimeout(t===2000?2000:t-(t===4000?2000:t===6000?4000:6000));console.log('t='+t/1000+'s','listening',await p.evaluate(()=>document.getElementById('micBtn').classList.contains('on')),'| text:',await p.inputValue('#prompt'),'| built',await p.evaluate(()=>window.__built));}
 console.log('recognizer restarts',await p.evaluate(()=>window.__starts),'| built with:',await p.evaluate(()=>window.__builtText));
 console.log(errs.join('\n')||'no page errors');await b.close();})();
