const test=require('node:test');
const assert=require('node:assert/strict');
const C=require('../web/pulse-behavior-core.js');

test('numeric catalog is substantial and all IDs unique',()=>{
  assert(C.items.length>=400);
  assert.equal(C.items.length,new Set(C.items.map(x=>x.id)).size);
});
test('every registered numeric operation has deterministic evaluator and TS expression',()=>{
  for(const op of C.items){
    for(const sample of [-8,7,100]){
      const expr=op.build('loss');
      assert(expr.includes('loss'),op.id);
      const a=op.fn(sample),b=op.fn(sample);
      assert(Object.is(a,b)||Number.isNaN(a)&&Number.isNaN(b),op.id);
    }
  }
});
test('two examples find lower bound without knowing operation name',()=>{
  const matches=C.matchRules([{input:-8,output:0},{input:7,output:7}],C.scenarioSeed('a'));
  assert.equal(matches[0].id,'max:0');
  assert(matches.length>1,'must expose ambiguity');
});
test('two examples find upper bound nested around existing lower bound',()=>{
  const ast=C.scenarioSeed('b');
  const matches=C.matchRules([{input:250,output:100},{input:7,output:7}],ast);
  assert.equal(matches[0].id,'min:100');
  const output=C.wrap(ast,matches[0].id);
  assert.equal(C.renderNode(output),'Math.min(100, Math.max(0, loss))');
  assert.equal(C.evaluateNode(output,250),100);
  assert.equal(C.evaluateNode(output,-8),0);
});
test('nested argument replacement changes only outer numeric parameter',()=>{
  const base=C.scenarioSeed('c');
  const changed=C.changeConstant(base,[],50);
  assert.equal(C.renderNode(changed),'Math.min(50, Math.max(0, loss))');
  assert.equal(C.renderNode(base),'Math.min(100, Math.max(0, loss))');
  assert.equal(C.evaluateNode(changed,250),50);
  assert.equal(C.evaluateNode(changed,-10),0);
});
test('semantic child path supports wrapping inside nested expression',()=>{
  const nested=C.scenarioSeed('c');
  const path=['child'];
  const chosen=C.nodeAt(nested,path);
  assert.equal(C.renderNode(chosen),'Math.max(0, loss)');
  const updated=C.replaceAt(nested,path,C.wrap(chosen,'abs'));
  assert.equal(C.renderNode(updated),'Math.min(100, Math.abs(Math.max(0, loss)))');
});
test('unknown operator by example resolves abs; never pretends uniqueness',()=>{
  const matches=C.matchRules([{input:-8,output:8},{input:7,output:7}],C.scenarioSeed('d'));
  assert.equal(matches[0].id,'abs');
  assert(matches.length>1);
});
test('source program is real TypeScript syntax',()=>{
  const code=C.renderProgram(C.scenarioSeed('c'));
  assert(code.includes('return Math.min(100, Math.max(0, loss));'));
  assert(code.includes('best?: number | null'));
});
