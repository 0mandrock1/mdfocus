'use strict';
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const puppeteer=require('/root/projects/tools/touchviz/node_modules/puppeteer');
const root=path.resolve(__dirname,'../web');
const server=http.createServer((req,res)=>{
  const file=path.resolve(root,decodeURIComponent((req.url||'/').split('?')[0]).replace(/^\//,''));
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  fs.readFile(file,(err,bytes)=>{
    if(err){res.writeHead(404).end();return;}
    res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript':file.endsWith('.html')?'text/html':'application/octet-stream'}).end(bytes);
  });
});
async function choose(page, selector,label){
  const controls=await page.$$(selector);
  for(const ctrl of controls){
    if((await page.evaluate(e=>e.textContent.trim(),ctrl))===String(label)){
      await page.evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}),ctrl);
      const r=await ctrl.boundingBox();
      if(!r)throw Error('not visible '+selector+' '+label);
      await page.touchscreen.tap(r.x+r.width/2,r.y+r.height/2);
      return;
    }
  }
  throw Error('missing '+selector+' '+label);
}
(async()=>{
  await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
  const browser=await puppeteer.launch({headless:true,executablePath:'/data/root-cache/ms-playwright/chromium-1243/chrome-linux64/chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
  for(const vp of [{width:320,height:568},{width:390,height:844}]){
    const context=await browser.createBrowserContext(),page=await context.newPage();
    await page.setViewport({...vp,isMobile:true,hasTouch:true,deviceScaleFactor:1});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:'+server.address().port+'/pulse-guided.html',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>document.querySelector('#workspace h1')?.textContent.includes('Покажи'),{timeout:12000});
    const initial=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,title:document.querySelector('#workspace h1')?.textContent,choices:[...document.querySelectorAll('#workspace .choices button')].map(b=>b.textContent),rects:[...document.querySelectorAll('#workspace .choices button')].map(b=>Math.round(b.getBoundingClientRect().height))}));
    assert.equal(initial.width,initial.scroll);assert.equal(initial.choices.length,4);assert(initial.rects.every(x=>x>=70));
    await page.screenshot({path:'/tmp/pulse-guided-start-'+vp.width+'.png'});
    await choose(page,'.choices button','0');
    let title=await page.$eval('#workspace h1',e=>e.textContent);assert(title.includes('іншому'));
    await choose(page,'.choices button','7');
    title=await page.$eval('#workspace h1',e=>e.textContent);assert(title.includes('можливий'));
    const proposal=await page.$eval('.diff.new code',e=>e.textContent);
    const applyViewport=await page.evaluate(()=>({rect:document.querySelector('#workspace button.btn.primary').getBoundingClientRect().toJSON(),footer:document.querySelector('.fixed').getBoundingClientRect().top}));
    assert(applyViewport.rect.bottom<=applyViewport.footer,'apply hidden by bottom dock: '+JSON.stringify(applyViewport));
    const alternatives=await page.$eval('.warning',e=>e.textContent);
    assert.equal(proposal,'return Math.max(0, loss);');
    await page.screenshot({path:'/tmp/pulse-guided-proposal-'+vp.width+'.png'});
    await choose(page,'#workspace button','✓ Застосувати локально');
    let applied=await page.$eval('#code-value',e=>e.textContent);assert.equal(applied,'Math.max(0, loss)');
    await page.reload({waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>document.querySelector('#code-value')?.textContent==='Math.max(0, loss)',{timeout:12000});
    await choose(page,'#workspace button','Спробувати ще: обмежити зверху');
    await choose(page,'.choices button','100');
    await choose(page,'.choices button','7');
    const nested=await page.$eval('.diff.new code',e=>e.textContent);assert.equal(nested,'return Math.min(100, Math.max(0, loss));');
    await choose(page,'#workspace button','✓ Застосувати локально');
    await choose(page,'#workspace button','Змінити 100 без курсора');
    await choose(page,'.choices button','50');
    const constant=await page.$eval('#code-value',e=>e.textContent);assert.equal(constant,'Math.min(50, Math.max(0, loss))');
    await choose(page,'#workspace button','↶ Скасувати останню зміну');
    const undone=await page.$eval('#code-value',e=>e.textContent);assert.equal(undone,'Math.min(100, Math.max(0, loss))');
    page.on('dialog',dialog=>dialog.accept());
    await choose(page,'#restart','↺ Спочатку');
    await choose(page,'.choices button','8');
    await choose(page,'.choices button','7');
    const another=await page.$eval('.diff.new code',e=>e.textContent);
    assert.equal(another,'return Math.abs(loss);');
    await choose(page,'#workspace button','✓ Застосувати локально');
    assert.equal(await page.$eval('#code-value',e=>e.textContent),'Math.abs(loss)');
    console.log(JSON.stringify({vp,initial,proposal,alternatives,nested,constant,undone,another,errors}));
    assert.equal(errors.length,0);
    await page.close();await context.close();
  }
  await browser.close();await new Promise(ok=>server.close(ok));
})().catch(e=>{console.error('GUIDED_QA_FAIL',e.stack);server.close();process.exit(1)});
