# Conteúdo dos checklists de inspeção pré-uso (revisão Claude, 28/11/2026) – base: pasta CHECK-LIST do Drive.
# Cada item: (texto, impeditivo). Impeditivo = se NC, o equipamento NÃO pode ser usado.
I, A = True, False

ELET = ('Alimentação elétrica', [
  ('Cabo e plugue sem emendas, cortes, fios expostos ou isolação danificada', I),
  ('Plugue padrão NBR 14136 compatível com a tomada (sem adaptação ou "benjamim")', I),
  ('Tensão do equipamento identificada e igual à da tomada', I),
  ('Ligado em circuito com DR (diferencial residual) ou em extensão com DR', I),
  ('Extensão íntegra, com DR, e passada de forma aérea ou protegida contra pisoteio e veículos', A),
])
BAT = ('Equipamento a bateria (se aplicável)', [
  ('Bateria original/compatível (mesma marca e tensão), sem trincas, inchaço ou vazamento', I),
  ('Bateria bem encaixada e travada; contatos limpos', A),
  ('Carregador íntegro, usado em local seco e ventilado', A),
])
TRAB = ('Condições de trabalho', [
  ('APR/OS da atividade disponível e com os EPIs indicados', I),
  ('EPIs em uso conforme APR/OS (óculos, protetor facial quando indicado, protetor auricular, luvas)', I),
  ('Área isolada e sinalizada; sem pessoas na linha de projeção', A),
  ('Executante treinado e autorizado para o equipamento', I),
])
QUENTE = ('Trabalho a quente', [
  ('Permissão para trabalho a quente emitida (quando exigida pela área)', I),
  ('Materiais combustíveis removidos ou protegidos (raio mínimo de 10 m ou barreira/manta)', I),
  ('Extintor adequado (PQS/CO2) a até 5 m e carregado (lacre e manômetro na faixa verde)', I),
  ('Observador de incêndio designado quando exigido', A),
])
def ident(extra=None):
  it = [('Equipamento com TAG/patrimônio legível e fita da cor do mês (inspeção periódica em dia)', I),
        ('Carcaça, empunhaduras e manoplas sem trincas, quebras ou improvisos', I)]
  return ('Identificação e estado geral', it + (extra or []))
FUNC_PORT = [
  ('Gatilho/interruptor liga e desliga normalmente e não fica travado ("homem-morto" quando aplicável)', I),
  ('Funcionamento sem ruído, vibração, faísca ou aquecimento anormais', I),
  ('Aberturas de ventilação limpas e desobstruídas', A),
]

CL = [
 dict(n=101, t='Furadeira elétrica, a bateria e de impacto', ref='NR-10, NR-12', campos=['Tipo: (  ) elétrica  (  ) bateria  (  ) impacto'], g=[
   ident(), ELET, BAT,
   ('Funcionamento e acessórios', FUNC_PORT + [
     ('Mandril íntegro e com chave própria (sem uso de alicate/martelo para apertar)', I),
     ('Broca adequada ao material, afiada, sem trinca ou empeno, bem presa no mandril', I),
     ('Seletor de rotação e modo impacto funcionando', A),
     ('Empunhadura auxiliar instalada (furadeiras de impacto e diâmetros grandes)', A),
   ]), TRAB]),
 dict(n=102, t='Furadeira de bancada / coluna / radial', ref='NR-12', g=[
   ident([('Máquina fixada na bancada/piso, nivelada e estável', I)]), ELET[:0] or ('Alimentação elétrica', [
     ('Cabos e painel sem danos; carcaça aterrada', I), ('Tensão identificada', A)]),
   ('Dispositivos de segurança', [
     ('Botão de emergência acessível e funcionando (testar)', I),
     ('Proteção da correia/polias fechada e fixada', I),
     ('Proteção móvel do mandril/broca instalada (com intertravamento quando houver)', I),
     ('Chave de partida não liga sozinha após falta de energia (rearme manual)', A),
   ]),
   ('Funcionamento', [
     ('Mandril, chave e broca em bom estado; chave retirada do mandril antes de ligar', I),
     ('Alavanca de avanço, trava da coluna e da mesa funcionando', A),
     ('Morsa/fixação da peça disponível e em uso (proibido segurar a peça com a mão)', I),
     ('Sem vibração ou ruído anormal', A),
     ('Área limpa, sem cavacos e óleo no piso', A),
   ]), TRAB]),
 dict(n=103, t='Esmerilhadeira / lixadeira angular', ref='NR-12, NR-10', campos=['Diâmetro do disco: ______ mm  ·  RPM máx. do equipamento: ________'], g=[
   ident(), ELET, BAT,
   ('Disco e proteções', [
     ('Coifa de proteção instalada e bem fixada (desbaste: abertura máx. 180°; corte: 150°)', I),
     ('Disco adequado ao serviço (corte ou desbaste), dentro da validade, sem trinca ou umidade', I),
     ('RPM máxima do disco maior ou igual à RPM do equipamento', I),
     ('Flange e porca corretas e apertadas com a chave própria', I),
     ('Empunhadura lateral instalada', I),
   ]),
   ('Funcionamento', FUNC_PORT), TRAB, QUENTE]),
 dict(n=104, t='Retífica elétrica / pneumática', ref='NR-12, NR-10', g=[
   ident([('Etiqueta com tensão, RPM e potência legível', A)]), ELET,
   ('Ar comprimido (retífica pneumática)', [
     ('Mangueira e engates sem rachaduras, vazamentos; com dispositivo anti-chicote', I),
     ('Pressão de trabalho conforme fabricante', A),
   ]),
   ('Ponta montada e fixação', [
     ('Pinça correta para a haste e bem apertada com a chave própria', I),
     ('Ponta/rebolo sem trinca, quebra ou desgaste excessivo; RPM compatível', I),
     ('Escovas de carvão e tampas fixas', A),
   ]),
   ('Funcionamento', FUNC_PORT + [('Controle de velocidade (se houver) funcionando', A)]), TRAB]),
 dict(n=105, t='Policorte', ref='NR-12', g=[
   ident([('Instalado em bancada ou base firme, piso nivelado', I)]),
   ('Alimentação elétrica', ELET[1][:4]),
   ('Disco e proteções', [
     ('Coifa protetora do disco instalada e funcionando (retorno automático)', I),
     ('Disco de corte adequado, dentro da validade, sem trinca; RPM compatível', I),
     ('Morsa de fixação da peça íntegra e em uso', I),
     ('Botão de emergência/desligamento acessível e funcionando', I),
     ('Alavanca de descida do disco com retorno por mola', A),
   ]),
   ('Funcionamento', FUNC_PORT[1:]), TRAB, QUENTE]),
 dict(n=106, t='Serra mármore / serra circular portátil', ref='NR-12, NR-18', g=[
   ident(), ELET,
   ('Disco e proteções', [
     ('Coifa de proteção instalada, íntegra e bem fixada', I),
     ('Disco compatível com o material, sem trinca ou dente quebrado; RPM compatível', I),
     ('Porca e flange do disco apertados com chave própria', I),
     ('Corte a úmido ou com aspiração quando houver poeira (sílica)', A),
   ]),
   ('Funcionamento', FUNC_PORT), TRAB]),
 dict(n=107, t='Parafusadeira / chave de impacto', ref='NR-12, NR-10', g=[
   ident(), ELET, BAT,
   ('Funcionamento e acessórios', FUNC_PORT + [
     ('Mandril/encaixe e bits/soquetes adequados, sem desgaste ou trinca (soquete de impacto na chave de impacto)', I),
     ('Seletor de torque e de sentido de rotação funcionando', A),
   ]), TRAB]),
 dict(n=108, t='Martelete / rompedor elétrico ou pneumático', ref='NR-12, NR-10', g=[
   ident(), ELET,
   ('Ar comprimido (rompedor pneumático)', [
     ('Mangueira e conexões sem rachaduras, rasgos, ressecamento ou vazamento', I),
     ('Engates travando corretamente e com dispositivo anti-chicote', I),
   ]),
   ('Ponteira e travas', [
     ('Trava/retentor da ponteira ou talhadeira funcionando', I),
     ('Ponteira/talhadeira sem trincas, rebarbas ("cogumelo") ou partes quebradas', I),
     ('Punhos, molas e calços em bom estado; parafusos apertados', A),
   ]),
   ('Funcionamento', FUNC_PORT), TRAB]),
 dict(n=109, t='Perfuratriz / furadeira de base magnética', ref='NR-12, NR-10', g=[
   ident([('Máquina estável e nivelada; base magnética limpa e fixando (testar antes de furar)', I)]), ELET,
   ('Dispositivos de segurança', [
     ('Botão de emergência / interruptores de desligamento funcionando', I),
     ('Corrente/cinta de segurança contra queda instalada (trabalho em posição vertical ou elevada)', I),
   ]),
   ('Funcionamento', FUNC_PORT + [
     ('Broca/coroa afiada, sem desgaste excessivo, bem fixada', I),
     ('Avanço e retorno funcionando sem travamento', A),
     ('Refrigeração (fluido) disponível quando necessário', A),
   ]), TRAB]),
 dict(n=110, t='Ferramentas manuais', ref='NR-12, NR-10', campos=['Caixa/kit nº: ________'], g=[
   ('Caixa e identificação', [
     ('Caixa de ferramentas íntegra, com cadeado e identificação', A),
     ('Ferramentas com fita da cor do mês', A),
   ]),
   ('Ferramentas', [
     ('Chaves (combinadas, fenda, Phillips, allen, inglesa, grifo) sem desgaste, trinca ou boca aberta', I),
     ('Alicates sem folga e com cabos íntegros', I),
     ('Ferramentas isoladas (eletricista) com isolação íntegra e marcação 1000 V legível', I),
     ('Martelo e marreta com cabo firme, sem rachaduras, e cabeça bem presa', I),
     ('Talhadeira, ponteiro e punção sem rebarbas ("cogumelo")', I),
     ('Arco de serra com lâmina tensionada; estilete com trava/retração automática', A),
     ('Trena, nível, esquadro e prumo em bom estado', A),
     ('Nenhuma ferramenta adaptada, soldada ou improvisada', I),
   ]),
   ('Uso', [
     ('Ferramentas limpas, sem óleo/graxa nos cabos', A),
     ('Ferramentas amarradas (porta-ferramenta/talabarte) em trabalho em altura', I),
   ])]),
 dict(n=111, t='Máquina de solda elétrica', ref='NR-10, NR-12, NR-18', g=[
   ident([('Carcaça aterrada e painéis fechados', I), ('Rodas/pneus e carrinho em bom estado (máquinas móveis)', A)]),
   ('Cabos e acessórios', [
     ('Cabo de alimentação e plugue íntegros, sem emendas', I),
     ('Cabos de solda (porta-eletrodo e terra) íntegros, sem emendas improvisadas, conexões apertadas', I),
     ('Porta-eletrodo (tenaz) e garra negativa (jacaré) isolados e em bom estado', I),
     ('Garra de terra fixada próxima ao ponto de solda', A),
   ]),
   ('Funcionamento', [
     ('Chave liga/desliga e regulagem de corrente funcionando; indicação legível', A),
     ('Proteção da ventoinha instalada e ventilação desobstruída', A),
   ]),
   ('EPI e área', [
     ('Máscara de solda com lente adequada, avental, perneira, mangote e luva de raspa em uso', I),
     ('Biombo/cortina de proteção para terceiros', A),
     ('Exaustão ou ventilação adequada (fumos de solda)', A),
   ]), QUENTE]),
 dict(n=112, t='Conjunto oxicorte / oxiacetileno', ref='NR-18, NR-13, NR-20', g=[
   ('Cilindros e carrinho', [
     ('Cilindros na vertical, presos ao carrinho por corrente/cinta, com capacete na troca/transporte', I),
     ('Cilindros identificados (cor/rótulo) e dentro do teste hidrostático', A),
     ('Carrinho com rodas/pneus em bom estado e proteção para as mãos', A),
   ]),
   ('Reguladores e válvulas', [
     ('Reguladores de pressão íntegros, sem óleo/graxa e sem fita veda-rosca nas conexões', I),
     ('Manômetros íntegros (visor, ponteiro) e com proteção', A),
     ('Válvulas contra retrocesso de chama nos reguladores E na caneta (oxigênio e gás)', I),
   ]),
   ('Mangueiras e maçarico', [
     ('Mangueiras verde (oxigênio) e vermelha (acetileno/GLP), sem cortes, ressecamento ou emendas', I),
     ('Conexões prensadas/abraçadeiras próprias, bem apertadas', I),
     ('Teste de vazamento com espuma feito em todas as conexões', I),
     ('Caneta/maçarico sem avarias; bico adequado ao gás, limpo e desobstruído (agulheiro)', I),
     ('Acendimento com acendedor de fricção (proibido isqueiro/fósforo)', A),
     ('Mangueiras protegidas contra calor e respingos ("fire sleeve" quando exigido)', A),
   ]), QUENTE, ('Condições de trabalho', TRAB[1][:2])]),
 dict(n=113, t='Máquina de oxicorte automática (tipo KBR)', ref='NR-12, NR-10, NR-20', g=[
   ('Local', [
     ('Local ventilado, limpo e sem materiais combustíveis próximos', I),
     ('Extintor (PQS/CO2) ou hidrante disponível', I),
     ('Área isolada e sinalizada; acessos e saídas de emergência desobstruídos', A),
   ]),
   ('Máquina e trilhos', [
     ('Trilhos em bom estado e sem obstrução; rodas lubrificadas', A),
     ('Movimentos (lateral, frente/trás, elevação dos maçaricos) funcionando', A),
     ('Sensores e fins de curso funcionando', I),
     ('Painel elétrico fechado, todas as sinalizações acendendo, cabos presos e protegidos', I),
     ('Botão de emergência funcionando (testar)', I),
   ]),
   ('Gases', [
     ('Mangueiras e conexões sem vazamento, cortes, óleo ou graxa; protegidas contra calor', I),
     ('Válvulas corta-chama/retenção instaladas', I),
     ('Manômetros sem avarias e com pressões de trabalho conforme tabela da máquina', I),
     ('Teste de estanqueidade (5 min com válvulas fechadas, sem queda de pressão) e teste com espuma', I),
     ('Bicos desobstruídos e sem danos; agulheiro disponível', A),
   ]), ('Condições de trabalho', TRAB[1][:2])]),
 dict(n=114, t='Cinto de segurança tipo paraquedista e talabarte', ref='NR-35, NR-6', campos=['CA do cinto: ________  ·  TAG do cinto: ________  ·  TAG do talabarte: ________', 'Usuário: ______________________________  Matrícula: ________'], g=[
   ('Cinto', [
     ('Etiqueta legível (nº de série, lote, CA, data de fabricação) e CA válido', I),
     ('Fitas sem cortes, furos, desfiamento, ressecamento, queimadura ou contaminação (óleo/química)', I),
     ('Costuras íntegras; indicador de queda NÃO acionado', I),
     ('Fivelas, argolas (dorsal/peitoral) e regulagens sem trinca, deformação ou corrosão', I),
     ('Cinto adequado à atividade (ex.: dielétrico/sem partes metálicas expostas para eletricidade; aramida para trabalho a quente)', I),
   ]),
   ('Talabarte / trava-quedas', [
     ('Etiqueta legível e talabarte compatível com o cinto', I),
     ('Talabarte adequado à zona livre de queda (ex.: retrátil abaixo de 4,5 m)', I),
     ('Absorvedor de energia íntegro, capa sem rasgos e sem sinal de acionamento', I),
     ('Mosquetões/ganchos com dupla trava funcionando, sem trincas ou deformação', I),
     ('Fitas e costuras do talabarte íntegras, sem óleo ou graxa', I),
     ('Partes isolantes (talabarte para eletricista) íntegras', I),
   ]),
   ('Condições de uso', [
     ('Ponto de ancoragem/linha de vida definidos na APR e aptos', I),
     ('Usuário com NR-35 válida e ASO apto para altura', I),
   ])]),
 dict(n=115, t='Escada portátil (simples, extensível e de abrir)', ref='NR-18, NR-35, NR-10', campos=['Tipo: (  ) simples  (  ) extensível  (  ) de abrir  ·  Material: (  ) fibra  (  ) alumínio  (  ) madeira'], g=[
   ('Identificação', [
     ('TAG visível, consta no inventário e fita da cor do mês', I),
     ('Escada adequada à tarefa e à altura (sem emendas ou prolongamentos improvisados)', I),
     ('Escada de fibra de vidro para serviços em eletricidade', I),
   ]),
   ('Estrutura', [
     ('Montantes sem trincas, rachaduras, corrosão, empenos ou sinais de adulteração', I),
     ('Degraus firmes, antiderrapantes, sem trincas; dois últimos degraus pintados de vermelho', I),
     ('Sapatas antiderrapantes íntegras', I),
     ('Parafusos, rebites e dobradiças fixos, sem folga', I),
     ('Limitador de abertura (escada de abrir) íntegro e sem improviso', I),
     ('Extensível: travas, corda, roldana/guia e limitador de curso em bom estado', I),
   ]),
   ('Uso', [
     ('Apoio em piso firme e nivelado; escada simples/extensível amarrada no topo e ultrapassando 1 m o ponto de apoio', I),
     ('Escada limpa (sem óleo, graxa, barro)', A),
     ('Cinto e talabarte em uso quando exigido pela APR', I),
   ])]),
 dict(n=116, t='Andaime (fachadeiro, tubular ou multidirecional)', ref='NR-18, NR-35', campos=['Altura: ______ m  ·  Liberado por (montador/responsável): ____________________'], g=[
   ('Liberação', [
     ('Placa/cartão de liberação do andaime (verde) preenchido e válido', I),
     ('Montado por pessoal treinado, conforme projeto/fabricante', I),
   ]),
   ('Base e estrutura', [
     ('Sapatas/bases ajustáveis apoiadas em piso firme e nivelado (rodízios travados, se móvel)', I),
     ('Contraventamentos instalados; estrutura sem ferrugem, amassados ou peças tortas', I),
     ('Abraçadeiras/braçadeiras e conectores completos e apertados', I),
     ('Ancoragem/estaiamento na estrutura quando a altura exigir (relação altura x base)', I),
   ]),
   ('Plataforma e proteções', [
     ('Piso totalmente forrado, plataformas/tábuas travadas, sem trincas, nós ou emendas', I),
     ('Guarda-corpo (1,20 m), travessão intermediário e rodapé em todo o perímetro', I),
     ('Escada de acesso interna ou fixada; alçapão fechado após a passagem', I),
     ('Plataforma limpa e sem sobrecarga de material', A),
   ]),
   ('Condições de uso', [
     ('Distância segura de redes elétricas ou rede desenergizada', I),
     ('Trabalhadores com NR-35 válida e cinto ancorado em ponto aprovado', I),
   ])]),
 dict(n=117, t='Plataforma elevatória móvel de trabalho (PEMT/PTA)', ref='NR-12, NR-18, NR-35', campos=['Horímetro: ________  ·  Operador habilitado: ______________________'], g=[
   ('Documentação e operador', [
     ('Manual de operação na máquina e manutenção periódica em dia', I),
     ('Operador com treinamento de PEMT válido e NR-35', I),
   ]),
   ('Inspeção visual', [
     ('Estrutura, cesto, braços e articulações sem trincas, amassados ou soldas improvisadas', I),
     ('Porta/corrente de acesso ao cesto fechando; guarda-corpo íntegro', I),
     ('Pneus/rodas íntegros e sem cortes', I),
     ('Cilindros hidráulicos, mangueiras e conexões sem vazamento', I),
     ('Nível de óleo hidráulico e carga/eletrólito da bateria (ou combustível)', A),
     ('Adesivos de capacidade, avisos e placas legíveis', A),
     ('Ponto de ancoragem do cinto no cesto íntegro', I),
   ]),
   ('Teste funcional', [
     ('Comandos do cesto e do solo funcionando (incluindo pedal habilitador)', I),
     ('Parada de emergência no cesto e no solo funcionando', I),
     ('Descida de emergência funcionando', I),
     ('Alarmes de movimento e de inclinação, buzina e luzes funcionando', I),
     ('Giro, elevação e translação sem ruído ou tranco anormal', A),
     ('Extintor (quando previsto) carregado', A),
   ]),
   ('Área', [
     ('Piso firme e nivelado; área isolada; distância de redes elétricas respeitada', I),
   ])]),
 dict(n=118, t='Talha elétrica', ref='NR-11, NR-12', campos=['Capacidade (t): ______  ·  Marca/modelo: ______________'], g=[
   ('Identificação e estrutura', [
     ('Capacidade de carga identificada e compatível com a carga', I),
     ('Viga/trilho e percurso livres de obstáculos e objetos soltos', I),
     ('Inspeção periódica dentro da validade', I),
   ]),
   ('Corrente/cabo e gancho', [
     ('Corrente ou cabo de aço sem elos deformados, fios rompidos, amassados ou corrosão', I),
     ('Cabo enrolando corretamente no tambor', A),
     ('Gancho com trava de segurança funcionando, sem abertura ou trinca', I),
   ]),
   ('Comando e teste sem carga', [
     ('Botoeira íntegra, comandos identificados; parada de emergência funcionando', I),
     ('Freio segura a carga (não desliza)', I),
     ('Fins de curso de subida/descida e batentes funcionando', I),
     ('Sem ruídos estranhos', A),
   ]),
   ('Içamento', [
     ('Acessórios (cintas, manilhas, laços) inspecionados e com capacidade identificada', I),
     ('Área isolada sob a carga; ninguém sob carga suspensa', I),
   ])]),
 dict(n=119, t='Talha manual de corrente / catraca / tirfor', ref='NR-11, NR-12', campos=['Tipo: (  ) talha de corrente  (  ) catraca (alavanca)  (  ) tirfor  ·  Capacidade: ______ t'], g=[
   ('Identificação', [
     ('Capacidade identificada e compatível com a carga', I),
     ('TAG e fita da cor do mês', A),
   ]),
   ('Componentes', [
     ('Corrente (ou cabo do tirfor) sem elos deformados, desgaste, fios rompidos ou corrosão', I),
     ('Ganchos superior e inferior com trava de segurança, sem abertura ou trinca', I),
     ('Mecanismo de catraca/freio segura a carga; alavanca íntegra', I),
     ('Pinos, contrapinos e parafusos completos', I),
     ('Corrente de manobra íntegra e sem nós', A),
   ]),
   ('Uso', [
     ('Ponto de fixação aprovado e com capacidade (proibido viga/tubo não dimensionado)', I),
     ('Acessórios de içamento inspecionados; área sob a carga isolada', I),
   ])]),
 dict(n=120, t='Ponte rolante – pré-uso', ref='NR-11, NR-12', campos=['Capacidade (t): ______  ·  Operador habilitado: ______________________'], g=[
   ('Inspeção visual', [
     ('Operador com treinamento de ponte rolante válido e autorizado', I),
     ('Sem vazamento de óleo', A),
     ('Vigas e caminho de rolamento sem objetos que possam cair', I),
     ('Cabo de aço sem fios rompidos, amassados ou gaiola; enrolando corretamente no tambor e dentro das polias', I),
     ('Gancho com trava de segurança; polias do moitão girando livremente', I),
     ('Batentes de fim de curso em bom estado', A),
     ('Acessórios/dispositivos de içamento (barra de carga, cintas, correntes, olhais) inspecionados', I),
   ]),
   ('Teste sem carga', [
     ('Controle (botoeira/rádio) íntegro, comandos identificados, bateria carregada', I),
     ('Parada de emergência funcionando', I),
     ('Sirene/alarme sonoro e luminoso funcionando', I),
     ('Freios de içamento, translação do carro e da ponte sem deslizar', I),
     ('Fins de curso de içamento e redutores de velocidade funcionando', I),
     ('Velocidades de cada movimento respondendo ao comando, sem ruído anormal', A),
     ('Eletroímã (se houver): teste de imantação e correntes/olhais em bom estado', I),
   ])]),
 dict(n=121, t='Macaco hidráulico', ref='NR-12', campos=['Capacidade (t): ______'], g=[
   ('Identificação', [
     ('Identificado e com capacidade de carga legível, compatível com a carga', I),
   ]),
   ('Estado e funcionamento', [
     ('Sem vazamento de óleo; nível de óleo correto', I),
     ('Estrutura e base sem trincas, amassados ou deformações', I),
     ('Pistão limpo, sem corrosão, riscos ou empeno', I),
     ('Cabeça/sapata de apoio íntegra', I),
     ('Alavanca e válvula de alívio/descida funcionando de forma controlada', I),
     ('Eleva e mantém a carga sem perder pressão', I),
     ('Sem adaptações ou reparos improvisados', I),
   ]),
   ('Uso', [
     ('Apoio em piso firme e nivelado; ponto de apoio correto na carga', I),
     ('Calços/cavaletes usados para sustentar a carga (nunca trabalhar sob carga só no macaco)', I),
   ])]),
 dict(n=122, t='Guincho hidráulico (girafa)', ref='NR-11, NR-12', campos=['Capacidade (t): ______'], g=[
   ('Inspeção visual', [
     ('Capacidade nominal identificada e compatível com a carga', I),
     ('Estrutura sem rachaduras, amassados ou deformações', I),
     ('Sem vazamento de óleo; mangueiras e conexões íntegras', I),
     ('Rodas e rodízios firmes e girando livremente', A),
   ]),
   ('Funcionamento', [
     ('Alavanca de bombeamento firme, sem travamento', A),
     ('Elevação contínua e mantém a altura parado (sem perder pressão)', I),
     ('Descida controlada', I),
     ('Corrente, gancho com trava e acessórios em bom estado', I),
   ]),
   ('Uso', [
     ('Uso em superfície plana e firme; lança dentro do limite de extensão para a carga', I),
   ])]),
 dict(n=123, t='Gerador portátil', ref='NR-10, NR-12, NR-20', campos=['Potência: ______ kVA  ·  Combustível: (  ) gasolina  (  ) diesel'], g=[
   ('Instalação', [
     ('Em local ventilado, longe de fontes de calor e a pelo menos 1,5 m de outras estruturas', I),
     ('Isolado e sinalizado (proibido tocar com o equipamento em funcionamento)', A),
     ('Aterrado; saídas com DR ou ligação por quadro com DR', I),
     ('Extintor próximo', I),
   ]),
   ('Inspeção', [
     ('Sem vazamento de óleo ou combustível; tampa do tanque fechada', I),
     ('Sem sinais de superaquecimento; escapamento sem obstrução ou vazamento', I),
     ('Cabos, tomadas, terminais, disjuntores e fusíveis em bom estado', I),
     ('Nível de óleo do motor', A),
   ]),
   ('Teste', [
     ('Partida, liga/desliga e medidores funcionando', A),
     ('Tensão de saída estável; carga dentro da capacidade', I),
     ('Sem ruído anormal', A),
   ]),
   ('Abastecimento', [
     ('Abastecimento com o motor desligado e frio, sem fontes de ignição', I),
   ])]),
 dict(n=124, t='Compactador de solo (sapo) – combustão ou elétrico', ref='NR-12, NR-18', g=[
   ident([('Guidão, sanfona e sapata sem trincas ou avarias', I)]),
   ('Motor a combustão', [
     ('Sem vazamento de combustível; tanque íntegro e tampa apertada', I),
     ('Nível de óleo do motor e do cárter/percussão', A),
     ('Filtro de ar limpo; vela e escapamento em bom estado', A),
     ('Corda/sistema de partida e acelerador funcionando', A),
     ('Abastecimento com motor desligado e frio', I),
   ]),
   ('Motor elétrico', [
     ('Cabo, plugue e conector sem emendas; tensão identificada; ligado em DR', I),
     ('Chave liga/desliga funcionando; aterramento', I),
   ]),
   ('Funcionamento e uso', [
     ('Parafusos e porcas apertados; sem vibração ou ruído anormal além do normal da máquina', A),
     ('Área livre de pessoas e materiais; ventilação (motor a combustão em vala/local fechado)', I),
     ('EPI: protetor auricular, calçado com biqueira, luvas antivibração quando indicado', I),
   ])]),
 dict(n=125, t='Placa vibratória', ref='NR-12, NR-18', g=[
   ident([('Base de aço sem trincas; guidão e protetor de correia instalados', I)]),
   ('Motor e transmissão', [
     ('Nível de óleo do motor (vareta)', A),
     ('Filtro de ar limpo (ambiente com poeira)', A),
     ('Sem vazamento de combustível; tanque com tampa apertada', I),
     ('Coxins de borracha (amortecedores motor/base) íntegros', A),
     ('Correia em V com tensão correta, sem desfiamento, sob a capa protetora', I),
     ('Óleo do excêntrico no nível (troca a cada ~200 h)', A),
   ]),
   ('Uso', [
     ('Abastecimento com motor desligado e frio', I),
     ('APR/OS com EPIs; EPIs em uso (protetor auricular, calçado, luvas)', I),
     ('Área isolada e sem pessoas próximas', A),
   ])]),
 dict(n=126, t='Veículo leve', ref='CTB, NR-11', campos=['Placa: ________  ·  Km: ________  ·  Condutor: ______________________  CNH válida até: ____/____/______'], g=[
   ('Documentação', [
     ('Documento do veículo (CRLV) do ano vigente no veículo', I),
     ('CNH do condutor válida e da categoria correta; autorização para dirigir na empresa/cliente', I),
     ('Liberação de acesso do veículo à ArcelorMittal válida (quando aplicável)', A),
   ]),
   ('Segurança', [
     ('Freios (serviço e estacionamento) eficientes, sem ruído ou vibração', I),
     ('Pneus sem desgaste além do limite (TWI), sem bolhas, calibrados; estepe em condições', I),
     ('Faróis, lanternas, setas, luz de freio e de ré funcionando', I),
     ('Cintos de segurança funcionando em todos os bancos', I),
     ('Para-brisa sem trincas na área de visão; limpadores funcionando; retrovisores íntegros', I),
     ('Buzina e alarme sonoro de ré (quando exigido) funcionando', I),
     ('Triângulo, macaco e chave de rodas no veículo', I),
   ]),
   ('Motor e manutenção (semanal)', [
     ('Nível de óleo do motor, líquido de arrefecimento e fluido de freio', A),
     ('Sem vazamentos sob o veículo', A),
     ('Painel sem luz de advertência acesa (freio, óleo, temperatura, airbag)', I),
     ('Revisão/manutenção preventiva em dia', A),
   ]),
   ('Conservação', [
     ('Lataria, vedações e interior limpos e conservados', A),
     ('Carga/ferramentas presas (nada solto na cabine)', A),
   ])]),
 dict(n=127, t='Autorização de acesso para trabalho em altura', ref='NR-35', freq='por atividade', campos=['Área/cabine: __________________  ·  Atividade: __________________________________'], g=[
   ('Pessoas', [
     ('Todos com NR-35 válida (credencial apresentada) e ASO apto para altura', I),
     ('Aferição de pressão arterial feita e dentro do limite definido', I),
     ('Crachás da equipe recolhidos/registrados na cabine (quando exigido pela área)', A),
   ]),
   ('Liberações', [
     ('APR/PT liberada pelo supervisor de trabalho em altura', I),
     ('Acesso à área restrita (vermelha) liberado pela operação', I),
     ('Andaime liberado (cartão verde) ou checklist de PEMT/escada preenchido', I),
     ('Cinto/talabarte com checklist preenchido', I),
     ('Ponto de ancoragem e linha de vida aptos', I),
     ('Plano de resgate definido e equipe/recursos disponíveis', I),
     ('Meio de comunicação disponível (rádio/telefone)', I),
   ]),
   ('Telhado (quando aplicável)', [
     ('Mapa (layout) do telhado e rota segura definidos', I),
     ('Acompanhamento do supervisor em tempo integral', I),
   ])]),
 dict(n=128, t='Máquina amarradeira (ATT1)', ref='NR-12, NR-10', campos=['Fabricante: ________________  ·  Turno: ____  ·  Cliente: ________________'], g=[
   ('Dispositivos de segurança', [
     ('Portas de segurança fechando e com intertravamento funcionando', I),
     ('Barreiras de luz ligadas e funcionando (testar)', I),
     ('Botões de emergência funcionando (testar)', I),
     ('Seccionadora de bloqueio operacional funcionando e com ponto de cadeado', I),
     ('Extintores carregados e nos locais', A),
   ]),
   ('Sistema de amarração (TEL)', [
     ('Pressão dos tracionadores conforme padrão', A),
     ('Voltas das alças livres de torção; amarras sem marcas; dobra inferior normal', A),
     ('Rolo tracionador sem marcas de desgaste', A),
     ('Alicate guia do fio em bom estado', A),
   ]),
   ('Ferramentas', [
     ('Tesouras corta-vergalhão e corta-fita em bom estado', A),
   ]), ('Condições de trabalho', TRAB[1][:2])]),
]

# 5S: auditoria mensal por senso (C / NC / NA) com % de atendimento
S5 = dict(n=129, t='Inspeção 5S do posto de trabalho', ref='Programa 5S', g=[
  ('Utilização (Seiri)', [
    ('Sem materiais, ferramentas ou objetos desnecessários no posto', A),
    ('Sem improvisos ("gambiarras"); recursos adequados ao trabalho; iluminação boa', A),
    ('Sem desperdícios (água, ar comprimido, energia, óleo, papel)', A),
    ('Móveis, máquinas e bebedouros em bom estado', A),
  ]),
  ('Organização (Seiton)', [
    ('Circulação e rotas de fuga desobstruídas e sinalizadas', I),
    ('Locais demarcados para materiais e equipamentos', A),
    ('Armários, prateleiras e gavetas identificados e organizados (pesados embaixo)', A),
    ('Extintores, hidrantes, chuveiro/lava-olhos e painéis elétricos desobstruídos', I),
  ]),
  ('Limpeza (Seiso)', [
    ('Piso limpo, sem óleo, água ou buracos', A),
    ('Paredes, máquinas, bancadas e armários limpos', A),
    ('Banheiros, refeitório e bebedouros limpos', A),
    ('Resíduos separados nos coletores corretos e destinados', A),
  ]),
  ('Saúde e segurança (Seiketsu)', [
    ('Produtos químicos em recipientes identificados (rótulo) e com FISPQ/FDS disponível', I),
    ('Proteções de máquinas e sinalizações de segurança no lugar', I),
    ('Rotina de limpeza/organização definida e dono da área identificado', A),
  ]),
  ('Autodisciplina (Shitsuke)', [
    ('Padrão de 5S conhecido e seguido pelos colaboradores (entrevistar)', A),
    ('Novos colaboradores orientados sobre o 5S', A),
    ('Desvios anteriores registrados e tratados', A),
  ])])
CL.append(S5)

ORIGEM = {101:'FURADEIRA- PREVINE / FURADEIRA IMPACTO - PREVINE / CHECK LIST FURADEIRA (SM 004.6)',102:'FURADEIRA DE BANCADA COLUNA RADIAL (SM 004.7)',103:'ESMERILHADEIRA- LIXADEIRA- PREVINE / CHECK LIST LIXADEIRA (SM 004.2)',
 104:'RETÍFICA ELÉTRICA - PREVINE / CHECK LIST RETIFICA (SM 004.5)',105:'POLICORTE (SM 004.1)',106:'SERRA MARMORE',107:'CHECK PARAFUSADEIRA (SM 004.26)',108:'CHECK LIST MARTELETE / MARTELETE ELÉTRICO PNEUMÁTICO (SM 004.27)',
 109:'INSPEÇÕES PERFURATRIZ- PREVINE',110:'CHECK LIST FERRAMENTAS MANUAIS (SM 004.8) / FERRAMENTAS MANUAIS.docx',111:'CHECK LIST MAQ DE SOLDA (SM 004.3)',112:'CONJUNTO DE OXI-CORTE- PREVINE / CHECK LIST OXICORTE (SM 004.4)',
 113:'MÁQUINA OXICORTE KBR 008',114:'CINTO DE SEGURANÇA-PREVINE (e cópia)',115:'INSPEÇÕES DE ESCADA- PREVINE / CHECK LIST ESCADA (SM 004.9)',116:'ANDAIME (SM 004.10)',117:'PLATAFORMA ELEVATÓRIA (SM 004.16)',
 118:'TALHA ELETRICA',119:'TALHA CATRACA TIFOR (SM 004.11)',120:'Checklist Ponte Rolante - PREVINE (CHECK 0010 - PR)',121:'MACACO HIDRAULICO (e SM 004.34)',122:'INSPEÇÃO DE GUINCHO HIDRÁULICO',123:'INSPEÇÕES GERADORES',
 124:'CHECK LIST COMPACTADOR DE SOLO / CHECK-LIST PRÉUSO DE COMPACTADOR DE SOLO',125:'PLACA VIBRATÓRIA PREVINE',126:'VEÍCLOS LEVES- PREVINE',127:'LIBERAÇÃO TRABALHO EM ALTURA- PREVINE',128:'CHECK LIST ATT1 - PREVINE',129:'Modelo Check list 5S / Checklist 5S_revisado'}
