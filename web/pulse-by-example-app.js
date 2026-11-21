/* Interactive, local-only usability lab. Numeric transforms are evaluated
 * against concrete examples; this does not run TypeScript or save to VPS. */
(() => {
  'use strict';
  const C = window.PulseBehaviorCore;
  if (!C) { document.body.textContent = 'Помилка завантаження ядра тесту'; return; }
  const $=id=>document.getElementById(id);
  const STORE='pulse.behaviorlab.v1';
  const idSet=new Set(C.scenarios.map(s=>s.id));
  const mkRecord=id=>({
    root:C.scenarioSeed(id), selectedPath:[], rules:[], input:id==='b'?250:-8,
    output:null, history:[], showMore:false, editExamples:false, codeOpen:false,
    metrics:{taps:0,start:Date.now(),applications:0,undo:0}
  });
  let store={active:'a', records:Object.fromEntries(C.scenarios.map(s=>[s.id,mkRecord(s.id)]))};
  try {
    const saved=JSON.parse(localStorage.getItem(STORE)||'null');
    if(saved&&idSet.has(saved.active)&&saved.records) {
      for(const scenario of C.scenarios) {
        const rec=saved.records[scenario.id];
        if(!rec || !Array.isArray(rec.rules)|| !Array.isArray(rec.history)|| !rec.root)continue;
        try {
          C.renderNode(rec.root);
          store.records[scenario.id]={
            ...mkRecord(scenario.id), ...rec,
            selectedPath:Array.isArray(rec.selectedPath)?rec.selectedPath:[],
            metrics:{...mkRecord(scenario.id).metrics,...rec.metrics},
            history:rec.history.slice(-35)
          };
          C.nodeAt(store.records[scenario.id].root,store.records[scenario.id].selectedPath);
        }catch(_){ store.records[scenario.id]=mkRecord(scenario.id); }
      }
      store.active=saved.active;
    }
  }catch(_){}
  const cur=()=>store.records[store.active];
  const spec=()=>C.scenarios.find(s=>s.id===store.active);
  function persist() {
    try{localStorage.setItem(STORE,JSON.stringify(store));}
    catch(e){$('save-status').textContent='⚠ Локальне сховище недоступне';console.warn('[pulse-lab]',e.name);}
  }
  function log(event,info={}) {
    console.info('[pulse-behavior-lab]',JSON.stringify({event,scenario:store.active,...info}));
  }
  function el(tag,cls,text) {
    const node=document.createElement(tag);
    if(cls)node.className=cls;
    if(text!==undefined)node.textContent=String(text);
    return node;
  }
  function button(label, onClick, cls='', pressed=null) {
    const b=el('button',cls,label);
    b.type='button';
    if(pressed!==null)b.setAttribute('aria-pressed',String(pressed));
    b.addEventListener('click',onClick);
    return b;
  }
  function sectionTitle(txt) {return el('h2','',txt);}
  function saveHistory(rec) {
    rec.history.push(JSON.stringify({root:rec.root,rules:rec.rules,selectedPath:rec.selectedPath}));
    if(rec.history.length>35)rec.history.shift();
  }
  function safeEval(ast,x) {
    try {
      const result=C.evaluateNode(ast,x);
      return Number.isFinite(result)?result:null;
    }catch(_){return null;}
  }
  function format(x) {
    if(x===null||x===undefined)return 'н/д';
    return Number.isInteger(x)?String(x):String(Math.round(x*1000)/1000);
  }
  function suggestions(input) {
    const node=C.nodeAt(cur().root,cur().selectedPath);
    const value=safeEval(node,input);
    const possible=[value,0,1,8,10,25,50,100,Math.abs(value??0),Math.round(value??0),Math.floor(value??0),Math.ceil(value??0),-1,200];
    const result=[];
    for(const num of possible) {
      if(!Number.isFinite(num) || result.some(n=>C.approx(n,num)))continue;
      result.push(num);
    }
    return result.slice(0,12);
  }
  function probeCandidates() {
    const rec=cur();if(!rec.rules.length)return [];
    try{return C.matchRules(rec.rules,C.nodeAt(rec.root,rec.selectedPath));}
    catch(_){return [];}
  }
  function renderTasks() {
    const tasks=$('tasks');tasks.replaceChildren();
    for(const s of C.scenarios) {
      const finished=isSuccess(s.id);
      const b=button('',()=>{
        store.active=s.id;
        persist();
        log('scenario_switch',{to:s.id});
        render();window.scrollTo({top:0,behavior:'instant'});
      },'task',s.id===store.active);
      const name=el('b','',s.id.toUpperCase());
      const desc=el('span',finished?'done':'',s.title);
      b.append(name,desc);
      tasks.appendChild(b);
    }
  }
  function nodesFor(root){
    const out=[];let node=root;let path=[];
    while(true){
      out.push({path:[...path],node});
      if(node.kind!=='operation')break;
      path.push('child');node=node.child;
    }
    return out;
  }
  function nodeLabel(node) {
    if(node.kind==='symbol')return '◆ '+node.name;
    const op=C.byId[node.opId];
    return '◈ '+(op.label.length>30?op.label.slice(0,29)+'…':op.label);
  }
  function renderEditor(){
    const rec=cur(),s=spec();
    $('task-title').textContent=s.title;
    $('task-goal').textContent=s.goal;
    $('expression').textContent=C.renderNode(rec.root);
    const full=$('full-code');
    full.textContent=C.renderProgram(rec.root);
    full.hidden=!rec.codeOpen;
    $('code-toggle').textContent=rec.codeOpen?'▴ Згорнути весь TypeScript':'▤ Показати весь TypeScript';
    $('code-toggle').setAttribute('aria-expanded',String(rec.codeOpen));
    const bar=$('nodebar');bar.replaceChildren();
    for(const part of nodesFor(rec.root)){
      const active=JSON.stringify(part.path)===JSON.stringify(rec.selectedPath);
      const b=button(nodeLabel(part.node),()=>{
        rec.selectedPath=part.path;
        rec.rules=[];rec.output=null;rec.showMore=false;
        persist();render();
      },'',active);
      b.title='Вибрати AST-вузол: '+C.renderNode(part.node);
      bar.appendChild(b);
    }
  }
  function renderRules(host){
    const rec=cur();
    const label=el('div','probe-label','Поведінка, яку ти вже показав');
    host.appendChild(label);
    const row=el('div','rulelist');
    if(!rec.rules.length)row.appendChild(el('span','small muted','Поки жодного прикладу'));
    rec.rules.forEach((r,i)=>{
      const wrap=el('div','rule');
      wrap.appendChild(el('span','',format(r.input)+' → '+format(r.output)));
      const remove=button('✕',()=>{
        saveHistory(rec);
        rec.rules.splice(i,1);rec.showMore=false;
        persist();render();log('rule_removed',{index:i});
      });
      remove.setAttribute('aria-label','Прибрати приклад '+format(r.input));
      wrap.appendChild(remove);row.appendChild(wrap);
    });
    host.appendChild(row);
  }
  function renderProbe(host){
    const rec=cur(),target=C.nodeAt(rec.root,rec.selectedPath);
    host.appendChild(sectionTitle('1 · Покажи приклад'));
    host.appendChild(el('p','small muted','Вибери значення до перетворення, потім потрібний результат. Жодної назви API.'));
    host.appendChild(el('div','probe-label','Коли loss ='));
    const inputRow=el('div','probe-row');
    const inputs=[-250,-8,-3,-0.5,0,0.5,3.7,7,25,37.5,50,75,100,150,250,500];
    const proposed=rec.rules.length?C.diagNextTest(probeCandidates(),target,rec.rules):null;
    for(const input of inputs){
      const b=button(format(input),()=>{
        rec.input=input;rec.output=null;persist();render();
        log('probe_input',{x:input});
      },'',rec.input===input);
      if(proposed!==null&&input===proposed)b.title='Цей вхід добре розрізняє поточні кандидати';
      inputRow.appendChild(b);
    }
    host.appendChild(inputRow);
    host.appendChild(el('div','probe-label','Хочу отримати · обери результат'));
    const outputs=el('div','probe-row');
    for(const value of suggestions(rec.input)){
      const b=button(format(value),()=>{
        rec.output=value;persist();render();
        log('probe_output',{x:rec.input,y:value});
      },'',rec.output!==null&&C.approx(rec.output,value));
      outputs.appendChild(b);
    }
    host.appendChild(outputs);
    const current=safeEval(target,rec.input);
    host.appendChild(el('p','small muted','Зараз вибраний вузол дає '+format(current)+'. Бажане значення можна обрати без клавіатури.'));
    const append=button('＋ Додати приклад',()=>{
      if(rec.output===null)return;
      saveHistory(rec);
      rec.rules=rec.rules.filter(r=>r.input!==rec.input).concat([{input:rec.input,output:rec.output}]).slice(-8);
      rec.output=null;rec.showMore=false;rec.editExamples=rec.rules.length<2;
      persist();render();
      if(rec.rules.length>=2)requestAnimationFrame(()=>$('control-panel').scrollIntoView({block:'start',behavior:'instant'}));
      log('rule_added',{total:rec.rules.length});
    },'cta primary');
    append.disabled=rec.output===null;
    host.appendChild(append);
    renderRules(host);
  }
  function renderCandidates(host){
    const rec=cur();
    host.appendChild(sectionTitle('2 · Що підходить за прикладами'));
    if(!rec.rules.length){
      host.appendChild(el('div','helpbar','Спочатку додай хоча б один приклад. Каталог не показує всі 415 варіантів одразу.'));
      return;
    }
    const matches=probeCandidates();
    host.appendChild(el('div','result-count','З '+C.items.length+' перетворень підійшло: '+matches.length+'. Це перевірка поведінки на твоїх прикладах, не доказ повної еквівалентності.'));
    if(matches.length>1)host.appendChild(el('div','helpbar','Результат неоднозначний. Додай інший приклад, щоб відсіяти зайве, або переглянь кандидата перед застосуванням.'));
    if(!matches.length){
      host.appendChild(el('p','small muted','Немає збігів. Можна прибрати останній приклад або вибрати інше бажане значення.'));
      return;
    }
    const selected=C.nodeAt(rec.root,rec.selectedPath);
    const list=matches.slice(0,rec.showMore?12:4);
    for(const op of list){
      const item=el('div','candidate');
      const desc=el('div');
      desc.appendChild(el('div','name',op.label));
      desc.appendChild(el('code','',op.build(C.renderNode(selected))));
      const sample=rec.rules.map(r=>{
        const val=safeEval(selected,r.input);
        let v;try{v=op.fn(val);}catch(_){v=null;}
        return format(r.input)+'→'+format(v);
      }).join(' · ');
      desc.appendChild(el('small','',sample));
      const apply=button('Застосувати',()=>{
        saveHistory(rec);
        rec.root=C.replaceAt(rec.root,rec.selectedPath,C.wrap(selected,op.id));
        rec.selectedPath=[];rec.rules=[];rec.output=null;rec.showMore=false;rec.editExamples=false;
        rec.metrics.applications++;
        persist();render();log('operation_applied',{op:op.id});
        $('expression').scrollIntoView({block:'nearest'});
      });
      apply.setAttribute('aria-label','Застосувати '+op.label);
      item.append(desc,apply);host.appendChild(item);
    }
    if(matches.length>4&&!rec.showMore){
      host.appendChild(button('Ще 8 кандидатів',()=>{
        rec.showMore=true;persist();render();
        log('candidate_expand',{matches:matches.length});
      },'cta subtle'));
    }
    const probe=C.diagNextTest(matches,selected,rec.rules);
    if(matches.length>1 && probe!==null){
      host.appendChild(button('◈ Спробувати інший приклад: loss = '+format(probe),()=>{
        rec.input=probe;rec.output=null;persist();render();
        $('control-panel').scrollIntoView({block:'start',behavior:'instant'});
      },'cta subtle'));
    }
  }
  function renderParameterPanel(host){
    const rec=cur();
    const target=C.nodeAt(rec.root,rec.selectedPath);
    host.appendChild(sectionTitle('Змінити лише аргумент'));
    if(target.kind!=='operation'||C.byId[target.opId].constant===null){
      host.appendChild(el('p','muted small','Обери зовнішню обгортку Math.min(100, …), а не вкладений Math.max або loss.'));
      host.appendChild(button('Вибрати зовнішню операцію',()=>{
        rec.selectedPath=[];persist();render();
      },'cta'));
      return;
    }
    const op=C.byId[target.opId];
    host.appendChild(el('p','small muted','Обрано: '+op.label+'. Заміниться тільки числовий аргумент; вкладений вираз залишиться недоторканим.'));
    const row=el('div','probe-row');
    for(const num of [0,1,5,10,20,25,50,75,100,150,200,500]){
      const valid=C.byId[target.opId.split(':')[0]+':'+num];
      if(!valid)continue;
      row.appendChild(button(String(num),()=>{
        if(num===op.constant)return;
        saveHistory(rec);
        rec.root=C.changeConstant(rec.root,rec.selectedPath,num);
        rec.rules=[];rec.output=null;
        persist();render();log('parameter_changed',{from:op.constant,to:num});
      },'',num===op.constant));
    }
    host.appendChild(row);
    host.appendChild(el('div','helpbar','Це зміна конкретного AST-аргументу. Клавіатуру й курсор у коді не використовуємо.'));
  }
  function isSuccess(id){
    const rec=store.records[id];
    if(!rec)return false;
    const points=[-250,-8,-3,0,7,50,99,100,150,250];
    let expected;
    if(id==='a')expected=x=>Math.max(0,x);
    else if(id==='b')expected=x=>Math.min(100,Math.max(0,x));
    else if(id==='c')expected=x=>Math.min(50,Math.max(0,x));
    else expected=x=>Math.abs(x);
    return points.every(x=>C.approx(safeEval(rec.root,x),expected(x)));
  }
  function renderSuccess(host) {
    const rec=cur(),passed=isSuccess(store.active);
    const box=el('div',passed?'success':'helpbar');
    if(passed){
      box.appendChild(el('b','', '✓ Контрольні приклади пройдено'));
      box.appendChild(el('p','small','Порівняння на 10 числових входах збіглося. Це не повний доказ правильності для всіх значень.'));
      if(store.active!=='d'){
        const s=C.scenarios[C.scenarios.findIndex(s=>s.id===store.active)+1];
        box.appendChild(button('Далі · '+s.title,()=>{
          store.active=s.id;persist();render();window.scrollTo({top:0,behavior:'instant'});
        },'cta primary'));
      }
    }else{
      box.textContent='Ціль поки не досягнута. Зміни локальні; можна пробувати інші приклади або Undo.';
    }
    host.appendChild(box);
  }
  function renderControl(){
    const panel=$('control-panel');panel.replaceChildren();
    const rec=cur();
    if(store.active==='c')renderParameterPanel(panel);
    else if(rec.rules.length>=2 && !rec.editExamples){
      renderCandidates(panel);
      renderRules(panel);
      panel.appendChild(button('＋ Ще один приклад',()=>{
        rec.editExamples=true;persist();render();
      },'cta subtle'));
    }else{
      renderProbe(panel);
      renderCandidates(panel);
    }
    renderSuccess(panel);
  }
  function renderMetrics() {
    const rec=cur();
    $('tap-count').textContent=rec.metrics.taps;
    $('rule-count').textContent=rec.rules.length;
    $('ops-count').textContent=C.items.length;
    $('undo').disabled=rec.history.length===0;
    $('save-status').textContent='● Локальна чернетка · VPS без змін';
  }
  function render(){
    renderTasks();renderEditor();renderControl();renderMetrics();
  }
  $('code-toggle').addEventListener('click',()=>{
    cur().codeOpen=!cur().codeOpen;
    persist();renderEditor();
  });
  $('undo').addEventListener('click',()=>{
    const rec=cur();
    if(!rec.history.length)return;
    const prev=JSON.parse(rec.history.pop());
    rec.root=prev.root;rec.rules=prev.rules;rec.selectedPath=prev.selectedPath;
    rec.output=null;rec.showMore=false;rec.metrics.undo++;
    persist();render();log('undo');
  });
  $('reset').addEventListener('click',()=>{
    if(!window.confirm('Скинути лише цей локальний сценарій?'))return;
    store.records[store.active]=mkRecord(store.active);
    persist();render();log('reset');
  });
  $('pause').addEventListener('click',()=>{
    persist();const btn=$('pause');btn.textContent='✓ Локально';
    setTimeout(()=>btn.textContent='◷ Відкласти',1600);
    log('pause');
  });
  document.addEventListener('click',event=>{
    if(!event.target.closest('button'))return;
    cur().metrics.taps++;
    persist();renderMetrics();
  });
  window.addEventListener('pagehide',persist);
  render();
  log('ready',{catalog:C.items.length});
})();
