// PREVINE · Junta os resultados do OCR do RH (_ocr_*.json da pasta do script) e o cadastro (nome, CPF, nascimento)
// num pacote CRIPTOGRAFADO com a chave pública passada na execução. O repositório é público: nada sai em texto aberto.
import admin from 'firebase-admin';
import { google } from 'googleapis';
import fs from 'node:fs';
const sa = JSON.parse(process.env.FIREBASE_SA || '{}');
admin.initializeApp({ credential: admin.credential.cert(sa) });
const auth = new google.auth.JWT({ email: sa.client_email, key: sa.private_key, scopes: ['https://www.googleapis.com/auth/drive.readonly'] });
const drive = google.drive({ version: 'v3', auth });
const PASTA = process.env.PASTA;
const out = { ocr: {}, func: [] };
let tok;
do {
  const r = await drive.files.list({ q: `'${PASTA}' in parents and name contains '_ocr_' and trashed = false`, fields: 'nextPageToken, files(id,name)', pageSize: 200, pageToken: tok, supportsAllDrives: true, includeItemsFromAllDrives: true });
  for (const f of r.data.files) { const c = await drive.files.get({ fileId: f.id, alt: 'media', supportsAllDrives: true }, { responseType: 'text' }); out.ocr[f.name] = c.data; }
  tok = r.data.nextPageToken;
} while (tok);
(await admin.firestore().collection('funcionarios').get()).forEach(d => { const f = d.data(); out.func.push({ id: d.id, nome: f.nome || '', cpf: f.cpf || '', nascimento: f.nascimento || f.dataNascimento || '', ativo: f.ativo !== false, situacao: f.situacao || '', funcao: f.funcao || '' }); });
fs.writeFileSync('pacote.json', JSON.stringify(out));
console.log('arquivos OCR:', Object.keys(out.ocr).length, '· funcionários:', out.func.length);
