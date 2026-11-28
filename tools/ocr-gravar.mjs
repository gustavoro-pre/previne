// PREVINE · Grava no cadastro (funcionarios) os dados lidos pelo OCR das pastas do RH (_ocr_*.json no Drive).
// Aprovado pelo Gustavo em 28/11/2026: CPF, data de nascimento e demais dados (PIS, último ASO, integração).
// Regras: só preenche campo VAZIO (ASO e integração: só se a data lida for mais nova); valor ambíguo não é gravado;
// cada gravação guarda a origem em funcionarios/{id}.ocrRH. Relatório em config/ocr_rh_gravacao.
// Repositório público: o log mostra só contagens.
import admin from 'firebase-admin';
import { google } from 'googleapis';
const sa = JSON.parse(process.env.FIREBASE_SA || '{}');
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();
const auth = new google.auth.JWT({ email: sa.client_email, key: sa.private_key, scopes: ['https://www.googleapis.com/auth/drive.readonly'] });
const drive = google.drive({ version: 'v3', auth });
const PASTA = process.env.PASTA || '1IX41_F_diN1oJEVbBRdBq1qozZNd8FY1';
const GRAVAR = process.env.MODO === 'gravar';

const norm = v => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
const so = v => String(v ?? '').replace(/\D/g, '');
const cpfOk = c => { c = so(c); if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false; const dv = n => { let s = 0; for (let i = 0; i < n; i++) s += +c[i] * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; }; return dv(9) === +c[9] && dv(10) === +c[10]; };
const iso = (d, m, a) => { d = +d; m = +m; a = +a; if (a < 100) a += a > 30 ? 1900 : 2000; if (!(d >= 1 && d <= 31 && m >= 1 && m <= 12)) return ''; return `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`; };
const addMeses = (s, n) => { const x = new Date(s + 'T12:00:00Z'); x.setUTCMonth(x.getUTCMonth() + n); return x.toISOString().slice(0, 10); };
const HOJE = new Date().toISOString().slice(0, 10);

// ---------- dados ----------
const lotes = [];
let tok;
do {
  const r = await drive.files.list({ q: `'${PASTA}' in parents and name contains '_ocr_' and mimeType = 'application/json' and trashed = false`, fields: 'nextPageToken, files(id,name)', pageSize: 200, pageToken: tok, supportsAllDrives: true, includeItemsFromAllDrives: true });
  for (const f of r.data.files) { const c = await drive.files.get({ fileId: f.id, alt: 'media', supportsAllDrives: true }, { responseType: 'text' }); try { const j = JSON.parse(c.data); if (Array.isArray(j)) lotes.push(...j); } catch (e) {} }
  tok = r.data.nextPageToken;
} while (tok);
const F = []; (await db.collection('funcionarios').get()).forEach(d => F.push(Object.assign({ id: d.id }, d.data())));
const porCpf = new Map(F.filter(f => cpfOk(f.cpf)).map(f => [so(f.cpf), f]));
const porNome = new Map(); F.forEach(f => { const k = norm(f.nome); if (!k) return; porNome.set(k, porNome.has(k) ? null : f); });
const nomeDe = s => norm(String(s || '').replace(/\.[a-z0-9]+$/i, '').split(/\s+-\s+/).slice(-1)[0]);
const pastaNome = s => norm(String(s || '').split(/\s+-\s+/)[0]);

// ---------- extração por arquivo ----------
const C = new Map(); // fid -> { nasc: Map(data -> n), cpf: Map, pis: Map, aso: [], integ: [], fontes: Set }
const cand = fid => { if (!C.has(fid)) C.set(fid, { nasc: new Map(), cpf: new Map(), pis: new Map(), aso: [], integ: [], fontes: {} }); return C.get(fid); };
const conta = (m, v) => m.set(v, (m.get(v) || 0) + 1);
let semDono = 0;
for (const a of lotes) {
  const tx = String(a.tx || ''); if (!tx) continue;
  const cpfs = [...new Set((tx.match(/\d{3}\.?\s?\d{3}\.?\s?\d{3}\s?[-\/.]?\s?\d{2}/g) || []).map(so).filter(cpfOk))];
  const arqNome = nomeDe(a.n), pasta = pastaNome(a.p);
  let f = null, forte = false;
  const c1 = cpfs.map(c => porCpf.get(c)).filter(Boolean);
  if (c1.length === 1) { f = c1[0]; forte = true; }
  if (!f && porNome.get(pasta)) f = porNome.get(pasta);
  if (!f && porNome.get(arqNome)) f = porNome.get(arqNome);
  if (!f) { semDono++; continue; }
  const K = norm(f.nome);
  // o arquivo é DESTA pessoa (e não de um dependente) quando o nome do arquivo é o dela, ou o CPF dela está no texto
  const proprio = forte || arqNome === K || (arqNome && K.startsWith(arqNome) && arqNome.split(' ').length >= 3) || (norm(tx).includes(K) && !/FILHO|FILHA|DEPENDENTE|CONJUGE|ESPOSA|MARIDO/.test(norm(a.n)));
  if (!proprio) continue;
  const c = cand(f.id); const fonte = k => { c.fontes[k] = c.fontes[k] || []; if (c.fontes[k].length < 5) c.fontes[k].push(a.id); };
  // nascimento: só data com rótulo
  const reN = /(?:NASCIMENTO(?:\s*\/\s*IDADE)?|DATA\s+DE\s+NASC\.?|DATE\s+OF\s+BIRTH|NASC\.)\s*[:.\-]*\s*(?:\/\s*[A-Za-z ]+)?\s*(\d{2})[\/.\-](\d{2})[\/.\-](\d{4})/gi;
  const ntx = tx.normalize('NFD').replace(/[̀-ͯ]/g, '');
  for (const m of ntx.matchAll(reN)) { const d = iso(m[1], m[2], m[3]); if (d && d >= '1940-01-01' && d <= '2010-12-31') { conta(c.nasc, d); fonte('nascimento'); } }
  if (forte || arqNome === K) for (const cp of cpfs) if (!porCpf.has(cp) || porCpf.get(cp).id === f.id) { conta(c.cpf, cp); fonte('cpf'); }
  for (const m of tx.matchAll(/PIS(?:\s*\/\s*PASEP|\s*\/\s*NIS)?\s*[:.]?\s*(\d{3}\.?\d{5}\.?\d{2}-?\d)/gi)) { conta(c.pis, so(m[1])); fonte('pis'); }
  if (a.k === 'ASO' || /ATESTADO DE SAUDE OCUPACIONAL/.test(norm(tx))) {
    const e = ntx.match(/Data\s+de\s+Emiss[a-z]*\s*:?\s*(\d{2})\/(\d{2})\/(\d{4})/i); const d = e ? iso(e[1], e[2], e[3]) : '';
    if (d && d <= HOJE) { const inapto = /\bINAPTO\b/i.test(ntx); c.aso.push({ d, apto: !inapto, id: a.id }); }
  }
  if (/TREINAMENTO INTRODUTORIO|INTEGRACAO/.test(norm(tx)) && /ARCELORMITTAL/.test(norm(tx))) {
    const m = tx.match(/na data\s+(\d{2})[.\/](\d{2})[.\/](\d{4})/i); const d = m ? iso(m[1], m[2], m[3]) : '';
    if (d && d <= HOJE) c.integ.push({ d, id: a.id });
  }
}
// ---------- decisão ----------
const dominante = m => { const L = [...m.entries()].sort((x, y) => y[1] - x[1]); if (!L.length) return { v: '' }; if (L.length === 1 || L[0][1] >= 2 * L[1][1]) return { v: L[0][0] }; return { v: '', amb: L.slice(0, 4).map(x => x[0]) }; };
const rel = { em: new Date().toISOString(), modo: GRAVAR ? 'gravar' : 'teste', arquivosLidos: lotes.length, semDono, itens: [], ambiguos: [] };
const cont = { pessoas: 0, nascimento: 0, cpf: 0, pis: 0, asoData: 0, integracaoData: 0, ambiguos: 0, jaTinha: 0, diferente: 0 };
const usados = new Set([...porCpf.keys()]);
for (const [fid, c] of C) {
  const f = F.find(x => x.id === fid); const set = {}; const n = norm(f.nome);
  const N = dominante(c.nasc);
  if (N.amb) { rel.ambiguos.push({ fid, nome: f.nome, campo: 'nascimento', valores: N.amb }); cont.ambiguos++; }
  else if (N.v) { if (!f.nascimento) set.nascimento = N.v; else if (String(f.nascimento).slice(0, 10) !== N.v) { cont.diferente++; rel.ambiguos.push({ fid, nome: f.nome, campo: 'nascimento (cadastro diferente do documento)', valores: [String(f.nascimento).slice(0, 10), N.v] }); } else cont.jaTinha++; }
  if (!cpfOk(f.cpf)) { const P = dominante(c.cpf); if (P.amb) { rel.ambiguos.push({ fid, nome: f.nome, campo: 'cpf', valores: P.amb }); cont.ambiguos++; } else if (P.v && !usados.has(P.v)) { set.cpf = P.v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4'); usados.add(P.v); } }
  if (!f.pis) { const P = dominante(c.pis); if (P.v) set.pis = P.v; }
  const aso = c.aso.sort((x, y) => y.d.localeCompare(x.d))[0];
  if (aso && aso.apto && addMeses(aso.d, 12) >= HOJE && (!f.asoData || String(f.asoData) < aso.d)) { set.asoData = aso.d; if (!f.asoValidade || String(f.asoValidade) < addMeses(aso.d, 12)) set.asoValidade = addMeses(aso.d, 12); }
  const it = c.integ.sort((x, y) => y.d.localeCompare(x.d))[0];
  if (it && (!f.integracaoData || String(f.integracaoData) < it.d)) set.integracaoData = it.d;
  const campos = Object.keys(set); if (!campos.length) continue;
  cont.pessoas++; campos.forEach(k => { if (k in cont) cont[k]++; });
  const fontes = {}; for (const k of campos) fontes[k] = k.startsWith('aso') ? [aso.id] : k === 'integracaoData' ? [it.id] : (c.fontes[k] || []);
  rel.itens.push({ fid, nome: f.nome, set, fontes });
  if (GRAVAR) await db.doc('funcionarios/' + fid).set(Object.assign({}, set, { ocrRH: { em: rel.em, campos, fontes, aprovadoPor: 'Gustavo Rogel de Almeida (28/11/2026)' } }), { merge: true });
}
// relatório (no Firestore, que é privado); listas grandes em partes
const parte = (L, n) => { const o = []; for (let i = 0; i < L.length; i += n) o.push(L.slice(i, i + n)); return o; };
await db.doc('config/ocr_rh_gravacao').set({ em: rel.em, modo: rel.modo, arquivosLidos: rel.arquivosLidos, semDono, cont, partes: Math.ceil(rel.itens.length / 150) || 0, ambiguos: rel.ambiguos });
for (const [i, p] of parte(rel.itens, 150).entries()) await db.doc('config/ocr_rh_gravacao/p/' + i).set({ itens: p, modo: rel.modo });
console.log((GRAVAR ? 'GRAVADO' : 'TESTE (nada gravado)') + ' · arquivos', lotes.length, '· sem dono', semDono, '·', JSON.stringify(cont));
