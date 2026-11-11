"""Montaje del capítulo 1 de «La Heredera Falsa».

Uso: python3 montaje.py <carpeta_temporal>
Lee clips/escenaNN.mp4 y voces/rec/lineaNN.wav, y genera capitulo01.mp4 (1080x1920).
"""
import json, math, os, subprocess, sys, wave
import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
TMP = sys.argv[1]
os.makedirs(TMP, exist_ok=True)
W, H, FPS, SR = 1080, 1920, 30, 44100
FONT = "/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf"
TEMPO = 1.06  # voces algo más ágiles

def run(*a):
    subprocess.run(a, check=True)

def dur(p):
    return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", p]))

# (texto, hablante) por línea de voz
LINES = [
    ("Esa mujer me echó como a un perro… sin saber quién era yo.", "V"),
    ("Tres días antes, Valeria solo era una camarera más… o eso creía.", "N"),
    ("¡Ay! ¡Lo siento muchísimo!", "V"),
    ("Tranquila… era un traje horrible.", "D"),
    ("Ese colgante… ¿de dónde lo has sacado?", "D"),
    ("Era de mi madre. ¿Por qué?", "V"),
    ("Mi padre lleva veinte años buscando la otra mitad. Ven a casa esta noche.", "D"),
    ("Valeria no sabía que esa puerta iba a cambiarle la vida.", "N"),
    ("¿Tú? Las camareras entran por la puerta de servicio, querida.", "E"),
    ("Y por primera vez en veinte años… Doña Elvira tuvo miedo.", "N"),
    ("Aquí no hay sitio para ti. Lárgate.", "E"),
    ("¿Por qué Elvira teme a una simple camarera?", "N"),
]
COLORS = {"V": (255, 182, 206), "D": (150, 210, 255), "E": (255, 95, 95), "N": (255, 236, 160)}

# escena -> [(línea, pausa antes)]
SCENES = [
    (1, [(0, 0.2)]), (2, [(1, 0.2)]), (3, [(2, 0.4), (3, 0.25)]), (4, [(4, 0.6), (5, 0.3)]),
    (5, [(6, 0.2)]), (6, [(7, 0.7)]), (7, [(8, 0.5)]), (8, [(9, 0.3)]), (9, [(10, 0.2)]),
    (10, [(11, 0.2)]),
]

# 1) voces aceleradas
vlen = {}
for i in range(len(LINES)):
    out = f"{TMP}/v{i:02d}.wav"
    run("ffmpeg", "-loglevel", "error", "-y", "-i", f"{HERE}/voces/linea{i:02d}.wav",
        "-af", f"silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,atempo={TEMPO}", "-ar", str(SR), "-ac", "1", out)
    vlen[i] = dur(out)

# 2) línea de tiempo
timeline, cues, t = [], [], 0.0
for sc, lines in SCENES:
    clip = f"{HERE}/clips/escena{sc:02d}.mp4"
    cl = dur(clip)
    local = 0.0
    for li, gap in lines:
        local += gap
        cues.append((li, t + local, t + local + vlen[li]))
        local += vlen[li]
    end_pad = 2.6 if sc == 10 else 0.45
    d = max(local + end_pad, 3.2)
    timeline.append((sc, clip, cl, t, d))
    t += d
TOTAL = t
print("duración total", round(TOTAL, 2))

# 3) normalizar cada clip a su duración (estirar suave o congelar el último fotograma)
parts = []
for sc, clip, cl, start, d in timeline:
    out = f"{TMP}/s{sc:02d}.mp4"
    factor = min(d / cl, 1.35)
    hold = max(0.0, d - cl * factor)
    vf = (f"setpts={factor:.4f}*PTS,fps={FPS},scale={W}:{H}:force_original_aspect_ratio=increase,"
          f"crop={W}:{H},tpad=stop_mode=clone:stop_duration={hold + 0.1:.3f},trim=duration={d:.3f},setpts=PTS-STARTPTS")
    run("ffmpeg", "-loglevel", "error", "-y", "-i", clip, "-an", "-vf", vf,
        "-c:v", "libx264", "-crf", "16", "-preset", "veryfast", "-pix_fmt", "yuv420p", out)
    parts.append(out)
with open(f"{TMP}/lista.txt", "w") as f:
    f.writelines(f"file '{p}'\n" for p in parts)
run("ffmpeg", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", f"{TMP}/lista.txt", "-c", "copy", f"{TMP}/base.mp4")

# 4) rótulos como PNG transparentes
def font(s):
    return ImageFont.truetype(FONT, s)

def wrap(d, text, f, maxw):
    words, lines, cur = text.split(), [], ""
    for w in words:
        test = (cur + " " + w).strip()
        if d.textlength(test, font=f) <= maxw:
            cur = test
        else:
            lines.append(cur); cur = w
    lines.append(cur)
    return lines

def caption_png(path, text, color, italic=False):
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    f = font(64)
    lines = wrap(d, text, f, W - 160)
    y = 1430 - (len(lines) - 1) * 40
    for i, l in enumerate(lines):
        d.text((W / 2, y + i * 82), l, font=f, fill=color, anchor="mm", stroke_width=9, stroke_fill=(0, 0, 0))
    im.save(path)

overlays = []  # (png, inicio, fin)
for k, (li, a, b) in enumerate(cues):
    text, sp = LINES[li]
    p = f"{TMP}/cap{k:02d}.png"
    caption_png(p, text, COLORS[sp])
    overlays.append((p, a, b + 0.15))

# gancho de los primeros segundos
im = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
d.rounded_rectangle([60, 150, W - 60, 470], 40, fill=(0, 0, 0, 150))
d.text((W / 2, 235), "La echaron de la mansión…", font=font(66), fill="white", anchor="mm")
d.text((W / 2, 320), "sin saber que era la", font=font(66), fill="white", anchor="mm")
d.text((W / 2, 410), "HEREDERA", font=font(92), fill=(255, 210, 60), anchor="mm", stroke_width=4, stroke_fill=(90, 50, 0))
im.save(f"{TMP}/gancho.png"); overlays.append((f"{TMP}/gancho.png", 0.0, 3.6))

# cartel final
fin_start = TOTAL - 2.6
im = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
d.text((W / 2, 330), "CONTINUARÁ…", font=font(120), fill=(255, 210, 60), anchor="mm", stroke_width=10, stroke_fill=(0, 0, 0))
d.text((W / 2, 470), "LA HEREDERA FALSA · Cap. 1", font=font(52), fill="white", anchor="mm", stroke_width=6, stroke_fill=(0, 0, 0))
d.rounded_rectangle([W / 2 - 330, 1560, W / 2 + 330, 1690], 65, fill=(230, 30, 60))
d.text((W / 2, 1625), "Sígueme para la Parte 2", font=font(50), fill="white", anchor="mm")
im.save(f"{TMP}/fin.png"); overlays.append((f"{TMP}/fin.png", fin_start, TOTAL + 1))

# 5) audio: música sintetizada + efectos + voces
n = int((TOTAL + 0.5) * SR); tt = np.arange(n) / SR
music = np.zeros(n); sfx = np.zeros(n)
def note(f, st, du, vol, decay):
    a = int(st * SR); b = min(n, int((st + du) * SR)); x = tt[a:b] - st
    env = np.minimum(1, x / 0.15) * np.exp(-x * decay) * np.minimum(1, (du - x) / 0.2 + 0.001).clip(0, 1)
    w = np.sin(2 * np.pi * f * x) + 0.4 * np.sin(4 * np.pi * f * x) + 0.15 * np.sin(6 * np.pi * f * x)
    music[a:b] += vol * env * w
m = lambda k: 440 * 2 ** ((k - 69) / 12)
CH = {"Am": [45, 57, 60, 64], "F": [41, 57, 60, 65], "C": [36, 55, 60, 64], "E": [40, 56, 59, 64], "Dm": [38, 53, 57, 62]}
prog = ["Am", "F", "C", "E", "Am", "Dm", "F", "E"]
t0 = 0.0; i = 0
while t0 < TOTAL:
    c = prog[i % len(prog)]
    for k in CH[c]: note(m(k), t0, 3.2, 0.05, 0.35)
    arp = CH[c][1:] + [CH[c][2] + 12]
    for j in range(8): note(m(arp[j % 4] + 12), t0 + j * 0.375, 0.6, 0.025, 3.5)
    t0 += 3.0; i += 1
def boom(st, vol=0.7):
    a = int(st * SR); b = min(n, a + int(1.6 * SR)); x = tt[a:b] - st
    sfx[a:b] += vol * np.sin(2 * np.pi * (60 - 20 * x) * x) * np.exp(-x * 2.5)
rng = np.random.default_rng(1)
def noise_burst(st, du, vol, hp=True):
    a = int(st * SR); b = min(n, a + int(du * SR)); x = tt[a:b] - st
    z = rng.standard_normal(b - a)
    if hp: z = np.diff(np.concatenate([[0], z]))
    sfx[a:b] += vol * z * np.exp(-x * 6)
def rain(st, du, vol):
    a = int(st * SR); b = min(n, a + int(du * SR))
    z = rng.standard_normal(b - a); z = np.convolve(z, np.ones(6) / 6, "same")
    env = np.minimum(1, np.minimum((tt[a:b] - st) / 0.5, (st + du - tt[a:b]) / 0.5))
    sfx[a:b] += vol * z * env
start = {sc: s for sc, _, _, s, _ in timeline}
length = {sc: d for sc, _, _, _, d in timeline}
rain(0, length[1], 0.05); rain(start[10], length[10], 0.05)
boom(start[4] + 0.5, 0.5)          # descubre el colgante
boom(start[8], 0.8); noise_burst(start[8] + 0.05, 1.2, 0.35)  # copa rota
boom(start[9] + length[9] - 1.0, 0.9)  # portazo
boom(start[10], 0.4)
voice = np.zeros(n)
for li, a, b in cues:
    with wave.open(f"{TMP}/v{li:02d}.wav") as w:
        v = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16) / 32768
    s = int(a * SR); voice[s:s + len(v)] += v[: n - s]
# atenuar música bajo la voz
duck = np.convolve((np.abs(voice) > 0.02).astype(float), np.ones(int(0.3 * SR)) / int(0.3 * SR), "same")
duck = 1 - 0.55 * np.clip(duck * 3, 0, 1)
mix = music / (np.abs(music).max() + 1e-9) * 0.30 * duck + sfx + voice * 1.0
fade = np.minimum(1, (TOTAL + 0.5 - tt) / 1.0).clip(0, 1); mix *= fade
mix = mix / max(1.0, np.abs(mix).max() / 0.95)
with wave.open(f"{TMP}/mezcla.wav", "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((mix * 32767).astype(np.int16).tobytes())

# 6) render final
args = ["ffmpeg", "-loglevel", "error", "-y", "-i", f"{TMP}/base.mp4"]
for p, _, _ in overlays: args += ["-i", p]
args += ["-i", f"{TMP}/mezcla.wav"]
fc, last = [], "0:v"
for k, (_, a, b) in enumerate(overlays):
    fc.append(f"[{last}][{k + 1}:v]overlay=0:0:enable='between(t,{a:.2f},{b:.2f})'[o{k}]"); last = f"o{k}"
fc.append(f"[{last}]fade=t=out:st={TOTAL - 0.6:.2f}:d=0.6[vout]")
args += ["-filter_complex", ";".join(fc), "-map", "[vout]", "-map", f"{len(overlays) + 1}:a",
         "-c:v", "libx264", "-crf", "19", "-preset", "medium", "-pix_fmt", "yuv420p", "-r", str(FPS),
         "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", f"{HERE}/capitulo01.mp4"]
run(*args)
json.dump({"total": TOTAL, "cues": cues}, open(f"{TMP}/timeline.json", "w"), indent=1)
print("ok")
