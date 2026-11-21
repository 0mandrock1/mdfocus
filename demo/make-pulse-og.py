from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
p=Path(__file__).resolve().parent.parent/'web/pulse-code-og.png'
im=Image.new('RGB',(1200,630),'#170917')
d=ImageDraw.Draw(im)
big='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
med='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
for x in range(0,1200,60):
    d.line((x,0,x,630),fill='#280e2b',width=1)
for y in range(0,630,60):
    d.line((0,y,1200,y),fill='#280e2b',width=1)
d.rounded_rectangle((38,44,1163,591),30,fill='#200d23',outline='#a53eac',width=3)
d.text((80,85),'/// PULSE CODE',font=ImageFont.truetype(big,56),fill='#ed7aff')
d.text((80,206),'90 секунд.',font=ImageFont.truetype(big,70),fill='#caff49')
d.text((80,306),'TypeScript одним пальцем',font=ImageFont.truetype(big,31),fill='#fff3ff')
d.text((80,399),'Мікросесія  /  Modwheel  /  Diff',font=ImageFont.truetype(med,22),fill='#91ebfa')
d.text((80,511),'НЕ IDE В МІНІАТЮРІ',font=ImageFont.truetype(big,19),fill='#c9a4c9')
for i,label in enumerate(('01','02','03')):
    x=775+i*127
    d.rounded_rectangle((x,185,x+104,446),20,fill='#351238',outline='#dc65e1',width=3)
    d.rounded_rectangle((x+12,210,x+92,240),8,fill='#691c69')
    for j in range(7):
        cy=264+j*18
        d.rounded_rectangle((x+14,cy,x+76-j%3*12,cy+5),3,fill=('#bff94c' if j==2 else '#82dce8' if j%2 else '#b1a0b7'))
    d.text((x+31,407),label,font=ImageFont.truetype(big,20),fill='#e4b2f3')
im.save(p,optimize=True)
print(p,p.stat().st_size)
