/* PULSE CODE: explicit, non-destructive mobile UX demonstrator.
 * All edits live in localStorage; no remote write API is called. */
(() => {
  'use strict';
  const root = document.documentElement;
  const KEY = 'pulse-code-demo-v2';
  const initial = { edited: false, renamed: '', hand: 'right', screen: 'home' };
  let state;
  try { state = { ...initial, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
  catch (_) { state = { ...initial }; }
  const byId = id => document.getElementById(id);
  const original = "type Score = {\n  current: number;\n  best?: number | null;\n};\n\nfunction calculateLoss(s: Score): number {\n  return s.best - s.current;\n}";
  const fixed = "type Score = {\n  current: number;\n  best?: number | null;\n};\n\nfunction calculateLoss(s: Score): number {\n  return s.best == null\n    ? 0\n    : Math.max(0, s.best - s.current);\n}";
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (_) {} };
  function renderCode() {
    const source = (state.edited ? fixed : original).replaceAll('calculateLoss', state.renamed || 'calculateLoss');
    byId('ts-code').textContent = source;
    byId('diagnostic-count').textContent = state.edited ? '0 TS-помилок (демо)' : '1 TS-помилка';
    byId('ts-diagnostic').textContent = state.edited ? '✓ Демонстраційне виправлення застосовано локально. Typecheck не запускався.' : 'TS18049: s.best може бути null або undefined.';
    byId('new-line').textContent = state.edited ? 'return s.best == null ? 0 : Math.max(0, s.best - s.current);' : 'Поки без змін';
    byId('change-count').textContent = state.edited ? '1 зміна (демо)' : '0 змін';
    byId('review-status').textContent = state.edited ? 'Виправлення лише локально · VPS без змін' : 'Чернетка локально · VPS без змін';
    byId('home-status').textContent = state.edited ? 'Є локальна зміна · не на VPS' : 'Останній контекст збережено';
    byId('edit-bottom').classList.toggle('left', state.hand === 'left');
    root.dataset.hand = state.hand;
  }
  function showScreen(id) {
    state.screen = id; save();
    document.querySelectorAll('.screen').forEach(el => el.classList.toggle('active', el.id === 'screen-' + id));
    renderCode();
  }
  function toast(message) {
    const el = byId('toast');
    el.textContent = message; el.classList.add('on');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => el.classList.remove('on'), 2600);
  }
  const sheet = byId('sheet-back');
  function closeSheet() {
    sheet.classList.remove('on');
    byId('sheet-content').replaceChildren();
    byId('gesture-pad').focus({ preventScroll: true });
  }
  function showSheet(title, build) {
    byId('sheet-title').textContent = title;
    const c = byId('sheet-content');
    c.replaceChildren(); build(c);
    sheet.classList.add('on');
    const first = c.querySelector('input,button'); if (first) first.focus({ preventScroll: true });
  }
  function makeButton(label, action, cls='option') {
    const b = document.createElement('button');
    b.type='button'; b.className=cls; b.textContent=label;
    b.addEventListener('click', action);
    return b;
  }
  const actions = [
    { label:'Rename · символ', id:'rename' },
    { label:'Fix · TypeScript code action', id:'fix' },
    { label:'Перейти до визначення', id:'goto' },
    { label:'Організувати імпорти', id:'import' }
  ];
  function chooseAction(action) {
    if(action==='fix') {
      state.edited=true; save(); renderCode(); closeSheet();
      toast('Застосовано в локальній демонстрації · VPS не змінено');
    } else if(action==='rename') {
      showSheet('Rename symbol · TypeScript', c => {
        const input=document.createElement('input');input.type='text';input.maxLength=45;
        input.value=state.renamed||'calculateLoss';input.autocapitalize='off';input.spellcheck=false;
        input.setAttribute('aria-label','Нове ім’я TypeScript-функції');
        c.appendChild(input);
        c.appendChild(makeButton('Перейменувати в демо',()=>{
          if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(input.value)) {toast('Потрібен коректний TS identifier');return;}
          state.renamed=input.value;save();renderCode();closeSheet();toast('Символ перейменовано локально');
        },'commit'));
      });
    } else if(action==='goto') {
      showSheet('Визначення TypeScript', c => {
        const p=document.createElement('p');p.className='muted';
        p.textContent='Score · type alias, рядок 1. Мобільний quick-peek без переходу й втрати позиції.';
        c.appendChild(p);
      });
    } else if(action==='import') {
      showSheet('Імпорти · контекстна дія', c => {
        const p=document.createElement('p');p.className='muted';
        p.textContent='У цьому уривку імпортів немає. Реальна реалізація має брати дії від tsserver, не пропонувати вигаданий fix.';
        c.appendChild(p);
      });
    }
  }
  function showOptions() {
    showSheet('Одна дія · великий палець', c => {
      actions.forEach(a => c.appendChild(makeButton(a.label,()=>chooseAction(a.id))));
      c.appendChild(makeButton('⇆ Перемкнути руку · '+(state.hand==='right'?'ліву':'праву'),()=>{
        state.hand = state.hand==='right'?'left':'right';save();renderCode();closeSheet();
        toast('Зону жесту переміщено');
      }));
    });
  }
  // Geometry inherited conceptually from Touchviz modwheel: R1=60, R2=112.
  // Four 90° annular sectors => 52px inscribed touch diameter (radial depth cap).
  const NS='http://www.w3.org/2000/svg';
  const wheel=byId('wheel'), ring=byId('wheel-svg');
  const colors=['var(--accent-purple)','var(--accent-lime)','var(--accent-cyan)','var(--accent-purple)'];
  const pathFor=(start,end,r1=60,r2=112)=>{
    const rad=d=>d*Math.PI/180, xy=(r,d)=>[124+r*Math.cos(rad(d)),124+r*Math.sin(rad(d))];
    const [ax,ay]=xy(r2,start),[bx,by]=xy(r2,end),[cx,cy]=xy(r1,end),[dx,dy]=xy(r1,start);
    return `M${ax} ${ay} A${r2} ${r2} 0 0 1 ${bx} ${by} L${cx} ${cy} A${r1} ${r1} 0 0 0 ${dx} ${dy} Z`;
  };
  const wedges=[];
  [-180,-90,0,90].forEach((start,i)=>{
    const p=document.createElementNS(NS,'path');p.setAttribute('d',pathFor(start+2,start+88));
    p.setAttribute('fill',colors[i]);p.setAttribute('fill-opacity','.7');p.classList.add('wedge');
    p.dataset.action=actions[i].id;ring.appendChild(p);wedges.push(p);
  });
  const pad=byId('gesture-pad');
  let touch=null, active=false, chosen=-1, holdTimer=null;
  const isValid=(d)=>d>=60&&d<=112;
  function hitAt(x,y){
    if(!touch) return -1;
    const dx=x-touch.x,dy=y-touch.y,d=Math.hypot(dx,dy);
    if(!isValid(d)) return -1;
    const a=(Math.atan2(dy,dx)*180/Math.PI+360)%360;
    return a<90?2:a<180?3:a<270?0:1;
  }
  function highlight(i){
    chosen=i;
    wedges.forEach((w,n)=>w.classList.toggle('hit',n===i));
    byId('wheel-center').textContent=i<0?'веди й відпусти':actions[i].label;
  }
  function openWheel(){
    if(!touch||active)return;
    active=true;
    const vw=window.innerWidth,vh=window.innerHeight;
    touch.x=Math.max(124,Math.min(vw-124,touch.x));
    touch.y=Math.max(124,Math.min(vh-124,touch.y));
    wheel.style.left=touch.x+'px';wheel.style.top=touch.y+'px';
    wheel.classList.add('on');byId('screen-editor').classList.add('wheeling');
    highlight(-1);
    if(navigator.vibrate)try{navigator.vibrate(14);}catch(_){}
  }
  function cleanWheel(){
    clearTimeout(holdTimer);holdTimer=null;touch=null;active=false;chosen=-1;
    wheel.classList.remove('on');byId('screen-editor').classList.remove('wheeling');
  }
  pad.addEventListener('pointerdown', e=>{
    if(e.button!==0 || touch)return;
    e.preventDefault();
    const rect=pad.getBoundingClientRect();
    touch={id:e.pointerId,x:rect.left+rect.width/2,y:rect.top+rect.height/2,
           downX:e.clientX,downY:e.clientY,t:performance.now()};
    pad.setPointerCapture(e.pointerId);
    holdTimer=setTimeout(openWheel,340);
  });
  pad.addEventListener('pointermove',e=>{
    if(!touch||e.pointerId!==touch.id)return;
    const d=Math.hypot(e.clientX-touch.downX,e.clientY-touch.downY);
    if(d>16&&!active)openWheel();
    if(active)highlight(hitAt(e.clientX,e.clientY));
  });
  pad.addEventListener('pointerup',e=>{
    if(!touch||e.pointerId!==touch.id)return;
    e.preventDefault();
    const elapsed=performance.now()-touch.t;
    if(!active&&elapsed>=340)openWheel(); // fallback if the delayed timer lost the race
    if(active)highlight(hitAt(e.clientX,e.clientY));
    const action=active&&chosen>=0?actions[chosen].id:null;
    cleanWheel();
    if(action)chooseAction(action);else showOptions();
  });
  pad.addEventListener('pointercancel',cleanWheel);
  pad.addEventListener('lostpointercapture',()=>{if(touch)cleanWheel();});
  pad.addEventListener('keydown', e=>{
    if(e.key==='Enter'||e.key===' '){e.preventDefault();showOptions();}
  });
  byId('sheet-close').addEventListener('click',closeSheet);
  sheet.addEventListener('click',e=>{if(e.target===sheet)closeSheet();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&sheet.classList.contains('on'))closeSheet();});
  byId('resume').addEventListener('click',()=>showScreen('editor'));
  byId('postpone').addEventListener('click',()=>toast('Контекст залишився в локальному демо'));
  byId('editor-back').addEventListener('click',()=>showScreen('home'));
  byId('to-review').addEventListener('click',()=>showScreen('review'));
  byId('pause-edit').addEventListener('click',()=>{showScreen('home');toast('Чернетка локально. Можна повернутися пізніше');});
  byId('review-back').addEventListener('click',()=>showScreen('editor'));
  byId('review-postpone').addEventListener('click',()=>{showScreen('home');toast('Зміна збережена лише локально');});
  byId('server-save').addEventListener('click',()=>showSheet('Демо без серверного запису',c=>{
    const p=document.createElement('p');p.className='muted';
    p.textContent='Прототип демонструє UX, але не підключений до VPS. Кнопка не змінює файли. Реальний запис вимагатиме compare-and-swap, перевірки diff і явного підтвердження.';
    c.appendChild(p);
    c.appendChild(makeButton('Закрити',closeSheet));
  }));
  renderCode();
  showScreen(['home','editor','review'].includes(state.screen)?state.screen:'home');
})();
