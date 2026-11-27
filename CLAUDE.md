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
4. Leitura de e-mail (conta previneime@gmail.com): ler os documentos de admissão que chegam (da contabilidade), gravar no cadastro do funcionário
   e marcar campos de assinatura do funcionário e da empresa (Gustavo ou Thiago assina). Precisa do navegador/Apps Script. Ainda não começado.
5. EAD: planilha dos 81 padrões (Drive, pastas PADRÃO <ÁREA>) feita como Sheets: https://claude.ai/artifact/B4tQ7WqExaitw9HsRs9nwF
   Carga = 40 s por página, mín. 15 min, máx. 2 h, arredondada para cima de 15 em 15. PO-TRF-001 com páginas estimadas (arquivo traz contagem errada).
   Gustavo vai preencher Área/Subárea/Função; depois cadastrar os padrões como cursos no EAD e programar por função.
6. RHiD, SOC e CRM: como antes (aguardando Gustavo / clínica / limite diário).
7. Antigas: e-mail das NFs, OAuth do Conta Azul, lista de papéis dos padrões, valor do plano de saúde, OS por função para as outras funções,
   separar o cinto dos kits da trefilaria, filtro de outliers em Folha/Salários, texto da carta-convite com salário visível para todo o RH.

## Feito em 27/11 (tarde)
- Propostas: código SIG-AAAA-XXXXX (3 letras da sigla do cliente, ano, 5 números aleatórios), sem "Controle Previne"; canceladas fora da lista;
  botões Word e PDF (propostas/proppdf.js desenha o PDF a partir da mesma estrutura do PropDoc.build); todo texto justificado.
  Proposta ROLTH (RBI-2026-57820) passada para o portal.
- rel.js: botão "PDF do painel" automático em toda tela com .kpis (modelo REL-GER-002).
- Admissão da Mariane (TST): envio de teste apagado; data de admissão 01/12 mantida (envio real feito à contabilidade).
- EPI da mobilização: epi_separacao + cartão no painel de Ferramentas & EPI + badge "EPI x/y" na admissão.
