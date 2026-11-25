"""Gera treinamentos/index.html a partir do app de Ferramentas & EPI (o mesmo app atende os dois módulos)."""
import re, pathlib
base = pathlib.Path(__file__).parent
src = (base / 'ferramentas/index.html').read_text()
assert src.count("window.__MODULO = 'ferramentas';") == 1
out = src.replace("window.__MODULO = 'ferramentas';", "window.__MODULO = 'treinamentos';")
mk = "/* ================= inicialização ================= */"
assert out.count(mk) == 1
out = out.replace(mk, "</script>\n<script src=\"trein.js\"></script>\n<script>\n" + mk)
out = out.replace('<title>Ferramentas &amp; EPI</title>', '<title>Treinamentos · PREVINE</title>')
(base / 'treinamentos/index.html').write_text(out)
print('ok', len(out))
