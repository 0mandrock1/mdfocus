#!/usr/bin/env python3
"""Generate three deterministic, mobile-first UI concept SVGs for MDFocus demo."""
from html import escape
from pathlib import Path

W, H = 390, 844
OUT = Path(__file__).resolve().parent.parent / "web"
P = dict(bg="#140815", panel="#231024", panel2="#301331", border="#5d335e", purple="#ec71fa", cyan="#7cebf9", lime="#c3ff55", white="#fff2fe", muted="#af91b1", green="#93f4c4", red="#ff718d", orange="#ffc385")


def e(s): return escape(str(s), quote=True)
def rect(x,y,w,h,fill,rx=0,stroke=None,sw=1, opacity=1):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}" opacity="{opacity}"'+(f' stroke="{stroke}" stroke-width="{sw}"' if stroke else "")+'/>'
def text(x,y,s,size=14,color=None,weight=400,mono=False,anchor="start",opacity=1):
    return f'<text x="{x}" y="{y}" font-size="{size}" fill="{color or P["white"]}" font-weight="{weight}" font-family="{"ui-monospace, SFMono-Regular, Consolas, monospace" if mono else "Inter, Arial, sans-serif"}" text-anchor="{anchor}" opacity="{opacity}">{e(s)}</text>'
def line(x1,y1,x2,y2,color=None,sw=1,opacity=1):
    return f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{color or P["border"]}" stroke-width="{sw}" opacity="{opacity}"/>'
def circle(x,y,r,fill):
    return f'<circle cx="{x}" cy="{y}" r="{r}" fill="{fill}"/>'
def pill(x,y,w,label,accent="purple",fill=None,h=30):
    color=P.get(accent,accent)
    return rect(x,y,w,h,fill or P["panel2"],h/2, P["border"]) + text(x+w/2,y+h/2+5,label,12,color,700,anchor="middle")
def base(title,subtitle,no):
    s=['<svg xmlns="http://www.w3.org/2000/svg" width="390" height="844" viewBox="0 0 390 844" role="img" aria-label="'+e(title)+'">']
    s+=['<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#260623"/><stop offset=".52" stop-color="#120916"/><stop offset="1" stop-color="#170c20"/></linearGradient><linearGradient id="shine" x1="0" x2="1"><stop stop-color="#db49e8"/><stop offset="1" stop-color="#51ddf0"/></linearGradient></defs>', rect(0,0,390,844,'url(#bg)'), rect(0,0,390,4,'url(#shine)')]
    s += [text(22,29,"9:41",13,P["white"],700),text(333,29,"● ᴡɪғɪ ▰",12,P["white"],600,anchor="middle")]
    s += [rect(16,48,358,57,P["panel"],14,P["border"]), text(29,72,"◈",25,P["purple"],700),text(58,71,"PULSE",21,P["white"],800),text(129,71,"CODE",21,P["purple"],800),text(58,92,subtitle,11,P["muted"]),pill(301,61,58,f"{no}/03","cyan",h=30)]
    s += [text(20,136,title,23,P["white"],800),line(20,150,370,150,P["border"])]
    return s
def footer(s, active):
    y=757
    s.extend([rect(0,y,390,87,P["panel"],0),line(0,y,390,y,P["border"])])
    items=[("▤","Файли"),("⌕","Пошук"),("⌘","Git"),("❯_","Термінал")]
    for idx,(glyph,label) in enumerate(items):
        x=49+idx*97
        if label==active: s.append(rect(x-37,y+8,74,65,P["panel2"],13,P["purple"]))
        c=P["purple"] if label==active else P["muted"]
        s.extend([text(x,y+39,glyph,22,c,700,anchor="middle"), text(x,y+59,label,10,c,600,anchor="middle")])
    s.append(rect(142,828,106,4,P["white"],3,opacity=.7))
def save(name,s):
    s.append('</svg>')
    (OUT/name).write_text('\n'.join(s),encoding="utf-8")
    print(name,(OUT/name).stat().st_size)
# 01 editor
s=base("Код без боротьби з екраном","gotable / feat/luna-review",1)
s += [pill(19,164,135,"luna-review.ts","purple"),pill(162,164,94,"gtp.ts","cyan"),text(343,185,"＋",23,P["muted"])]
s += [rect(16,211,358,396,P["bg"],10,P["border"]),rect(19,412,352,29,P["panel2"],0),rect(20,412,4,29,P["lime"])]
# syntax-highlighted code with semantic colors
lines=[
[( "export ", "purple"),("async ", "cyan"),("function ", "purple")],
[( "reviewMove(", "white"),("move", "orange"),(": Move) {", "white")],
[( "  const ", "purple"),("eval", "cyan"),(" = await", "white")],
[( "    analyzer.", "muted"),("analyze", "lime"),("(move);", "white")],
[("  if ", "purple"),("(eval.loss > ", "white"),("3", "orange"),(") {", "white")],
[("    return ", "purple"),("{", "white")],
[("      kind: ", "white"),("'moment'", "green"),(",", "white")],
[("      what: ", "white"),("eval.what", "cyan"),(",", "white")],
[("      why: ", "white"),("explain(eval)", "lime")],
[("    };", "white")],
[("  }", "white")],
[("  return ", "purple"),("tickFor(move)", "lime"),(";", "white")],
[("}", "white")]
]
for idx,segments in enumerate(lines):
    y=247+idx*26
    s.append(text(37,y,f"{idx+21:02}",11,P["muted"],mono=True,anchor="end"))
    x=51
    for part,color in segments:
        s.append(text(x,y,part,12.5,P[color],mono=True))
        x += len(part)*7.55
s.extend([text(29,630,"TS",10,P["cyan"],800),text(58,630,"UTF-8    ⌁  main   •   збережено",11,P["muted"]),circle(358,625,5,P["lime"])])
s += [rect(17,647,356,48,P["panel"],12,P["border"])]
for x,label,w in [(25,"{ }",42),(73,"( )",42),(121,"[ ]",42),(169,"=>",42),(217,";",42),(265,"⇥",42),(313,"↶",49)]:
    s.append(rect(x,657,w,29,P["panel2"],8))
    s.append(text(x+w/2,677,label,15,P["white"],600,mono=True,anchor="middle"))
s += [rect(19,702,352,41,P["panel2"],12,P["purple"]),text(36,728,"⌘  Палітра дій",13,P["white"],700),text(344,728,"⌄",18,P["purple"],700,anchor="middle")]
footer(s,"Пошук");save("demo-editor.svg",s)
# 02 files
s=base("Проєкт у великому пальці","VPS / 12 файлів змінено",2)
s += [rect(18,166,354,48,P["panel"],12,P["border"]),text(31,197,"⌕",24,P["cyan"]),text(68,196,"Файл, символ, команда…",14,P["muted"]),pill(294,175,66,"⌘ K","purple",h=31)]
s += [pill(19,227,126,"● VPS · online","lime",h=31),pill(152,227,110,"Git: main","cyan",h=31),pill(267,227,104,"Змін: 12","orange",h=31)]
s += [text(23,290,"ШВИДКИЙ ДОСТУП",11,P["purple"],800),text(350,290,"⋯",20,P["muted"])]
folders=[("⌂","gotable","/root/projects/sites/gotable","lime"),("▣","src/server","23 файли • TypeScript","cyan"),("▣","src/client","18 файлів • UI","cyan"),("▤","README.md","змінено 12 хв тому","orange")]
for i,(sym,title,detail,accent) in enumerate(folders):
    y=308+i*77
    s += [rect(17,y,356,68,P["panel"],13,P["border"]),text(34,y+39,sym,23,P[accent],700),text(72,y+28,title,16,P["white"],700),text(72,y+49,detail,11,P["muted"]),text(351,y+39,"›",25,P["muted"],anchor="middle")]
s += [text(22,632,"ЖЕСТИ",11,P["purple"],800),text(22,656,"← Свайп",12,P["cyan"],700),text(113,656,"історія файлів",12,P["muted"]),text(22,681,"→ Утримай",12,P["cyan"],700),text(123,681,"дії з файлом",12,P["muted"])]
s += [rect(17,701,356,43,P["panel2"],12,P["purple"]),text(34,728,"＋",22,P["lime"],700),text(64,728,"Новий файл / папка",13,P["white"],700),text(343,728,"›",22,P["purple"])]
footer(s,"Файли");save("demo-projects.svg",s)
# 03 git/diff
s=base("Diff перед комітом","без небезпечних сюрпризів",3)
s += [pill(19,167,161,"feat/luna-review","purple"),pill(189,167,183,"✓ робоча копія","lime")]
s += [rect(17,211,356,57,P["panel"],12,P["border"]),text(33,234,"2 файли",14,P["white"],700),text(33,254,"1 staged  •  1 unstaged",12,P["muted"]),text(346,245,"⌄",20,P["purple"],anchor="middle")]
s += [text(22,300,"src/server/luna-review.ts",13,P["cyan"],700,mono=True),text(348,300,"⊕",17,P["lime"],anchor="middle")]
s += [rect(17,318,356,235,P["bg"],10,P["border"])]
diff=[("-",330,"-  const score = rawEstimate", "red"),("+",358,"+  // Та сама черга ходу", "green"),("+",386,"+  const score = compare(", "green"),("+",414,"+    before, after, side", "green"),("+",442,"+  );", "green"),(" ",487,"  return classify(score);", "muted")]
for mark,y,content,accent in diff:
    s.append(rect(23,y,344,25,P["red"] if accent=="red" else P["green"] if accent=="green" else P["panel"],4,opacity=.12 if accent!="muted" else .5))
    s.append(text(32,y+18,content,11.6,P[accent],mono=True))
s += [pill(27,516,108,"✓ Stage hunk","lime",h=27),pill(141,516,213,"↶ Відхилити зміни","red",h=27)]
s += [rect(17,567,356,84,P["panel"],12,P["border"]),text(31,592,"ПЕРЕВІРКИ",11,P["purple"],800),text(31,616,"✓  vitest  76 / 76",13,P["green"],mono=True),text(31,637,"✓  oxlint  no errors",13,P["green"],mono=True)]
s += [rect(17,665,356,78,P["panel2"],12,P["purple"]),text(30,689,"Повідомлення коміту",11,P["muted"]),text(30,715,"Fix move score perspective",14,P["white"],700,mono=True),text(345,717,"✎",18,P["purple"])]
footer(s,"Git");save("demo-diff.svg",s)
