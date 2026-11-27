# Portal PREVINE — estado do projeto (atualizado em 27/11/2026)

Portal interno da PREVINE INSTALAÇÃO E MANUTENÇÃO ELÉTRICA LTDA (CNPJ 03.052.261/0001-43,
Av. Homero Leite, 198, Saudade, Barra Mansa – RJ). Dono: Gustavo Rogel de Almeida (gerente de operações).
Site: https://app.previneeletrica.com.br (GitHub Pages deste repositório: gustavoro-pre/previne).
Firebase: projeto `ferramentas-epi` (Firestore + Auth). Responder sempre em português do Brasil.

## Como publicar
1. Editar os arquivos. Se mexer em `ferramentas/index.html`, rodar `python3 build.py` (gera `treinamentos/index.html`).
2. Subir a versão do script na página (`adm.js?v=N`, `ficha.js?v=N`, `prop.js?v=N`…) e o cache em `sw.js` (`previne-vNN`, hoje v81).
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

## Pendências (27/11/2026)
1. Cópia "11. Mobilização Documentos" (5.663 arquivos): terminar e rodar `refazerMob` uma vez quando a cópia acabar,
   para reprocessar as pastas que não casaram. Listar ao Gustavo as pastas que não são de pessoa (ex.: "DOCUMENTOS HANNA", "PEDREIRO").
2. Cópia RH (BM/NOVATOS/RESENDE): concluída (5.018 copiados). Falta conferir 222 itens sem registro e 21 "sem destino"
   (NOVATOS/"CERTIFICADOS DE INTEGRAÇÃO 25.03.2026" e BM). Só depois disso dizer ao Gustavo quais pastas antigas ele pode apagar (ele apaga).
3. OCR dos documentos do RH: montar a planilha de revisão (certificados NR com validade, CPF, nascimento) para ele aprovar antes de gravar.
4. Admissão usada no teste completo do de acordo (27/11, a da TST): o teste deixou um envio de teste para a conta do script
   e gravou data de admissão 01/12/2026. Depois do teste, tirar essa data e o envio de teste dessa admissão.
5. RHiD: Gustavo vai mandar as perguntas ao suporte (integracao@controlid.com.br) e criar um usuário de integração.
   Segredos esperados no GitHub: `RHID_EMAIL`, `RHID_SENHA`. API: `POST /login` → token Bearer; `GET /person`, `GET /apuracao_ponto` (até 90 dias),
   AFD por equipamento (`/report/afd/download671`). Depois: rotina diária que grava marcações e apuração no portal.
6. SOC (saúde ocupacional): perguntas enviadas pela clínica; esperar retorno sobre Exporta Dados/WebService.
7. CRM: construir depois (o Gustavo pediu para esperar o limite diário renovar).
8. Antigas: e-mail das NFs, OAuth do Conta Azul, lista de papéis dos padrões, valor do plano de saúde, OS por função para as outras funções,
   separar o cinto dos kits da trefilaria, filtro de outliers em Folha/Salários, texto da carta-convite com salário visível para todo o RH.
