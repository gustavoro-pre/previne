// PREVINE · Lança em `treinamentos` (origem 'historico') os certificados do sistema antigo achados pelo inventário do Drive
// (drive_inv: NR, certificados, Take Care, Safety, integração) de funcionários ATIVOS. Decisões do Gustavo (27 e 28/11/2026):
// todas as NRs como histórico; validade escrita no certificado ou, sem ela, data + validadeMeses do tipo (trein_tipos).
// O arquivo original fica ligado ao registro (arquivoDrive). Id do registro = hist_<id do arquivo>: rodar de novo não duplica.
// Repositório público: o log mostra só contagens.
import admin from 'firebase-admin';
const sa = JSON.parse(process.env.FIREBASE_SA || '{}');
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();
const GRAVAR = process.env.MODO === 'gravar';
const norm = v => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
const so = v => String(v ?? '').replace(/\D/g, '');
const HOJE = new Date().toISOString().slice(0, 10);
const addMeses = (s, n) => { const x = new Date(s + 'T12:00:00Z'); x.setUTCMonth(x.getUTCMonth() + n); return x.toISOString().slice(0, 10); };

const F = new Map(), porCpf = new Map();
(await db.collection('funcionarios').get()).forEach(d => { const f = Object.assign({ id: d.id }, d.data()); F.set(d.id, f); if (so(f.cpf).length === 11) porCpf.set(so(f.cpf), f); });
const TT = []; (await db.collection('trein_tipos').get()).forEach(d => TT.push(Object.assign({ id: d.id }, d.data())));
const ja = new Set(); (await db.collection('treinamentos').select('funcionarioId', 'tipoNome', 'termino').get()).forEach(d => { const x = d.data(); ja.add(x.funcionarioId + '|' + norm(x.tipoNome) + '|' + x.termino); });
const TIPOS = ['NR', 'CERTIFICADO', 'TAKE CARE', 'SAFETY', 'INTEGRACAO'];
const docs = []; for (const t of TIPOS) (await db.collection('drive_inv').where('tipo', '==', t).get()).forEach(d => docs.push(d.data()));

const porNome = k => TT.find(t => norm(t.nome).includes(k));
function tipoDe(o) {
  const T = norm(o.arquivo + ' ' + (o.tx || '').slice(0, 2500));
  if (o.tipo === 'TAKE CARE') return { t: porNome('TAKE CARE'), nome: 'Take Care' };
  if (o.tipo === 'SAFETY') return { t: porNome('SAFETY'), nome: 'Safety' };
  if (o.tipo === 'INTEGRACAO') return { t: porNome('INTEGRA'), nome: 'Integração de segurança ArcelorMittal' };
  const nr = (o.nrs || [])[0];
  if (nr) {
    let C = TT.filter(t => norm(t.norma).replace(/ /g, '') === norm(nr).replace(/ /g, '') || norm(t.norma).startsWith(norm(nr) + ' '));
    const quer = k => C.filter(t => norm(t.nome).includes(k));
    if (/\bSEP\b|SISTEMA ELETRICO DE POTENCIA/.test(T) && quer('SEP').length) C = quer('SEP'); else C = C.filter(t => !norm(t.nome).includes('SEP'));
    if (/RECICLAGEM|PERIODICO/.test(T) && quer('RECICLAGEM').length) C = quer('RECICLAGEM'); else if (C.some(t => !norm(t.nome).includes('RECICLAGEM'))) C = C.filter(t => !norm(t.nome).includes('RECICLAGEM'));
    C.sort((a, b) => String(a.nome).length - String(b.nome).length);
    return { t: C[0], nome: C[0] ? C[0].nome : nr + ' (sistema antigo)', norma: nr };
  }
  const base = String(o.arquivo || '').replace(/\.[a-z0-9]+$/i, '').split(/\s+-\s+/)[0].trim();
  return { t: null, nome: base ? 'Certificado: ' + base : 'Certificado (sistema antigo)' };
}
const cont = { docs: docs.length, inativo: 0, semPessoa: 0, semData: 0, repetido: 0, gravados: 0, comTipo: 0, comValidade: 0, vigentes: 0, nr: 0, takecare: 0, safety: 0, integracao: 0, outros: 0 };
const vistos = new Set();
let lote = db.batch(), n = 0;
for (const o of docs) {
  if (o.destino !== 'pessoa' || o.pst !== 'ativos') { cont.inativo++; continue; }
  const f = String(o.pkey || '').startsWith('cpf_') ? porCpf.get(o.pkey.slice(4)) : F.get(String(o.pkey || '').slice(2));
  if (!f) { cont.semPessoa++; continue; }
  if (!o.data || o.data > HOJE || o.data < '2000-01-01') { cont.semData++; continue; }
  const { t, nome, norma } = tipoDe(o);
  const chave = f.id + '|' + norm(nome) + '|' + o.data;
  if (ja.has(chave) || vistos.has(chave) || (o.md5 && vistos.has('md5|' + f.id + '|' + o.md5))) { cont.repetido++; continue; }
  vistos.add(chave); if (o.md5) vistos.add('md5|' + f.id + '|' + o.md5);
  const validade = o.validade && o.validade > o.data ? o.validade : (t && +t.validadeMeses ? addMeses(o.data, +t.validadeMeses) : '');
  const r = { origem: 'historico', funcionarioId: f.id, nome: String(f.nome || '').trim(), matricula: String(f.matricula || ''), cpf: String(f.cpf || ''), funcao: String(f.funcao || ''),
    tipoId: t ? t.id : '', tipoNome: nome, norma: String((t && t.norma) || norma || ''), cargaHoraria: t ? +t.cargaHoraria || 0 : 0, conteudo: '',
    inicio: o.data, termino: o.data, validade, local: '', instrutor: '', codigo: 'HIST-' + o.id.slice(0, 8),
    arquivoDrive: { id: o.id, nome: o.arquivo, caminho: o.caminho || '' }, validadeOrigem: o.validade && o.validade > o.data ? 'certificado' : validade ? 'padrao do tipo' : '',
    criadoEm: new Date().toISOString(), por: 'importacao-drive (aprovado por Gustavo Rogel de Almeida em 27-28/11/2026)' };
  cont.gravados++; if (t) cont.comTipo++; if (validade) cont.comValidade++; if (validade && validade >= HOJE) cont.vigentes++;
  cont[{ NR: 'nr', 'TAKE CARE': 'takecare', SAFETY: 'safety', INTEGRACAO: 'integracao' }[o.tipo] || 'outros']++;
  if (GRAVAR) { lote.set(db.doc('treinamentos/hist_' + o.id), r, { merge: true }); if (++n >= 300) { await lote.commit(); lote = db.batch(); n = 0; } }
}
if (GRAVAR && n) await lote.commit();
await db.doc('config/trein_hist').set({ em: new Date().toISOString(), modo: GRAVAR ? 'gravar' : 'teste', cont });
console.log((GRAVAR ? 'GRAVADO' : 'TESTE (nada gravado)') + ' ·', JSON.stringify(cont));
