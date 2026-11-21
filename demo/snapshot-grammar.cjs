'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const puppeteer=require('/root/projects/tools/touchviz/node_modules/puppeteer');
const root=path.resolve(__dirname,'../web');
const server=http.createServer((req,res)=>{
  const file=path.resolve(root,decodeURIComponent((req.url||'/').split('?')[0]).replace(/^\//,''));
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  fs.readFile(file,(e,b)=>{if(e){res.writeHead(404).end();return;}
    res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript':file.endsWith('.html')?'text/html':'application/octet-stream'});res.end(b);});
});
(async()=>{
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const browser=await puppeteer.launch({headless:true,executablePath:'/data/root-cache/ms-playwright/chromium-1243/chrome-linux64/chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage();
 await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:2});
 const delay=ms=>new Promise(ok=>setTimeout(ok,ms));
 await page.goto('http://127.0.0.1:'+server.address().port+'/pulse-code-demo.html',{waitUntil:'domcontentloaded',timeout:12000});
 await page.waitForFunction(() => !!document.querySelector('#gesture-pad') && document.querySelector('#ts-code').textContent.length>0,{timeout:12000});
 await page.evaluate(()=>localStorage.removeItem('pulse-code-grammar3'));await page.reload({waitUntil:'domcontentloaded',timeout:12000});
 await page.waitForFunction(() => document.querySelector('#ts-code').textContent.length>0,{timeout:12000});
 await page.screenshot({path:path.join(root,'pulse-v3-home.png')});
 await page.click('#resume');
 const pad=await page.$eval('#gesture-pad',e=>{const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};});
 const cdp=await page.createCDPSession();
 // Set the first ring's root to 'Структура', then hold the button to display ring level 2.
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:pad.x,y:pad.y,id:0}]});
 await delay(375);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:pad.x-70,y:pad.y-70,id:0}]});
 await delay(30);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await delay(2550);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:pad.x,y:pad.y,id:0}]});
 await delay(390);
 await page.screenshot({path:path.join(root,'pulse-v3-wheel.png')});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
 await delay(80);
 await page.click('#gesture-pad');
 await page.click('#sheet-options .option:nth-child(2)');
 await page.screenshot({path:path.join(root,'pulse-v3-grid.png')});
 for(const name of ['pulse-v3-home.png','pulse-v3-wheel.png','pulse-v3-grid.png']){
   const f=path.join(root,name);console.log(name,fs.statSync(f).size);
 }
 await browser.close();await new Promise(ok=>server.close(ok));
})().catch(e=>{console.error(e.stack);server.close();process.exitCode=1;});
