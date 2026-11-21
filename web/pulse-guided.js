/* Single-path, thumb-friendly demonstration of sample-driven discovery.
 * Uses the existing 415-operation numeric AST catalog; no network or eval. */
(() => {
  'use strict';
  const C=window.PulseBehaviorCore;
  const $=id=>document.getElementById(id);
  if(!C){$('workspace').textContent='Помилка завантаження тесту';return;}
  const KEY='pulse-guided-v2-20261121';
  const newState=()=>({version:2,round:0,step:'first',root:C.createSource(),answers:[],chosen:null,more:false,
    history:[],taps:0,lastAction:'',clarifyInput:null});
  let s=newState();
  try{
    const v=JSON.parse(localStorage.getItem(KEY)||'null');
    if(v&&v.version===2&&['first','second','suggest','clarify','applied','parameter'].includes(v.step)){
      C.renderNode(v.root);s={...newState(),...v};
    }
  }catch(_){s=newState();}
  const store=()=>{try{localStorage.setItem(KEY,JSON.stringify(s));}catch(e){console.warn('[pulse-guided]',e.name);$('save-status').textContent='⚠ Стан не збережено';}};
  const log=(type,details={})=>console.info('[pulse-guided]',{type,round:s.round,step:s.step,...details});
  const el=(tag,cls,txt)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=String(txt);return e;};
  function button(label,fn,cls='btn'){
    const b=el('button',cls,label);b.type='button';b.addEventListener('click',()=>{s.taps++;fn();store();});return b;
  }
  const cfg=()=>s.round===0?
    [{input:-8,choices:[0,-8,8,1]},{input:7,choices:[7,0,8,-7]}]:
    [{input:250,choices:[100,250,50,0]},{input:7,choices:[7,0,100,-7]}];
  const list=()=>C.matchRules(s.answers,s.root);
  const isMax=()=>C.renderNode(s.root)==='Math.max(0, loss)';
  const isMin=()=>C.renderNode(s.root)==='Math.min(100, Math.max(0, loss))';
  function render(){
    const ws=$('workspace');ws.replaceChildren();
    $('code-value').textContent=C.renderNode(s.root);
    document.querySelector('.code').hidden=['suggest','clarify','applied'].includes(s.step);
    const done=s.step==='first'?0:s.step==='second'?1:s.step==='suggest'||s.step==='clarify'||s.step==='parameter'?2:3;
    [...$('progress').children].forEach((e,i)=>e.classList.toggle('done',i<done));
    if(s.step==='first'||s.step==='second')renderQuestion(ws);
    if(s.step==='suggest')renderSuggestion(ws);
    if(s.step==='clarify')renderClarify(ws);
    if(s.step==='parameter')renderParameter(ws);
    if(s.step==='applied')renderApplied(ws);
    $('save-status').textContent='● Локально · VPS без змін';
  }
  function title(ws,eyebrow,head,sub){
    ws.append(el('div','eyebrow',eyebrow),el('h1','',head));
    if(sub)ws.appendChild(el('p','question',sub));
  }
  function chooseOutput(value){
    const index=s.step==='first'?0:1;
    s.answers[index]={input:cfg()[index].input,output:value};
    s.step=index===0?'second':'suggest';s.chosen=null;s.more=false;
    log('example_chosen',{input:cfg()[index].input,output:value});
    render();window.scrollTo({top:0,behavior:'instant'});
  }
  function renderQuestion(ws){
    const index=s.step==='first'?0:1;
    const row=cfg()[index];
    title(ws,'КРОК '+(index+1)+' З 3',index===0?'Покажи, чого хочеш':'А в іншому випадку?',
      'Уяви, що loss = '+row.input+'. Яке число функція МАЄ повернути?');
    const choices=el('div','choices');
    for(const v of row.choices)choices.appendChild(button(String(v),()=>chooseOutput(v)));
    ws.appendChild(choices);
    const tip=el('div','warning',index===0?'Натисни бажаний результат. Функцію й оператор називати не потрібно.':'Два приклади допоможуть відсікти непотрібні операції.');
    ws.appendChild(tip);
    if(index===1)ws.appendChild(button('‹ Змінити перший приклад',()=>{s.step='first';s.answers=[];render();},'btn linklike'));
  }
  function selected(){
    const options=list();
    const chosen=options.find(x=>x.id===s.chosen)||options[0]||null;
    return {options,op:chosen};
  }
  function chooseCandidate(op){s.chosen=op.id;log('candidate_selected',{op:op.id});render();}
  function renderSuggestion(ws){
    const {options,op}=selected();
    title(ws,'КРОК 3 З 3','Знайшов можливий спосіб',
      'Ти показав '+s.answers.map(x=>x.input+' → '+x.output).join(' та ')+'.');
    if(!op){
      ws.appendChild(el('div','panel','Жоден із доступних числових варіантів не задовольняє обидва приклади. Це межа нашого тестового каталогу.'));
      ws.appendChild(button('‹ Змінити другий приклад',()=>{s.step='second';s.answers=s.answers.slice(0,1);render();},'btn'));
      return;
    }
    ws.appendChild(el('div','breadcrumb','ПРОПОЗИЦІЯ · '+op.label));
    const cmp=el('div','comparison');
    const before=el('div','diff old'),after=el('div','diff new');
    before.append(el('label','','Зараз'),el('code','','return '+C.renderNode(s.root)+';'));
    after.append(el('label','','Після застосування'),el('code','','return '+op.build(C.renderNode(s.root))+';'));
    cmp.append(before,after);ws.appendChild(cmp);
    const warning=el('p','warning',options.length+' варіантів підходять до цих прикладів. Це найпростіша пропозиція за правилами демо, не математичний доказ.');
    ws.appendChild(warning);
    ws.appendChild(button('✓ Застосувати локально',()=>{
      s.history.push(JSON.stringify({root:s.root,round:s.round,step:'suggest',answers:s.answers,chosen:s.chosen}));
      s.root=C.wrap(s.root,op.id);s.step='applied';s.lastAction='operation';
      log('operation_applied',{op:op.id});render();window.scrollTo({top:0,behavior:'instant'});
    },'btn primary'));
    ws.appendChild(button('Мені потрібна інша операція',()=>{s.more=!s.more;render();},'btn linklike'));
    if(s.more){
      const box=el('div','suggestions');
      for(const alt of options.slice(0,6)){
        const b=button('',()=>chooseCandidate(alt),'suggestion');
        const left=el('div');left.append(el('strong','',alt.label),el('small','',alt.build(C.renderNode(s.root))));
        b.append(left,el('span','right',alt.id===op.id?'✓':'Обрати'));box.appendChild(b);
      }
      ws.appendChild(box);
    }
    if(options.length>1)ws.appendChild(button('◈ Уточнити ще одним прикладом',()=>{
      const probe=C.diagNextTest(options,s.root,s.answers);
      if(probe===null)return;
      s.clarifyInput=probe;s.step='clarify';render();
    },'btn linklike'));
    ws.appendChild(button('‹ Назад',()=>{s.step='second';s.answers=s.answers.slice(0,1);render();},'btn linklike'));
  }
  function renderClarify(ws){
    const input=s.clarifyInput;
    const matches=list();
    title(ws,'УТОЧНЕННЯ','Ще одна ситуація',
      'Коли loss = '+input+', який результат ти хочеш?');
    const values=[];
    for(const op of matches.slice(0,80)){
      let v;try{v=op.fn(C.evaluateNode(s.root,input));}catch(_){continue;}
      if(!Number.isFinite(v)||values.some(x=>C.approx(x,v)))continue;
      values.push(v);
      if(values.length>=4)break;
    }
    if(values.length<2){s.step='suggest';render();return;}
    const choices=el('div','choices');
    for(const val of values){choices.appendChild(button(String(Math.round(val*1000)/1000),()=>{
      s.answers.push({input,output:val});s.step='suggest';s.chosen=null;s.more=false;render();
      window.scrollTo({top:0,behavior:'instant'});
    }));}
    ws.appendChild(choices);
    ws.appendChild(button('‹ Назад до пропозиції',()=>{s.step='suggest';render();},'btn linklike'));
  }
  function renderApplied(ws){
    title(ws,'ГОТОВО · ЛИШЕ ЛОКАЛЬНО','Тепер код такий:',
      'Зміна залишилася у цьому браузері. Не було компіляції чи серверного збереження.');
    const box=el('div','diff new');box.append(el('label','','TypeScript · поточний вираз'),el('code','','return '+C.renderNode(s.root)+';'));
    ws.appendChild(box);
    ws.appendChild(el('p','result','✓ '+s.taps+' натискань у цьому тесті. Після оновлення сторінки чернетка збережеться.'));
    const stack=el('div','stack');
    if(s.round===0&&isMax()){
      stack.appendChild(button('Спробувати ще: обмежити зверху',()=>{
        s.round=1;s.step='first';s.answers=[];s.chosen=null;s.more=false;render();
        window.scrollTo({top:0,behavior:'instant'});
      },'btn primary'));
    }else if(s.round===1&&isMin()){
      stack.appendChild(button('Змінити 100 без курсора',()=>{s.step='parameter';render();},'btn primary'));
    }
    if(s.history.length)stack.appendChild(button('↶ Скасувати останню зміну',()=>{
      const previous=JSON.parse(s.history.pop());
      s.root=previous.root;s.round=previous.round;s.step=previous.step;s.answers=previous.answers;s.chosen=previous.chosen;
      render();log('undo');
    },'btn'));
    stack.appendChild(button('↺ Спробувати з іншими числами',()=>{s=newState();render();},'btn linklike'));
    ws.appendChild(stack);
  }
  function renderParameter(ws){
    title(ws,'ЩЕ ОДИН ЕКСПЕРИМЕНТ','Зміни тільки число',
      'Math.min(100, …) має аргумент 100. Обери нове значення, не відкриваючи клавіатуру.');
    const choices=el('div','choices');
    for(const value of [50,75,150,200])choices.appendChild(button(String(value),()=>{
      s.history.push(JSON.stringify({root:s.root,round:s.round,step:'parameter',answers:s.answers,chosen:s.chosen}));
      s.root=C.changeConstant(s.root,[],value);s.step='applied';s.lastAction='parameter';
      render();log('constant_changed',{to:value});
    }));
    ws.appendChild(choices);
    ws.appendChild(button('‹ Назад',()=>{s.step='applied';render();},'btn linklike'));
  }
  $('restart').addEventListener('click',()=>{
    if(s.taps>0&&!window.confirm('Почати тест заново? Локальний результат цього тесту буде скинуто.'))return;
    s=newState();store();render();log('reset');window.scrollTo({top:0,behavior:'instant'});
  });
  window.addEventListener('pagehide',store);
  render();log('ready',{catalog:C.items.length});
})();
