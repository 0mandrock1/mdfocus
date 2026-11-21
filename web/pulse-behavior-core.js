/* PULSE CODE By Example Lab: deliberately restricted numeric TypeScript AST.
 * Pure, deterministic, zero network calls, no eval/Function. Browser + Node.
 * This is NOT a complete TypeScript compiler or language service. */
(function (host, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else host.PulseBehaviorCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const constants = [-500,-200,-100,-50,-25,-20,-10,-5,-3,-2,-1,0,1,2,3,5,10,20,25,50,100,200,500];
  const items = [];
  const registered = new Set();
  function add(id, family, label, build, fn, cost=5, constant=null) {
    if (registered.has(id)) throw Error('duplicate operation '+id);
    registered.add(id);
    items.push(Object.freeze({id, family, label, build, fn, cost, constant}));
  }
  function n(c) { return String(c); }
  add('identity', 'Число', 'Без змін', x=>x, x=>x, 1);
  const unary = [
    ['abs','Модуль', 'Math.abs', Math.abs, 2],
    ['round','Найближче ціле','Math.round', Math.round, 2],
    ['floor','Округлити вниз','Math.floor', Math.floor, 2],
    ['ceil','Округлити вгору','Math.ceil', Math.ceil, 2],
    ['trunc','Відкинути дробову частину','Math.trunc', Math.trunc, 3],
    ['sign','Лише знак','Math.sign', Math.sign, 3],
    ['sqrt','Квадратний корінь','Math.sqrt', Math.sqrt, 4],
    ['cbrt','Кубічний корінь','Math.cbrt', Math.cbrt, 4],
    ['exp','Експонента','Math.exp', Math.exp, 4],
    ['log','Натуральний логарифм','Math.log', Math.log, 4],
    ['log10','Логарифм за основою 10','Math.log10', Math.log10, 4],
    ['log2','Логарифм за основою 2','Math.log2', Math.log2, 4],
    ['log1p','log(1 + x)','Math.log1p', Math.log1p, 4],
    ['expm1','exp(x) − 1','Math.expm1', Math.expm1, 4],
    ['sin','Синус','Math.sin', Math.sin, 4],
    ['cos','Косинус','Math.cos', Math.cos, 4],
    ['tan','Тангенс','Math.tan', Math.tan, 4],
    ['asin','Арксинус','Math.asin', Math.asin, 4],
    ['acos','Арккосинус','Math.acos', Math.acos, 4],
    ['atan','Арктангенс','Math.atan', Math.atan, 4],
    ['sinh','Гіперболічний синус','Math.sinh', Math.sinh, 4],
    ['cosh','Гіперболічний косинус','Math.cosh', Math.cosh, 4],
    ['tanh','Гіперболічний тангенс','Math.tanh', Math.tanh, 4],
    ['asinh','Гіперболічний арксинус','Math.asinh', Math.asinh, 4],
    ['acosh','Гіперболічний арккосинус','Math.acosh', Math.acosh, 4],
    ['atanh','Гіперболічний арктангенс','Math.atanh', Math.atanh, 4],
    ['fround','Float32 precision','Math.fround', Math.fround, 4],
  ];
  for (const [id,label,method,fn,cost] of unary) {
    add(id,'Математика',label,x=>method+'('+x+')',fn,cost);
  }
  function perC(id, family, describe, builder, evaluator, cost=5, check=()=>true) {
    for(const c of constants) {
      if(!check(c)) continue;
      add(id+':'+c, family, describe(c), x=>builder(x,c), x=>evaluator(x,c), cost, c);
    }
  }
  perC('max','Межі',c=>'Не нижче '+c,(x,c)=>`Math.max(${n(c)}, ${x})`,(x,c)=>Math.max(c,x),2);
  perC('min','Межі',c=>'Не вище '+c,(x,c)=>`Math.min(${n(c)}, ${x})`,(x,c)=>Math.min(c,x),2);
  perC('add','Арифметика',c=>'Додати '+c,(x,c)=>`(${x} + ${n(c)})`,(x,c)=>x+c,3);
  perC('sub','Арифметика',c=>'Відняти '+c,(x,c)=>`(${x} - ${n(c)})`,(x,c)=>x-c,3);
  perC('mul','Арифметика',c=>'Помножити на '+c,(x,c)=>`(${x} * ${n(c)})`,(x,c)=>x*c,3);
  perC('div','Арифметика',c=>'Поділити на '+c,(x,c)=>`(${x} / ${n(c)})`,(x,c)=>x/c,4,c=>c!==0);
  perC('rem','Арифметика',c=>'Остача від '+c,(x,c)=>`(${x} % ${n(c)})`,(x,c)=>x%c,4,c=>c!==0);
  perC('absDist','Модуль',c=>'Відстань до '+c,(x,c)=>`Math.abs(${x} - ${n(c)})`,(x,c)=>Math.abs(x-c),4);
  perC('reflect','Перетворення',c=>'Віддзеркалити навколо '+c,(x,c)=>`(2 * ${n(c)} - ${x})`,(x,c)=>2*c-x,5);
  perC('squareDist','Перетворення',c=>'Квадрат відстані до '+c,(x,c)=>`(${x} - ${n(c)}) ** 2`,(x,c)=>(x-c)**2,6);
  perC('zeroBelow','Умови',c=>'Нуль, коли менше '+c,(x,c)=>`(${x} < ${n(c)} ? 0 : ${x})`,(x,c)=>x<c?0:x,5);
  perC('zeroAbove','Умови',c=>'Нуль, коли більше '+c,(x,c)=>`(${x} > ${n(c)} ? 0 : ${x})`,(x,c)=>x>c?0:x,5);
  perC('roundStep','Округлення',c=>'Округлити до кроку '+c,(x,c)=>`(Math.round(${x} / ${n(c)}) * ${n(c)})`,(x,c)=>Math.round(x/c)*c,5,c=>c>0);
  perC('floorStep','Округлення',c=>'Вниз до кроку '+c,(x,c)=>`(Math.floor(${x} / ${n(c)}) * ${n(c)})`,(x,c)=>Math.floor(x/c)*c,5,c=>c>0);
  perC('ceilStep','Округлення',c=>'Вгору до кроку '+c,(x,c)=>`(Math.ceil(${x} / ${n(c)}) * ${n(c)})`,(x,c)=>Math.ceil(x/c)*c,5,c=>c>0);
  perC('zeroClamp','Межі',c=>'У діапазоні 0…'+c,(x,c)=>`Math.min(${n(c)}, Math.max(0, ${x}))`,(x,c)=>Math.min(c,Math.max(0,x)),5,c=>c>0);
  perC('offsetSign','Знак',c=>'Знак після зсуву на '+c,(x,c)=>`Math.sign(${x} - ${n(c)})`,(x,c)=>Math.sign(x-c),6);
  perC('fraction','Перетворення',c=>'Дробова частина після зсуву '+c,(x,c)=>`(${x} - ${n(c)} - Math.trunc(${x} - ${n(c)}))`,(x,c)=>x-c-Math.trunc(x-c),7);
  perC('scaleAbs','Перетворення',c=>'Модуль, помножений на '+c,(x,c)=>`(Math.abs(${x}) * ${n(c)})`,(x,c)=>Math.abs(x)*c,6);
  const byId = Object.fromEntries(items.map(x=>[x.id,x]));
  const createSource = () => ({kind:'symbol',name:'loss'});
  const wrap = (node, opId) => {
    if(!byId[opId]) throw Error('Unknown operation '+opId);
    return {kind:'operation',opId,child:node};
  };
  const nodeAt = (node, path) => {
    let current=node;
    for(const segment of path) {
      if(segment!=='child'||current.kind!=='operation') throw Error('Invalid AST path');
      current=current.child;
    }
    return current;
  };
  const replaceAt = (node,path,next) => {
    if(!path.length) return next;
    if(path[0]!=='child'||node.kind!=='operation') throw Error('Invalid replacement path');
    return {...node,child:replaceAt(node.child,path.slice(1),next)};
  };
  function renderNode(node) {
    if(node.kind==='symbol')return node.name;
    if(node.kind==='operation'&&byId[node.opId])return byId[node.opId].build(renderNode(node.child));
    throw Error('Unknown AST node');
  }
  function evaluateNode(node, loss) {
    if(node.kind==='symbol')return loss;
    if(node.kind==='operation'&&byId[node.opId])return byId[node.opId].fn(evaluateNode(node.child,loss));
    throw Error('Unknown AST node');
  }
  const approx = (a,b) => Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=Math.max(1e-7,Math.abs(b)*1e-6);
  function matchRules(rules, selected, xFilter) {
    const matches = items.filter(op => rules.every(rule=>{
      const input=evaluateNode(selected,rule.input);
      let output;try{output=op.fn(input);}catch(_){return false;}
      return approx(output,rule.output);
    }));
    return matches.sort((a,b)=>a.cost-b.cost||a.label.localeCompare(b.label,'uk'));
  }
  const changeConstant=(root,path,nextValue)=>{
    const current=nodeAt(root,path);
    if(current.kind!=='operation')throw Error('Node is not a parameterized operation');
    const old=byId[current.opId];
    if(old.constant===null)throw Error('Operation has no editable constant');
    if(!constants.includes(nextValue))throw Error('Unsupported constant');
    const key=current.opId.split(':')[0]+':'+nextValue;
    if(!byId[key])throw Error('Constant is invalid for this operation');
    return replaceAt(root,path,{...current,opId:key});
  };
  const scenarios = Object.freeze([
    {id:'a',title:'Нижня межа',goal:'Для −8 отримати 0, для 7 залишити 7. Не вводь назву операції.',seed:null, success:'Math.max(0, loss)'},
    {id:'b',title:'Верхня межа',goal:'Після нижньої межі: 250 має стати 100, а 7 лишитися 7.',seed:'max:0', success:'Math.min(100, Math.max(0, loss))'},
    {id:'c',title:'Вкладений аргумент',goal:'Заміни тільки верхній ліміт 100 → 50 без курсора між символами.',seed:'min:100', success:'Math.min(50, Math.max(0, loss))'},
    {id:'d',title:'Незнайома операція',goal:'За прикладами −8 → 8 та 7 → 7 відкрий правильне перетворення.',seed:null, success:'Math.abs(loss)'},
  ]);
  function scenarioSeed(id) {
    let root=createSource();
    if(id==='b'||id==='c')root=wrap(root,'max:0');
    if(id==='c')root=wrap(root,'min:100');
    return root;
  }
  const renderProgram=root=>[
    'type Score = { current: number; best?: number | null };',
    'export function calculateLoss(s: Score): number {',
    '  const best = s.best ?? s.current;',
    '  const loss = best - s.current;',
    '  return '+renderNode(root)+';',
    '}'
  ].join('\n');
  function diagNextTest(matches, selected,existing) {
    const probes=[-250,-100,-8,-3,-0.5,0,0.5,3.7,7,21,37,49,75,99,101,150,250,500];
    const prior=new Set(existing.map(e=>e.input));
    let best=null,score=-1;
    for(const x of probes) {
      if(prior.has(x))continue;
      const v=evaluateNode(selected,x);
      const values=new Set(matches.slice(0,120).map(op=>{
        let y; try{y=op.fn(v);}catch(_){return 'err';}
        return Number.isFinite(y)?Math.round(y*100)/100:'invalid';
      }));
      if(values.size>score){best=x;score=values.size;}
    }
    return best;
  }
  return Object.freeze({items,constants,byId,createSource,wrap,nodeAt,replaceAt,renderNode,evaluateNode,matchRules,changeConstant,scenarios,scenarioSeed,renderProgram,diagNextTest,approx});
});
