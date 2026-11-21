const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const puppeteer=require('/root/projects/tools/touchviz/node_modules/puppeteer');
const root=path.resolve(__dirname,'../web');
const server=http.createServer((req,res)=>{
  const relative=(req.url||'/').split('?')[0].replace(/^\//,'');
  const p=path.resolve(root,relative);
  if(!p.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  fs.readFile(p,(e,b)=>{
    if(e){res.writeHead(404).end();return;}
    const mime=p.endsWith('.js')?'text/javascript':p.endsWith('.html')?'text/html':'application/octet-stream';
    res.writeHead(200,{'Content-Type':mime});res.end(b);
  });
});
const listen=()=>new Promise(ok=>server.listen(0,'127.0.0.1',ok));
async function tapText(page,selector,label){
 const elements=await page.$$(selector);
 for(const el of elements){
   const text=await page.evaluate(x=>x.textContent.trim(),el);
   if(text===label){await page.evaluate(node=>node.click(),el);return;}
 }
 throw Error('missing button '+selector+': '+label);
}
async function tapProbe(page, row, label){
 const rows=await page.$$('#control-panel .probe-row');
 if(rows.length<2)throw Error('Missing probe rows');
 const opts=await rows[row].$$('button');
 for(const button of opts){
   const value=await page.evaluate(x=>x.textContent.trim(),button);
   if(value===label){await page.evaluate(node=>node.click(),button);return;}
 }
 throw Error('Missing '+label+' in probe row '+row);
}
(async()=>{
 await listen();
 const browser=await puppeteer.launch({headless:true,executablePath:'/data/root-cache/ms-playwright/chromium-1243/chrome-linux64/chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
 for(const vp of [{width:320,height:568},{width:390,height:844}]){
  const context=await browser.createBrowserContext();const page=await context.newPage();await page.setViewport({...vp,isMobile:true,hasTouch:true,deviceScaleFactor:1});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const url='http://127.0.0.1:'+server.address().port+'/pulse-by-example-20261121.html';
  const resp=await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.getElementById('ops-count').textContent==='415',{timeout:10000});
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.getElementById('ops-count').textContent==='415',{timeout:10000});
  const before=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,viewport:innerWidth,tasks:[...document.querySelectorAll('.task')].map(t=>t.getBoundingClientRect().height)}));
  assert.equal(before.scroll,vp.width);assert.equal(before.tasks.length,4);
  // A: -8 => 0, 7 => 7
  await tapProbe(page,1,'0');
  await page.click('#control-panel .cta.primary');
  await tapProbe(page,0,'7');
  await tapProbe(page,1,'7');
  await page.click('#control-panel .cta.primary');
  await page.waitForFunction(()=>document.querySelector('.candidate .name')?.textContent.includes('Не нижче'),{timeout:8000});
  const a=await page.$eval('.candidate .name',e=>e.textContent);
  await page.evaluate(()=>document.querySelector('.candidate button').scrollIntoView({block:'center',behavior:'instant'}));
  const coord=await page.$eval('.candidate button',b=>{const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};});
  await page.touchscreen.tap(coord.x,coord.y);
  const acode=await page.$eval('#expression',e=>e.textContent);
  assert.equal(acode,'Math.max(0, loss)');
  await page.screenshot({path:'/tmp/pulse-behavior-a-'+vp.width+'.png'});
  // B
  await page.click('#tasks .task:nth-child(2)');
  await tapProbe(page,1,'100');
  await page.click('#control-panel .cta.primary');
  await tapProbe(page,0,'7');
  await tapProbe(page,1,'7');
  await page.click('#control-panel .cta.primary');
  await page.waitForFunction(()=>document.querySelector('.candidate .name')?.textContent.includes('Не вище'),{timeout:8000});
  await page.$eval('.candidate button', b => b.click());
  const bcode=await page.$eval('#expression',e=>e.textContent);
  assert.equal(bcode,'Math.min(100, Math.max(0, loss))');
  // C
  await page.click('#tasks .task:nth-child(3)');
  await tapText(page,'#control-panel .probe-row button','50');
  const ccode=await page.$eval('#expression',e=>e.textContent);
  assert.equal(ccode,'Math.min(50, Math.max(0, loss))');
  await page.click('#undo');
  const undone=await page.$eval('#expression',e=>e.textContent);
  assert.equal(undone,'Math.min(100, Math.max(0, loss))');
  await tapText(page,'#control-panel .probe-row button','50');
  // D
  await page.click('#tasks .task:nth-child(4)');
  await tapProbe(page,1,'8');
  await page.click('#control-panel .cta.primary');
  await tapProbe(page,0,'7');
  await tapProbe(page,1,'7');
  await page.click('#control-panel .cta.primary');
  await page.waitForFunction(()=>document.querySelector('.candidate .name')?.textContent.includes('Модуль'),{timeout:8000});
  await page.$eval('.candidate button', b => b.click());
  const dcode=await page.$eval('#expression',e=>e.textContent);
  assert.equal(dcode,'Math.abs(loss)');
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#expression')?.textContent==='Math.abs(loss)',{timeout:8000});
  const persisted=await page.$eval('#expression',e=>e.textContent);
  const metrics=await page.evaluate(()=>({taps:+document.getElementById('tap-count').textContent,ruleCount:+document.getElementById('rule-count').textContent,finished:[...document.querySelectorAll('.task .done')].length}));
  console.log(JSON.stringify({vp,before,a,acode,bcode,ccode,undone,dcode,persisted,metrics,errors}));
  assert.equal(errors.length,0,JSON.stringify(errors));
  assert(metrics.taps>=1&&metrics.finished===4);
  await page.close();await context.close();
 }
 await browser.close();
 await new Promise(ok=>server.close(ok));
})().catch(e=>{console.error('QA FAIL',e.stack);server.close();process.exit(1)});
