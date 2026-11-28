"""Simula folhas preenchidas à mão com X e mede o % de acerto do leitor."""
import cv2, numpy as np, json, subprocess, random, glob, math, sys
from leitor import ler
def caneta(img, p0, p1, w, cor, curva):
    pts = []; 
    for t in np.linspace(0, 1, 12):
        x = p0[0] + (p1[0] - p0[0]) * t; y = p0[1] + (p1[1] - p0[1]) * t
        b = curva * math.sin(math.pi * t); dx, dy = p1[1] - p0[1], -(p1[0] - p0[0]); nn = math.hypot(dx, dy) or 1
        pts.append((int(x + b * dx / nn), int(y + b * dy / nn)))
    cv2.polylines(img, [np.array(pts)], False, cor, max(1, int(w)), cv2.LINE_AA)
def X(img, cx, cy, dpp, tipo):
    lado = 2.8 * dpp; s = lado * random.uniform(0.55, 0.95) / 2
    if tipo == 'grande': s = lado * random.uniform(1.0, 1.35) / 2
    if tipo == 'pequeno': s = lado * random.uniform(0.3, 0.45) / 2
    ox, oy = random.gauss(0, 0.35 * dpp), random.gauss(0, 0.35 * dpp); a = math.radians(random.uniform(-25, 25))
    w = random.uniform(0.28, 0.7) * dpp; cor = (random.randint(90, 160), random.randint(30, 70), random.randint(10, 40)) if random.random() < .6 else (35, 35, 35)
    if tipo == 'fraco': cor = (165, 150, 140); w = 0.28 * dpp
    for ang in (a + math.pi / 4, a - math.pi / 4):
        dx, dy = s * math.cos(ang) * 1.3, s * math.sin(ang) * 1.3
        caneta(img, (cx + ox - dx, cy + oy - dy), (cx + ox + dx, cy + oy + dy), w, cor, random.uniform(-0.08, 0.08))
def folha(form, seed, dpi=200):
    random.seed(seed); np.random.seed(seed)
    pdf = glob.glob('/home/claude/chk/omr/%s*.pdf' % form)[0]; lay = json.load(open('/home/claude/chk/omr/layout/%s.json' % form))
    subprocess.run(['pdftoppm', '-r', str(dpi), '-png', pdf, '/tmp/xt'], check=True); img = cv2.imread('/tmp/xt-1.png'); dpp = img.shape[1] / 210
    verdade = {}; dias_uso = random.sample(range(7), random.randint(4, 6)); tipos = {}
    for b in lay['bolhas']:
        k = (b['item'], b['dia'])
        if b['dia'] in dias_uso and k not in verdade:
            verdade[k] = random.choices(['C', 'NC', 'NA'], [0.82, 0.1, 0.08])[0]
            tipos[k] = random.choices(['normal', 'grande', 'pequeno', 'fraco', 'corrigido'], [0.86, 0.05, 0.03, 0.03, 0.03])[0]
    for b in lay['bolhas']:
        k = (b['item'], b['dia']); cx, cy = b['x'] * dpp, b['y'] * dpp
        if verdade.get(k) == b['op']: X(img, cx, cy, dpp, tipos[k] if tipos[k] != 'corrigido' else 'normal')
        elif tipos.get(k) == 'corrigido' and b['op'] == [o for o in ('C', 'NC', 'NA') if o != verdade[k]][0]:
            h = 1.4 * dpp; cv2.rectangle(img, (int(cx - h), int(cy - h)), (int(cx + h), int(cy + h)), (40, 40, 40), -1)  # errou: pintou o quadrado todo
    h, w = img.shape[:2]; M = cv2.getRotationMatrix2D((w / 2, h / 2), random.uniform(-2.5, 2.5), random.uniform(0.95, 1.02)); M[:, 2] += (random.uniform(-12, 12), random.uniform(-12, 12))
    sc = cv2.warpAffine(img, M, (w, h), borderValue=(230, 230, 230)); sc = cv2.GaussianBlur(sc, (3, 3), 0)
    import os
    if os.environ.get('FOTO'):  # foto de celular: perspectiva, sombra e foco pior
        d = lambda: random.uniform(-35, 35); src = np.float32([[0, 0], [w, 0], [0, h], [w, h]]); dst = np.float32([[d() + 20, d() + 20], [w - 20 + d(), d() + 20], [d() + 20, h - 20 + d()], [w - 20 + d(), h - 20 + d()]])
        sc = cv2.warpPerspective(sc, cv2.getPerspectiveTransform(src, dst), (w, h), borderValue=(90, 90, 90))
        gx = np.linspace(random.uniform(0.7, 0.85), 1.0, w)[None, :, None]; gy = np.linspace(1.0, random.uniform(0.75, 0.9), h)[:, None, None]
        sc = (sc * gx * gy).astype(np.uint8); sc = cv2.GaussianBlur(sc, (5, 5), 0)
    sc = np.clip(sc.astype(int) + np.random.normal(0, 8, sc.shape).astype(int) - random.randint(0, 25), 0, 255).astype(np.uint8)
    ok, enc = cv2.imencode('.jpg', sc, [cv2.IMWRITE_JPEG_QUALITY, random.randint(55, 85)]); sc = cv2.imdecode(enc, 1)
    if seed == 1: cv2.imwrite('/tmp/x_exemplo.jpg', sc)
    out, uni, rub = ler(sc, lay)
    r = {'total': len(verdade), 'certo': 0, 'duvida': 0, 'errado': 0, 'nao_lido': 0, 'falso': 0}; det = {}
    for k, v in verdade.items():
        o = out.get(k); t = 'certo' if o == v else 'duvida' if o == 'DUVIDA' else 'nao_lido' if o is None else 'errado'; r[t] += 1
        det.setdefault(tipos[k], {}).setdefault(t, 0); det[tipos[k]][t] += 1
    r['falso'] = sum(1 for k in out if k not in verdade); return r, det
if __name__ == '__main__':
    T = {}; D = {}
    forms = ['FOR-SST-103', 'FOR-SST-101', 'FOR-SST-114', 'FOR-SST-117', 'FOR-SST-126']
    for i in range(int(sys.argv[1]) if len(sys.argv) > 1 else 15):
        r, det = folha(forms[i % len(forms)], i + 1)
        for k, v in r.items(): T[k] = T.get(k, 0) + v
        for t, x in det.items():
            for k, v in x.items(): D.setdefault(t, {}).setdefault(k, 0); D[t][k] += v
    print(T); print({k: round(v / T['total'] * 100, 2) for k, v in T.items() if k != 'total'}); print(D)
