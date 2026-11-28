"""Checklists semanais (1 folha A4 retrato por semana) preparados para leitura automática (OMR):
4 marcas pretas nos cantos, bolinhas C / NC / NA por dia, QR com código e revisão do formulário.
Gera o PDF de cada checklist e o layout (posição de cada bolinha, em mm) para o leitor do portal."""
import sys, os, json, io
sys.path.insert(0, '/home/claude/chk')
from dados import CL
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader
from reportlab.lib.colors import HexColor, black, white
import qrcode
LIB = '/usr/share/fonts/truetype/liberation/'
pdfmetrics.registerFont(TTFont('A', LIB + 'LiberationSans-Regular.ttf'))
pdfmetrics.registerFont(TTFont('AB', LIB + 'LiberationSans-Bold.ttf'))
pdfmetrics.registerFont(TTFont('AN', LIB + 'LiberationSansNarrow-Regular.ttf'))
NAVY = HexColor('#14213D'); BLUE = HexColor('#1F4E9C'); GRAY = HexColor('#6B7280'); LG = HexColor('#F3F4F6'); RED = HexColor('#B91C1C'); LINE = HexColor('#9CA3AF'); LB = HexColor('#E8EEF8')
EMP = 'PREVINE INSTALAÇÃO E MANUTENÇÃO ELÉTRICA LTDA'; CNPJ = 'CNPJ 03.052.261/0001-43'
HOJE = '28/11/2026'; ELAB = 'Gustavo Rogel de Almeida'; VERIF = 'Thiago Rogel de Almeida'; APROV = 'Claudio José de Almeida'
W, H = 210, 297
MK = 5.0  # marca de canto (mm)
MARCAS = [(8, 8), (W - 8 - MK, 8), (8, H - 8 - MK), (W - 8 - MK, H - 8 - MK)]  # canto sup. esq. de cada marca
DIAS = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM']; OPC = ['C', 'NC', 'NA']
X0, X1 = 13, 197                       # área útil da tabela
XN, XI, XIMP, XD = 13, 20, 109.5, 116  # colunas: nº, item, imp., início dos dias
DW = (X1 - XD) / 7; BP = DW / 3; BR = 1.4  # largura do dia, passo e raio da bolinha
LOGO = '/home/claude/ipar/logo.png'

class P:
    def __init__(s, c): s.c = c
    def y(s, v): return (H - v) * mm
    def rect(s, x, y, w, h, fill=None, stroke=LINE, lw=0.4):
        c = s.c; c.setLineWidth(lw); c.setStrokeColor(stroke or white)
        if fill is not None: c.setFillColor(fill)
        c.rect(x * mm, s.y(y + h), w * mm, h * mm, stroke=1 if stroke else 0, fill=1 if fill is not None else 0)
    def text(s, x, y, t, f='A', sz=7, col=black, al='l'):
        c = s.c; c.setFont(f, sz); c.setFillColor(col)
        fn = {'l': c.drawString, 'c': c.drawCentredString, 'r': c.drawRightString}[al]; fn(x * mm, s.y(y), t)
    def wrap(s, t, f, sz, wmm):
        out, cur = [], ''
        for w in t.split():
            tt = (cur + ' ' + w).strip()
            if pdfmetrics.stringWidth(tt, f, sz) <= wmm * mm: cur = tt
            else: out.append(cur); cur = w
        if cur: out.append(cur)
        return out
    def circ(s, x, y, r, lw=0.5):
        c = s.c; c.setLineWidth(lw); c.setStrokeColor(HexColor('#4B5563')); c.circle(x * mm, s.y(y), r * mm, stroke=1, fill=0)

def gerar(d, dst, lay_dst):
    code = 'FOR-SST-%03d' % d['n']; rev = '000'
    c = canvas.Canvas(dst, pagesize=(W * mm, H * mm)); c.setTitle(code + ' – ' + d['t']); c.setAuthor(EMP)
    p = P(c)
    for (x, y) in MARCAS: p.rect(x, y, MK, MK, fill=black, stroke=None)
    # ---- cabeçalho
    p.rect(X0, 15, X1 - X0, 26)
    c.drawImage(ImageReader(LOGO), (X0 + 1.5) * mm, p.y(15 + 24), 22 * mm, 22 * mm, preserveAspectRatio=True, mask='auto')
    p.rect(X0, 15, 25, 26)
    p.text(X0 + 27, 20, EMP, 'AB', 8, NAVY)
    p.text(X0 + 27, 25, 'CHECKLIST SEMANAL DE INSPEÇÃO' if d['n'] not in (127, 129) else ('INSPEÇÃO 5S – SEMANAL' if d['n'] == 129 else 'CHECKLIST DE LIBERAÇÃO – SEMANAL'), 'AB', 7, GRAY)
    tl = p.wrap(d['t'].upper(), 'AB', 11.5, 88)
    for i, l in enumerate(tl[:2]): p.text(X0 + 27, 30.5 + i * 4.6, l, 'AB', 11.5, BLUE)
    p.text(X0 + 27, 39.5, 'Ref.: ' + d['ref'] + '  ·  ' + d.get('freq', 'preencher antes do uso, em cada dia em que for usado'), 'A', 6.3, GRAY)
    bx = 137; p.rect(bx, 15, X1 - bx, 26)
    lab = [('Código', code), ('Revisão', rev + ' – ' + HOJE), ('Elaborado', ELAB), ('Verificado', VERIF), ('Aprovado', APROV)]
    for i, (a, b) in enumerate(lab):
        yy = 15 + i * 5.2; p.rect(bx, yy, X1 - bx - 17, 5.2)
        p.text(bx + 1, yy + 3.7, a, 'A', 5.6, GRAY); p.text(bx + 12, yy + 3.7, b, 'AB', 6.3)
    q = qrcode.QRCode(border=1, box_size=4, error_correction=qrcode.constants.ERROR_CORRECT_M); q.add_data('PREVINE|%s|%s|S' % (code, rev)); q.make()
    b = io.BytesIO(); q.make_image().save(b, format='PNG'); b.seek(0)
    c.drawImage(ImageReader(b), (X1 - 16.5) * mm, p.y(15 + 16.5), 16 * mm, 16 * mm)
    p.text(X1 - 8.5, 39.8, 'Semanal', 'AB', 5.5, GRAY, 'c')
    # ---- identificação
    y = 43; lay = {'form': code, 'rev': rev, 'pagina': [W, H], 'marcas': MARCAS, 'marca_mm': MK, 'raio': BR, 'itens': [], 'bolhas': [], 'campos': {}}
    p.rect(X0, y, X1 - X0, 7)
    p.text(X0 + 1.5, y + 4.6, 'Unidade:', 'AB', 7.5)
    for i, (k, t) in enumerate((('BM', 'Barra Mansa'), ('RS', 'Resende'))):
        cx = X0 + 19 + i * 27; p.circ(cx, y + 3.5, BR); p.text(cx + 2.6, y + 4.6, t, 'A', 7.5)
        lay['campos'].setdefault('unidade', []).append({'v': k, 'x': cx, 'y': y + 3.5})
    p.text(X0 + 76, y + 4.6, 'Semana de  ____/____/________  a  ____/____/________', 'A', 7.5)
    y += 7; p.rect(X0, y, X1 - X0, 7)
    p.text(X0 + 1.5, y + 4.6, 'TAG / nº do equipamento: ______________________   Marca/modelo: ______________________   Área/local: ____________________', 'A', 7.5)
    y += 7
    for cp in d.get('campos', []):
        p.rect(X0, y, X1 - X0, 7); p.text(X0 + 1.5, y + 4.6, cp, 'A', 7.5); y += 7
    # legenda
    p.rect(X0, y, X1 - X0, 8, fill=LB)
    p.text(X0 + 1.5, y + 3.4, 'Use caneta azul ou preta e PINTE a bolinha inteira:  C = conforme   NC = não conforme   NA = não se aplica.  Uma bolinha por item em cada dia de uso.', 'AB', 6.6, NAVY)
    p.text(X0 + 1.5, y + 6.8, '● na coluna IMP. = item impeditivo: se NC, o equipamento NÃO pode ser usado.   Dia sem uso: deixe em branco.   Exemplo:', 'A', 6.6, NAVY)
    ex = X0 + 133; c.setFillColor(black); c.circle(ex * mm, p.y(y + 6.0), BR * mm, stroke=0, fill=1); p.text(ex + 2.5, y + 6.8, 'certo', 'A', 6.3)
    p.circ(ex + 13, y + 6.0, BR); c.setLineWidth(0.7); c.setStrokeColor(black); c.line((ex+12.2)*mm, p.y(y+6.0), (ex+12.9)*mm, p.y(y+6.9)); c.line((ex+12.9)*mm, p.y(y+6.9), (ex+14.3)*mm, p.y(y+4.6)); p.text(ex + 15.5, y + 6.8, 'errado (não marque com tique nem X)', 'A', 6.3)
    y += 8
    # ---- cabeçalho da tabela
    th = 8.5
    p.rect(XN, y, XI - XN, th, fill=BLUE); p.rect(XI, y, XIMP - XI, th, fill=BLUE); p.rect(XIMP, y, XD - XIMP, th, fill=BLUE)
    p.text((XN + XI) / 2, y + 5.5, 'Nº', 'AB', 6.5, white, 'c'); p.text(XI + 1.5, y + 5.5, 'ITEM DE VERIFICAÇÃO', 'AB', 6.5, white); p.text((XIMP + XD) / 2, y + 5.5, 'IMP.', 'AB', 6, white, 'c')
    for i, dn in enumerate(DIAS):
        x = XD + i * DW; p.rect(x, y, DW, th, fill=BLUE)
        p.text(x + DW / 2, y + 3.3, dn, 'AB', 6.5, white, 'c')
        for j, o in enumerate(OPC): p.text(x + BP * (j + 0.5), y + 7.3, o, 'AB', 4.8, white, 'c')
    y += th; ytab = y
    # ---- linhas
    ng = len(d['g']); ni = sum(len(g[1]) for g in d['g'])
    rod = 52  # rodapé reservado (mm)
    disp = (H - 15) - rod - y
    gh = 4.2; rh = min(8.0, (disp - gh * ng) / ni)
    n = 0
    for grupo, itens in d['g']:
        p.rect(XN, y, X1 - XN, gh, fill=LG); p.text(XN + 1.5, y + 3.0, grupo.upper(), 'AB', 6.2, NAVY); y += gh
        for txt, imp in itens:
            n += 1
            p.rect(XN, y, XI - XN, rh); p.rect(XI, y, XIMP - XI, rh); p.rect(XIMP, y, XD - XIMP, rh)
            p.text((XN + XI) / 2, y + rh / 2 + 1.1, str(n), 'AB', 7, black, 'c')
            sz = 6.6; ls = p.wrap(txt, 'A', sz, XIMP - XI - 2.5)
            if len(ls) > 2 or (len(ls) == 2 and rh < 5.4): sz = 5.9; ls = p.wrap(txt, 'AN', sz, XIMP - XI - 2.5); fn = 'AN'
            else: fn = 'A'
            ls = ls[:3]; lh = sz * 0.36
            y0 = y + rh / 2 - (len(ls) - 1) * lh / 2 + sz * 0.13
            for k, l in enumerate(ls): p.text(XI + 1.2, y0 + k * lh, l, fn, sz)
            if imp: p.text((XIMP + XD) / 2, y + rh / 2 + 1.4, '●', 'AB', 9, RED, 'c')
            lay['itens'].append({'n': n, 't': txt, 'imp': imp, 'grupo': grupo})
            for i in range(7):
                x = XD + i * DW; p.rect(x, y, DW, rh)
                for j, o in enumerate(OPC):
                    cx, cy = x + BP * (j + 0.5), y + rh / 2; p.circ(cx, cy, BR)
                    lay['bolhas'].append({'item': n, 'dia': i, 'op': o, 'x': round(cx, 3), 'y': round(cy, 3)})
            y += rh
    # ---- rodapé
    y += 1
    for txt, k in (('Rubrica de quem inspecionou', 'rubrica'), ('Hora da inspeção', 'hora')):
        hh = 7 if k == 'rubrica' else 5.5
        p.rect(XN, y, XD - XN, hh, fill=LG); p.text(XN + 1.5, y + hh / 2 + 1.1, txt, 'AB', 6.6)
        for i in range(7):
            p.rect(XD + i * DW, y, DW, hh)
            if k == 'rubrica': lay['campos'].setdefault('rubrica', []).append({'dia': i, 'x': XD + i * DW, 'y': y, 'w': DW, 'h': hh})
        y += hh
    p.rect(XN, y, XD - XN, 7, fill=LG); p.text(XN + 1.5, y + 4.6, 'Visto da liderança na semana (nome e rubrica)', 'AB', 6.6); p.rect(XD, y, X1 - XD, 7); y += 8.5
    p.rect(XN, y, X1 - XN, 6, fill=HexColor('#FEF2F2'))
    p.text(XN + 1.5, y + 2.7, 'NC em item ●: NÃO USE. Retire de uso, coloque a etiqueta "NÃO USE – EM MANUTENÇÃO" e avise a liderança. Item sem ●: anote abaixo e corrija.', 'AB', 6, RED)
    p.text(XN + 1.5, y + 5.2, 'Só volte a usar depois da correção e de nova inspeção. Ao fim da semana, entregue a folha à liderança/TST para ser escaneada no portal.', 'A', 6, RED)
    y += 6
    cols = [(XN, 12, 'Dia'), (XN + 12, 12, 'Item nº'), (XN + 24, 64, 'Não conformidade / observação'), (XN + 88, 52, 'Ação tomada'), (XN + 140, 26, 'Responsável'), (XN + 166, X1 - XN - 166, 'Liberado em')]
    for x, w, t in cols: p.rect(x, y, w, 4.5, fill=LG); p.text(x + 1, y + 3.2, t, 'AB', 5.8)
    y += 4.5
    for _ in range(3):
        for x, w, t in cols: p.rect(x, y, w, 6)
        y += 6
    p.text(XN, y + 3.5, 'Declaro que as informações desta folha são verdadeiras.  Inspecionado por: ______________________________  Matrícula: __________  Assinatura: _______________________', 'A', 6.6)
    # rodapé padrão
    p.text(X0 + 2, H - 9.5, EMP + ' – ' + CNPJ, 'A', 5.8, GRAY)
    p.text(X1 - 7, H - 9.5, code + ' · Rev. ' + rev + ' · Página 1 de 1', 'AB', 5.8, GRAY, 'r')
    c.showPage(); c.save()
    lay['altura_linha'] = round(rh, 3)
    json.dump(lay, open(lay_dst, 'w', encoding='utf-8'), ensure_ascii=False)
    return code, n, rh

if __name__ == '__main__':
    import re, unicodedata
    out = '/home/claude/chk/omr'; os.makedirs(out + '/layout', exist_ok=True)
    for d in CL:
        nome = unicodedata.normalize('NFKD', d['t']).encode('ascii', 'ignore').decode(); nome = re.sub(r'[^A-Za-z0-9]+', ' ', nome).strip().upper()
        code, n, rh = gerar(d, '%s/FOR-SST-%03d - CHECKLIST SEMANAL %s - Rev000.pdf' % (out, d['n'], nome[:55]), '%s/layout/FOR-SST-%03d.json' % (out, d['n']))
        print(code, n, 'itens', 'linha %.1f mm' % rh)
