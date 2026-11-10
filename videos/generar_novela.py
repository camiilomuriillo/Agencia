import subprocess, math, numpy as np, wave, sys
from PIL import Image, ImageDraw, ImageFont
W,H,FPS=1080,1920,30
B="/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
def F(s): return ImageFont.truetype(B,s)
OUT=sys.argv[1]; SP=sys.argv[2]

def ease(t): return t*t*(3-2*t)

def bg_cafe(d,tint=None):
    d.rectangle([0,0,W,H],fill=(255,226,190))
    for x in range(0,W,120): d.rectangle([x,0,x+60,1100],fill=(250,212,170))
    d.rectangle([140,250,940,750],fill=(150,200,240),outline=(110,70,40),width=18)
    d.line([540,250,540,750],fill=(110,70,40),width=14); d.line([140,500,940,500],fill=(110,70,40),width=14)
    d.ellipse([700,300,820,420],fill=(255,240,150))
    d.rectangle([0,1100,W,H],fill=(160,100,60))
    for y in range(1100,H,90): d.line([0,y,W,y],fill=(140,85,50),width=4)
    d.rectangle([200,1250,880,1290],fill=(120,70,40)); d.rectangle([520,1290,560,1600],fill=(120,70,40))
    d.rectangle([560,1180,640,1250],fill=(255,255,255),outline=(60,40,30),width=5)
    d.arc([630,1195,670,1235],-90,90,fill=(60,40,30),width=6)

def person(d,cx,cy,s,hair,shirt,mood="normal",female=True,blink=False):
    k=lambda v:int(v*s)
    d.rounded_rectangle([cx-k(170),cy+k(170),cx+k(170),cy+k(600)],k(80),fill=shirt,outline=(40,30,30),width=k(8))
    d.rectangle([cx-k(35),cy+k(120),cx+k(35),cy+k(190)],fill=(250,205,170))
    if female: d.ellipse([cx-k(200),cy-k(210),cx+k(200),cy+k(260)],fill=hair)
    d.ellipse([cx-k(150),cy-k(160),cx+k(150),cy+k(170)],fill=(250,205,170),outline=(40,30,30),width=k(7))
    if female: d.chord([cx-k(165),cy-k(190),cx+k(165),cy+k(60)],180,360,fill=hair)
    else:
        d.chord([cx-k(160),cy-k(200),cx+k(160),cy+k(40)],180,360,fill=hair)
        for i in range(-2,3): d.polygon([(cx+k(i*55-30),cy-k(150)),(cx+k(i*55+30),cy-k(150)),(cx+k(i*55),cy-k(215))],fill=hair)
    ey=cy+k(10)
    for ex in (cx-k(55),cx+k(55)):
        if blink: d.line([ex-k(25),ey,ex+k(25),ey],fill=(30,20,20),width=k(8))
        elif mood=="shock":
            d.ellipse([ex-k(38),ey-k(38),ex+k(38),ey+k(38)],fill="white",outline=(30,20,20),width=k(6))
            d.ellipse([ex-k(10),ey-k(10),ex+k(10),ey+k(10)],fill=(30,20,20))
        else:
            d.ellipse([ex-k(24),ey-k(30),ex+k(24),ey+k(30)],fill=(30,20,20))
            d.ellipse([ex-k(6),ey-k(20),ex+k(8),ey-k(6)],fill="white")
    if female:
        for ex in (cx-k(100),cx+k(100)): d.ellipse([ex-k(28),ey+k(45),ex+k(28),ey+k(70)],fill=(255,150,160))
    my=cy+k(100)
    if mood=="shock": d.ellipse([cx-k(32),my-k(20),cx+k(32),my+k(55)],fill=(120,30,40),outline=(30,20,20),width=k(5))
    elif mood=="serious":
        d.line([cx-k(35),my+k(10),cx+k(35),my+k(10)],fill=(30,20,20),width=k(8))
        for ex,sg in ((cx-k(55),1),(cx+k(55),-1)): d.line([ex-k(30),ey-k(55-sg*10),ex+k(30),ey-k(55+sg*10)],fill=(30,20,20),width=k(9))
    else: d.arc([cx-k(45),my-k(30),cx+k(45),my+k(30)],20,160,fill=(30,20,20),width=k(8))

def flowers(d,x,y):
    for i,(dx,dy) in enumerate([(-50,-40),(0,-80),(50,-40),(-20,-110),(30,-120)]):
        d.line([x,y+60,x+dx,y+dy],fill=(40,140,60),width=8)
        c=[(240,60,90),(255,120,160),(250,200,60)][i%3]
        d.ellipse([x+dx-30,y+dy-30,x+dx+30,y+dy+30],fill=c,outline=(120,30,50),width=4)

def bubble(d,text,y,tail_x,size=58,bg="white",fg=(30,20,20)):
    f=F(size); lines=text.split("\n")
    w=max(d.textlength(l,font=f) for l in lines)+90; h=len(lines)*(size+16)+60
    x0=(W-w)/2
    d.polygon([(tail_x-30,y+h-10),(tail_x+30,y+h-10),(tail_x,y+h+70)],fill=bg,outline=(30,20,20))
    d.rounded_rectangle([x0,y,x0+w,y+h],40,fill=bg,outline=(30,20,20),width=7)
    d.rectangle([tail_x-24,y+h-12,tail_x+24,y+h-2],fill=bg)
    for i,l in enumerate(lines): d.text((W/2,y+40+i*(size+16)+size/2),l,font=f,fill=fg,anchor="mm")

def caption(d,text,y=1700,size=56):
    f=F(size)
    for i,l in enumerate(text.split("\n")):
        d.text((W/2,y+i*(size+14)),l,font=f,fill="white",anchor="mm",stroke_width=8,stroke_fill="black")

def zoom(img,z,cx=W/2,cy=H/2,shake=0,t=0):
    if z<=1.001 and not shake: return img
    w,h=W/z,H/z; ox=math.sin(t*90)*shake; oy=math.cos(t*70)*shake
    x0=min(max(cx-w/2+ox,0),W-w); y0=min(max(cy-h/2+oy,0),H-h)
    return img.crop((int(x0),int(y0),int(x0+w),int(y0+h))).resize((W,H))

def lines_bg(d,c1,c2,t):
    d.rectangle([0,0,W,H],fill=c1)
    for i in range(36):
        a=i*math.pi/18+t*0.4
        d.polygon([(W/2,H/2),(W/2+3000*math.cos(a),H/2+3000*math.sin(a)),(W/2+3000*math.cos(a+0.08),H/2+3000*math.sin(a+0.08))],fill=c2)

LUCIA=dict(hair=(110,50,30),shirt=(230,80,120),female=True)
MATEO=dict(hair=(40,30,30),shirt=(60,110,200),female=False)
def s_title(t,lt):
    im=Image.new("RGB",(W,H)); d=ImageDraw.Draw(im); lines_bg(d,(120,20,50),(160,30,70),t)
    p=ease(min(lt/0.8,1)); fs=int(150*(0.5+0.5*p))
    d.text((W/2,780),"AMOR",font=F(fs),fill=(255,220,100),anchor="mm",stroke_width=10,stroke_fill=(60,0,20))
    d.text((W/2,960),"DE PAPEL",font=F(int(fs*0.8)),fill="white",anchor="mm",stroke_width=10,stroke_fill=(60,0,20))
    if lt>1.0: d.text((W/2,1150),"Capítulo 1",font=F(70),fill=(255,200,210),anchor="mm")
    for i in range(5):
        x=200+i*170; y=1450+20*math.sin(t*3+i)
        d.text((x,y),"♥",font=F(90),fill=(255,90,130),anchor="mm")
    return im
def s_intro(t,lt):
    im=Image.new("RGB",(W,H)); d=ImageDraw.Draw(im); bg_cafe(d)
    person(d,540,700,1.35,blink=(lt%2.5)<0.12,**LUCIA)
    caption(d,"Lucía esperaba a Mateo\ncada tarde en el café...")
    return zoom(im,1+0.08*lt/5,540,900)
def s_enter(t,lt):
    im=Image.new("RGB",(W,H)); d=ImageDraw.Draw(im); bg_cafe(d)
    x=int(1400-ease(min(lt/1.2,1))*600)
    person(d,330,760,1.0,mood="normal",**LUCIA)
    person(d,x,720,1.05,mood="serious",**MATEO); flowers(d,x-150,1200)
    if lt>1.4: bubble(d,"Lucía... tengo que\ndecirte algo.",180,x-80)
    return im
def s_lucia(t,lt):
    im=Image.new("RGB",(W,H)); d=ImageDraw.Draw(im); bg_cafe(d)
    person(d,540,820,1.6,mood="normal",blink=(lt%2)<0.12,**LUCIA)
    if lt>0.3: bubble(d,"¿Qué pasa, Mateo?\n¿Por fin me vas a...?",130,540)
    caption(d,"(su corazón latía a mil)",1780,46)
    return zoom(im,1+0.05*math.sin(lt*8)*min(lt,1)*0.4,540,900)
def s_reveal(t,lt):
    im=Image.new("RGB",(W,H)); d=ImageDraw.Draw(im)
    lines_bg(d,(30,30,60),(60,50,110),t)
    person(d,540,800,1.6,mood="serious",**MATEO)
    if lt>0.6: bubble(d,"¡Lucía... yo soy\ntu HERMANO perdido!",120,540,62)
    z=1+0.25*ease(min(lt/3,1))
    im=zoom(im,z,540,900)
    if 0.6<lt<0.75:
        im=Image.blend(im,Image.new("RGB",(W,H),"white"),0.7)
    return im
def s_shock(t,lt):
    im=Image.new("RGB",(W,H)); d=ImageDraw.Draw(im)
    lines_bg(d,(200,20,40),(250,90,40),t*3)
    person(d,540,820,1.6,mood="shock",**LUCIA)
    d.text((W/2,300),"¡¿QUÉ?!",font=F(190),fill=(255,240,90),anchor="mm",stroke_width=14,stroke_fill="black")
    return zoom(im,1.15,540,850,shake=18*max(0,1-lt/2),t=t)
def s_end(t,lt):
    im=Image.new("RGB",(W,H)); d=ImageDraw.Draw(im); lines_bg(d,(120,20,50),(160,30,70),t)
    d.text((W/2,700),"¿Será verdad?",font=F(100),fill="white",anchor="mm",stroke_width=10,stroke_fill=(60,0,20))
    d.text((W/2,880),"¿Y el beso...?",font=F(90),fill=(255,220,100),anchor="mm",stroke_width=10,stroke_fill=(60,0,20))
    s=1+0.06*math.sin(lt*6)
    d.rounded_rectangle([W/2-380*s,1150-90*s,W/2+380*s,1150+90*s],60,fill=(255,40,60))
    d.text((W/2,1150),"Parte 2 ▶ Sígueme",font=F(int(66*s)),fill="white",anchor="mm")
    d.text((W/2,1500),"♥ Comenta quién miente ♥",font=F(52),fill=(255,200,210),anchor="mm")
    return im

SC=[(s_title,3),(s_intro,5),(s_enter,5),(s_lucia,4),(s_reveal,5),(s_shock,3.5),(s_end,4.5)]
total=sum(s for _,s in SC)

# --- música: telenovela dramática sintetizada ---
SR=44100; n=int(total*SR); tt=np.arange(n)/SR; audio=np.zeros(n)
def note(f,st,du,vol=0.2,kind="pad"):
    a=int(st*SR); b=min(n,int((st+du)*SR)); x=tt[a:b]-st
    env=np.minimum(1,x/0.08)*np.exp(-x*(0.6 if kind=="pad" else 4))
    w=np.sin(2*np.pi*f*x)+0.5*np.sin(4*np.pi*f*x)+0.25*np.sin(6*np.pi*f*x)
    audio[a:b]+=vol*env*w
m=lambda k:440*2**((k-69)/12)
chords={"Am":[57,60,64],"F":[53,57,60],"C":[48,55,60],"E":[52,56,59],"Dm":[50,53,57]}
prog=["Am","F","C","E"]*6
starts=[0,3,8,13,17,22,25.5]
for i,c in enumerate(prog):
    st=i*2.0
    if st>=total: break
    tense = 17<=st<25.5
    for k in chords["Dm" if tense and i%2 else c]: note(m(k),st,2.2,0.07)
    for j in range(4): note(m(chords[c][j%3]+12),st+j*0.5,0.5,0.06,"pluck")
# golpes dramáticos
for s in (17.6,22,22.3):
    a=int(s*SR); x=tt[a:a+SR]-s; audio[a:a+SR]+=0.6*np.sin(2*np.pi*55*x)*np.exp(-x*3)
    audio[a:a+SR]+=0.15*np.random.randn(len(x))*np.exp(-x*8)
audio=audio/np.max(np.abs(audio))*0.85
with wave.open(SP+"/m.wav","wb") as w:
    w.setnchannels(1);w.setsampwidth(2);w.setframerate(SR);w.writeframes((audio*32767).astype(np.int16).tobytes())

p=subprocess.Popen(["ffmpeg","-y","-loglevel","error","-f","rawvideo","-pix_fmt","rgb24","-s",f"{W}x{H}","-r",str(FPS),"-i","-","-i",SP+"/m.wav",
  "-c:v","libx264","-pix_fmt","yuv420p","-crf","20","-c:a","aac","-b:a","160k","-shortest","-movflags","+faststart",OUT],stdin=subprocess.PIPE)
fr=0; acc=0
for fn,dur in SC:
    for i in range(int(dur*FPS)):
        lt=i/FPS; im=fn(acc+lt,lt)
        if lt<0.2: im=Image.blend(Image.new("RGB",(W,H)),im,lt/0.2)
        p.stdin.write(im.tobytes())
    acc+=dur
p.stdin.close(); p.wait(); print("ok",total)
