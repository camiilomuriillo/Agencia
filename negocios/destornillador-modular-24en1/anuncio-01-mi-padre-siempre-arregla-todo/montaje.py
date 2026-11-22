#!/usr/bin/env python3
"""Montaje del anuncio 01 «Mi padre siempre arregla todo» (30 s, 9:16).

Usa los clips de Higgsfield de clips/ y la tarjeta final de fotogramas/.
Recorta cada clip, los une con cortes secos, quema los subtítulos (ASS)
y los rótulos y exporta a 1080x1920, 30 fps y H.264.

Uso: python3 montaje.py
"""
import json
import pathlib
import subprocess

AQUI = pathlib.Path(__file__).resolve().parent
CLIPS = AQUI / "clips"
SALIDA = AQUI / "salida"
SALIDA.mkdir(exist_ok=True)
TMP = SALIDA / "tmp"
TMP.mkdir(exist_ok=True)

PLAN = json.loads((AQUI / "plan_montaje.json").read_text())
W, H, FPS = 1080, 1920, 30


def run(cmd):
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def tramo(i, p):
    out = TMP / f"t{i:02d}.mp4"
    vf = (f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},"
          f"fps={FPS},setsar=1")
    if p.get("imagen"):
        # Tarjeta final: imagen fija con un zoom lento, como una foto del móvil.
        d = p["dur"]
        vf = (f"scale={W*2}:-1,zoompan=z='min(zoom+0.0007,1.06)':d={int(d*FPS)}:"
              f"x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s={W}x{H}:fps={FPS},setsar=1")
        run(["ffmpeg", "-y", "-loop", "1", "-i", str(AQUI / p["imagen"]),
             "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo",
             "-t", str(d), "-vf", vf, "-c:v", "libx264", "-preset", "medium", "-crf", "17",
             "-c:a", "aac", "-ar", "48000", "-ac", "2", "-shortest", str(out)])
        return out
    af = f"volume={p.get('vol', 1.0)},afade=t=in:d=0.04,afade=t=out:st={p['dur']-0.06}:d=0.06"
    run(["ffmpeg", "-y", "-ss", str(p["ini"]), "-i", str(CLIPS / p["clip"]), "-t", str(p["dur"]),
         "-vf", vf, "-af", af, "-c:v", "libx264", "-preset", "medium", "-crf", "17",
         "-c:a", "aac", "-ar", "48000", "-ac", "2", str(out)])
    return out


def main():
    tramos = [tramo(i, p) for i, p in enumerate(PLAN["tramos"])]
    lista = TMP / "lista.txt"
    lista.write_text("".join(f"file '{t}'\n" for t in tramos))
    unido = TMP / "unido.mp4"
    run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(lista), "-c", "copy", str(unido)])

    ass = AQUI / "subtitulos.ass"
    final = SALIDA / "mi-padre-siempre-arregla-todo_30s_9x16.mp4"
    run(["ffmpeg", "-y", "-i", str(unido),
         "-vf", f"ass={ass}:fontsdir=/usr/share/fonts/opentype/inter",
         "-af", "loudnorm=I=-14:TP=-1.5:LRA=11",
         "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p",
         "-r", str(FPS), "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
         "-movflags", "+faststart", str(final)])
    limpio = SALIDA / "mi-padre-siempre-arregla-todo_30s_9x16_sin-textos.mp4"
    run(["ffmpeg", "-y", "-i", str(unido), "-af", "loudnorm=I=-14:TP=-1.5:LRA=11",
         "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p",
         "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(limpio)])
    print(final)
    print(limpio)


if __name__ == "__main__":
    main()
