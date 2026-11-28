// PREVINE · Ficha e termo de EPI do sistema antigo (achados pelo inventário do Drive, drive_inv) → portal. Decisões do Gustavo (27/11/2026):
// a) termo antigo assinado vale como termo do funcionário (dispensa assinar novo): funcionarios/{id}.termoEpi = { origem:'historico', arquivoDrive, data }
// b) ficha antiga: cada linha vira `entregas` (origem 'historico', SEM mexer no estoque, sem custo e sem data de troca); EPI que não existe mais
//    no cadastro fica com o nome escrito na ficha. O arquivo original fica ligado ao registro (arquivoDrive).
// Só funcionários ATIVOS. Ids fixos (hist_<arquivo>_<linha>): rodar de novo não duplica. Repositório público: log só com contagens.
import admin from 'firebase-admin';
const sa = JSON.parse(process.env.FIREBASE_SA || '{}');
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();
const GRAVAR = process.env.MODO === 'gravar';
const norm = v => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
const so = v => String(v ?? '').replace(/\D/g, '');
const HOJE = new Date().toISOString().slice(0, 10);
const F = new Map(), porCpf = new Map();
(await db.collection('funcionarios').get()).forEach(d => { const f = Object.assign({ id: d.id }, d.data()); F.set(d.id, f); if (so(f.cpf).length === 11) porCpf.set(so(f.cpf), f); });
const EPIS = []; (await db.collection('epis').get()).forEach(d => EPIS.push(Object.assign({ id: d.id }, d.data())));
const jaEnt = new Set(); (await db.collection('entregas').select('funcionarioId', 'data', 'epiNome').get()).forEach(d => { const x = d.data(); jaEnt.add(x.funcionarioId + '|' + String(x.data).slice(0, 10) + '|' + norm(x.epiNome)); });
const docs = []; for (const t of ['FICHA EPI', 'TERMO EPI']) (await db.collection('drive_inv').where('tipo', '==', t).get()).forEach(d => docs.push(d.data()));

const LIXO = /\b(ASSINATURA|ENTREGUE POR|DATA DA TROCA|TROCA|QUANT|DESCRICAO DO EPI|RESPONSAVEL)\b.*$/;
function linhas(tx) {
  const t = String(tx || '').replace(/\s+/g, ' ');
  const re = /(?:^|\s)(\d{1,2})\s+(\d{2})\/(\d{2})\/(\d{2,4})\s+/g; const M = [...t.matchAll(re)]; const out = [];
  M.forEach((m, i) => {
    let a = +m[4]; if (a < 100) a += 2000; const d = `${a}-${m[3]}-${m[2]}`;
    if (!(+m[2] >= 1 && +m[2] <= 31 && +m[3] >= 1 && +m[3] <= 12) || d < '2010-01-01' || d > HOJE) return;
    let seg = t.slice(m.index + m[0].length, i + 1 < M.length ? M[i + 1].index : m.index + m[0].length + 160);
    seg = norm(seg).replace(LIXO, '').trim();
    const cas = seg.match(/\b\d{4,6}\b/g) || []; const ca = cas.length ? cas[cas.length - 1] : '';
    let desc = seg.replace(/\b\d{4,6}\b/g, ' ').replace(/\b(PP|P|M|G|GG|XG|EG|ML|\d{1,2})\s*$/, '').replace(/\s+/g, ' ').trim();
    if (desc.replace(/[^A-Z]/g, '').length < 4 || desc.length > 80) return;
    const q = +m[1]; if (!(q >= 1 && q <= 50)) return;
    out.push({ qtd: q, data: d, desc, ca });
  });
  return out;
}
function epiDe(l) {
  let p = l.ca ? EPIS.find(e => so(e.ca) === l.ca) : null;
  if (!p) { const k = l.desc.split(' ').slice(0, 2).join(' '); p = EPIS.find(e => norm(e.nome) === l.desc) || (k.length >= 6 ? EPIS.find(e => norm(e.nome).startsWith(k)) : null); }
  return p;
}
const bonito = s => s.toLowerCase().replace(/^./, c => c.toUpperCase());
const cont = { docs: docs.length, inativo: 0, semPessoa: 0, fichas: 0, fichasSemLinha: 0, linhas: 0, comCadastro: 0, nomeDaFicha: 0, repetidas: 0, termos: 0, termoJaTinha: 0, pessoasComFicha: 0 };
const termo = new Map(), vistos = new Set(), pessoasFicha = new Set();
let lote = db.batch(), n = 0; const put = async (ref, o) => { if (!GRAVAR) return; lote.set(ref, o, { merge: true }); if (++n >= 300) { await lote.commit(); lote = db.batch(); n = 0; } };
for (const o of docs) {
  if (o.destino !== 'pessoa' || o.pst !== 'ativos') { cont.inativo++; continue; }
  const f = String(o.pkey || '').startsWith('cpf_') ? porCpf.get(o.pkey.slice(4)) : F.get(String(o.pkey || '').slice(2));
  if (!f) { cont.semPessoa++; continue; }
  if (o.md5) { if (vistos.has(f.id + '|' + o.md5)) { cont.repetidas++; continue; } vistos.add(f.id + '|' + o.md5); }
  const L = o.tipo === 'FICHA EPI' ? linhas(o.tx) : [];
  // termo: o termo antigo e também a ficha antiga (que traz o termo de responsabilidade) valem como termo; fica o mais recente
  const dt = L.length ? L.map(l => l.data).sort().slice(-1)[0] : (o.data || '');
  const t0 = termo.get(f.id); if (!t0 || String(dt) > String(t0.data)) termo.set(f.id, { data: dt, arquivoDrive: { id: o.id, nome: o.arquivo, caminho: o.caminho || '' }, tipoDoc: o.tipo });
  if (o.tipo !== 'FICHA EPI') continue;
  cont.fichas++; if (!L.length) { cont.fichasSemLinha++; continue; }
  pessoasFicha.add(f.id);
  for (const [i, l] of L.entries()) {
    const p = epiDe(l); const nome = p ? String(p.nome) : bonito(l.desc);
    const k = f.id + '|' + l.data + '|' + norm(nome); if (jaEnt.has(k)) { cont.repetidas++; continue; } jaEnt.add(k);
    cont.linhas++; p ? cont.comCadastro++ : cont.nomeDaFicha++;
    await put(db.doc('entregas/hist_' + o.id + '_' + i), { origem: 'historico', numero: 'HIST-' + o.id.slice(0, 6) + '-' + (i + 1), data: l.data + 'T12:00:00.000Z',
      funcionarioId: f.id, funcionarioNome: String(f.nome || ''), matricula: String(f.matricula || ''), funcao: String(f.funcao || ''), area: String(f.area || ''),
      epiId: p ? p.id : '', epiNome: nome, ca: l.ca || (p ? String(p.ca || '') : ''), validadeCA: '', categoria: p ? String(p.categoria || '') : '', qtd: l.qtd, tamanho: '',
      motivo: 'Sistema antigo (ficha original no Drive)', custo: 0, proximaTroca: '', assinatura: '', responsavel: 'importacao-drive', estoqueId: '', estoqueNome: '',
      arquivoDrive: { id: o.id, nome: o.arquivo, caminho: o.caminho || '' }, aprovadoPor: 'Gustavo Rogel de Almeida (27/11/2026)' });
  }
}
cont.pessoasComFicha = pessoasFicha.size;
for (const [fid, t] of termo) { const f = F.get(fid); if (f.termoEpi && f.termoEpi.origem !== 'historico') { cont.termoJaTinha++; continue; } cont.termos++;
  await put(db.doc('funcionarios/' + fid), { termoEpi: Object.assign({ origem: 'historico', gravadoEm: new Date().toISOString(), aprovadoPor: 'Gustavo Rogel de Almeida (27/11/2026)' }, t) }); }
if (GRAVAR && n) await lote.commit();
await db.doc('config/epi_hist').set({ em: new Date().toISOString(), modo: GRAVAR ? 'gravar' : 'teste', cont });
console.log((GRAVAR ? 'GRAVADO' : 'TESTE (nada gravado)') + ' ·', JSON.stringify(cont));
