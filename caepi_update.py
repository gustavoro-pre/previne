"""Baixa a base oficial de CAs (MTE/CAEPI) e gera ca.json + ca/NN.json para o app.
Se o arquivo vier inválido ou muito pequeno, mantém a base anterior e só registra o erro."""
import ftplib, io, json, os, re, sys, zipfile, datetime, urllib.request

HOST, PASTA, ARQ = 'ftp.mtps.gov.br', 'portal/fiscalizacao/seguranca-e-saude-no-trabalho/caepi', 'tgg_export_caepi.zip'
hoje = datetime.date.today().isoformat()

def status(ok, msg, extra=None):
    d = {'verificadoEm': hoje, 'ok': ok, 'mensagem': msg}
    if extra: d.update(extra)
    json.dump(d, open('caepi_status.json', 'w'), ensure_ascii=False, indent=1)
    print(('OK: ' if ok else 'FALHA: ') + msg)

def baixar():
    erros = []
    try:
        ftp = ftplib.FTP(HOST, timeout=120); ftp.login(); ftp.cwd(PASTA)
        data_arq = ''
        try:
            r = ftp.sendcmd('MDTM ' + ARQ)  # 213 YYYYMMDDhhmmss
            m = re.search(r'(\d{8})', r); data_arq = m and f'{m.group(1)[:4]}-{m.group(1)[4:6]}-{m.group(1)[6:8]}' or ''
        except Exception as e: erros.append('MDTM ' + str(e))
        buf = io.BytesIO(); ftp.retrbinary('RETR ' + ARQ, buf.write); ftp.quit()
        return buf.getvalue(), data_arq, erros
    except Exception as e:
        erros.append('FTP: ' + str(e))
    try:
        b = urllib.request.urlopen('ftp://%s/%s/%s' % (HOST, PASTA, ARQ), timeout=120).read()
        return b, '', erros
    except Exception as e:
        erros.append('URL: ' + str(e))
    return None, '', erros

def data_iso(t):
    t = (t or '').strip()
    m = re.match(r'(\d{2})/(\d{2})/(\d{4})', t)
    if m: return f'{m.group(3)}-{m.group(2)}-{m.group(1)}'
    m = re.match(r'(\d{4})-(\d{2})-(\d{2})', t)
    return m.group(0) if m else ''

raw, data_arq, erros = baixar()
if not raw:
    status(False, 'Não foi possível baixar o arquivo: ' + ' | '.join(erros)); sys.exit(0)
if not raw.strip(b'\x00'):
    status(False, 'Arquivo baixado veio vazio (só zeros).'); sys.exit(0)
try:
    z = zipfile.ZipFile(io.BytesIO(raw)); nome = [n for n in z.namelist() if n.lower().endswith('.txt')][0]
    texto = z.read(nome)
except Exception as e:
    status(False, 'ZIP inválido: ' + str(e)); sys.exit(0)
for enc in ('utf-8', 'latin-1'):
    try: texto = texto.decode(enc); break
    except Exception: pass
linhas = texto.splitlines()
cab = [c.strip() for c in linhas[0].split('|')]
print('Colunas:', cab)
def col(*pal, nao=()):
    for i, c in enumerate(cab):
        u = c.upper()
        if all(p in u for p in pal) and not any(n in u for n in nao): return i
    return None
iCA = col('REGISTRO', 'CA') if col('REGISTRO', 'CA') is not None else col('CA', nao=('DESCRICAO', 'SITUACAO'))
iVal, iSit = col('VALIDADE'), col('SITUACAO')
iEq = col('EQUIPAMENTO', nao=('DESCRICAO',)); iEq = iEq if iEq is not None else col('EQUIPAMENTO')
iFab = col('RAZAO') if col('RAZAO') is not None else col('FABRICANTE')
print('Indices CA/validade/situacao/equip/fabricante:', iCA, iVal, iSit, iEq, iFab)
if iCA is None or iVal is None:
    status(False, 'Colunas não reconhecidas: ' + ', '.join(cab)); sys.exit(0)
base, nomes = {}, {}
for l in linhas[1:]:
    p = l.split('|')
    if len(p) <= max(iCA, iVal): continue
    ca = re.sub(r'\D', '', p[iCA]).lstrip('0')
    if not ca: continue
    val = data_iso(p[iVal]); sit = (p[iSit].strip().upper() if iSit is not None and len(p) > iSit else '')
    if ca in base and base[ca][0] >= val: continue
    base[ca] = [val, sit]
    eq = p[iEq].strip()[:70] if iEq is not None and len(p) > iEq else ''
    fab = p[iFab].strip()[:50] if iFab is not None and len(p) > iFab else ''
    nomes[ca] = [eq, fab]
n = len(base); maxv = max((v[0] for v in base.values()), default='')
if n < 5000:
    status(False, f'Base muito pequena ({n} CAs); mantida a anterior.'); sys.exit(0)
json.dump({'atualizadoEm': hoje, 'dataArquivo': data_arq, 'fonte': f'ftp://{HOST}/{PASTA}/{ARQ}', 'total': n, 'maiorValidade': maxv, 'ca': base}, open('ca.json', 'w'), ensure_ascii=False, separators=(',', ':'))
os.makedirs('ca', exist_ok=True)
shards = {}
for ca, v in nomes.items(): shards.setdefault(str(int(ca) % 100).zfill(2), {})[ca] = v
for k, v in shards.items(): json.dump(v, open(f'ca/{k}.json', 'w'), ensure_ascii=False, separators=(',', ':'))
status(True, f'{n} CAs; maior validade {maxv}; arquivo de {data_arq or "data desconhecida"}.', {'total': n, 'dataArquivo': data_arq})
