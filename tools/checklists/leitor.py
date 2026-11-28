"""Protótipo do leitor (OMR) da folha escaneada: acha as 4 marcas, corrige a perspectiva e mede quanto cada bolinha está pintada."""
import cv2, numpy as np, json, sys
def ler(img, lay, dpm=8.0):
    g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if img.ndim == 3 else img
    hh, ww = g.shape; esc = ww / lay['pagina'][0]; alvo = (lay['marca_mm'] * esc) ** 2
    bs = int(lay['marca_mm'] * esc * 3) | 1
    th = cv2.adaptiveThreshold(cv2.GaussianBlur(g, (5, 5), 0), 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY_INV, bs, 25)
    cs, _ = cv2.findContours(th, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    cand = []
    for c in cs:
        a = cv2.contourArea(c)
        if not (0.6 * alvo < a < 1.6 * alvo): continue
        (cx, cy), (w, h), _ = cv2.minAreaRect(c)
        if 0.75 < w / max(h, 1) < 1.33 and a / max(w * h, 1) > 0.8: cand.append((cx, cy))
    if len(cand) < 4: raise ValueError('marcas não encontradas: %d' % len(cand))
    cand = np.array(cand); cantos = [(0, 0), (ww, 0), (0, hh), (ww, hh)]
    src = np.array([cand[np.argmin(((cand - np.array(k)) ** 2).sum(1))] for k in cantos], dtype=np.float32)
    m = lay['marca_mm'] / 2; dst = np.array([[(x + m) * dpm, (y + m) * dpm] for x, y in lay['marcas']], dtype=np.float32)
    M = cv2.getPerspectiveTransform(src, dst); W, H = [int(v * dpm) for v in lay['pagina']]
    n = cv2.warpPerspective(g, M, (W, H), borderValue=255)
    # corrige sombra/iluminação desigual (foto de celular): divide pelo fundo estimado
    bg = cv2.morphologyEx(n, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_RECT, (25, 25))); bg = cv2.GaussianBlur(bg, (51, 51), 0)
    n = np.clip(n.astype(np.float32) / np.maximum(bg, 1) * 235, 0, 255).astype(np.uint8)
    # interior do quadrado (descarta a borda impressa e o que vaza do vizinho)
    lado = (lay['raio'] - 0.38) * dpm
    lim = min(200, int(np.percentile(n, 60)) - 38)   # limiar de tinta relativo ao papel
    def tinta(cx, cy):
        x, y = cx * dpm, cy * dpm; p = n[int(y - lado):int(y + lado), int(x - lado):int(x + lado)] < lim
        t = float(p.mean())
        if t > 0.6:  # muito escuro: é X grosso ou quadrado pintado (cancelado)? No X, o meio de cada lado fica claro.
            h, w = p.shape; q = max(2, h // 5)
            lados = [p[:q, w // 2 - q // 2:w // 2 + q // 2 + 1], p[-q:, w // 2 - q // 2:w // 2 + q // 2 + 1], p[h // 2 - q // 2:h // 2 + q // 2 + 1, :q], p[h // 2 - q // 2:h // 2 + q // 2 + 1, -q:]]
            if min(float(l.mean()) for l in lados) > 0.6: return 1.0
            return min(t, 0.7)
        return t
    res = {}
    for b in lay['bolhas']: res.setdefault((b['item'], b['dia']), {})[b['op']] = tinta(b['x'], b['y'])
    out = {}
    MIN, CHEIO = 0.07, 0.95   # X: ~15–60% do interior; quadrado todo pintado = marcação cancelada
    for k, v in res.items():
        val = {o: t for o, t in v.items() if MIN <= t < CHEIO}
        cheios = [o for o, t in v.items() if t >= CHEIO]
        if not val and len(cheios) == 1: out[k] = cheios[0]; continue   # X muito grosso (ninguém cancela sem marcar outro)
        if not val: continue                                 # em branco (ou só cancelados)
        o = sorted(val, key=val.get, reverse=True)
        out[k] = o[0] if len(o) == 1 or val[o[1]] < 0.45 * val[o[0]] else 'DUVIDA'
    uni = {c['v']: tinta(c['x'], c['y']) for c in lay['campos']['unidade']}
    rub = []
    for c in lay['campos']['rubrica']:
        x0, y0 = int((c['x'] + 1) * dpm), int((c['y'] + 1) * dpm); p = n[y0:y0 + int((c['h'] - 2) * dpm), x0:x0 + int((c['w'] - 2) * dpm)]
        rub.append(float((p < 140).mean()) > 0.01)
    return out, {k: MIN <= v < CHEIO for k, v in uni.items()}, rub
