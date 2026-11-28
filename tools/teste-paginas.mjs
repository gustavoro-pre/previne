// Teste automático antes de publicar: abre cada página do portal num navegador e falha se aparecer erro de JavaScript
// (erro de sintaxe, variável que não existe, script que não carrega). Roda no GitHub a cada push (.github/workflows/teste.yml).
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const PAGINAS = ['index.html', 'ferramentas/index.html', 'treinamentos/index.html', 'indicadores/index.html', 'alocacao/index.html', 'admissao/index.html',
  'admissao/enviar.html', 'documentos/index.html', 'propostas/index.html', 'aluno/index.html', 'carteirinhas/index.html', 'matriz/index.html', 'ocorrencias/index.html', 'acessos/index.html', 'desligamento/index.html'];
const srv = spawn('python3', ['-m', 'http.server', '8799'], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1500));
const nav = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME, args: ['--no-sandbox'] } : {}); let falhas = 0;
for (const p of PAGINAS) {
  const pg = await nav.newPage(); const erros = [];
  pg.on('pageerror', e => erros.push(String(e && e.message || e)));
  pg.on('requestfailed', r => { const u = r.url(); if (u.startsWith('http://localhost:8799/') && !/favicon/.test(u)) erros.push('não carregou: ' + u.replace('http://localhost:8799/', '')); });
  try { await pg.goto('http://localhost:8799/' + p, { waitUntil: 'load', timeout: 30000 }); await pg.waitForTimeout(2500); }
  catch (e) { erros.push('não abriu: ' + e.message); }
  // erros esperados sem login/sem internet do Firebase não contam
  const reais = erros.filter(e => !/firebase|firestore|auth\/|permission|network|Failed to fetch|ERR_|net::/i.test(e));
  console.log((reais.length ? '✗ ' : '✓ ') + p + (reais.length ? '\n   ' + reais.join('\n   ') : ''));
  falhas += reais.length; await pg.close();
}
await nav.close(); srv.kill();
if (falhas) { console.log(`::error title=Teste das páginas::${falhas} erro(s) de JavaScript. Veja o log.`); process.exit(1); }
console.log('Todas as páginas abriram sem erro de JavaScript.');
