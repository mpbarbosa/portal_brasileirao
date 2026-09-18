#!/usr/bin/env python3
"""Mede se um mp4 passa do limite de flashes para fotossensibilidade.

    python3 scripts/manim/check-flashes.py docs/medias/flamengo/barras-flamengo.mp4

A regra é a do WCAG 2.3.1 / ITU-R BT.1702 (limite geral de flash): um **flash**
é um par de variações opostas de luminância relativa, cada uma de pelo menos
10% do máximo, com o lado escuro abaixo de 0,8; e o vídeo não pode ter **mais de
três flashes por segundo** em mais de **25% de um campo visual de 10°**. O campo
de 10° é o retângulo de 341×256 que o WCAG usa numa tela de 1024×768, escalado
para a proporção do quadro.

**É uma aproximação e não uma análise certificada** (PEAT, Harding). Serve para
comparar dois renders da mesma cena e para pegar um desenho que estoura por
muito — que é o que aconteceu com a corrida de barras (ver `BEAT_S` em
`barras.py`). Não serve para declarar um vídeo seguro para transmissão.

O vermelho saturado (R / (R+G+B) ≥ 0,8) é reportado à parte, porque a paleta
destas cenas não chega nele e um tom novo que chegasse mudaria a leitura.

Sai **1** quando reprova e **0** quando passa. Lê o vídeo em fluxo e mantém só
um segundo de contagens na memória: a primeira versão carregava o vídeo inteiro
em float e três análises em paralelo derrubaram a sessão por falta de memória.
Precisa só de python3 com numpy e do ffmpeg — não do virtualenv do Manim.
"""

from __future__ import annotations

import json
import subprocess
import sys

import numpy as np

LIMIT = 0.25            # fração do campo de 10° com mais de 3 flashes/s
MAX_FLASHES = 3
DELTA = 0.10            # variação mínima de luminância relativa
DARK_CEILING = 0.80     # o lado escuro do par tem de estar abaixo disto
LONG_SIDE = 480         # análise reduzida: 1 px aqui = 4 px de um 1080p


def probe(path: str) -> tuple[int, int, float]:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0",
         "-show_entries", "stream=width,height,r_frame_rate", "-of", "json", path],
        capture_output=True, check=True, text=True,
    ).stdout
    stream = json.loads(out)["streams"][0]
    num, den = stream["r_frame_rate"].split("/")
    return int(stream["width"]), int(stream["height"]), int(num) / int(den)


def main(path: str) -> int:
    width, height, fps = probe(path)
    scale = LONG_SIDE / max(width, height)
    w, h = round(width * scale / 2) * 2, round(height * scale / 2) * 2
    per_second = max(1, round(fps))

    # O campo de 10°: 341×256 em 1024×768, na mesma fração do quadro. Num
    # quadro em pé os lados trocam, porque o campo é o do olho e não o da tela.
    if w >= h:
        box_w, box_h = round(w * 341 / 1024), round(h * 256 / 768)
    else:
        box_w, box_h = round(w * 256 / 768), round(h * 341 / 1024)

    proc = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-i", path, "-vf", f"scale={w}:{h}:flags=area",
         "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
        stdout=subprocess.PIPE,
    )
    frame_bytes = w * h * 3

    ring = np.zeros((per_second, h, w), np.uint8)   # transições por quadro, 1 s
    window = np.zeros((h, w), np.uint16)
    ref = direction = None
    worst, worst_at, worst_pixel, red_worst = 0.0, 0.0, 0, 0.0
    index = 0

    while True:
        buffer = proc.stdout.read(frame_bytes)
        if len(buffer) < frame_bytes:
            break
        rgb = np.frombuffer(buffer, np.uint8).reshape(h, w, 3).astype(np.float32) / 255
        red_worst = max(red_worst, float((rgb[..., 0] / (rgb.sum(-1) + 1e-6) >= 0.8).mean()))
        linear = np.where(rgb <= 0.04045, rgb / 12.92, ((rgb + 0.055) / 1.055) ** 2.4)
        lum = linear @ np.array([0.2126, 0.7152, 0.0722], np.float32)

        if ref is None:
            ref, direction = lum.copy(), np.zeros((h, w), np.int8)
            transitions = np.zeros((h, w), np.uint8)
        else:
            # `ref` é o extremo desde a última virada: uma rampa lenta que soma
            # 10% conta uma vez, e não uma vez por quadro.
            darker_ok = np.minimum(lum, ref) < DARK_CEILING
            up = (lum - ref >= DELTA) & darker_ok
            down = (ref - lum >= DELTA) & darker_ok
            event = (up & (direction != 1)) | (down & (direction != -1))
            transitions = event.astype(np.uint8)
            direction = np.where(up, 1, np.where(down, -1, direction)).astype(np.int8)
            ref = np.where(
                up | down, lum,
                np.where(direction == 1, np.maximum(ref, lum),
                         np.where(direction == -1, np.minimum(ref, lum), ref)),
            )

        slot = index % per_second
        window -= ring[slot]
        ring[slot] = transitions
        window += transitions
        index += 1

        if index >= per_second:
            flashes = window // 2
            worst_pixel = max(worst_pixel, int(flashes.max()))
            hot = (flashes > MAX_FLASHES).astype(np.float32)
            if hot.any():
                integral = np.pad(hot.cumsum(0).cumsum(1), ((1, 0), (1, 0)))
                sums = (integral[box_h:, box_w:] - integral[:-box_h, box_w:]
                        - integral[box_h:, :-box_w] + integral[:-box_h, :-box_w])
                coverage = float(sums.max()) / (box_w * box_h)
                if coverage > worst:
                    worst, worst_at = coverage, index / fps

    proc.wait()
    if index == 0:
        print(f"{path}: nenhum quadro lido", file=sys.stderr)
        return 2

    verdict = "REPROVA" if worst > LIMIT else "passa"
    print(f"{path}")
    print(f"  {width}x{height} @ {fps:g}fps, {index / fps:.1f}s")
    print(f"  pior campo de 10° com >{MAX_FLASHES} flashes/s: {worst:.3f}"
          f" em t={worst_at:.2f}s (limite {LIMIT})  {verdict}")
    print(f"  máximo de flashes/s num ponto: {worst_pixel}")
    print(f"  maior fração de vermelho saturado num quadro: {red_worst:.4f}")
    return 1 if worst > LIMIT else 0


if __name__ == "__main__":
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    sys.exit(max(main(p) for p in sys.argv[1:]))
