# Portal PREVINE — estado do projeto (atualizado em 27/11/2026)

Portal interno da PREVINE INSTALAÇÃO E MANUTENÇÃO ELÉTRICA LTDA (CNPJ 03.052.261/0001-43,
Av. Homero Leite, 198, Saudade, Barra Mansa – RJ). Dono: Gustavo Rogel de Almeida (gerente de operações).
Site: https://app.previneeletrica.com.br (GitHub Pages deste repositório: gustavoro-pre/previne).
Firebase: projeto `ferramentas-epi` (Firestore + Auth). Responder sempre em português do Brasil.

## Atenção
Mais de uma conversa pode estar mexendo neste repositório. Sempre `git pull --rebase` antes de editar e antes do push.

## Como publicar
1. Editar os arquivos. Se mexer em `ferramentas/index.html`, rodar `python3 build.py` (gera `treinamentos/index.html`).
2. Subir a versão do script na página (`adm.js?v=N`, `ficha.js?v=N`, `prop.js?v=N`…) e o cache em `sw.js` (`previne-vNN`; ver o número atual no `sw.js`).
   Arquivo novo de módulo: incluir também na lista `SHELL` do `sw.js`.
3. `git commit` + `git push` (main) publica no GitHub Pages em ~1 min.
4. Regras do Firestore (`firestore.rules`): depois do push, publicar no console do Firebase
   (aba Regras): buscar `https://app.previneeletrica.com.br/firestore.rules`, colar no editor e clicar em Publicar.
5. Rodapé dos commits: `Co-Authored-By: Claude …` e `Claude-Session: …` (como nos commits anteriores).

Testes locais: `/home/claude/test` (mock do Firebase `fbmock2.js`, scripts `t_*.py` com Playwright).
Servidor: `cd repo && python3 -m http.server 8766`. Libs do OCR para teste em `/home/claude/tess` (servir com `cors.py` na 8767).
Esses arquivos ficam só na sessão; numa sessão nova podem não existir.

## Regras do Gustavo (seguir sempre)
- Nunca digitar senhas dele. Tokens e chaves só ele coloca (GitHub Secrets ou no app). Criar contas, aceitar termos, pagar, 2FA e telas de permissão OAuth: ele faz ou aprova explicitamente.
- Confirmar antes de apagar algo de forma definitiva. No Google Drive, nunca mandar para a lixeira o que ele não pediu.
- Salários: só Gustavo, Thiago, Josilaine (e Cláudio quando tiver usuário) veem salários ou documentos com salário (`usuarios.verSalarios`). Ninguém mais.
- Mudança em dados de funcionário: só com OK explícito dele.
- Padrões e conteúdo de OS/ficha de EPI: nada vai para o portal sem ele aprovar.
- Conta Azul: mostrar a lista para aprovação antes de lançar qualquer coisa.
- Não usar envio pago de WhatsApp.
- Documentos internos seguem o modelo padrão: cabeçalho com logo, razão social, código, revisão, elaborado por, aprovado por; rodapé com código e página.
  Ficha cadastral: FOR-RH-001, elaborado por Gustavo Rogel de Almeida, aprovado por Claudio José de Almeida.

## Módulos (pastas)
- `ferramentas/` e `treinamentos/` (mesmo app; `build.py`), `aluno/` (portal do aluno), `indicadores/` (pessoas, folha, salários, horas, contracheques),
  `alocacao/`, `documentos/` (documentação ISO, `config/modelos`), `propostas/` (técnica e comercial em .docx), `admissao/`, `crm/` (só esqueleto, não publicado).
- `rel.js`: exportação Excel/PDF com cabeçalho padrão. `fb.js`: login e wrapper do Firestore. `index.html`: portal (avisos de de acordo, usuários).

## Admissão (o que está pronto)
- Link do candidato (`admissao/enviar.html` + `cand.js`): dados da ficha de registro (CLT/eSocial) + documentos + assinaturas (LGPD, carta, OS/ficha/termo de EPI, PDFs anexados pelo RH).
- `admissao/ficha.js`: ficha cadastral em PDF (FOR-RH-001), conferência dos dados × documentos (OCR no navegador com tesseract.js),
  tela de de acordo (`?aprov=<id do envio>`), leitura automática da data do ASO (e apto/inapto) e da integração ao anexar.
- Envio à contabilidade (`envios_contab`): RH pede → e-mail e notificação para quem aprova (`config/admissao.aprovEmails`: Gustavo e Josilaine) →
  um deles dá o de acordo no portal (a ficha é refeita com o nome de quem aprovou e com salário) → o script do Google manda o e-mail na data/hora marcada.
- Adicional na abertura: sem adicional / insalubridade / periculosidade. Etapas salvam sozinhas ao mudar (salário só no botão).

## Script do Google (Apps Script, conta previneime@gmail.com)
Projeto "PREVINE - Backup do portal para o Drive" (abrir em script.google.com na conta do script).
A versão em uso está no editor do Apps Script; `tools/backup-drive.gs` neste repositório é uma cópia antiga.
A conta previneime só LÊ o Firestore (Viewer). Funções principais:
- `sincronizar` (a cada hora): pastas por pessoa no Drive e cópia dos documentos da admissão e da Documentação.
- `enviarContab` (a cada 5 min): pedidos de de acordo e e-mails à contabilidade (MailApp, 100 e-mails/dia, 25 MB).
  `doGet` = web app que devolve o status dos envios para o portal
  (endereço fixo em `admissao/adm.js`, função `envStatus`).
- `consolidarRH` / `consolidarMob`: cópia das pastas antigas de RH (BM, NOVATOS, RESENDE, e "11. Mobilização Documentos") para a pasta de cada funcionário.
  Logs no Drive (pasta DOCUMENTAÇÃO PORTAL): `_consolidacao_rh_log.json`, `_consolidacao_mob_log.json`.
- `lerDocsRH`: OCR dos documentos do RH (`_ocr_rh/`), para montar planilha de certificados, CPF e nascimento (revisar antes de gravar no portal).

Notificações no celular: `.github/workflows/push.yml` (a cada 5 min, 6h–20h) roda `tools/push.mjs` com o segredo `FIREBASE_SA`.

## Inventário das pastas antigas (novo, 27/11 noite) — substitui o OCR/cópias que estouravam a cota do Apps Script
- LEITURA no GitHub: `.github/workflows/drive-inv.yml` (de hora em hora o dia todo, uma rodada por vez, + ao dar push no script, ou manual) roda `tools/drive-inv.mjs` com a conta de serviço
  (`FIREBASE_SA`, escopo drive.readonly). Varre as pastas compartilhadas com a conta de serviço (ou `config/inventario.pastas`), lê PDF/imagem
  (pdftotext + tesseract), identifica a pessoa (CPF no texto > nome no caminho > nome no texto > pasta com nome de pessoa sem cadastro),
  o tipo (ASO, NR, integração, Take Care, Safety, CRC, ficha/termo de EPI, documentos pessoais, salário…), datas e validade,
  e grava em Firestore `drive_inv/{idArquivo}` (destino: pessoa / morto / morto_semcad / sem_id). Estado em `config/inventario_estado`.
  Repositório público: o log só mostra contagens.
- CÓPIAS no Apps Script: `tools/inventario.gs` (colar no projeto do script; `instalarInventario` = a cada 15 min; `pararRotinasAntigas` desliga
  lerDocsRH/consolidarRH/consolidarMob/refazerMob). 1 chamada runQuery por rodada; cópias com DriveApp.makeCopy (não gastam UrlFetch).
  Ativo → pasta da pessoa/RH ou Segurança/"Pastas antigas"; desligado → DOCUMENTAÇÃO PORTAL/ARQUIVO MORTO - EX-FUNCIONÁRIOS/NOME - CPF;
  sem cadastro → .../_SEM CADASTRO NO PORTAL/NOME; salário → subpasta "Restrito - salário". Planilha "Inventário de cópias (origem → destino)".
- Depende do Gustavo: (1) ativar a Google Drive API no projeto ferramentas-epi (console do Google Cloud); (2) compartilhar as pastas antigas
  (RH, SEGURANÇA DO TRABALHO, Mobilização…) com o e-mail da conta de serviço, como Leitor; (3) publicar a regra `drive_inv` do Firestore;
  (4) colar `tools/inventario.gs` no Apps Script e rodar `pararRotinasAntigas`, `instalarInventario`, `instalarMapa` e `instalarBackupBanco` (ou eu faço quando o navegador voltar).
- BACKUP DO BANCO: `backupBanco` (inventario.gs) todo dia às 2h → DOCUMENTAÇÃO PORTAL/_BACKUP DO BANCO/AAAA-MM-DD/<coleção>.json.
- TESTE ANTES DE PUBLICAR: `.github/workflows/teste.yml` (a cada push) roda `node --check` nos scripts e abre cada página (tools/teste-paginas.mjs); falha se houver erro de JavaScript.
- NOVOS MÓDULOS 27/11 noite: Alocação → aba Medição (alocacao/med.js; med_mes, med_cfg) e Carteirinhas (carteirinhas/; cart, cart_cfg).
- ESCOPO (27/11, 19h14): Gustavo vai compartilhar o Drive INTEIRO. Funcionário ativo → pasta dele; inativo → arquivo morto; lista de origens para excluir depois.
  Todo o resto → planilha "Mapa geral do Drive" (função `mapaGeral` em inventario.gs, `instalarMapa` = a cada 2 h): abas Pastas e Arquivos,
  com "O que fazer" e "Finalidade" para o Gustavo preencher. Sem gastar tokens do Claude nem a cota de UrlFetch.
- Conta de serviço não pode ser dona de arquivo em Drive de Gmail comum: por isso as cópias ficam no Apps Script (conta previneime).
- Google Workspace (conta nova @previneeletrica.com.br, Drive compartilhado) avaliado: vale a pena DEPOIS da limpeza das pastas.

## Pendências (27/11/2026, fim da tarde)
0. Regras do Firestore: publicar no console a regra nova `epi_separacao` (alerta de EPI da mobilização). Sem isso o cartão não aparece.
1. Cota diária do Apps Script (urlfetch) estourou em 27/11 ~14h30: travou a cópia "11. Mobilização" (3.283/5.663) e o OCR do RH (3.080/5.261).
   Quando renovar: terminar as duas, rodar `refazerMob`. Pastas sem destino na Mobilização (Gustavo viu o conteúdo):
   PEDREIRO (admissões jul/2026: Leandro F. de Paula está no portal; Jorge A. Q. de Barros, Tarciso A. da Silva Jr., Wellington J. da Silva e Renato R. Gonçalves não),
   CANCELADOS (6 pessoas que não estão no portal), DOCUMENTOS HANNA (certificados NR-34/12 assinados de funcionários ativos: copiar para a pasta de cada um).
   Proposta aguardando OK: copiar HANNA/Leandro para a pasta de cada um e criar pastas "ex-funcionário / sem cadastro" para o resto. Nada é apagado.
2. Cópia RH: os 21 "sem destino" são 15 certificados de integração de 25/03 (só 4 pessoas estão no portal: Davidson, Daniel Costa, Deivison, Francisco Justo)
   + 6 arquivos gerais (listas, CONTRATO NOVO BM, DADOS PARA RHID). Os 222 "sem registro" precisam ser listados pelo script.
3. OCR do RH: planilha de revisão entregue ao Gustavo (Revisao_OCR_RH.xlsx): 189 pessoas, CPF 187 (35 ambíguos), nascimento 187 (12 ambíguos),
   132 dos 167 do portal batem pelo CPF; NRs quase não aparecem nessas pastas (só 40 pessoas). Gravar no portal só o que ele aprovar.
   ESCOPO NOVO pedido pelo Gustavo: ler as pastas RH e SEGURANÇA DO TRABALHO inteiras e trazer TODOS os documentos dos funcionários atuais e dependentes:
   ASO, integração, Take Care, Safety, certificados, treinamentos, carteirinha CRC, documentos pessoais e de dependentes (só os válidos, de funcionários atuais).
   Depois de montado o banco de dados ele vai excluir essas pastas.
   USO DOS DOCUMENTOS ANTIGOS (pedido de 27/11, 17h40), depois de ler RH + SEGURANÇA DO TRABALHO e identificar cada documento por pessoa (CPF/nome):
   a) Termo de EPI antigo assinado: anexar como o termo válido do funcionário antigo. DISPENSA assinar um novo no portal (decisão do Gustavo, 27/11).
   b) Ficha de EPI antiga: lançar em `entregas` o que ele já recebeu (registro histórico, origem 'historico', SEM mexer no estoque). Ficha não vence.
      EPI que não existe mais no cadastro: lançar com o nome escrito na ficha (decisão do Gustavo, 27/11).
      SEMPRE guardar o arquivo original (ficha, termo, certificado) ligado ao registro e copiado para a pasta do funcionário no Drive,
      para fiscalização. As pastas antigas só podem ser apagadas depois que cada arquivo tiver sua cópia conferida.
   c) Treinamentos do sistema antigo: lançar em `treinamentos` (origem 'historico', com o certificado anexado). Todas as NRs ficam como histórico;
      as válidas recebem a validade (data do certificado + `validadeMeses` do tipo em `trein_tipos`, ou a validade escrita no certificado) para o controle de vencimento.
      Sem validade escrita no certificado: usar a validade padrão do tipo (`validadeMeses`) — aprovado pelo Gustavo em 27/11.
   ARQUIVO MORTO (pedido de 27/11, 17h51): todos os arquivos de funcionários que JÁ SAÍRAM (status desligados no _controle_backup / portal)
   vão para uma pasta separada "ARQUIVO MORTO - EX-FUNCIONÁRIOS/<NOME - CPF>" no Drive (cópia, nada apagado), e uma planilha de caminhos
   (origem → destino, id do arquivo, data da cópia, conferido S/N) para depois apagar as origens. Mesma planilha de inventário do item 3.
   IPAR: 12 IPARs convertidos para o layout Previne (IPAR-TRF-001…013, sem o 009; código antigo citado no controle de revisões) + modelo em branco,
   entregues em 27/11 para aprovação. Depois do OK: subir no Drive/Documentação junto com os padrões.
   META: a partir da semana de 30/11/2026 todo mundo passa a ser controlado pelo portal; a documentação antiga continua guardada.
   Tudo passa por planilha de revisão e OK do Gustavo antes de gravar (dado de funcionário).
4. Leitura de e-mail (conta previneime@gmail.com): ler os documentos de admissão que chegam (da contabilidade), gravar no cadastro do funcionário
   e marcar campos de assinatura do funcionário e da empresa (Gustavo ou Thiago assina). Precisa do navegador/Apps Script. Ainda não começado.
5. EAD: planilha dos 81 padrões (Drive, pastas PADRÃO <ÁREA>) feita como Sheets: https://claude.ai/artifact/B4tQ7WqExaitw9HsRs9nwF
   Carga = 40 s por página, mín. 15 min, máx. 2 h, arredondada para cima de 15 em 15. PO-TRF-001 com páginas estimadas (arquivo traz contagem errada).
   Gustavo vai preencher Área/Subárea/Função; depois cadastrar os padrões como cursos no EAD e programar por função.
6. RHiD, SOC e CRM: como antes (aguardando Gustavo / clínica / limite diário).
7. Antigas: e-mail das NFs, OAuth do Conta Azul, lista de papéis dos padrões, valor do plano de saúde, OS por função para as outras funções,
   separar o cinto dos kits da trefilaria, filtro de outliers em Folha/Salários, texto da carta-convite com salário visível para todo o RH.

## Feito em 28/11
- OCR do RH gravado no cadastro (aprovado pelo Gustavo 28/11): workflow `ocr-gravar.yml` (modo teste/gravar) + tools/ocr-gravar.mjs.
  Só preenche campo vazio (ASO/integração só se mais novos; ASO só se ainda no prazo de 12 meses). Origem em funcionarios/{id}.ocrRH; relatório em config/ocr_rh_gravacao.
  Resultado: 136 pessoas · nascimento 136 · CPF 2 · PIS 11 · ASO 128 · integração 46. NRs/certificados NÃO gravados (vão com o arquivo anexado, pelo inventário).
- Treinamentos do sistema antigo (trein-hist.yml / tools/trein-hist.mjs, modo teste/gravar): drive_inv → treinamentos/hist_<arquivo> (origem historico, arquivoDrive).
  1ª carga: 575 (integração 295, NR 140, outros 133, Take Care 7). Rodar de novo quando o inventário terminar (não duplica). Certificado: abre o original no Drive.
- Ficha/termo de EPI antigos (epi-hist.yml / tools/epi-hist.mjs): entregas/hist_<arquivo>_<linha> (origem historico, sem estoque/custo/troca) e funcionarios.termoEpi (origem historico).
  1ª carga: 1.670 linhas de 115 pessoas (899 ligadas ao cadastro de EPI, 771 com o nome da ficha), 123 termos; 112 fichas sem linha legível. Links do original no cadastro do funcionário.
- Auditorias de piso/cruzada (campo/, aba Auditorias, checklists SSTSF ST DD 0042), advertências e nota de promoção (avaliacao/). Regra nova a publicar: advertencias.

## Lista de implementação (27/11 noite)
Planilha (Sheets) com 57 itens, prioridade, status e dependências: https://claude.ai/artifact/2e9JqJwpzFZfTF4kcp3eSH
Pedidos novos de 27/11 22h10:
- Alocação de OM → MEDIÇÃO HH: importar acompanhamento do portalRDO (siderurgia/trefilaria; aprovados, reprovados, enviados ao SAP, valor),
  roleta e ponto do RHiD; meta de medição por funcionário/local/OM (contrato fixo de HH; regra a confirmar com o Gustavo, ex.: 540 min/dia);
  painel medido × meta × trabalhado; quem falta lançar e quais dias; reprovados por funcionário; medido × trabalhado (roleta/ponto).
  Regras dele para apontamentos: sem HE buscar 540 min ou mais (30 min de tolerância + almoço); com HE, sem a tolerância.
- Segurança: imprimir carteirinha de bloqueio e CRC (aguardando o que a CRC precisa conter / modelo).

## Feito em 27/11 (noite)
- Alocação → aba Medição (med.js): importa acompanhamento do portalRDO (CSV, siderurgia+trefilaria juntos), roleta (xlsx, testada com a real) e ponto RHiD
  (genérico: batidas ou horas; ajustar ao arquivo real). Mapa do mês verde/laranja/vermelho/roxo, por funcionário, OM, local, faltam lançar, reprovados,
  previsto × realizado, medido × ponto × roleta. Tolerância 30 min e almoço 60 min em med_cfg/geral. Vínculo PN→funcionário em med_cfg/pn.
- Carteirinhas (novo módulo, gate ferramentas): etiqueta de bloqueio no modelo do Drive (telefone (24) 98855-7273, editável) e CRC guardada/impressa.
- Treinamentos: ficha de presença FOR-SST-002 com nº de verificação (listas_presenca/LP-AAAAMMDD-XXXXXX).
- Resumo semanal (segunda 7h, tools/vencimentos.mjs): NRs/externos 30 dias, CA 60 dias, experiência 45/90 dias → push para admin/gestão/gerente/TST/RH.
- Teste automático das páginas a cada push (teste.yml). Backup diário do banco (backupBanco no inventario.gs, depende do passo 4 do inventário).
- Carta-convite só para quem vê salários (UI + regra d/carta). Indicadores › Salários: filtro de valores fora da curva.
- Matriz por função (matriz/, gate treinamentos; matriz_funcao): proposta automática, revisão (gestor/TST) e aprovação (só admin; aprovar grava trein_tipos.obrig).
- Alocação: aptidão (NR obrigatória/NR-35) com badge "Não apto", filtro e justificativa ao programar (aptoJust).
- Ocorrências e ações (ocorrencias/, gate ferramentas): acidente, quase-acidente, NC, reclamação, auditoria; 5 porquês, ações, eficácia.
- Medição (28/11): importa a "LISTA DE FUNCIONÁRIOS – PREVINE – <MÊS>" (Drive › MEDIÇÕES, aba FUNCIONÁRIOS COM OM) → med_lista/{AAAA-MM}: matrícula AM, unidade, área, subárea, OM, status. Não lê salário. eSocial SST foi retirado a pedido do Gustavo.
- Tela inicial (28/11): 7 grupos (RH, Segurança do Trabalho, Operações, Financeiro, Comercial, Gestão, Portal do Aluno; GRUPOS/EXTRA no index.html; #g=<id>) e bloco "Assinaturas pendentes" no topo.
  Módulo assinaturas/ (ass.js): Para mim / Enviados por mim / Histórico, lendo treinamentos+aprov_lotes, docs, envios_contab, autorizacoes+decisoes, matriz_funcao (sem coleção nova).
- Checklists FOR-SST-101..129 (tools/checklists): semanais, marcação com X, leitor OMR (leitor.py; simulação 99,9%). Aguardando aprovação do Gustavo.
- 28/11 tarde: Medição mostra OM e base no mapa, letra da unidade em todo dia (cinza previsto, preta roleta) e amarelo quando fora da base. Indicadores › Pessoas: sexo (cadastro `sexo` ou estimado pelo 1º nome), % mulheres/homens, filtros sexo/faixa/função. Apadrinhamento (apadrinhamento/, coleção apadrinhamento) — aguardando o modelo do Gustavo.
- Regras novas a publicar: apadrinhamento, med_lista, campo, avaliacoes, med_mes, med_cfg, cart, cart_cfg, listas_presenca, matriz_funcao, ocorrencias, drive_inv, epi_separacao, admissoes/d/carta.

## Feito em 27/11 (tarde)
- Propostas: código SIG-AAAA-XXXXX (3 letras da sigla do cliente, ano, 5 números aleatórios), sem "Controle Previne"; canceladas fora da lista;
  botões Word e PDF (propostas/proppdf.js desenha o PDF a partir da mesma estrutura do PropDoc.build); todo texto justificado.
  Proposta ROLTH (RBI-2026-57820) passada para o portal.
- rel.js: botão "PDF do painel" automático em toda tela com .kpis (modelo REL-GER-002).
- Admissão da Mariane (TST): envio de teste apagado; data de admissão 01/12 mantida (envio real feito à contabilidade).
- EPI da mobilização: epi_separacao + cartão no painel de Ferramentas & EPI + badge "EPI x/y" na admissão.
