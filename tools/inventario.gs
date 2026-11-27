/**
 * PREVINE · Cópias do inventário das pastas antigas (colar como arquivo novo "inventario" no MESMO projeto
 * do Apps Script "PREVINE - Backup do portal para o Drive"; usa PASTA, lerControle, req e val de lá).
 *
 * A leitura e a identificação dos arquivos são feitas no GitHub (tools/drive-inv.mjs), que grava a lista em
 * Firestore drive_inv. Aqui só copiamos, com as funções do próprio Drive (não gastam a cota de UrlFetch):
 * 1 chamada ao Firestore por rodada. Nada é apagado nem movido: são cópias.
 *  - Funcionário ativo / em admissão → pasta da pessoa / RH ou Segurança / "Pastas antigas"
 *  - Ex-funcionário (desligado no portal) → ARQUIVO MORTO - EX-FUNCIONÁRIOS / NOME - CPF / RH ou Segurança
 *  - Pasta com nome de pessoa que não está no portal → ARQUIVO MORTO - EX-FUNCIONÁRIOS / _SEM CADASTRO NO PORTAL / NOME
 *  - Documento com salário → subpasta "Restrito - salário" (compartilhar só com quem pode ver salários)
 * Cada cópia vira uma linha na planilha "Inventário de cópias (origem → destino)" (pasta DOCUMENTAÇÃO PORTAL),
 * com a coluna "Conferido" (tamanho da cópia = tamanho da origem). Ela é o roteiro para apagar as pastas antigas depois.
 */
const INV_LIMITE_MS = 5 * 60 * 1000;
const INV_PLANILHA = 'Inventário de cópias (origem → destino)';
const INV_MORTO = 'ARQUIVO MORTO - EX-FUNCIONÁRIOS';
const INV_CAB = ['Data da cópia', 'Pessoa', 'CPF', 'Situação', 'Destino', 'Tipo', 'NRs', 'Data do documento', 'Validade', 'Arquivo',
  'Caminho de origem', 'Link da origem', 'ID da origem', 'Pasta de destino', 'Link da cópia', 'ID da cópia', 'Conferido (tamanho igual)', 'Identificado por'];

function instalarInventario() {
  ScriptApp.getProjectTriggers().forEach(t => { if (t.getHandlerFunction() === 'copiarInventario') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('copiarInventario').timeBased().everyMinutes(15).create();
  copiarInventario();
}

function copiarInventario() {
  const t0 = Date.now(); const tempo = () => Date.now() - t0 < INV_LIMITE_MS;
  const lock = LockService.getScriptLock(); if (!lock.tryLock(1000)) return;
  try {
    const sh = invPlanilha();
    const feitos = new Set(); const n = sh.getLastRow();
    if (n > 1) sh.getRange(2, 13, n - 1, 1).getValues().forEach(r => r[0] && feitos.add(String(r[0])));
    const lista = invListar().filter(d => !feitos.has(d.id));
    if (!lista.length) { Logger.log('Nada novo para copiar.'); return; }
    const ctl = lerControle(); const cache = {}; const linhas = []; let erros = 0;
    for (const d of lista) {
      if (!tempo()) break;
      try {
        const destino = invPastaDestino(d, ctl, cache); if (!destino) continue; // pasta da pessoa ainda não criada pelo sincronizar
        const orig = DriveApp.getFileById(d.id);
        const copia = orig.makeCopy(orig.getName(), destino);
        const ok = copia.getSize() === orig.getSize() ? 'S' : 'N';
        linhas.push([Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'dd/MM/yyyy HH:mm'), d.pnome || '', invCpf(d.pcpf), d.pst || '',
          ({ pessoa: 'Pasta do funcionário', morto: 'Arquivo morto', morto_semcad: 'Arquivo morto (sem cadastro)' })[d.destino] || d.destino,
          d.tipo || '', (d.nrs || []).join(', '), invData(d.data), invData(d.validade), orig.getName(), d.caminho || '', orig.getUrl(), d.id,
          invCaminhoPasta(destino), copia.getUrl(), copia.getId(), ok, d.metodo || '']);
      } catch (e) { erros++; }
      if (linhas.length >= 50) { invGravar(sh, linhas); linhas.length = 0; }
    }
    invGravar(sh, linhas);
    Logger.log('Copiados nesta rodada: ' + (sh.getLastRow() - 1 - feitos.size) + ' · erros: ' + erros + ' · faltam: ' + Math.max(0, lista.length - (sh.getLastRow() - 1 - feitos.size)));
  } finally { lock.releaseLock(); }
}

/* Firestore: 1 chamada (runQuery) traz toda a lista a copiar, só os campos necessários. */
function invListar() {
  const body = { structuredQuery: {
    from: [{ collectionId: 'drive_inv' }],
    where: { fieldFilter: { field: { fieldPath: 'acao' }, op: 'EQUAL', value: { stringValue: 'copiar' } } },
    select: { fields: ['id', 'pkey', 'pnome', 'pcpf', 'pst', 'destino', 'area', 'tipo', 'nrs', 'data', 'validade', 'caminho', 'metodo', 'salario'].map(f => ({ fieldPath: f })) }
  } };
  const r = UrlFetchApp.fetch(BASE + ':runQuery', { method: 'post', contentType: 'application/json', payload: JSON.stringify(body),
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) throw new Error('Firestore ' + r.getResponseCode() + ': ' + r.getContentText().slice(0, 300));
  return JSON.parse(r.getContentText()).filter(x => x.document).map(x => val({ mapValue: { fields: x.document.fields || {} } }));
}

function invPastaDestino(d, ctl, cache) {
  const area = d.area === 'Segurança' ? 'Segurança' : 'RH';
  let base;
  if (d.destino === 'pessoa') {
    const pp = (ctl.p || {})[d.pkey]; if (!pp) return null;
    base = invSub(DriveApp.getFolderById(area === 'Segurança' ? pp.seg : pp.rh), 'Pastas antigas', cache);
  } else if (d.destino === 'morto') {
    const raiz = invSub(DriveApp.getFolderById(PASTA.raiz), INV_MORTO, cache);
    base = invSub(invSub(raiz, String(d.pnome || 'SEM NOME').toUpperCase().trim() + (invCpf(d.pcpf) ? ' - CPF ' + invCpf(d.pcpf) : ''), cache), area, cache);
  } else if (d.destino === 'morto_semcad') {
    const raiz = invSub(invSub(DriveApp.getFolderById(PASTA.raiz), INV_MORTO, cache), '_SEM CADASTRO NO PORTAL', cache);
    base = invSub(invSub(raiz, String(d.pnome || 'SEM NOME').toUpperCase().trim(), cache), area, cache);
  } else return null;
  return d.salario ? invSub(base, 'Restrito - salário', cache) : base;
}
function invSub(pai, nome, cache) {
  const k = pai.getId() + '/' + nome; if (cache[k]) return cache[k];
  const it = pai.getFoldersByName(nome); return (cache[k] = it.hasNext() ? it.next() : pai.createFolder(nome));
}
function invCaminhoPasta(f) { const p = []; let x = f; for (let i = 0; i < 6 && x; i++) { p.unshift(x.getName()); const it = x.getParents(); x = it.hasNext() ? it.next() : null; } return p.join(' / '); }
function invPlanilha() {
  const it = DriveApp.getFolderById(PASTA.raiz).getFilesByName(INV_PLANILHA);
  let ss;
  if (it.hasNext()) ss = SpreadsheetApp.open(it.next());
  else {
    ss = SpreadsheetApp.create(INV_PLANILHA); DriveApp.getFileById(ss.getId()).moveTo(DriveApp.getFolderById(PASTA.raiz));
    const sh = ss.getSheets()[0]; sh.setName('Cópias'); sh.getRange(1, 1, 1, INV_CAB.length).setValues([INV_CAB]).setFontWeight('bold').setBackground('#1f4e9c').setFontColor('#ffffff');
    sh.setFrozenRows(1);
  }
  return ss.getSheetByName('Cópias') || ss.getSheets()[0];
}
function invGravar(sh, linhas) { if (linhas.length) sh.getRange(sh.getLastRow() + 1, 1, linhas.length, INV_CAB.length).setValues(linhas); }
function invCpf(c) { const d = String(c || '').replace(/\D/g, ''); return d.length === 11 ? d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : ''; }
function invData(iso) { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || '')); return m ? m[3] + '/' + m[2] + '/' + m[1] : ''; }

/* Para parar as rotinas antigas que gastavam a cota (OCR e cópias do RH/Mobilização), rode uma vez: */
function pararRotinasAntigas() {
  const parar = ['lerDocsRH', 'consolidarRH', 'consolidarMob', 'refazerMob'];
  ScriptApp.getProjectTriggers().forEach(t => { if (parar.indexOf(t.getHandlerFunction()) >= 0) { ScriptApp.deleteTrigger(t); Logger.log('Parado: ' + t.getHandlerFunction()); } });
}
