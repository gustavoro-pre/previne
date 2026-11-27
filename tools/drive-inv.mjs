// PREVINE · Inventário das pastas antigas do Drive (RH, SEGURANÇA DO TRABALHO, Mobilização…).
// Roda no GitHub Actions com a conta de serviço (segredo FIREBASE_SA). Só LÊ o Drive (escopo drive.readonly)
// e grava o resultado em Firestore drive_inv/{idDoArquivo}. Não copia, não move e não apaga nada.
// As cópias são feitas depois pelo script do Google (tools/inventario.gs, função copiarInventario),
// na conta previneime, a partir desta lista.
//
// O repositório é público: o log mostra só contagens, nunca nomes, CPFs ou caminhos.
import admin from 'firebase-admin';
import { google } from 'googleapis';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const sa = JSON.parse(process.env.FIREBASE_SA || '{}');
if (!sa.project_id) { console.log('Segredo FIREBASE_SA não configurado.'); process.exit(0); }
console.log('Conta de serviço (compartilhe as pastas com este e-mail, como Leitor):', sa.client_email);
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();
const auth = new google.auth.JWT({ email: sa.client_email, key: sa.private_key, scopes: ['https://www.googleapis.com/auth/drive.readonly'] });
const drive = google.drive({ version: 'v3', auth });

const T0 = Date.now();
const LIMITE_MS = Number(process.env.LIMITE_MIN || 300) * 60e3; // job do GitHub vai até 6 h
const tempo = () => Date.now() - T0 < LIMITE_MS;
const IGNORAR = new Set(['1Ku5Qjo0J1Di1i_9B6VYk5XOcLbZ5hW0o']); // DOCUMENTAÇÃO PORTAL (destino das cópias)
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'inv-'));
const MAX_BAIXAR = 30 * 1024 * 1024;

const norm = v => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
const so11 = v => String(v ?? '').replace(/\D/g, '');
const chavePessoa = (cpf, alt) => (so11(cpf).length === 11 ? 'cpf_' + so11(cpf) : alt);

/* ---------- pessoas do portal (mesma regra do script de backup) ---------- */
async function pessoas() {
  const P = {};
  (await db.collection('funcionarios').get()).forEach(d => {
    const f = d.data(); const k = chavePessoa(f.cpf, 'f_' + d.id);
    P[k] = { k, nome: f.nome || '', cpf: so11(f.cpf), st: f.ativo !== false ? 'ativos' : (f.situacao === 'Em admissão' ? 'admissao' : 'desligados') };
  });
  (await db.collection('admissoes').get()).forEach(d => {
    const a = d.data(); const k = chavePessoa(a.cpf, 'a_' + d.id);
    if (!P[k]) P[k] = { k, nome: a.nome || '', cpf: so11(a.cpf), st: a.status === 'aberto' ? 'admissao' : 'desligados' };
    else if (a.status === 'aberto' && P[k].st === 'desligados') P[k].st = 'admissao';
  });
  const lista = Object.values(P).filter(p => p.nome);
  lista.forEach(p => { p.n = norm(p.nome); p.tok = p.n.split(' ').filter(t => t.length > 1); });
  const porCpf = new Map(lista.filter(p => p.cpf.length === 11).map(p => [p.cpf, p]));
  return { lista, porCpf };
}

/* ---------- identificação ---------- */
const PALAVRAS_NAO_NOME = /\b(DOC|DOCS|DOCUMENT|DOCUMENTOS|ASO|ASOS|NR|NRS|RH|ADMISS|DEMISS|RESCIS|MOBILIZ|CERTIFIC|TREINAM|INTEGRA|SEGURAN|PASTA|ARQUIVO|FOTO|FOTOS|NOVATOS|RESENDE|BM|LISTA|PLANILHA|CONTRATO|FICHA|EPI|EPIS|TERMO|PADRAO|IPAR|OS|CANCELADOS|PEDREIRO|HANNA|SAFETY|TAKE|CARE|GERAL|ANTIGO|ANTIGOS|NOVO|NOVA|COPIA|SCAN|IMG|WHATSAPP|\d)/;
function pareceNomeDePessoa(nomePasta) {
  const n = norm(nomePasta).replace(/\bCPF\b.*$/, '').trim();
  if (!n || PALAVRAS_NAO_NOME.test(n)) return '';
  const t = n.split(' ').filter(Boolean);
  return t.length >= 2 && t.length <= 7 && t.every(x => /^[A-Z]+$/.test(x)) ? n : '';
}
function acharPorNome(texto, P) {
  const s = ' ' + norm(texto) + ' ';
  // nome completo dentro do texto
  let ach = P.lista.filter(p => p.tok.length >= 2 && s.includes(' ' + p.n + ' '));
  if (ach.length === 1) return ach[0];
  if (ach.length > 1) { ach.sort((a, b) => b.n.length - a.n.length); if (ach[0].n.length > ach[1].n.length) return ach[0]; return null; }
  // primeiro + último nome
  ach = P.lista.filter(p => p.tok.length >= 2 && s.includes(' ' + p.tok[0] + ' ') && s.includes(' ' + p.tok[p.tok.length - 1] + ' ')
    && s.indexOf(' ' + p.tok[0] + ' ') < s.lastIndexOf(' ' + p.tok[p.tok.length - 1] + ' '));
  return ach.length === 1 ? ach[0] : null;
}
function acharPorCpf(texto, P) {
  const achados = new Set();
  for (const m of String(texto).matchAll(/(?<!\d)(\d{3})\.?(\d{3})\.?(\d{3})[-\s.]?(\d{2})(?!\d)/g)) {
    const c = m[1] + m[2] + m[3] + m[4]; if (P.porCpf.has(c)) achados.add(c);
  }
  return achados.size === 1 ? P.porCpf.get([...achados][0]) : null;
}

/* ---------- tipo de documento ---------- */
const TIPOS = [
  ['ASO', /\bA\s?S\s?O\b|ATESTADO DE SAUDE OCUPACIONAL/],
  ['FICHA EPI', /FICHA (DE )?(CONTROLE (DE )?)?(ENTREGA (DE )?)?EPI|FICHA DE EPI|CONTROLE DE ENTREGA DE EQUIPAMENTO/],
  ['TERMO EPI', /TERMO (DE )?(RESPONSABILIDADE|COMPROMISSO|RECEBIMENTO)?.{0,20}EPI/],
  ['ORDEM DE SERVICO', /ORDEM DE SERVICO|\bOS\b.{0,20}(SEGURANCA|NR ?1)/],
  ['INTEGRACAO', /INTEGRACAO/],
  ['TAKE CARE', /TAKE ?CARE/],
  ['SAFETY', /SAFETY/],
  ['CRC', /\bCRC\b|CARTEIRINHA/],
  ['NR', /\bNR ?-? ?\d{1,2}\b|NORMA REGULAMENTADORA/],
  ['CERTIFICADO', /CERTIFICADO|CERTIFICAMOS|TREINAMENTO|CAPACITACAO|RECICLAGEM/],
  ['CONTRACHEQUE / SALARIO', /CONTRA ?CHEQUE|HOLERITE|RECIBO DE PAGAMENTO|DEMONSTRATIVO DE PAGAMENTO|FOLHA DE PAGAMENTO/],
  ['RESCISAO', /RESCISAO|TRCT|AVISO PREVIO/],
  ['CONTRATO DE TRABALHO', /CONTRATO (INDIVIDUAL )?DE (TRABALHO|EXPERIENCIA)/],
  ['CTPS', /\bCTPS\b|CARTEIRA DE TRABALHO/],
  ['CNH', /\bCNH\b|HABILITACAO/],
  ['RG', /\bRG\b|IDENTIDADE|REGISTRO GERAL/],
  ['CPF', /\bCPF\b|CADASTRO DE PESSOAS FISICAS/],
  ['TITULO DE ELEITOR', /TITULO (DE )?ELEITOR/],
  ['RESERVISTA', /RESERVISTA|CERTIFICADO DE DISPENSA/],
  ['PIS', /\bPIS\b|\bNIS\b|PASEP/],
  ['CERTIDAO', /CERTIDAO DE (NASCIMENTO|CASAMENTO)|CERTIDAO/],
  ['COMPROVANTE DE RESIDENCIA', /COMPROVANTE DE (RESIDENCIA|ENDERECO)|CONTA DE (LUZ|AGUA)|\bLIGHT\b|\bENEL\b|\bCEDAE\b/],
  ['ESCOLARIDADE', /DIPLOMA|HISTORICO ESCOLAR|DECLARACAO ESCOLAR|ESCOLARIDADE/],
  ['VACINA', /VACINA/],
  ['FOTO', /\bFOTO\b|3X4/]
];
const SEG = new Set(['ASO', 'FICHA EPI', 'TERMO EPI', 'ORDEM DE SERVICO', 'INTEGRACAO', 'TAKE CARE', 'SAFETY', 'CRC', 'NR', 'CERTIFICADO']);
function tipoDe(nomeArq, caminho, texto) {
  const a = norm(nomeArq), b = norm(texto).slice(0, 3000), c = norm(caminho);
  for (const [t, rx] of TIPOS) if (rx.test(a)) return t;
  for (const [t, rx] of TIPOS) if (rx.test(b)) return t;
  for (const [t, rx] of TIPOS) if (rx.test(c)) return t;
  return 'OUTROS';
}
const nrsDe = s => [...new Set([...norm(s).matchAll(/\bNR ?-? ?(\d{1,2})\b/g)].map(m => 'NR-' + String(+m[1]).padStart(2, '0')))].slice(0, 6);
function datasDe(texto) {
  const out = []; const hoje = new Date();
  for (const m of String(texto).matchAll(/(?<!\d)(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4}|\d{2})(?!\d)/g)) {
    let [d, mm, y] = [+m[1], +m[2], +m[3]]; if (y < 100) y += 2000;
    if (d < 1 || d > 31 || mm < 1 || mm > 12 || y < 1990 || y > hoje.getFullYear() + 6) continue;
    out.push({ iso: `${y}-${String(mm).padStart(2, '0')}-${String(d).padStart(2, '0')}`, i: m.index });
  }
  return out;
}
function datasDoc(texto) {
  const ds = datasDe(texto); const hoje = new Date().toISOString().slice(0, 10);
  let validade = '';
  const U = String(texto).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  const m = /VALID[A-Z]*\W{0,20}(?:ATE\W{0,5})?(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4})/.exec(U);
  if (m) { const v = datasDe(m[1]); if (v[0]) validade = v[0].iso; }
  const hojeIso = hoje;
  const passadas = ds.map(x => x.iso).filter(x => x <= hojeIso && x !== validade).sort();
  return { data: passadas.length ? passadas[passadas.length - 1] : '', validade };
}

/* ---------- texto do arquivo ---------- */
function rodar(cmd, args, timeout = 120e3) { try { return execFileSync(cmd, args, { timeout, maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'ignore'] }).toString(); } catch (e) { return ''; } }
async function baixar(f) {
  const dst = path.join(TMP, 'a');
  const r = await drive.files.get({ fileId: f.id, alt: 'media', supportsAllDrives: true }, { responseType: 'arraybuffer' });
  fs.writeFileSync(dst, Buffer.from(r.data)); return dst;
}
async function textoDe(f) {
  const mime = f.mimeType || '';
  try {
    if (mime === 'application/vnd.google-apps.document') {
      const r = await drive.files.export({ fileId: f.id, mimeType: 'text/plain' }, { responseType: 'text' }); return { tx: String(r.data).slice(0, 20000), via: 'texto' };
    }
    if (+f.size > MAX_BAIXAR) return { tx: '', via: 'grande' };
    if (mime === 'application/pdf') {
      const a = await baixar(f);
      let tx = rodar('pdftotext', ['-l', '3', '-layout', a, '-']);
      if (tx.replace(/\s/g, '').length >= 60) return { tx, via: 'pdf' };
      rodar('pdftoppm', ['-r', '200', '-l', '2', '-gray', '-png', a, path.join(TMP, 'p')]);
      tx = fs.readdirSync(TMP).filter(x => /^p-\d+\.png$/.test(x)).sort().map(x => { const t = rodar('tesseract', [path.join(TMP, x), '-', '-l', 'por']); fs.rmSync(path.join(TMP, x)); return t; }).join('\n');
      return { tx, via: 'ocr' };
    }
    if (/^image\/(jpeg|png|tiff|bmp|webp)$/.test(mime)) {
      const a = await baixar(f); return { tx: rodar('tesseract', [a, '-', '-l', 'por']), via: 'ocr' };
    }
    if (/wordprocessingml|msword/.test(mime)) {
      const a = await baixar(f); fs.renameSync(a, a + '.docx');
      rodar('soffice', ['--headless', '--convert-to', 'txt:Text', '--outdir', TMP, a + '.docx'], 180e3);
      const t = path.join(TMP, 'a.txt'); const tx = fs.existsSync(t) ? fs.readFileSync(t, 'utf8') : ''; try { fs.rmSync(t); fs.rmSync(a + '.docx'); } catch (e) {}
      return { tx: tx.slice(0, 20000), via: 'docx' };
    }
  } catch (e) { return { tx: '', via: 'erro' }; }
  return { tx: '', via: 'so-nome' };
}

/* ---------- varredura ---------- */
async function listarFilhos(pasta) {
  const out = []; let pageToken;
  do {
    const r = await drive.files.list({ q: `'${pasta}' in parents and trashed = false`, pageSize: 1000, pageToken,
      fields: 'nextPageToken, files(id, name, mimeType, size, md5Checksum, modifiedTime)', supportsAllDrives: true, includeItemsFromAllDrives: true });
    out.push(...(r.data.files || [])); pageToken = r.data.nextPageToken;
  } while (pageToken);
  return out;
}
async function raizes() {
  const cfg = (await db.doc('config/inventario').get()).data() || {};
  if (Array.isArray(cfg.pastas) && cfg.pastas.length) return cfg.pastas.map(p => ({ id: p.id || p, name: p.nome || '' }));
  const out = []; let pageToken;
  do {
    const r = await drive.files.list({ q: "sharedWithMe and mimeType = 'application/vnd.google-apps.folder' and trashed = false", pageSize: 200, pageToken, fields: 'nextPageToken, files(id, name)' });
    out.push(...(r.data.files || [])); pageToken = r.data.nextPageToken;
  } while (pageToken);
  return out.filter(f => !IGNORAR.has(f.id));
}

/* ---------- principal ---------- */
const P = await pessoas();
const R = await raizes();
console.log('Pastas raiz compartilhadas:', R.length, '· pessoas no portal:', P.lista.length);
if (!R.length) { console.log('Nenhuma pasta compartilhada com a conta de serviço ainda.'); process.exit(0); }

const ja = new Map(); // id -> mod já processado
(await db.collection('drive_inv').select('mod', 'v').get()).forEach(d => ja.set(d.id, d.data()));
const VERSAO = 1;

const cont = { arquivos: 0, novos: 0, pulados: 0, cpf: 0, nome: 0, pasta: 0, sem: 0, ocr: 0 };
let lote = db.batch(), nLote = 0;
const gravar = async (id, o) => { lote.set(db.doc('drive_inv/' + id), o, { merge: true }); if (++nLote >= 200) { await lote.commit(); lote = db.batch(); nLote = 0; } };

const pilha = R.map(r => ({ id: r.id, caminho: [r.name], pessoaPasta: pareceNomeDePessoa(r.name) }));
const vistas = new Set();
while (pilha.length && tempo()) {
  const pz = pilha.pop(); if (vistas.has(pz.id) || IGNORAR.has(pz.id)) continue; vistas.add(pz.id);
  let filhos; try { filhos = await listarFilhos(pz.id); } catch (e) { continue; }
  for (const f of filhos) {
    if (!tempo()) break;
    if (f.mimeType === 'application/vnd.google-apps.folder') { pilha.push({ id: f.id, caminho: pz.caminho.concat(f.name), pessoaPasta: pareceNomeDePessoa(f.name) || pz.pessoaPasta }); continue; }
    if (f.mimeType === 'application/vnd.google-apps.shortcut') continue;
    cont.arquivos++;
    const ant = ja.get(f.id);
    if (ant && ant.mod === f.modifiedTime && ant.v === VERSAO) { cont.pulados++; continue; }
    const caminho = pz.caminho.join(' / ');
    const { tx, via } = await textoDe(f); if (via === 'ocr') cont.ocr++;
    // quem é: CPF no texto > nome no nome do arquivo/pastas > nome no texto > pasta com nome de pessoa (sem cadastro)
    let p = acharPorCpf(tx, P), metodo = p ? 'cpf' : '';
    if (!p) { p = acharPorNome(f.name + ' ' + caminho, P); if (p) metodo = 'nome-caminho'; }
    if (!p) { p = acharPorNome(tx.slice(0, 4000), P); if (p) metodo = 'nome-texto'; }
    const tipo = tipoDe(f.name, caminho, tx);
    const { data, validade } = datasDoc(tx);
    const o = {
      id: f.id, arquivo: f.name, caminho, mime: f.mimeType, tam: +f.size || 0, md5: f.md5Checksum || '', mod: f.modifiedTime, v: VERSAO,
      tipo, area: SEG.has(tipo) ? 'Segurança' : 'RH', nrs: nrsDe(f.name + ' ' + tx.slice(0, 4000)), data, validade,
      salario: tipo === 'CONTRACHEQUE / SALARIO' || /SALARIO|REMUNERACAO/.test(norm(tx).slice(0, 4000)),
      via, tx: tx.replace(/\s+/g, ' ').trim().slice(0, 4000), proc: new Date().toISOString(),
      pkey: '', pnome: '', pcpf: '', pst: '', metodo: '', destino: 'sem_id', acao: 'revisar'
    };
    if (p) {
      Object.assign(o, { pkey: p.k, pnome: p.nome, pcpf: p.cpf, pst: p.st, metodo, destino: p.st === 'desligados' ? 'morto' : 'pessoa', acao: 'copiar' });
      cont[metodo === 'cpf' ? 'cpf' : 'nome']++;
    } else if (pz.pessoaPasta) {
      // pasta com nome de pessoa que não está no portal: ex-funcionário sem cadastro → arquivo morto
      Object.assign(o, { pnome: pz.pessoaPasta, metodo: 'pasta', destino: 'morto_semcad', acao: 'copiar' });
      cont.pasta++;
    } else cont.sem++;
    await gravar(f.id, o); cont.novos++;
  }
}
if (nLote) await lote.commit();
await db.doc('config/inventario_estado').set({ ultima: new Date().toISOString(), completo: !pilha.length, pastasPendentes: pilha.length, cont }, { merge: true });
console.log('Resumo:', JSON.stringify(cont), pilha.length ? `· faltam ${pilha.length} pastas (continua na próxima rodada)` : '· varredura completa');
