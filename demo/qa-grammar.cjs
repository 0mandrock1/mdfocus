'use strict';
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const assert=require('node:assert/strict');
const puppeteer=require('/root/projects/tools/touchviz/node_modules/puppeteer');
const root=path.resolve(__dirname,'../web');
const server=http.createServer((req,res)=>{
  const file=path.resolve(root,decodeURIComponent((req.url||'/').split('?')[0]).replace(/^\//,''));
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  fs.readFile(file,(e,body)=>{
    if(e){res.writeHead(404).end();return;}
    res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript':file.endsWith('.html')?'text/html':'application/octet-stream'});
    res.end(body);
  });
});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const port=server.address().port;
  const browser=await puppeteer.launch({headless:true,executablePath:'/data/root-cache/ms-playwright/chromium-1243/chrome-linux64/chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
  for(const vp of [{width:320,height:568},{width:390,height:844}]){
    const page=await browser.newPage();
    await page.setViewport({...vp,isMobile:true,hasTouch:true,deviceScaleFactor:1});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:'+port+'/pulse-code-demo.html',{waitUntil:'networkidle2'});
    await page.evaluate(()=>localStorage.removeItem('pulse-code-grammar3'));await page.reload({waitUntil:'networkidle2'});
    const initial=await page.evaluate(()=>({screen:document.querySelector('.screen.active').id,wide:document.documentElement.scrollWidth>innerWidth,buttons:[...document.querySelectorAll('#screen-home button')].map(b=>({id:b.id,y:b.getBoundingClientRect().bottom}))}));
    assert.equal(initial.screen,'screen-home');assert.equal(initial.wide,false);
    await page.screenshot({path:'/tmp/pulse-grammar-home-'+vp.width+'.png'});
    await page.click('#resume');
    await page.click('#gesture-pad');
    let rootList=await page.$eval('#sheet-options',e=>[...e.querySelectorAll('button')].map(x=>x.textContent));
    assert(rootList.some(x=>x.includes('Структура')));
    await page.click('#sheet-options .option:first-child');
    let subList=await page.$eval('#sheet-options',e=>[...e.querySelectorAll('button')].map(x=>x.textContent));
    assert(subList.some(x=>x.includes('Умови')));
    await page.click('#sheet-options .option:nth-child(2)');
    let grid=await page.evaluate(()=>({opened:document.getElementById('grid-overlay').classList.contains('open'),count:document.querySelectorAll('.tile').length,scroll:document.documentElement.scrollWidth,cols:getComputedStyle(document.getElementById('grid-tiles')).gridTemplateColumns}));
    assert(grid.opened);assert(grid.count>=10);assert.equal(grid.scroll,vp.width);
    await page.screenshot({path:'/tmp/pulse-grammar-grid-'+vp.width+'.png'});
    await page.click('#grid-search');await page.keyboard.type('null');
    const filtered=await page.$eval('#grid-tiles',e=>e.querySelectorAll('.tile').length);
    assert(filtered>=1&&filtered<grid.count);
    await page.click('#grid-tiles .tile:first-child');
    assert.equal(await page.$eval('#grid-apply',b=>b.disabled),false);
    await page.screenshot({path:'/tmp/pulse-grammar-grid-selected-'+vp.width+'.png'});
    await page.click('#grid-apply');
    const updated=await page.$eval('#ts-code',e=>e.textContent);
    assert(updated.includes('if (s.best == null) return 0;'));
    assert(updated.indexOf('if (s.best == null) return 0;')<updated.indexOf('return loss;'));
    await page.screenshot({path:'/tmp/pulse-grammar-editor-'+vp.width+'.png'});
    await page.click('#review-edit');
    const review=await page.$eval('#diff',e=>e.textContent);
    assert(review.includes('+   if (s.best == null) return 0;'));
    await page.reload({waitUntil:'networkidle2'});
    const persists=await page.evaluate(()=>({screen:document.querySelector('.screen.active').id,code:document.getElementById('ts-code').textContent}));
    assert(persists.code.includes('if (s.best == null) return 0;'));
    await page.click('#review-back');
    await page.click('#undo-edit');
    assert(!(await page.$eval('#ts-code',e=>e.textContent)).includes('if (s.best == null) return 0;'));

    // Touch gesture: root top-left, second ring top-right, then grid.
    const cdp=await page.createCDPSession();
    const point=await page.$eval('#gesture-pad',e=>{const r=e.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2,bottom:r.bottom};});
    assert(point.bottom<=vp.height,'thumb target offscreen: '+JSON.stringify(point));
    async function gesture(dx,dy,{cancel=false,auto=false}={}){
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:point.x,y:point.y,id:0}]});
      await wait(375);
      await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:point.x+dx,y:point.y+dy,id:0}]});
      if(auto)await wait(330);else await wait(40);
      await cdp.send('Input.dispatchTouchEvent',{type:cancel?'touchCancel':'touchEnd',touchPoints:[]});
      await wait(70);
    }
    await gesture(-70,-70);
    assert((await page.$eval('#wheel-prompt',e=>e.textContent)).includes('Структура'));
    await gesture(70,-70);
    assert(await page.$eval('#grid-overlay',e=>e.classList.contains('open')));
    await page.click('#grid-close');
    await page.click('#nav-back');
    await gesture(70,-70,{cancel:true});
    assert(!(await page.$eval('#grid-overlay',e=>e.classList.contains('open'))));
    assert((await page.$eval('#wheel-prompt',e=>e.textContent)).includes('1 / 2'));

    // On release after dwell, accidental selection of same-angle subcategory is forbidden.
    await gesture(-70,-70,{auto:true});
    assert((await page.$eval('#wheel-prompt',e=>e.textContent)).includes('Структура'));
    assert(!(await page.$eval('#grid-overlay',e=>e.classList.contains('open'))));
    // Reopening an ordinary tap offers the accessible second-level list.
    await page.click('#gesture-pad');
    const accessible=await page.$eval('#sheet-options',e=>e.querySelectorAll('button').length);
    assert(accessible>=5);
    // One continuous touch: dwell on top-right root, move to a different sector and release into a grid.
    await page.click('#sheet-close');
    await page.click('#nav-back');
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:point.x,y:point.y,id:0}]});
    await wait(375);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:point.x+70,y:point.y-70,id:0}]});
    await wait(330);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:point.x-70,y:point.y-70,id:0}]});
    await wait(50);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await wait(90);
    const singleGesture=await page.evaluate(()=>({grid:document.getElementById('grid-overlay').classList.contains('open'),title:document.getElementById('grid-title').textContent}));
    assert(singleGesture.grid&&singleGesture.title==='Символи',JSON.stringify(singleGesture));
    await page.click('#grid-close');
    await page.click('#gesture-pad');
    await page.click('#sheet-options .option:last-child');
    const leftHand=await page.$eval('#thumbbar',e=>e.classList.contains('left'));
    assert(leftHand);
    console.log(JSON.stringify({vp,initial,rootList:rootList.length,subList:subList.length,grid,filtered,persisted:true,gesture:'two levels + cancellation + dwell guard',singleGesture,leftHand,accessible,errors}));
    assert.equal(errors.length,0,JSON.stringify(errors));
    await page.close();
  }
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
})().catch(e=>{console.error(e.stack);server.close();process.exitCode=1;});
