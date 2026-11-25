/* Importa os cursos EaD (apostilas em PDF + provas) para o módulo Treinamentos. Roda uma vez, na página de Treinamentos, com o usuário logado.
   Cada curso entra como RASCUNHO (inativo): falta preencher instrutor/responsável técnico e ativar. Não duplica cursos que já existem com o mesmo nome. */
window.importarCursos = async function (log) {
  log = log || console.log;
  const db = await claude.use('db'); const base = new URL('../_import/', location.href);
  const man = await (await fetch(new URL('cursos.json', base))).json();
  const tipos = (await db.collection('trein_tipos').get()).docs.map(d => Object.assign({ id: d.id }, d.data()));
  const cursos = (await db.collection('cursos').get()).docs.map(d => Object.assign({ id: d.id }, d.data()));
  const PARTE = 700000, agora = () => new Date().toISOString(); const res = [];
  const b64 = buf => { let s = ''; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode.apply(null, u.subarray(i, i + 32768)); return btoa(s); };
  const id = () => Math.random().toString(36).slice(2, 10);
  for (const c of man) {
    if (cursos.some(x => x.nome === c.nome)) { res.push(c.nome + ': já existia, não mexi'); continue; }
    let t = tipos.find(x => x.nome === c.nome) || tipos.find(x => String(x.norma || '').replace(/\s/g, '') === c.norma.replace(/\s/g, '') && Number(x.cargaHoraria) === c.cargaHoraria);
    if (!t) { const r = db.collection('trein_tipos').doc(); t = { id: r.id, nome: c.nome, norma: c.norma, cargaHoraria: c.cargaHoraria, validadeMeses: c.validadeMeses, conteudo: c.conteudo, criadoEm: agora() }; const d = Object.assign({}, t); delete d.id; await r.set(d); tipos.push(t); }
    const mods = [];
    for (const m of c.mods) {
      log('Enviando ' + m.nomePdf + '…');
      const dados = b64(await (await fetch(new URL(m.arquivo, base))).arrayBuffer()); const partes = Math.max(1, Math.ceil(dados.length / PARTE));
      const ref = db.collection('arquivos').doc();
      for (let i = 0; i < partes; i++) await db.doc(`arquivos/${ref.id}/p/${i}`).set({ i, d: dados.slice(i * PARTE, (i + 1) * PARTE) });
      await ref.set({ nome: m.nomePdf, tipo: 'application/pdf', tam: Math.round(dados.length * 0.75), partes, ref: 'curso', criadoEm: agora(), por: 'importação' });
      mods.push({ id: id(), titulo: m.titulo, mats: [{ id: id(), tipo: 'pdf', titulo: 'Apostila do módulo', minMin: m.minMin, url: '', texto: '', arquivoId: ref.id }], quiz: { qs: m.qs, min: 70, tent: 3 } });
    }
    await db.collection('cursos').doc().set({ nome: c.nome, tipoId: t.id, cargaHoraria: c.cargaHoraria, minHoras: 0, prazoDias: 30, pratica: c.pratica, instrutor: '', instrutorQualif: '', descricao: 'Material PREVINE ELÉTRICA. Prova de 5 questões por módulo, nota mínima de 70%.', mods, ativo: false, criadoEm: agora(), por: 'importação', instrutorAssin: '' });
    res.push(c.nome + ': criado (' + mods.length + ' módulos, rascunho)');
  }
  log(res.join('\n')); return res;
};
