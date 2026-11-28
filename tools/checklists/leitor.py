"""Protótipo do leitor (OMR) da folha escaneada: acha as 4 marcas, corrige a perspectiva e mede quanto cada bolinha está pintada."""
import cv2, numpy as np, json, sys
def ler(img, lay, dpm=8.0):
    g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if img.ndim == 3 else img
    th = cv2.threshold(cv2.GaussianBlur(g, (5, 5), 0), 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)[1]
    cs, _ = cv2.findContours(th, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    hh, ww = g.shape; esc = ww / lay['pagina'][0]; alvo = (lay['marca_mm'] * esc) ** 2
    cand = []
    for c in cs:
        x, y, w, h = cv2.boundingRect(c); a = cv2.contourArea(c)
        if 0.7 * alvo < a < 1.45 * alvo and 0.75 < w / max(h, 1) < 1.33 and a / (w * h) > 0.75: cand.append((x + w / 2, y + h / 2))
    if len(cand) < 4: raise ValueError('marcas não encontradas: %d' % len(cand))
    cand = np.array(cand); cantos = [(0, 0), (ww, 0), (0, hh), (ww, hh)]
    src = np.array([cand[np.argmin(((cand - np.array(k)) ** 2).sum(1))] for k in cantos], dtype=np.float32)
    m = lay['marca_mm'] / 2; dst = np.array([[(x + m) * dpm, (y + m) * dpm] for x, y in lay['marcas']], dtype=np.float32)
    M = cv2.getPerspectiveTransform(src, dst); W, H = [int(v * dpm) for v in lay['pagina']]
    n = cv2.warpPerspective(g, M, (W, H), borderValue=255)
    r = lay['raio'] * dpm * 0.7; yy, xx = np.ogrid[-int(r) - 1:int(r) + 2, -int(r) - 1:int(r) + 2]; mask = (xx ** 2 + yy ** 2) <= r * r
    def tinta(cx, cy):
        x, y = int(round(cx * dpm)), int(round(cy * dpm)); p = n[y - int(r) - 1:y + int(r) + 2, x - int(r) - 1:x + int(r) + 2]
        return float((p[mask] < 140).mean())
    res = {}
    for b in lay['bolhas']: res.setdefault((b['item'], b['dia']), {})[b['op']] = tinta(b['x'], b['y'])
    out = {}
    for k, v in res.items():
        best = max(v, key=v.get); ord_ = sorted(v.values(), reverse=True)
        if ord_[0] < 0.35: continue                        # dia/item em branco
        out[k] = best if ord_[1] < 0.35 else 'DUVIDA'        # duas pintadas = conferir
    uni = {c['v']: tinta(c['x'], c['y']) for c in lay['campos']['unidade']}
    rub = []
    for c in lay['campos']['rubrica']:
        x0, y0 = int((c['x'] + 1) * dpm), int((c['y'] + 1) * dpm); p = n[y0:y0 + int((c['h'] - 2) * dpm), x0:x0 + int((c['w'] - 2) * dpm)]
        rub.append(float((p < 140).mean()) > 0.01)
    return out, {k: v > 0.35 for k, v in uni.items()}, rub
