const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const dir=path.resolve(__dirname,'../web');
const md=fs.readFileSync(path.join(dir,'uxpilot-pulse-four.md'),'utf8');
test('four distinct provider renders are present and linked',()=>{
 for(const l of 'abcd'){
  const name='uxpilot-pulse-'+l+'.png';
  assert(md.includes('./'+name),name+' absent in gallery');
  const bytes=fs.readFileSync(path.join(dir,name));
  assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  assert(bytes.length>60000);
  assert.equal(bytes.readUInt32BE(16),780); // 390px at DPR 2
  assert.equal(bytes.readUInt32BE(20),1688); // 844px at DPR 2
 }
});
test('download archive exists and gallery explains origin/limitations',()=>{
 assert(fs.statSync(path.join(dir,'uxpilot-pulse-four.zip')).size>200000);
 assert(md.includes('обрізаний'));
 assert(md.includes('не робочі інтерактивні прототипи'));
});
