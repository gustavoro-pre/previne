// Lê o e-mail da empresa (Zoho, por IMAP) e anexa na admissão certa os PDFs que a contabilidade devolve
// (contrato de trabalho, ficha de registro, acordos etc.). Roda no GitHub Actions.
// Segredos: FIREBASE_SA, CONTAB_IMAP_USER (ex.: engenharia@previneeletrica.com.br), CONTAB_IMAP_PASS (senha de app do Zoho).
// Só lê: não apaga, não move e não marca e-mails como lidos.
import admin from 'firebase-admin';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import crypto from 'node:crypto';

const sa = JSON.parse(process.env.FIREBASE_SA || '{}');
const USER = process.env.CONTAB_IMAP_USER, PASS = process.env.CONTAB_IMAP_PASS, HOST = process.env.CONTAB_IMAP_HOST || 'imap.zoho.com';
if (!sa.project_id || !USER || !PASS) { console.log('Segredos FIREBASE_SA / CONTAB_IMAP_USER / CONTAB_IMAP_PASS não configurados.'); process.exit(0); }
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

const PARTE = 700000, MAX_PDF = 8 * 1048576, DIAS = 21;
const PUBLICOS = new Set(['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com', 'yahoo.com.br', 'live.com', 'icloud.com', 'uol.com.br', 'bol.com.br', 'terra.com.br']);
const norm = v => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const dig = v => String(v ?? '').replace(/\D/g, '');
const rand = n => crypto.randomBytes(16).toString('hex').slice(0, n);
const sha = t => crypto.createHash('sha256').update(t, 'utf8').digest('hex');
const tituloDe = nome => String(nome || 'Documento').replace(/\.pdf$/i, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90) || 'Documento';

// quem conta como "contabilidade": os e-mails de config/admissao (Para, Cópia e, se houver, contabRemetentes)
const cfg = (await db.doc('config/admissao').get()).data() || {};
const ends = String([cfg.contabEmail, cfg.contabRemetentes].filter(Boolean).join(',')).toLowerCase().split(/[,;\s]+/).filter(x => x.includes('@'));
if (!ends.length) { console.log('Sem e-mail da contabilidade em config/admissao.'); process.exit(0); }
const doms = new Set(ends.map(e => e.split('@')[1]).filter(d => !PUBLICOS.has(d)));
const daContab = addr => { const a = String(addr || '').toLowerCase(); return ends.includes(a) || doms.has(a.split('@')[1]); };

// admissões em andamento que já foram à contabilidade
const abertas = (await db.collection('admissoes').where('status', '==', 'aberto').get()).docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() }))
  .filter(a => ((a.etapas || {}).contab || {}).data || (a.envios || []).some(x => x.status === 'enviado'));

function casar(txt) {
  const t = ' ' + norm(txt) + ' ', d = dig(txt);
  const pts = abertas.map(a => {
    const n = norm(a.nome), p = n.split(' ').filter(x => x.length > 2); let s = 0;
    if (dig(a.cpf).length === 11 && d.includes(dig(a.cpf))) s += 10;
    if (n && t.includes(' ' + n + ' ')) s += 6;
    else if (p.length >= 2 && t.includes(' ' + p[0] + ' ') && t.includes(' ' + p[p.length - 1] + ' ')) s += 3;
    return { a, s };
  }).filter(x => x.s > 0).sort((x, y) => y.s - x.s);
  if (!pts.length) return null;
  if (pts.length > 1 && pts[1].s === pts[0].s) return null; // empate: o RH escolhe no portal
  return pts[0].a;
}

async function gravarPartes(colPath, slot, b64) {
  const v = rand(6), partes = Math.max(1, Math.ceil(b64.length / PARTE));
  for (let i = 0; i < partes; i++) await db.doc(`${colPath}/${slot}_${v}_${i}`).set({ d: b64.slice(i * PARTE, (i + 1) * PARTE) });
  return { v, partes };
}

const cli = new ImapFlow({ host: HOST, port: 993, secure: true, auth: { user: USER, pass: PASS }, logger: false });
await cli.connect();
const lock = await cli.getMailboxLock('INBOX');
let lidos = 0, ligados = 0, soltos = 0;
try {
  const since = new Date(Date.now() - DIAS * 864e5);
  const uids = await cli.search({ since }, { uid: true });
  for await (const m of cli.fetch(uids, { uid: true, envelope: true }, { uid: true })) {
    const de = ((m.envelope.from || [])[0] || {}).address;
    if (!daContab(de)) continue;
    const mid = m.envelope.messageId || `${m.uid}@${USER}`;
    const ref = db.doc('contab_mail/' + sha(mid).slice(0, 24));
    if ((await ref.get()).exists) continue;
    const full = await cli.fetchOne(String(m.uid), { source: true }, { uid: true });
    const msg = await simpleParser(full.source); lidos++;
    const pdfs = (msg.attachments || []).filter(x => (/pdf/i.test(x.contentType) || /\.pdf$/i.test(x.filename || '')) && x.size <= MAX_PDF);
    const base = { de, assunto: msg.subject || '', em: (msg.date || new Date()).toISOString(), lidoEm: new Date().toISOString(), messageId: mid };
    if (!pdfs.length) { await ref.set({ ...base, status: 'sem_anexo' }); continue; }
    const a = casar([msg.subject, msg.text, pdfs.map(x => x.filename).join(' ')].join(' '));
    if (a) {
      const arq = {};
      for (const p of pdfs) {
        const b64 = p.content.toString('base64'); const id = 'ct' + rand(6); const g = await gravarPartes(`admissoes/${a.id}/d`, id, b64);
        arq[id] = { v: g.v, partes: g.partes, nome: p.filename || 'documento.pdf', tipo: 'application/pdf', tam: p.size, em: base.lidoEm, q: 'ok', prob: [], thumb: '', hash: sha(b64), titulo: tituloDe(p.filename), por: 'contabilidade (e-mail)' };
      }
      const cd = a.contabDocs || {};
      await a.ref.update({ contabDocs: { ...cd, arq: { ...(cd.arq || {}), ...arq }, recebidoEm: cd.recebidoEm || base.lidoEm, ultimoEm: base.lidoEm, emails: [...(cd.emails || []), { de, assunto: base.assunto, em: base.em }] } });
      a.contabDocs = { ...cd, arq: { ...(cd.arq || {}), ...arq } };
      await ref.set({ ...base, status: 'ligado', admissao: a.id, nome: a.nome, n: pdfs.length }); ligados++;
    } else {
      // sem candidato certo: guarda os PDFs para o RH ligar no portal
      const arqs = [];
      for (const [i, p] of pdfs.entries()) { const b64 = p.content.toString('base64'); const g = await gravarPartes(`contab_mail/${ref.id}/p`, 'f' + i, b64); arqs.push({ slot: 'f' + i, v: g.v, partes: g.partes, nome: p.filename || 'documento.pdf', tam: p.size, hash: sha(b64), titulo: tituloDe(p.filename) }); }
      await ref.set({ ...base, status: 'sem_candidato', arquivos: arqs, trecho: String(msg.text || '').slice(0, 400) }); soltos++;
    }
  }
} finally { lock.release(); await cli.logout().catch(() => {}); }
console.log(`e-mails da contabilidade lidos: ${lidos}; ligados a admissões: ${ligados}; sem candidato: ${soltos}`);
