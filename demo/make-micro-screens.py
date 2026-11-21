#!/usr/bin/env python3
"""Precise, deterministic 390x844 mockups for the micro-session redesign."""
from html import escape
from pathlib import Path
import math
ROOT=Path(__file__).resolve().parent.parent / 'web'
COLORS=dict(bg='#160918',card='#2a112b',surface='#351439',border='#6e3d6e',white='#fff4ff',muted='#bfa0c2',purple='#e57afb',lime='#caff49',cyan='#80e9f8',red='#fa6d83')
def c(name):return COLORS.get(name,name)
def t(x,y,txt,size=15,color='white',weight=400,mono=False,anchor='start'):
    return f'<text x="{x}" y="{y}" font-family="{"monospace" if mono else "Arial,sans-serif"}" font-size="{size}" font-weight="{weight}" fill="{c(color)}" text-anchor="{anchor}">{escape(str(txt))}</text>'
def r(x,y,w,h,col='card',radius=12,stroke=None):
    s=f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{radius}" fill="{c(col)}"'
    if stroke:s+=f' stroke="{c(stroke)}" stroke-width="1.5"'
    return s+'/>'
def line(x1,y1,x2,y2,col='border'):
    return f'<path d="M{x1} {y1} L{x2} {y2}" stroke="{c(col)}" stroke-width="1"/>'
def base(no,title):
    s=['<svg xmlns="http://www.w3.org/2000/svg" width="390" height="844" viewBox="0 0 390 844">']
    s += ['<defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#260725"/><stop offset=".5" stop-color="#160918"/><stop offset="1" stop-color="#170c21"/></linearGradient></defs>']
    s += [r(0,0,390,844,'url(#g)',0),r(0,0,390,4,'purple',0)]
    s += [t(24,33,'9:41',13,weight=800),t(359,33,'● ▰',13,anchor='end')]
    s += [t(23,76,'///',25,'purple',800),t(87,74,'PULSE',21,weight=800),t(161,74,'CODE',21,'purple',800),r(287,50,80,38,'card',14,'border'),t(327,73,f'0{no}/03',13,'cyan',700,anchor='middle')]
    s += [line(20,92,370,92),t(20,125,title,14,'purple',800)]
    return s
def end(name,s):
    s.append('</svg>')
    p=ROOT/name;p.write_text('\n'.join(s),encoding='utf8')
    print(p.name,p.stat().st_size)
def btn(y,txt,primary=False):
    return [r(20,y,350,64,'lime' if primary else 'card',18,None if primary else 'border'),t(195,y+40,txt,18,'bg' if primary else 'white',800,anchor='middle')]
# screen 1
s=base(1,'МІКРОСЕСІЯ · TS')
s += [t(23,195,'90 секунд',35,'lime',800),t(23,236,'і готово.',36,weight=800)]
s += [t(23,271,'Одна конкретна справа. Жодних меню.',14,'muted')]
s += [r(20,303,350,274,'card',19,'purple')]
s += [r(37,320,50,32,'surface',8),t(62,342,'TS',14,'cyan',800,anchor='middle')]
s += [t(100,342,'gotable / feat/luna',13,'muted'),r(284,320,69,32,'lime',13),t(318,341,'~90 c',13,'bg',800,anchor='middle')]
s += [t(37,390,'Помилка типів',27,weight=800),t(37,424,'calculateLoss()',25,'lime',800,mono=True)]
s += [t(37,460,'best?: number | null',16,'cyan',400,mono=True)]
s += [t(37,493,'Одна правка · одна перевірка',14,'muted')]
s += [r(37,527,10,10,'lime',5),t(57,538,'Позиція збережена локально',13,'muted')]
s += [r(20,605,350,43,'surface',12),t(34,632,'Немає дерева файлів на старті',14,'cyan',700)]
s += btn(672,'▶ Продовжити',True)
s += [t(195,764,'◷  Відкласти без втрати',16,'muted',700,anchor='middle')]
end('pulse-session.svg',s)
# screen 2
s=base(2,'TYPE SCRIPT · РЕДАКТОР')
s += [r(20,147,350,40,'card',12,'border'),t(37,172,'‹',22,'muted',700),t(70,172,'calculateLoss()',17,'white',700,mono=True),t(337,172,'TS',14,'cyan',800,anchor='middle')]
s += [t(22,219,'luna-review.ts · 1 TS-помилка',13,'red')]
s += [r(20,236,350,270,'bg',13,'border')]
code=[('type Score = {','cyan'),('  current: number;','white'),('  best?: number | null;','lime'),('};','white'),('','white'),('function calculateLoss(s: Score) {','purple'),('  return s.best - s.current;','red'),('}','white')]
for i,(value,color) in enumerate(code):
    s += [t(35,269+i*28,f'{i+118}',11,'muted',400,mono=True),t(69,269+i*28,value,11.9,color,400,mono=True)]
s += [t(22,537,'◎  Тримай · веди · відпусти',15,'cyan',800)]
s += [t(22,558,'Один жест, не шість дрібних тапів',12,'muted')]
# Annular menu: R1=60 R2=112 with 4 equal sectors, drawn around (250,672).
cx,cy=250,670
def xy(radius,deg):
    a=math.radians(deg)
    return cx+radius*math.cos(a),cy+radius*math.sin(a)
for i,(a,b,name,col) in enumerate([(-180,-90,'Rename','purple'),(-90,0,'Fix','lime'),(0,90,'Перейти','cyan'),(90,180,'Імпорт','purple')]):
    a+=2;b-=2
    x1,y1=xy(112,a);x2,y2=xy(112,b);x3,y3=xy(60,b);x4,y4=xy(60,a)
    d=f'M{x1:.2f} {y1:.2f} A112 112 0 0 1 {x2:.2f} {y2:.2f} L{x3:.2f} {y3:.2f} A60 60 0 0 0 {x4:.2f} {y4:.2f} Z'
    s.append(f'<path d="{d}" fill="{c(col)}" fill-opacity=".83" stroke="{c("bg")}" stroke-width="4"/>')
for x,y,name,clr in [(180,620,'Rename','white'),(320,620,'Fix','bg'),(317,719,'Перейти','bg'),(178,719,'Імпорт','white')]:
    s.append(t(x,y,name,13,clr,800,anchor='middle'))
s += [f'<circle cx="{cx}" cy="{cy}" r="56" fill="{c("card")}" stroke="{c("purple")}" stroke-width="3"/>']
s += [t(cx,665,'◎',24,'white',800,anchor='middle'),t(cx,684,'один жест',12,'muted',700,anchor='middle')]
s += [t(20,819,'52 px / сектор · fallback: список',13,'muted')]
end('pulse-wheel.svg',s)
# screen 3
s=base(3,'ФІНІШ · ОДНА ЗМІНА')
s += [t(21,194,'Перевір.',35,'white',800),t(21,236,'Закрий сесію.',35,'lime',800)]
s += [r(20,272,350,265,'card',18,'purple')]
s += [r(36,288,48,32,'surface',8),t(60,310,'TS',14,'cyan',800,anchor='middle')]
s += [t(99,309,'luna-review.ts',15,'white',800)]
s += [t(37,354,'−  return s.best - s.current;',14,'red',400,mono=True)]
s += [r(33,370,326,88,'surface',12)]
s += [t(42,400,'+  return s.best == null',13,'lime',400,mono=True),t(59,425,'? 0 : Math.max(0, ...);',13,'lime',400,mono=True)]
s += [line(37,478,352,478),r(38,500,11,11,'lime',6),t(59,511,'Чернетка локально',14,'muted')]
s += [r(20,563,350,61,'surface',14,'border'),t(38,586,'Сервер не змінено',15,'white',800),t(38,608,'Демо: запис на VPS не виконується',12,'muted')]
s += btn(664,'↑ Зберегти на VPS · демо',True)
s += btn(744,'◷ Відкласти без втрати')
end('pulse-review.svg',s)
