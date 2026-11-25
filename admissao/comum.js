/* Admissão: lista de documentos, conferência de qualidade da foto e envio em partes. Usado pelo RH e pela página do candidato. */
"use strict";
(function () {
  const SLOTS = [
    { id: 'foto', t: 'Foto de rosto (tipo 3x4)', d: 'De frente, fundo claro, sem boné nem óculos escuros.', obr: true, selfie: true, max: 1 },
    { id: 'rg', t: 'RG ou CNH (frente e verso)', d: 'Pode mandar a CNH digital em PDF.', obr: true, max: 3 },
    { id: 'cpf', t: 'CPF', d: 'Só se o número não estiver no RG ou na CNH.', obr: false, max: 2 },
    { id: 'ctps', t: 'Carteira de trabalho digital', d: 'PDF ou print da Carteira de Trabalho Digital (app), com os dados pessoais e os contratos.', obr: true, max: 4 },
    { id: 'pis', t: 'PIS / NIS', d: 'Se não aparecer na carteira de trabalho.', obr: false, max: 2 },
    { id: 'titulo', t: 'Título de eleitor', d: 'Pode ser o e-Título.', obr: true, max: 2 },
    { id: 'reservista', t: 'Certificado de reservista', d: 'Homens de 18 a 45 anos.', obr: false, max: 2 },
    { id: 'residencia', t: 'Comprovante de residência', d: 'Conta de luz, água ou telefone dos últimos 3 meses.', obr: true, max: 2 },
    { id: 'escolaridade', t: 'Comprovante de escolaridade', d: 'Diploma, certificado ou histórico do maior grau concluído.', obr: true, max: 3 },
    { id: 'certidao', t: 'Certidão de nascimento ou casamento', d: '', obr: true, max: 2 },
    { id: 'filhos', t: 'Filhos: certidão, CPF e vacinação', d: 'Filhos menores de 14 anos: certidão e CPF. Menores de 7: cartão de vacina.', obr: false, max: 6 },
    { id: 'cursos', t: 'Certificados de cursos e NRs', d: 'NR-10, NR-35, NR-33, curso técnico, se tiver.', obr: false, max: 8 },
    { id: 'registro', t: 'Registro profissional (CREA / CFT)', d: 'Só para técnicos e engenheiros.', obr: false, max: 2 },
    { id: 'cnpj', t: 'Cartão CNPJ', d: 'Comprovante de inscrição do CNPJ (site da Receita).', obr: true, max: 1, pj: true },
    { id: 'contrato', t: 'Contrato social ou certificado MEI', d: '', obr: true, max: 4, pj: true }
  ];
  /* PJ (prestador): pede CNPJ e contrato social; carteira de trabalho e documentos de registro CLT ficam opcionais */
  const OBR_PJ = ['foto', 'rg', 'residencia', 'cnpj', 'contrato'];
  function slotsDe(a) { const pj = a && a.vinculo === 'PJ'; return SLOTS.filter(s => pj || !s.pj).map(s => pj ? Object.assign({}, s, { obr: OBR_PJ.includes(s.id) }) : s); }
  const PARTE = 700000, MAX_PDF = 8 * 1048576;
  const rand = n => { const a = new Uint8Array(n); crypto.getRandomValues(a); return [...a].map(x => 'abcdefghijkmnpqrstuvwxyz23456789'[x % 32]).join(''); };
  const dig = s => String(s || '').replace(/\D/g, '');
  function cpfOk(c) { c = dig(c); if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false; const dv = k => { let s = 0; for (let i = 0; i < k; i++) s += +c[i] * (k + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; }; return dv(9) === +c[9] && dv(10) === +c[10]; }
  const fmtCpf = c => { c = dig(c); return c.length === 11 ? c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : c; };
  const lerURL = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(f); });
  const carregarImg = url => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Não foi possível abrir a imagem.')); i.src = url; });
  /* qualidade da foto: resolução, nitidez (variação do laplaciano) e iluminação */
  function qualidade(img) {
    const menor = Math.min(img.width, img.height); const k = Math.min(1, 640 / Math.max(img.width, img.height));
    const w = Math.max(8, Math.round(img.width * k)), h = Math.max(8, Math.round(img.height * k));
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.drawImage(img, 0, 0, w, h);
    const p = x.getImageData(0, 0, w, h).data; const g = new Float32Array(w * h); let soma = 0;
    for (let i = 0; i < w * h; i++) { g[i] = 0.299 * p[i * 4] + 0.587 * p[i * 4 + 1] + 0.114 * p[i * 4 + 2]; soma += g[i]; }
    const media = soma / (w * h); let s1 = 0, s2 = 0, n = 0;
    for (let y = 1; y < h - 1; y++) for (let xx = 1; xx < w - 1; xx++) { const i = y * w + xx; const l = g[i - 1] + g[i + 1] + g[i - w] + g[i + w] - 4 * g[i]; s1 += l; s2 += l * l; n++; }
    const nit = n ? s2 / n - (s1 / n) ** 2 : 0;
    const prob = [];
    if (menor < 600) prob.push('resolução baixa: aproxime o celular ou use a câmera traseira');
    if (nit < 60) prob.push('foto tremida ou desfocada');
    if (media < 55) prob.push('foto escura: procure um lugar mais iluminado');
    if (media > 235) prob.push('foto muito clara ou com reflexo');
    return { ok: !prob.length, prob, nit: Math.round(nit), luz: Math.round(media), menor };
  }
  /* prepara o arquivo: imagem é reduzida para JPEG e conferida; PDF vai como está */
  async function preparar(file) {
    if (!file) throw new Error('Nenhum arquivo.');
    if (/^image\//.test(file.type) || /\.(jpe?g|png|heic|webp)$/i.test(file.name || '')) {
      const img = await carregarImg(await lerURL(file)); const q = qualidade(img);
      const k = Math.min(1, 1800 / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
      const url = c.toDataURL('image/jpeg', 0.82); return { b64: url.slice(url.indexOf(',') + 1), tipo: 'image/jpeg', nome: (file.name || 'foto').replace(/\.[^.]+$/, '') + '.jpg', q, thumb: miniatura(c) };
    }
    if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '')) {
      if (file.size > MAX_PDF) throw new Error(`PDF muito grande (${(file.size / 1048576).toFixed(1)} MB). O limite é 8 MB.`);
      const url = await lerURL(file); return { b64: url.slice(url.indexOf(',') + 1), tipo: 'application/pdf', nome: file.name || 'documento.pdf', q: { ok: true, prob: [] }, thumb: '' };
    }
    throw new Error('Envie foto (JPG, PNG) ou PDF.');
  }
  function miniatura(c) { const k = 160 / Math.max(c.width, c.height); const m = document.createElement('canvas'); m.width = Math.round(c.width * k); m.height = Math.round(c.height * k); m.getContext('2d').drawImage(c, 0, 0, m.width, m.height); return m.toDataURL('image/jpeg', 0.6); }
  /* grava em partes: setPart(id, texto) é passado por quem chama (RH ou candidato) */
  async function gravar(prep, slot, setPart) {
    const v = rand(6); const partes = Math.max(1, Math.ceil(prep.b64.length / PARTE));
    for (let i = 0; i < partes; i++) await setPart(`${slot}_${v}_${i}`, prep.b64.slice(i * PARTE, (i + 1) * PARTE));
    return { v, nome: prep.nome, tipo: prep.tipo, tam: Math.round(prep.b64.length * 0.75), partes, em: new Date().toISOString(), q: prep.q.ok ? 'ok' : 'baixa', prob: prep.q.prob || [], thumb: prep.thumb || '' };
  }
  async function ler(arq, slot, getPart) {
    let b64 = ''; for (let i = 0; i < arq.partes; i++) { const d = await getPart(`${slot}_${arq.v}_${i}`); if (d == null) throw new Error('Arquivo incompleto. Tente de novo em instantes.'); b64 += d; }
    const bin = atob(b64); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return new Blob([u8], { type: arq.tipo });
  }
  /* situação dos documentos: obrigatórios enviados, recusados e conferidos */
  function docsSt(a) {
    const docs = (a.cand && a.cand.docs) || {}, rev = a.rev || {};
    const SL = slotsDe(a); const obr = SL.filter(s => s.obr); const env = obr.filter(s => (docs[s.id] || []).length);
    const rej = SL.filter(s => (docs[s.id] || []).length && rev[s.id] && rev[s.id].st === 'rej' && str(rev[s.id].em) >= ultimoEnvio(docs[s.id]));
    const pendRev = SL.filter(s => (docs[s.id] || []).length && !(rev[s.id] && str(rev[s.id].em) >= ultimoEnvio(docs[s.id])));
    const ok = obr.filter(s => rev[s.id] && rev[s.id].st === 'ok' && str(rev[s.id].em) >= ultimoEnvio(docs[s.id] || []));
    return { obr: obr.length, env: env.length, rej, pendRev, ok: ok.length, faltam: obr.filter(s => !(docs[s.id] || []).length) };
  }
  const str = v => v == null ? '' : String(v);
  const ultimoEnvio = L => (L || []).reduce((m, x) => str(x.em) > m ? str(x.em) : m, '');

  /* textos padrão (o RH pode mudar em Admissão → Modelos). Campos entre chaves são trocados pelos dados da admissão. */
  const CARTA_PADRAO = `Prezado(a) {nome},

Temos a satisfação de informar que você foi aprovado(a) no nosso processo seletivo e convidamos você para fazer parte da equipe da {empresa}.

Dados da proposta:
Nome completo: {nome}
CPF: {cpf}
Função: {funcao}
Área: {area}
Local de trabalho: {unidade}
Remuneração mensal: {salario}
Vínculo: {vinculo}

Benefícios:
{beneficios}

A contratação se concretiza após a entrega dos documentos, o exame admissional (ASO) com resultado apto e a integração de segurança. Nos próximos passos você vai enviar seus dados e documentos por este mesmo link, e o RH vai acompanhar você até o primeiro dia de trabalho.

Seja muito bem-vindo(a)! Contamos com você para trabalhar com segurança, qualidade e respeito.

Atenciosamente,
{empresa}
CNPJ {cnpj}`;
  const BENEF_PADRAO = `• Cartão alimentação de R$ 500,00 por mês, sendo R$ 250,00 de alimentação e R$ 250,00 de assiduidade.
• Plano de saúde coparticipativo, após o término do período de experiência.`;
  const BENEF_PJ = '• Conforme o contrato de prestação de serviços (contratação como pessoa jurídica).';
  const LGPD_PADRAO = `TERMO DE CIÊNCIA E CONSENTIMENTO PARA TRATAMENTO DE DADOS PESSOAIS (Lei nº 13.709/2018 – LGPD)

Eu, {nome}, CPF {cpf}, declaro estar ciente de que a {empresa}, inscrita no CNPJ {cnpj} ("Empresa"), na condição de controladora, tratará os meus dados pessoais para as finalidades descritas abaixo.

1. Dados tratados: dados de identificação e documentos pessoais; endereço e contatos; escolaridade e qualificações; dados de dependentes; dados bancários; fotografia; e dados de saúde ocupacional (exames admissionais e periódicos – ASO).

2. Finalidades: processo de admissão e registro do contrato; cumprimento de obrigações legais e regulatórias (trabalhistas, previdenciárias, fiscais, eSocial e normas de segurança e saúde no trabalho); folha de pagamento e benefícios; treinamentos, integração e controle de acesso nos clientes onde os serviços serão prestados; e emissão de crachá e documentos de segurança.

3. Compartilhamento: os dados poderão ser compartilhados, somente no necessário, com o escritório de contabilidade, a clínica de medicina do trabalho, órgãos públicos (eSocial, Receita Federal, Ministério do Trabalho), instituições bancárias e de benefícios, e com os clientes da Empresa para fins de integração e liberação de acesso.

4. Guarda: os dados serão mantidos pelo tempo necessário às finalidades acima e pelos prazos exigidos em lei. Os documentos enviados por este link ficam armazenados com acesso restrito ao RH.

5. Direitos: posso, a qualquer momento, pedir confirmação, acesso, correção, anonimização, portabilidade ou eliminação dos dados, bem como informações sobre o compartilhamento, nos termos do art. 18 da LGPD, pelo contato do RH da Empresa. Dados necessários ao cumprimento de obrigação legal ou à execução do contrato de trabalho não dependem de consentimento e serão mantidos enquanto exigido.

6. Declaro que as informações e documentos que vou enviar são verdadeiros e que li e compreendi este termo.`;
  const moeda = v => (v == null || v === '' || !isFinite(+v)) ? 'a combinar' : (+v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  function preencher(tpl, a, extra) {
    const vars = Object.assign({ nome: a.nome, cpf: fmtCpf(a.cpf), funcao: a.funcao, area: [a.area, a.subarea].filter(Boolean).join(' / ') || '—', unidade: a.unidade || '—', vinculo: a.vinculo === 'PJ' ? 'PJ (prestação de serviços)' : 'CLT' }, extra || {});
    return String(tpl || '').replace(/\{(\w+)\}/g, (m, k) => vars[k] != null && vars[k] !== '' ? String(vars[k]) : m === '{salario}' ? 'a combinar' : '—');
  }
  async function sha256(txt) { const b = new TextEncoder().encode(txt); const h = await crypto.subtle.digest('SHA-256', b); return [...new Uint8Array(h)].map(x => x.toString(16).padStart(2, '0')).join(''); }
  window.ADM = { CARTA_PADRAO, LGPD_PADRAO, BENEF_PADRAO, BENEF_PJ, moeda, preencher, sha256, SLOTS, slotsDe, rand, dig, cpfOk, fmtCpf, preparar, gravar, ler, docsSt, ultimoEnvio, qualidade };
})();
