/* PULSE CODE / grammar-wheel UX experiment.
 * No API calls. All edits are local demo state, not tsserver changes or remote writes. */
(() => {
  'use strict';
  const KEY = 'pulse-code-grammar3';
  const $ = id => document.getElementById(id);
  const BASE = [
    'type Score = { current: number; best?: number | null };',
    '',
    'export function calculateLoss(s: Score): number {',
    '  const best = s.best ?? s.current;',
    '  const loss = best - s.current;',
    '  return loss;',
    '}'
  ].join('\n');

  const defs = [
    {
      id:'syntax', label:'Структура',
      groups:[
        ['declare','Оголошення',[
          ['const','const total = 0;'],['let','let attempt = 0;'],['object','const point = { x: 0, y: 0 };'],
          ['array','const queue: number[] = [];'],['destructuring','const { current } = s;'],
          ['enum-free','const Status = { idle: 0, ready: 1 } as const;'],
          ['boolean','const active = true;'],['readonly','const config = { retry: 3 } as const;'],
          ['alias','type Count = number;'],['tuple','const pair: [number,number] = [0,1];']
        ]],
        ['conditions','Умови',[
          ['if','if (s.best == null) return 0;'],['if/else','if (loss < 0) { return 0; } else { return loss; }'],
          ['guard','if (!Number.isFinite(loss)) return 0;'],['ternary','const safe = loss > 0 ? loss : 0;'],
          ['switch','switch (Math.sign(loss)) { case -1: return 0; default: return loss; }'],
          ['assert','if (s.current < 0) throw new RangeError("current");'],
          ['optional','const chosen = s.best?.toFixed(2) ?? "n/a";'],
          ['narrow','if (typeof s.best === "number") return s.best;'],
          ['default','const score = s.best ?? 0;'],['early','if (loss === 0) return 0;']
        ]],
        ['flow','Потік',[
          ['return','return Math.max(0, loss);'],['throw','throw new Error("Invalid score");'],
          ['for/of','for (const value of [s.current, best]) { void value; }'],
          ['while','while (false) { break; }'],['try/catch','try { void best; } catch (error) { console.error(error); }'],
          ['async','void Promise.resolve(loss);'],['continue','for (let i = 0; i < 3; i++) { if (i === 1) continue; }'],
          ['break','for (let i = 0; i < 3; i++) { if (i === 1) break; }'],
          ['generator','const ids = [1, 2, 3].values();'],['flatmap','const xs = [[1],[2]].flatMap(x => x);']
        ]],
        ['functions','Функції',[
          ['arrow','const twice = (n: number) => n * 2;'],['typed','const clamp = (n: number): number => Math.max(0, n);'],
          ['predicate','const isPositive = (n: number): n is number => n > 0;'],
          ['callback','const onChange = (value: number): void => { void value; };'],
          ['generic','const identity = <T,>(value: T): T => value;'],
          ['closure','const makeAdder = (a: number) => (b: number) => a + b;'],
          ['rest','const sum = (...values: number[]) => values.reduce((a,b)=>a+b,0);'],
          ['method','const api = { getScore: () => loss };'],['async','const load = async (): Promise<number> => loss;'],
          ['literal','const noop = () => undefined;']
        ]]
      ]
    },
    {
      id:'value', label:'Значення',
      groups:[
        ['symbols','Символи',[
          ['current','s.current'],['best','s.best'],['best-narrowed','s.best ?? 0'],['best-default','s.best ?? s.current'],
          ['loss','loss'],['minus','best - s.current'],['absolute','Math.abs(loss)'],
          ['positive','Math.max(0, loss)'],['boolean','loss > 0'],['pair','[s.current, best]'],
          ['object','{ current: s.current, best }'],['tofixed','loss.toFixed(2)']
        ]],
        ['literals','Літерали',[
          ['zero','0'],['one','1'],['minus-one','-1'],['true','true'],['false','false'],['null','null'],
          ['undefined','undefined'],['empty','""'],['text','"ready"'],['list','[]'],
          ['object','{}'],['nanc','NaN']
        ]],
        ['calls','Виклики',[
          ['max','Math.max(0, loss)'],['min','Math.min(100, loss)'],['round','Math.round(loss)'],
          ['abs','Math.abs(loss)'],['finite','Number.isFinite(loss)'],['string','String(loss)'],
          ['number','Number(s.best ?? 0)'],['json','JSON.stringify({ loss })'],
          ['promise','Promise.resolve(loss)'],['array','Array.from({ length: 3 }, (_, i) => i)'],
          ['objectkeys','Object.keys({ loss })'],['log','Math.log1p(loss)']
        ]],
        ['operators','Оператори',[
          ['nullish','s.best ?? 0'],['strict','s.best === null'],['optional','s.best?.toFixed(2)'],
          ['and','loss > 0 && loss < 100'],['or','loss < 0 || loss > 100'],
          ['ternary','loss > 0 ? loss : 0'],['addition','best + s.current'],
          ['subtraction','best - s.current'],['multiply','loss * 2'],['divide','loss / 2'],
          ['mod','loss % 2'],['satisfies','({ loss } satisfies { loss: number })']
        ]]
      ]
    },
    {
      id:'type', label:'Типи',
      groups:[
        ['primitive','Базові',[
          ['number','number'],['string','string'],['boolean','boolean'],['unknown','unknown'],
          ['never','never'],['null','null'],['undefined','undefined'],['void','void'],
          ['literal','0 | 1 | 2'],['union','number | null'],['tuple','[number, number]'],['object','{ value: number }']
        ]],
        ['collections','Колекції',[
          ['array','number[]'],['readonly','readonly number[]'],['record','Record<string, number>'],
          ['map','Map<string, number>'],['set','Set<number>'],['tuple','[string, number]'],
          ['dictionary','{ [key: string]: number }'],['nested','Array<{ id: string; score: number }>'],
          ['option','Array<number | null>'],['iter','Iterable<number>'],
          ['promise','Promise<number>'],['iterator','Iterator<number>']
        ]],
        ['utility','Utility',[
          ['partial','Partial<Score>'],['required','Required<Score>'],['readonly','Readonly<Score>'],
          ['pick','Pick<Score, "current">'],['omit','Omit<Score, "best">'],
          ['nonnullable','NonNullable<number | null>'],['extract','Extract<number | string, number>'],
          ['exclude','Exclude<number | null, null>'],['returntype','ReturnType<typeof calculateLoss>'],
          ['parameters','Parameters<typeof calculateLoss>'],['awaited','Awaited<Promise<number>>'],
          ['record','Record<"x" | "y", number>']
        ]],
        ['contracts','Контракти',[
          ['score','Score'],['point','{ x: number; y: number }'],
          ['readonly-score','Readonly<Score>'],['result','{ ok: true; value: number } | { ok: false; error: string }'],
          ['event','{ type: "move"; point: [number,number] }'],['status','"idle" | "loading" | "done"'],
          ['comparator','(left: number, right: number) => number'],['callback','(value: number) => void'],
          ['predicate','(value: unknown) => value is number'],
          ['generic-array','Array<Score>'],['nullable','Score | null'],['async','Promise<Score>']
        ]]
      ]
    },
    {
      id:'tools',label:'Дії',
      groups:[
        ['navigation','Навігація',[
          ['editor','Повернутися до редактора','editor'],['review','Показати diff','review'],
          ['home','До контекстів','home'],['scratch','Чистий експеримент','scratch'],
          ['sample','Демо-файл Score','sample'],['text','Текстове введення','text'],
          ['lefthand','Ліва / права рука','hand']
        ]],
        ['revisions','Історія',[
          ['undo','Скасувати останнє','undo'],['reset','Очистити конструктор','reset'],
          ['review','Checkpoint / diff','review'],['home','Відкласти','home']
        ]],
        ['refactor','Рефакторинг',[
          ['extract','Extract function','info'],['rename','Rename symbol','info'],
          ['inline','Inline variable','info'],['import','Organize imports','info'],
          ['references','Find references','info'],['format','Format selection','info']
        ]],
        ['inspection','Перевірка',[
          ['diagnostics','TypeScript diagnostics','info'],['typecheck','Typecheck','info'],
          ['definition','Go to definition','info'],['usages','Find usages','info'],
          ['review','Diff','review'],['status','Status','info']
        ]]
      ]
    }
  ];
  const roots = defs.map(d=>({id:d.id,label:d.label}));
  const safe = value=>String(value||'').slice(0,700);
  const defaults = {screen:'home',mode:'sample',hand:'right',rootId:null,pieces:{syntax:null,value:null,type:null},raw:'',history:[]};
  let state;
  try {
    const stored = JSON.parse(localStorage.getItem(KEY)||'null');
    state = stored && stored.pieces && Array.isArray(stored.history) ? {...defaults,...stored} : structuredClone(defaults);
  } catch (_) { state=structuredClone(defaults); }
  if(!['home','editor','review'].includes(state.screen))state.screen='home';
  const record = (event,extra={})=>console.info('[pulse-code-demo]',{event,...extra});
  const persist = ()=>{try{localStorage.setItem(KEY,JSON.stringify(state));}catch(e){record('draft_storage_failed',{kind:e.name});}};
  const snapshot = ()=>JSON.stringify({mode:state.mode,pieces:state.pieces,raw:state.raw});
  function addHistory() {state.history.push(snapshot()); if(state.history.length>30)state.history.shift();}
  function baseSource(){return state.mode==='scratch'?'// TypeScript scratchpad · local only':BASE;}
  function buildSource(s=state) {
    const appended=[];
    if(s.pieces.type)appended.push('  type ChosenType = '+s.pieces.type.code+';');
    if(s.pieces.syntax)appended.push('  '+s.pieces.syntax.code.replaceAll('\n','\n  '));
    if(s.pieces.value)appended.push('  const quickValue = '+s.pieces.value.code+';');
    let code;
    if(s.mode==='scratch') {
      code='// TypeScript scratchpad · local only';
      if(appended.length)code+='\n\n'+appended.map(x=>x.replace(/^  /,'')).join('\n\n');
    } else {
      const lines=BASE.split('\n');
      const target=lines.findIndex(line=>line.trim()==='return loss;');
      if(target>=0)lines.splice(target,0,...appended);
      code=lines.join('\n');
    }
    if(s.raw.trim())code+='\n\n'+s.raw.trim();
    return code;
  }
  function pieceCount(){return Object.values(state.pieces).filter(Boolean).length+(state.raw.trim()?1:0);}
  function toast(message){
    const el=$('toast');el.textContent=message;el.classList.add('open');
    clearTimeout(toast.timeout);toast.timeout=setTimeout(()=>el.classList.remove('open'),2400);
  }
  function render(){
    $('ts-code').textContent=buildSource();
    $('filelabel').textContent=state.mode==='scratch'?'scratch.ts · локально':'luna-review.ts · демо';
    $('step-count').textContent=pieceCount()+' частини';
    $('edit-state').textContent=pieceCount()?'Редаговано локально':'Базовий стан';
    $('home-status').textContent=pieceCount()?'Незавершена чернетка · '+pieceCount()+' частини':'Остання позиція · без призначеної задачі';
    $('thumbbar').classList.toggle('left',state.hand==='left');
    const root=defs.find(d=>d.id===state.rootId);
    $('wheel-prompt').textContent=root?'2 / 2 · '+root.label:'1 / 2 · Обери намір';
    $('wheel-help').textContent=root?'Сектор → таблиця великих виборів. ‹ для кроку назад.':'Утримай, проведи, відпусти. На секторі можна затриматись.';
    const chips=$('compose-chips');chips.replaceChildren();
    for(const slot of ['syntax','value','type']){
      const item=state.pieces[slot];
      const btn=document.createElement('button');btn.type='button';btn.className='chip'+(item?' active':'');
      btn.textContent=({'syntax':'◇ Структура','value':'◈ Значення','type':'T Тип'})[slot]+(item?' · '+item.label:' · +');
      btn.addEventListener('click',()=>{
        state.rootId=slot==='syntax'?'syntax':slot;
        persist();render();openList();
      });
      chips.appendChild(btn);
    }
    if(state.raw.trim()){
      const extra=document.createElement('button');extra.className='chip active';extra.textContent='⌨ Текст';extra.onclick=openTextEditor;chips.appendChild(extra);
    }
    $('undo-edit').disabled=!state.history.length;
  }
  function show(id){
    state.screen=id;persist();
    document.querySelectorAll('.screen').forEach(el=>el.classList.toggle('active',el.id==='screen-'+id));
    render();
    if(id==='review')renderDiff();
  }
  const sheet=$('sheet-overlay');
  function closeSheet(){sheet.classList.remove('open');$('sheet-options').replaceChildren();}
  function option(label, fn){
    const b=document.createElement('button');b.type='button';b.className='option';b.textContent=label;
    b.addEventListener('click',fn);return b;
  }
  function openSheet(title, renderChoices){
    $('sheet-title').textContent=title;
    $('sheet-options').replaceChildren();
    renderChoices($('sheet-options'));
    sheet.classList.add('open');
  }
  const rootOf=id=>defs.find(d=>d.id===id);
  function enterRoot(rootId){
    state.rootId=rootId;persist();render();record('wheel_enter_root',{rootId});
  }
  function enterGroup(rootId,groupId){
    const root=rootOf(rootId),group=root?.groups.find(g=>g[0]===groupId);
    if(!group)return;
    closeSheet();
    openGrid(root,group);
    record('wheel_open_grid',{rootId,groupId});
  }
  function openList(){
    const root=rootOf(state.rootId);
    openSheet(root?'Рівень 2 · '+root.label:'Рівень 1 · Намір',container=>{
      (root?root.groups.map(g=>({id:g[0],label:g[1]})):roots).forEach(d=>{
        container.appendChild(option(d.label+'  ›',()=>{
          if(root){enterGroup(root.id,d.id);}
          else{closeSheet();enterRoot(d.id);openList();}
        }));
      });
      if(root)container.appendChild(option('‹ Назад до рівня 1',()=>{closeSheet();enterRoot(null);openList();}));
      container.appendChild(option('⇆ Перемкнути руку',()=>{state.hand=state.hand==='left'?'right':'left';persist();render();closeSheet();}));
    });
  }
  function openTextEditor(){
    openSheet('Редагувати текстом · demo',container=>{
      const t=document.createElement('textarea');
      t.rows=8;t.maxLength=4000;t.spellcheck=false;t.autocapitalize='off';
      t.style.cssText='display:block;width:100%;min-height:160px;background:var(--background);border:1px solid var(--page-accent);border-radius:12px;padding:12px;font:13px/1.5 ui-monospace,monospace;';
      t.value=state.raw;container.appendChild(t);
      container.appendChild(option('✓ Застосувати до локальної чернетки',()=>{
        if(t.value!==state.raw){addHistory();state.raw=t.value;persist();render();}closeSheet();
        toast('Локальна чернетка оновлена · без typecheck');
      }));
    });
  }
  function makeChoice(node, root) {
    const [id,label,code]=node;
    return {id,label,code:code||label,rootId:root.id};
  }
  let activeGrid=null,selected=null;
  function openGrid(root,group) {
    activeGrid={root,group,items:group[2].map(node=>makeChoice(node,root))};
    selected=null;$('grid-search').value='';
    $('grid-title').textContent=group[1];
    $('grid-crumbs').textContent=root.label+'  ›  '+group[1]+'  ›  таблиця';
    $('grid-help').textContent=activeGrid.items.length+' великих карток · можна шукати, гортати й переглядати перед вставкою';
    $('grid-preview').textContent='Обери картку для попереднього перегляду.';
    $('grid-apply').disabled=true;
    $('grid-overlay').classList.add('open');
    $('grid-overlay').scrollTop=0;
    renderTiles();
  }
  function renderTiles(){
    const c=$('grid-tiles');c.replaceChildren();
    if(!activeGrid)return;
    const filter=$('grid-search').value.trim().toLowerCase();
    const items=activeGrid.items.filter(i=>(i.label+' '+i.code).toLowerCase().includes(filter));
    for(const item of items){
      const b=document.createElement('button');b.type='button';b.className='tile'+(selected?.id===item.id?' sel':'');
      b.setAttribute('aria-pressed',selected?.id===item.id?'true':'false');
      const name=document.createElement('strong');name.textContent=item.label;
      const code=document.createElement('code');
      code.textContent=safe(item.code);
      b.append(name,code);
      b.addEventListener('click',()=>{
        selected=item;
        $('grid-preview').textContent=item.label+' · '+safe(item.code);
        $('grid-apply').disabled=false;
        $('grid-apply').textContent=activeGrid.root.id==='tools'?'Виконати локальну дію':'Додати '+item.label+' до чернетки';
        renderTiles();
      });
      c.appendChild(b);
    }
    if(!items.length){
      const p=document.createElement('p');p.className='muted';p.textContent='Нічого не знайдено. Можна повернутись до іншої категорії або ввести текстом.';
      c.appendChild(p);
    }
  }
  function closeGrid(){
    $('grid-overlay').classList.remove('open');activeGrid=null;selected=null;
    $('grid-apply').disabled=true;render();
  }
  function applyChoice(){
    if(!activeGrid||!selected)return;
    const rootId=activeGrid.root.id,item=selected;
    if(rootId==='tools'){
      closeGrid();runTool(item.code,item.label);return;
    }
    addHistory();
    state.pieces[rootId]={id:item.id,label:item.label,code:item.code};
    state.rootId=null;persist();closeGrid();show('editor');
    record('draft_piece',{slot:rootId,choice:item.id});
    toast('Змінено лише локально · '+item.label);
  }
  function runTool(verb,label){
    if(verb==='undo'){undo();return;}
    if(verb==='reset'){
      openSheet('Очистити тільки чернетку?',c=>{
        const p=document.createElement('p');p.className='muted';p.textContent='Можна скасувати через Undo. Реального VPS запису немає.';
        c.appendChild(p);
        c.appendChild(option('Так, очистити чернетку',()=>{
          addHistory();state.pieces={syntax:null,value:null,type:null};state.raw='';
          persist();closeSheet();show('editor');
        }));
      });return;
    }
    if(verb==='hand'){state.hand=state.hand==='left'?'right':'left';persist();render();return;}
    if(verb==='text'){openTextEditor();return;}
    if(verb==='home'||verb==='editor'||verb==='review'){show(verb);return;}
    if(verb==='scratch'||verb==='sample'){
      addHistory();state.mode=verb;state.rootId=null;persist();show('editor');return;
    }
    toast(label+' · доступно як концепт; tsserver не підключений');
  }
  function undo(){
    const prev=state.history.pop();if(!prev){toast('Нема чого скасовувати');return;}
    try{
      const restored=JSON.parse(prev);
      state.mode=restored.mode;state.pieces=restored.pieces;state.raw=restored.raw;
    }catch(_){toast('Не вдалося відновити крок');return;}
    persist();render();record('undo');toast('Попередній локальний стан відновлено');
  }
  function renderDiff(){
    const before=baseSource().split('\n'),after=buildSource().split('\n');
    const c=$('diff');c.replaceChildren();
    const prefix=document.createElement('div');prefix.textContent='luna-review.ts · локальна зміна, без typecheck';c.appendChild(prefix);
    let first=0;
    while(first<before.length&&first<after.length&&before[first]===after[first])first++;
    let oldEnd=before.length,newEnd=after.length;
    while(oldEnd>first&&newEnd>first&&before[oldEnd-1]===after[newEnd-1]){oldEnd--;newEnd--;}
    if(first===oldEnd&&first===newEnd){
      const none=document.createElement('div');none.textContent='Немає змін.';c.appendChild(none);
    }else{
      const context=document.createElement('div');context.textContent='  '+before.slice(Math.max(0,first-2),first).join('\n  ');
      c.appendChild(context);
      for(const line of before.slice(first,oldEnd)){
        const el=document.createElement('div');el.className='minus';el.textContent='− '+line;c.appendChild(el);
      }
      for(const line of after.slice(first,newEnd)){
        const el=document.createElement('div');el.className='plus';el.textContent='+ '+line;c.appendChild(el);
      }
      const ending=document.createElement('div');ending.textContent='  '+after.slice(newEnd,newEnd+2).join('\n  ');c.appendChild(ending);
    }
    $('review-state').textContent=pieceCount()?'Чернетка локально · VPS не змінено':'Без змін · VPS не змінено';
  }
  // Radial ring: two levels, each four 90° annular sectors, R1=60, R2=112.
  // D=2*min((R2-R1)/2, 86*sin(45°))=52px, no scaling at 320px.
  const NS='http://www.w3.org/2000/svg', wheel=$('radial'), svg=$('radial-svg'), pad=$('gesture-pad');
  const r=deg=>deg*Math.PI/180;
  const shape=(start,end)=>{
    const xy=(radius,a)=>[124+radius*Math.cos(r(a)),124+radius*Math.sin(r(a))];
    const [x1,y1]=xy(112,start),[x2,y2]=xy(112,end),[x3,y3]=xy(60,end),[x4,y4]=xy(60,start);
    return `M${x1} ${y1} A112 112 0 0 1 ${x2} ${y2} L${x3} ${y3} A60 60 0 0 0 ${x4} ${y4} Z`;
  };
  const paths=[];
  ['var(--accent-purple)','var(--accent-lime)','var(--accent-cyan)','var(--accent-purple)'].forEach((col,i)=>{
    const p=document.createElementNS(NS,'path');
    p.classList.add('wedge');p.setAttribute('d',shape(i*90-178,i*90-92));
    p.setAttribute('fill',col);p.setAttribute('fill-opacity','.78');
    svg.appendChild(p);paths.push(p);
  });
  let finger=null,open=false,hover=-1,dwell=null,openTimer=null,blockedClickUntil=0;
  let wheelRoot=null;
  function labels(){
    wheelRoot=rootOf(state.rootId);
    const names=wheelRoot?wheelRoot.groups.map(g=>g[1]):roots.map(v=>v.label);
    document.querySelectorAll('.wheel-label').forEach((el,i)=>{el.textContent=names[i];});
    $('radial-depth').textContent=wheelRoot?'2 / 2':'1 / 2';
    $('radial-center').textContent=wheelRoot?wheelRoot.label+' ›':'обери розділ';
  }
  function wheelHit(x,y){
    if(!finger)return -1;
    const dx=x-finger.cx,dy=y-finger.cy,dist=Math.hypot(dx,dy);
    if(dist<60||dist>112)return -1;
    const degrees=(Math.atan2(dy,dx)*180/Math.PI+360)%360;
    return degrees<90?2:degrees<180?3:degrees<270?0:1;
  }
  function selectSector(idx){
    if(idx===hover)return;
    hover=idx;paths.forEach((p,i)=>p.classList.toggle('selected',i===idx));
    clearTimeout(dwell);dwell=null;
    if(idx>=0){
      const name=wheelRoot?wheelRoot.groups[idx][1]:roots[idx].label;
      $('radial-center').textContent=name;
      if(!wheelRoot){
        dwell=setTimeout(()=>{
          if(!finger||!open||hover!==idx)return;
          finger.needMove=true;
          finger.descendX=finger.lastX;
          finger.descendY=finger.lastY;
          enterRoot(roots[idx].id);
          labels();selectSector(-1);
          record('wheel_dwell_descend',{rootId:state.rootId});
        },260);
      }
    }else $('radial-center').textContent=wheelRoot?wheelRoot.label+' ›':'обери розділ';
  }
  function showWheel(){
    if(!finger||open)return;
    open=true;labels();
    const vw=innerWidth,vh=innerHeight;
    finger.cx=Math.max(124,Math.min(vw-124,finger.cx));
    finger.cy=Math.max(124,Math.min(vh-124,finger.cy));
    wheel.style.left=finger.cx+'px';wheel.style.top=finger.cy+'px';
    wheel.classList.add('open');selectSector(-1);
    if(navigator.vibrate)try{navigator.vibrate(10);}catch(_){}
    record('wheel_open',{level:wheelRoot?2:1});
  }
  function clearWheel(){
    clearTimeout(openTimer);clearTimeout(dwell);openTimer=null;dwell=null;
    finger=null;open=false;hover=-1;wheel.classList.remove('open');
    paths.forEach(p=>p.classList.remove('selected'));
  }
  pad.addEventListener('pointerdown',e=>{
    if(e.button!==0||finger||$('grid-overlay').classList.contains('open'))return;
    e.preventDefault();
    const rect=pad.getBoundingClientRect();
    finger={id:e.pointerId,downX:e.clientX,downY:e.clientY,lastX:e.clientX,lastY:e.clientY,
      cx:rect.left+rect.width/2,cy:rect.top+rect.height/2,start:performance.now(),needMove:false};
    pad.setPointerCapture(e.pointerId);
    openTimer=setTimeout(showWheel,340);
  });
  pad.addEventListener('pointermove',e=>{
    if(!finger||finger.id!==e.pointerId)return;
    finger.lastX=e.clientX;finger.lastY=e.clientY;
    if(!open&&Math.hypot(e.clientX-finger.downX,e.clientY-finger.downY)>16)showWheel();
    if(finger.needMove){
      if(Math.hypot(e.clientX-finger.descendX,e.clientY-finger.descendY)<24)return;
      finger.needMove=false;
    }
    if(open)selectSector(wheelHit(e.clientX,e.clientY));
  });
  pad.addEventListener('pointerup',e=>{
    if(!finger||finger.id!==e.pointerId)return;
    e.preventDefault();blockedClickUntil=performance.now()+700;
    if(!open&&performance.now()-finger.start>=340)showWheel();
    const requireNextGesture=finger.needMove;
    const sector=open&&!requireNextGesture?wheelHit(e.clientX,e.clientY):-1;
    const root=wheelRoot;
    clearWheel();
    if(requireNextGesture){toast('Рівень 2 · веди до наступного сектора');return;}
    if(sector<0){openList();return;}
    if(root)enterGroup(root.id,root.groups[sector][0]);
    else {enterRoot(roots[sector].id);toast('Рівень 2 · '+roots[sector].label);}
  });
  pad.addEventListener('pointercancel',()=>{record('wheel_cancel');clearWheel();});
  pad.addEventListener('lostpointercapture',()=>{if(finger)clearWheel();});
  pad.addEventListener('click',()=>{if(performance.now()>blockedClickUntil)openList();});
  pad.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();blockedClickUntil=performance.now()+600;openList();}});
  sheet.addEventListener('click',e=>{if(e.target===sheet)closeSheet();});
  $('sheet-close').onclick=closeSheet;
  $('grid-search').addEventListener('input',renderTiles);
  $('grid-apply').onclick=applyChoice;
  $('grid-close').onclick=closeGrid;
  $('grid-back').onclick=()=>{closeGrid();openList();};
  document.addEventListener('keydown',e=>{
    if(e.key!=='Escape')return;
    if($('grid-overlay').classList.contains('open'))closeGrid();
    else if(sheet.classList.contains('open'))closeSheet();
    else if(state.rootId){enterRoot(null);}
  });
  $('resume').onclick=()=>show('editor');
  $('open-file').onclick=()=>openSheet('Демо: обрати фрагмент',c=>{
    c.appendChild(option('Score · luna-review.ts',()=>{addHistory();state.mode='sample';state.pieces={syntax:null,value:null,type:null};state.raw='';state.rootId=null;persist();closeSheet();show('editor');}));
    c.appendChild(option('Чистий TypeScript scratch',()=>{addHistory();state.mode='scratch';state.pieces={syntax:null,value:null,type:null};state.raw='';state.rootId=null;persist();closeSheet();show('editor');}));
  });
  $('new-scratch').onclick=()=>{addHistory();state.mode='scratch';state.pieces={syntax:null,value:null,type:null};state.raw='';state.rootId=null;persist();show('editor');};
  $('editor-back').onclick=()=>show('home');
  $('to-review').onclick=$('review-edit').onclick=()=>show('review');
  $('review-back').onclick=()=>show('editor');
  $('nav-back').onclick=()=>{if(state.rootId)enterRoot(null);else show('home');};
  $('undo-edit').onclick=undo;
  $('edit-as-text').onclick=openTextEditor;
  $('server-save').onclick=()=>openSheet('UX-демо без VPS-запису',c=>{
    const p=document.createElement('p');p.className='muted';
    p.textContent='У цьому прототипі серверні файли, Git і TypeScript Language Service не підключені. Кнопка не виконує запису. Є лише локальний конструктор і попередній перегляд.';
    c.appendChild(p);
  });
  $('review-postpone').onclick=()=>{show('home');toast('Чернетка лишилась у цьому браузері');};
  render();show(state.screen);record('ready',{mode:state.mode});
})();
