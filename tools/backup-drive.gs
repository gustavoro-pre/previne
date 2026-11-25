/**
 * PREVINE · Backup automático do portal para o Google Drive (pasta DOCUMENTAÇÃO PORTAL).
 * Roda na conta previneime@gmail.com, que tem acesso de Leitor ao Firebase (projeto ferramentas-epi).
 * Lê o Firestore e copia para o Drive; nunca apaga nada no Drive nem altera o portal.
 *
 * O que faz a cada hora:
 *  1. Uma pasta por pessoa ("NOME - CPF"), com as subpastas RH e Segurança, dentro de
 *     Admissões em andamento / Funcionários ativos / Desligados, e move a pasta quando o status muda.
 *  2. Copia os documentos da admissão (fotos e PDFs enviados), o ASO, a carta-convite e o termo LGPD,
 *     a OS e o termo de EPI e os demais documentos para assinar; quando assinados, junta o registro
 *     da assinatura eletrônica (imagem, data e hora, hash, aparelho).
 *  3. Copia os arquivos do módulo Documentação (todas as revisões).
 */
const PROJ = 'ferramentas-epi';
const BASE = 'https://firestore.googleapis.com/v1/projects/' + PROJ + '/databases/(default)/documents';
const PASTA = {
  raiz: '1Ku5Qjo0J1Di1i_9B6VYk5XOcLbZ5hW0o',      // DOCUMENTAÇÃO PORTAL
  admissao: '17azTRuyGzNN43LwDq7k-brwbzmWh6r5i',  // 01 - RH / 02 - Admissões em andamento
  ativos: '1wnRHDCNDEuLy_LFXTbzIngG5TvQz17uL',    // 01 - RH / 01 - Funcionários ativos
  desligados: '1HCoG09iNmayUS9pZG-otuabuUANqiLWx', // 01 - RH / 03 - Desligados
  diversos: '1PBsYTPl0GQEeJKCSJINjX_QEcgYOMpQ1'   // 03 - DOCUMENTOS DIVERSOS
};
const SLOT_NOME = { foto: 'Foto 3x4', rg: 'RG', cpf: 'CPF', cnh: 'CNH', ctps: 'Carteira de trabalho', pis: 'PIS-NIS', titulo: 'Título de eleitor',
  reservista: 'Reservista', residencia: 'Comprovante de residência', escolaridade: 'Escolaridade', certidao: 'Certidão de nascimento ou casamento',
  filhos: 'Filhos', cursos: 'Certificados de cursos', registro: 'Registro profissional', cnpj: 'Cartão CNPJ', contrato: 'Contrato social ou MEI', aso: 'ASO admissional' };
const LIMITE_MS = 5 * 60 * 1000;

/* ---------- instalar: rode uma vez (Executar → instalar) ---------- */
function instalar() {
  ScriptApp.getProjectTriggers().forEach(t => { if (t.getHandlerFunction() === 'sincronizar') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('sincronizar').timeBased().everyHours(1).create();
  sincronizar();
}

/* ---------- principal ---------- */
function sincronizar() {
  const t0 = Date.now(); const ctl = lerControle(); const log = [];
  const tempo = () => Date.now() - t0 < LIMITE_MS;
  try {
    const funcs = listar('funcionarios'), adms = listar('admissoes');
    const pessoas = {};
    ctl.p = ctl.p || {};
    funcs.forEach(f => { const k = chavePessoa(f.cpf, ''); if (k && !ctl.p[k] && ctl.p['f_' + f._id]) { ctl.p[k] = ctl.p['f_' + f._id]; delete ctl.p['f_' + f._id]; } });
    funcs.forEach(f => { const k = chavePessoa(f.cpf, 'f_' + f._id); pessoas[k] = { nome: f.nome, cpf: f.cpf, st: f.ativo !== false ? 'ativos' : (f.situacao === 'Em admissão' ? 'admissao' : 'desligados') }; });
    adms.forEach(a => { const k = chavePessoa(a.cpf, 'a_' + a._id); if (!pessoas[k]) pessoas[k] = { nome: a.nome, cpf: a.cpf, st: a.status === 'aberto' ? 'admissao' : 'desligados' }; else if (a.status === 'aberto' && pessoas[k].st === 'desligados') pessoas[k].st = 'admissao'; });
    // 1. pastas e status
    Object.keys(pessoas).forEach(k => { if (tempo()) pastaPessoa(ctl, k, pessoas[k], log); });
    // 2. admissões
    for (const a of adms) { if (!tempo()) break; backupAdmissao(ctl, a, pessoas, log); }
    // 3. módulo Documentação
    if (tempo()) backupDocumentacao(ctl, log, tempo);
  } catch (e) { log.push('ERRO: ' + (e && e.stack || e)); }
  ctl.ultima = new Date().toISOString(); ctl.log = log.slice(-60).concat(ctl.log || []).slice(0, 200);
  salvarControle(ctl);
  Logger.log(log.join('\n') || 'Nada novo.');
}

/* ---------- pessoas ---------- */
function chavePessoa(cpf, alt) { const d = String(cpf || '').replace(/\D/g, ''); return d.length === 11 ? 'cpf_' + d : alt; }
function fmtCpf(c) { const d = String(c || '').replace(/\D/g, ''); return d.length === 11 ? d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : ''; }
function pastaPessoa(ctl, k, p, log) {
  ctl.p = ctl.p || {}; let r = ctl.p[k]; const destino = PASTA[p.st];
  const nome = (String(p.nome || 'SEM NOME').toUpperCase().trim()) + (fmtCpf(p.cpf) ? ' - CPF ' + fmtCpf(p.cpf) : '');
  if (r) { try { const f = DriveApp.getFolderById(r.id); if (r.st !== p.st) { f.moveTo(DriveApp.getFolderById(destino)); log.push('Movida: ' + nome + ' → ' + p.st); r.st = p.st; } if (f.getName() !== nome) f.setName(nome); return r; } catch (e) { r = null; } }
  const pai = DriveApp.getFolderById(destino); const f = pai.createFolder(nome);
  r = { id: f.getId(), rh: f.createFolder('RH').getId(), seg: f.createFolder('Segurança').getId(), st: p.st }; ctl.p[k] = r; log.push('Pasta criada: ' + nome);
  return r;
}

/* ---------- admissão ---------- */
function backupAdmissao(ctl, a, pessoas, log) {
  const k = chavePessoa(a.cpf, 'a_' + a._id); const pp = (ctl.p || {})[k]; if (!pp) return;
  ctl.f = ctl.f || {}; const cand = a.cand || {}, assin = cand.assin || {};
  // documentos enviados (candidato ou RH)
  Object.keys(cand.docs || {}).forEach(slot => (cand.docs[slot] || []).forEach((arq, i, arr) => {
    const key = 'a:' + a._id + ':' + slot + ':' + arq.v; if (ctl.f[key]) return;
    const blob = juntar('admissoes/' + a._id + '/p/', slot + '_' + arq.v + '_', arq.partes, arq.tipo); if (!blob) return;
    const nome = (SLOT_NOME[slot] || slot) + (arr.length > 1 ? ' ' + (i + 1) : '') + ext(arq.tipo, arq.nome);
    ctl.f[key] = salvar(pp.rh, nome, blob); log.push('Copiado: ' + a.nome + ' / ' + nome);
  }));
  // ASO anexado pelo RH
  ((((a.etapas || {}).aso || {}).arq) || []).forEach((arq, i, arr) => {
    const key = 'a:' + a._id + ':aso:' + arq.v; if (ctl.f[key]) return;
    const blob = juntar('admissoes/' + a._id + '/p/', 'aso_' + arq.v + '_', arq.partes, arq.tipo); if (!blob) return;
    const nome = 'ASO admissional' + (arr.length > 1 ? ' ' + (i + 1) : '') + ext(arq.tipo, arq.nome);
    ctl.f[key] = salvar(pp.seg, nome, blob); log.push('Copiado: ' + a.nome + ' / ' + nome);
  });
  // carta-convite e termo LGPD (texto) — só depois de assinados
  ['lgpd', 'carta'].forEach(id => {
    const t = (a.textos || {})[id], s = assin[id]; if (!t || !s || s.hash !== t.hash) return;
    const key = 'a:' + a._id + ':txt:' + id + ':' + t.hash; if (ctl.f[key]) return;
    const d = ler('admissoes/' + a._id + '/d/' + id); if (!d || !d.texto) return;
    const tit = id === 'carta' ? 'Carta-convite' : 'Termo LGPD';
    const html = cab(tit) + '<div style="white-space:pre-wrap;font-size:11pt;line-height:1.45;text-align:justify">' + esc(d.texto) + '</div>' + registro(a, s, tit);
    ctl.f[key] = salvar(pp.rh, tit + ' (assinado).pdf', pdfDeHtml(html, tit)); log.push('Copiado: ' + a.nome + ' / ' + tit);
  });
  // OS e termo de EPI e demais documentos para assinar
  Object.keys(a.assinar || {}).forEach(id => {
    const arq = a.assinar[id]; const tit = id === 'osepi' ? 'OS de segurança e termo de EPI' : String(arq.titulo || 'Documento'); const pasta = id === 'osepi' ? pp.seg : pp.rh;
    const s = assin[id]; const ok = !!(s && s.hash === arq.hash);
    const kd = 'a:' + a._id + ':ass:' + id + ':' + arq.v;
    if (!ctl.f[kd]) { const blob = juntar('admissoes/' + a._id + '/d/', id + '_' + arq.v + '_', arq.partes, arq.tipo || 'application/pdf'); if (blob) { ctl.f[kd] = salvar(pasta, tit + '.pdf', blob); log.push('Copiado: ' + a.nome + ' / ' + tit); } }
    const ks = kd + ':reg'; if (ok && !ctl.f[ks]) { ctl.f[ks] = salvar(pasta, tit + ' - registro de assinatura.pdf', pdfDeHtml(cab('Registro de assinatura eletrônica') + '<p>Documento: <b>' + esc(tit) + '</b></p>' + registro(a, s, tit), tit)); log.push('Assinatura registrada: ' + a.nome + ' / ' + tit); }
  });
}
function registro(a, s, tit) {
  const img = /^data:image\//.test(String(s.img || '')) ? '<img src="' + s.img + '" style="max-width:260px;max-height:90px;display:block;margin:14px 0 4px">' : '';
  return '<div style="margin-top:24px;border-top:1px solid #999;padding-top:10px;font-size:10pt">' + img +
    '<div style="border-top:1px solid #333;width:280px;padding-top:3px"><b>' + esc(a.nome) + '</b> · CPF ' + esc(fmtCpf(a.cpf)) + '</div>' +
    '<p style="color:#444">Assinado eletronicamente em ' + esc(dataHora(s.em)) + ' (horário de Brasília), pelo link individual enviado pelo RH, após confirmar o CPF. ' +
    'Código do processo: ' + esc(a._id) + '. Impressão digital do documento (SHA-256): ' + esc(s.hash || '') + '. Aparelho: ' + esc(String(s.ua || '').slice(0, 160)) + '. ' +
    'Assinatura eletrônica nos termos da MP 2.200-2/2001, art. 10, § 2º.</p></div>';
}

/* ---------- módulo Documentação ---------- */
function backupDocumentacao(ctl, log, tempo) {
  ctl.f = ctl.f || {}; ctl.dp = ctl.dp || {};
  if (!ctl.dp._raiz) ctl.dp._raiz = DriveApp.getFolderById(PASTA.diversos).createFolder('Documentação controlada (módulo Documentação)').getId();
  listar('docs').forEach(d => {
    if (!tempo()) return;
    const revs = (d.hist || []).filter(h => h.arquivo && h.arquivo.id); if (d.arquivo && d.arquivo.id && !revs.some(h => h.arquivo.id === d.arquivo.id)) revs.push({ rev: d.rev, arquivo: d.arquivo });
    revs.forEach(h => {
      const key = 'd:' + h.arquivo.id; if (ctl.f[key] || !tempo()) return;
      const meta = ler('docfiles/' + h.arquivo.id); if (!meta || meta.completo === false) return;
      let b64 = ''; for (let i = 0; i < (meta.partes || 1); i++) { const p = ler('docfiles/' + h.arquivo.id + '/p/' + i); if (!p) return; b64 += p.d; }
      const tipo = String(d.tipo || 'Outros'); if (!ctl.dp[tipo]) ctl.dp[tipo] = DriveApp.getFolderById(ctl.dp._raiz).createFolder(tipo).getId();
      const nome = (d.codigo ? d.codigo + ' ' : '') + 'rev ' + (h.rev != null ? h.rev : '') + ' - ' + (d.titulo || meta.nome) + ext(meta.tipo, meta.nome);
      ctl.f[key] = salvar(ctl.dp[tipo], nome, Utilities.newBlob(Utilities.base64Decode(b64), meta.tipo || 'application/octet-stream'));
      log.push('Documentação: ' + nome);
    });
  });
}

/* ---------- Firestore (REST, com o login desta conta) ---------- */
function req(url) { return UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true }); }
function ler(path) { const r = req(BASE + '/' + path); if (r.getResponseCode() === 404) return null; if (r.getResponseCode() !== 200) throw new Error('Firestore ' + r.getResponseCode() + ' em ' + path + ': ' + r.getContentText().slice(0, 300)); return doc(JSON.parse(r.getContentText())); }
function listar(col) { const out = []; let tok = ''; do { const r = req(BASE + '/' + col + '?pageSize=300' + (tok ? '&pageToken=' + encodeURIComponent(tok) : '')); if (r.getResponseCode() !== 200) throw new Error('Firestore ' + r.getResponseCode() + ' em ' + col + ': ' + r.getContentText().slice(0, 300)); const j = JSON.parse(r.getContentText()); (j.documents || []).forEach(d => out.push(doc(d))); tok = j.nextPageToken || ''; } while (tok); return out; }
function doc(d) { const o = val({ mapValue: { fields: d.fields || {} } }); o._id = String(d.name).split('/').pop(); return o; }
function val(v) {
  if (!v) return null; if ('stringValue' in v) return v.stringValue; if ('integerValue' in v) return Number(v.integerValue); if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue; if ('nullValue' in v) return null; if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(val); if ('mapValue' in v) { const o = {}; const f = v.mapValue.fields || {}; Object.keys(f).forEach(k => o[k] = val(f[k])); return o; } return null;
}
function juntar(base, prefixo, partes, tipo) { let b64 = ''; for (let i = 0; i < (partes || 1); i++) { const p = ler(base + prefixo + i); if (!p || p.d == null) return null; b64 += p.d; } return Utilities.newBlob(Utilities.base64Decode(b64), tipo || 'application/octet-stream'); }

/* ---------- Drive ---------- */
function salvar(pastaId, nome, blob) { blob.setName(nome); return DriveApp.getFolderById(pastaId).createFile(blob).getId(); }
function ext(tipo, nome) { const m = /\.[a-z0-9]{2,4}$/i.exec(String(nome || '')); if (m) return m[0].toLowerCase(); return ({ 'application/pdf': '.pdf', 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' })[tipo] || ''; }
function pdfDeHtml(html, tit) { return HtmlService.createHtmlOutput('<html><head><meta charset="utf-8"><style>body{font-family:Arial,Helvetica,sans-serif;margin:28px;color:#222}</style></head><body>' + html + '</body></html>').getAs('application/pdf').setName(tit + '.pdf'); }
function cab(tit) { return '<div style="border-bottom:2px solid #14213d;padding-bottom:6px;margin-bottom:14px"><div style="font-weight:bold;color:#14213d">PREVINE INSTALAÇÃO E MANUTENÇÃO ELÉTRICA LTDA</div><div style="font-size:9pt;color:#555">CNPJ 03.052.261/0001-43</div><div style="font-size:14pt;font-weight:bold;color:#1f4e9c;margin-top:4px">' + esc(tit) + '</div></div>'; }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]); }
function dataHora(iso) { try { return Utilities.formatDate(new Date(iso), 'America/Sao_Paulo', 'dd/MM/yyyy HH:mm'); } catch (e) { return String(iso || ''); } }

/* ---------- controle (o que já foi copiado), num arquivo na pasta raiz ---------- */
function arqControle() { const it = DriveApp.getFolderById(PASTA.raiz).getFilesByName('_controle_backup.json'); return it.hasNext() ? it.next() : null; }
function lerControle() { const f = arqControle(); if (!f) return {}; try { return JSON.parse(f.getBlob().getDataAsString()); } catch (e) { return {}; } }
function salvarControle(c) { const s = JSON.stringify(c); const f = arqControle(); if (f) f.setContent(s); else DriveApp.getFolderById(PASTA.raiz).createFile('_controle_backup.json', s, 'application/json'); }
