# CartSchedule — Planejamento do Projeto

## 1. Visão Geral

Sistema web para organizar o uso de carrinhos de trabalho ao longo do mês.
Publicadores solicitam em quais carrinhos, dias da semana e turnos desejam
trabalhar; todo pedido entra direto na escala e um administrador a ajusta,
excluindo os excedentes, buscando o limite de **2 pessoas por carrinho, por dia da
semana, por turno** — ou 3, quando uma delas é criança ou idoso (regra 1).

## 2. Atores

- **Publicador**: entra no site com o **usuário e a senha** que recebeu do
  administrador (fica logado por 180 dias no aparelho) e, a cada
  solicitação, escolhe o dia da semana, o turno e o carrinho em que quer
  trabalhar — uma combinação por solicitação — e a envia, apenas
  enquanto o envio estiver aberto (abre sozinho no dia 15 e fecha quando o
  administrador decidir — ver seção 4).
- **Administrador**: visualiza todas as solicitações de uma escala (todas
  já contam na escala), move, adiciona e exclui solicitações em qualquer
  escala a qualquer momento (buscando a meta de 2 por vaga, ou 3 com uma
  criança/idoso — regra 1), decide quando fechar (e, se quiser, reabrir) o
  envio dos publicadores, e divulga a escala no grupo de WhatsApp. Não há
  etapa de "gerar" ou "finalizar" a escala: ela é sempre o retrato atual
  das solicitações existentes (regra 5).

## 3. Conceitos-chave

| Conceito | Descrição |
|---|---|
| **Escala (mês de referência)** | O mês/ano para o qual a escala está sendo montada (ex: Outubro/2026). |
| **Escala em envio (mês-alvo)** | A escala que recebe os pedidos dos publicadores agora: a aberta no último dia 15 — do dia 15 em diante, a do mês seguinte; do dia 1 ao 14, a do mês corrente. "Escala em envio", "mês-alvo" e "escala-alvo" são sinônimos. Datas sempre no horário de Brasília. |
| **Janela de envio** | Período em que o sistema aceita novas solicitações de Publicadores para a escala em envio: abre sozinha no dia 15 e fecha quando o administrador decidir (ver seção 4). "Janela aberta" e "envio aberto" são sinônimos. |
| **Vaga (trinca)** | Uma combinação `(carrinho, dia da semana, turno)` configurada pelo administrador, dentro de uma escala. "Vaga", "trinca" e "combinação" são sinônimos. |
| **Carrinho** | Um carrinho de trabalho disponível (ex: Carrinho 1, Carrinho 2...). Tem um nome e uma **descrição** opcional (ex: local onde fica), exibida ao publicador abaixo do nome na hora de escolher o carrinho. Pode ser **desativado** (regra 18): deixa de receber novas solicitações, de publicadores e do administrador, mas as existentes continuam. |
| **Dia da semana** | **Sempre Segunda a Sexta-feira** — são os únicos dias que existem no sistema; não há Sábado nem Domingo. A escolha é **recorrente**: se o publicador escolhe "Segunda-feira", isso vale para todas as segundas-feiras daquele mês — não é uma data específica do calendário. A única exceção é o **carrinho de data especial** (regra 10a), que funciona numa data só. |
| **Turno** | Faixa de horário **fixa do sistema**, não cadastrável pelo administrador. São sempre estes 6 turnos: **06:00–08:00, 08:00–10:00, 10:00–12:00, 14:00–16:00, 16:00–18:00, 18:00–20:00**. Os mesmos horários valem para todos os carrinhos que usarem aquele turno. |
| **Turnos disponíveis do carrinho** | Cada carrinho usa apenas um subconjunto dos turnos fixos, definido pelo administrador **por dia da semana**. Um carrinho pode ter turnos diferentes de outro, e o mesmo carrinho pode ter turnos diferentes em cada dia (ex: Carrinho 01 tem 08:00–10:00 na Segunda, mas só 10:00–12:00 na Terça). |
| **Solicitação** | O pedido para trabalhar em `(carrinho, dia da semana, turno)` dentro de uma escala (mês). Pode ter sido criada por um Publicador (fluxo normal) ou pelo Administrador (adição manual). Não há aprovação: **toda solicitação existente já faz parte da escala**; tirar alguém é excluir a solicitação. |
| **Escala mensal (resultado final)** | Para cada `(carrinho, dia da semana, turno)`, todos os publicadores com solicitação (a meta é 2, ou 3 com uma criança/idoso — regra 1). |
| **Criança ou idoso** | Marca que o administrador põe na pessoa (vale para todos os pedidos dela). Quem tem a marca pode ser a 3ª pessoa de uma vaga sem que ela fique com excesso (regra 1). |

## 4. Janela de Envio (abre sozinha, o administrador fecha)

- **Abertura (automática)**: todo dia **15** do mês (à meia-noite, horário
  de Brasília), o sistema abre automaticamente o envio de solicitações para
  a escala do **mês seguinte**.
  - Ex: dia 15 de setembro → abre a escala de Outubro.
- **Fechamento (manual)**: não há data fixa — o envio fica aberto até o
  **administrador fechá-lo**, na tela da Escala daquele mês. Ele pode
  **reabrir** depois, quantas vezes quiser. Se ninguém fechar, o envio
  continua aberto (mesmo depois que o mês da escala começa) até o dia 15
  seguinte, quando a escala do outro mês abre.
  - Ex: abriu em 15/09 para Outubro; o admin fecha em 25/09, reabre em
    26/09 para um ajuste e fecha de novo em 27/09. Se não tivesse
    fechado, em 05/10 os publicadores ainda enviariam pedidos para
    Outubro; em 15/10 abre Novembro e Outubro deixa de receber pedidos.
- **Escala em envio**: é a escala aberta no último dia 15 — do dia 15 em
  diante, a do mês seguinte; do dia 1 ao 14, a do mês corrente. Só ela
  pode ser fechada ou reaberta pelo administrador.
- Depois de fechar, começa o período em que o **administrador
  realiza os ajustes** (movendo, excluindo e adicionando solicitações
  manualmente) e divulga a escala. Não há ação de "finalizar": a escala
  continua editável pelo administrador depois de divulgada (regra 7).
- **Com o envio fechado**: o Publicador que acessar o site vê uma
  **mensagem informando que o envio de novas solicitações está fechado**
  (ex: "Envio fechado. Abre novamente no dia 15."). O **histórico de suas
  próprias solicitações continua disponível para consulta a qualquer
  momento**, independentemente da janela estar aberta ou fechada (ver
  regra 11).
- **Apenas uma escala fica aberta por vez** para novos envios de
  Publicadores — a escala em envio, até o administrador fechá-la ou até o
  próximo dia 15.
- O Administrador **não é limitado pela janela**: pode ver, excluir
  e adicionar solicitações em qualquer escala (passada, atual
  em aberto, ou futura) a qualquer momento.

## 5. Fluxo do Publicador

1. Acessa o site (pelo link do grupo de WhatsApp). Para pedir, a janela de envio precisa estar aberta (do dia 15 até o administrador fechar); fora dela, vê só o histórico e o aviso de envio fechado.
2. **Todo o site fica atrás do login** (janela aberta ou fechada): sem estar
   logado, qualquer página leva à tela de login (usuário + senha) e, depois de
   entrar, volta à página pedida. O login dura **180 dias** no aparelho e é
   renovado a cada vez que ele abre o site, então a senha quase nunca é pedida de
   novo. O cabeçalho mostra **"Olá, {primeiro nome}"** (o nome da conta), que
   abre um menu com **"Trocar senha"** e **"Sair"**; o publicador não edita o nome (só o
   administrador). Em "Trocar senha" ele informa a senha atual e a nova duas vezes; a
   nova precisa ter exatamente 4 dígitos e não ser óbvia (dígitos todos iguais ou em
   sequência, como 0000, 1234 ou 4321). Ao trocar, os outros aparelhos dele são
   desconectados e o aparelho atual continua logado. Quem é administrador vê também o link **"Administração"**.
   O formulário de solicitação não pede o nome: o pedido é da conta logada.
3. Toca em **"Solicitar Nova Escala"** e seleciona o **dia da semana** em que quer trabalhar — só aparecem os dias em que algum carrinho oferecido tem turno configurado (carrinho oferecido = ativo e, se for de data especial, da escala em envio e com a data ainda não passada — regras 10a e 18); um dia em que nenhuma vaga pode mais ser pedida por ele (todas cheias ou em horários em que ele já tem pedido) aparece desabilitado, sem texto.
4. Seleciona o **turno** desejado — só aparecem os turnos que algum carrinho tem configurados **naquele dia da semana**; um turno sem nenhuma vaga que ele possa pedir aparece desabilitado, sem texto. Se ele já tem pedido naquele dia e horário (em qualquer carrinho), o turno fica desabilitado e mostra "Você já tem pedido neste horário" — não dá para estar em dois lugares ao mesmo tempo (regra 10).
5. Seleciona o **carrinho** — só aparecem os carrinhos que o administrador configurou com aquele turno **naquele dia da semana** (carrinhos diferentes, e dias diferentes do mesmo carrinho, podem ter turnos diferentes). Vê o nome e, abaixo dele, a descrição (quando houver); a vaga cheia fica desabilitada com "Cheio" e a vaga com uma pessoa mostra o **primeiro nome** de quem já está nela ("Com: Maria") — para ajudar a completar a dupla, inclusive pelo gênero (homem trabalha com homem e mulher com mulher, salvo casais); a vaga vazia não mostra texto. Só o primeiro nome é exposto (o `GET /api/carrinhos` só responde a quem está logado): nunca o nome completo, o id ou a marca criança/idoso, e nem a vaga cheia nem a desabilitada por "Você já tem pedido neste horário" mostram nomes. As etapas de dia e turno não mostram nomes.
6. Ao confirmar o carrinho, a solicitação é **enviada na hora** (uma por vez — não há carrinho de compras nem etapa de revisão) e ele volta à tela inicial. Para pedir mais de uma combinação na mesma escala (ex: Carrinho A / Segunda / 08–10 **e** Carrinho B / Quinta / 14–16), repete os passos 3–5. O mês/escala não é escolhido: é sempre a escala em envio.
7. Se a vaga encher ou o horário ficar ocupado entre a escolha e o envio (`VAGA_CHEIA` / `HORARIO_OCUPADO`), o formulário avisa e volta para ele escolher de novo; se a janela fechar nesse meio-tempo, mostra o aviso de envio fechado.
8. A qualquer momento (mesmo fora da janela de envio), a **tela inicial** funciona como histórico: mostra as solicitações dele na escala do **mês corrente** e na **escala em envio** (quando forem meses diferentes, uma lista por mês; escalas mais antigas não aparecem). As excluídas não existem mais. Não mostra data/hora do envio — a escala oficial é divulgada pelo administrador no grupo de WhatsApp, fora do sistema. Cada pedido mostra em destaque o dia da semana e, ao lado, o turno; por último o carrinho (nome e descrição), e a lista segue essa mesma ordem. Abaixo da lista, o botão **"Voltar ao WhatsApp"** (abre um agradecimento e leva ao grupo; não indica "escala concluída", pois o sistema não tem esse status) só aparece quando o publicador tem ao menos um pedido na escala (mês atual ou mês-alvo) e o link do grupo está configurado.
9. Nessa mesma tela de histórico, pode **excluir** uma solicitação sua **somente enquanto a janela de envio estiver aberta e apenas para a escala do mês-alvo**. A exclusão apaga o registro. Fora disso, só o administrador pode excluí-la.

Regra do horário (regra 10): o mesmo publicador não pode ter dois pedidos
no mesmo **dia da semana e turno** da escala, nem em carrinhos diferentes —
não dá para estar em dois lugares ao mesmo tempo.

## 6. Fluxo do Administrador

1. Acessa o painel administrativo.
2. **Configura os carrinhos**: cadastra os carrinhos (nome e descrição
   opcional), pode editar esses dados a qualquer momento, e define, para
   cada um e **para cada dia da semana**, quais dos 6 turnos fixos do
   sistema ele tem disponíveis (um carrinho pode ter turnos diferentes
   de outro, e turnos diferentes em cada dia). Os turnos em si
   não são cadastráveis — são sempre os mesmos 6, fixos no sistema
   (ver seção 3). Essa configuração vale para os publicadores
   escolherem e também para a adição manual (ver item 7).
3. Seleciona a escala (mês) que deseja gerenciar — pode ser a que está
   com a janela aberta no momento, ou qualquer outra (passada ou
   futura).
4. Toda a gestão é feita na **tela da Escala** (usada em celular e
   tablet, por toque). Ela mostra um **resumo geral** (total de pedidos,
   vagas com 1 pessoa e vagas com excesso) e, **um bloco por carrinho**, as
   vagas dele (no celular, um seletor de dia e a lista de turnos daquele
   dia; a partir de 768 px, uma grade Turno × Dia) — **todas as vagas configuradas
   dos carrinhos ativos, inclusive as vazias**, e também qualquer vaga que
   ainda tenha pedidos (de turno removido ou carrinho desativado), cada uma
   colorida pelo estado (regra 1): sem cor se vazia, verde se completa,
   vermelho se incompleta (1 pessoa) ou com excesso. Quem é criança ou
   idoso aparece com um ícone ao lado do nome.
5. Tocando no nome de uma pessoa, o administrador vê em que vaga ela está
   e quantos pedidos tem na escala, e escolhe o que fazer:
   - **Mover** (a ação mais comum): depois de conversar com o
     publicador, toca na vaga de destino (outro carrinho, dia ou turno
     da mesma escala, de carrinho ativo) e confirma. O pedido continua o mesmo (mesma
     origem), só muda de vaga. Mover para uma vaga que ficaria com
     excesso, ou deixar a vaga de origem com 1 pessoa, é permitido — a
     tela apenas avisa — também se a pessoa já estiver em outro carrinho no mesmo dia e turno. Vale a regra de duplicidade (regra 10).
   - **Editar pessoa**: nome e marca "criança ou idoso" (valem para
     todos os pedidos daquela pessoa).
   - **Excluir** (último recurso, discreto na tela, com confirmação).
6. Não há aprovação nem rejeição: toda solicitação já conta na escala. O objetivo é **encaixar cada publicador numa vaga disponível**, de preferência movendo; quando não houver jeito, o administrador **exclui** (com confirmação — é definitivo) as solicitações que decidir tirar. **O critério de desempate é de uso exclusivo do administrador** — o sistema não sugere nem impõe nenhum critério (ordem de chegada, prioridade, etc.); a escolha de quem fica é inteiramente sua. Para ajudá-lo nessa decisão, o sistema mostra, ao selecionar uma pessoa na tela da Escala, **quantas solicitações ela já tem na mesma escala** (contando todas as trincas, não só a selecionada — regra 16).
7. **A qualquer momento**, o administrador também pode **adicionar
   manualmente** uma nova solicitação a qualquer escala, pelo "+" da vaga
   na tela da Escala:
   - Escolhe o carrinho, o dia da semana e o turno (a vaga tocada) — o turno só pode
     ser um dos configurados como disponível para aquele carrinho
     naquele dia da semana, e o carrinho precisa estar ativo (mesma restrição que vale para o publicador, ver item 2 e regra 18).
   - Escolhe um **publicador já cadastrado**, buscando pelo nome
     ou pelo usuário (sem diferenciar maiúsculas nem acentos); quem já está
     na vaga aparece desabilitado. Nome digitado livremente **não cria**
     publicador, e a tela da Escala não cria contas: quem ainda não tem
     conta é cadastrado antes na tela **Publicadores**.
   - Vale a **regra de duplicidade** (regra 10): o sistema não permite
     criar uma solicitação manual idêntica a uma que aquele publicador
     já tenha na mesma escala. Se ele já estiver em outro carrinho no
     mesmo dia e turno, a tela só avisa.
   - A solicitação criada dessa forma entra na escala como qualquer
     outra.
   - A marca **criança ou idoso** (regra 1) é a da pessoa: posta na tela
     Publicadores ou em "Editar pessoa".
   - **Não há bloqueio do sistema** caso uma trinca passe da meta da
     regra 1 (seja por adição manual, seja por mover) — a
     tela apenas **sinaliza visualmente** o excesso, e cabe ao
     administrador decidir quando e como ajustar (excluindo alguma
     solicitação daquela trinca).
8. A **escala mensal é sempre calculada na hora** a partir de todas as
   solicitações existentes (vindas de publicadores ou adicionadas
   manualmente) — não há passo de gerar, aprovar ou publicar.
9. A mesma tela é a escala final (com os nomes). Pelo botão
   "Compartilhar", o administrador gera imagens só leitura para o grupo.
   A **imagem de compartilhamento** (para o grupo do WhatsApp) segue a ordem
   em que as pessoas procuram o próprio nome — **dia → turno → carrinho**: é
   **uma imagem do mês inteiro**, com uma grade por dia da semana (turnos nas
   linhas, carrinhos — só o nome — nas colunas, os nomes nas células),
   só com o que tem gente e sem estado de vaga. A descrição dos carrinhos
   aparece uma vez por imagem, numa legenda acima das grades (só os que têm
   descrição), para não alargar as colunas. Cada **data especial**
   (regra 10a) sai numa **imagem separada**, fora da imagem do mês.

## 7. Regras de Negócio

1. **Limite alvo por combinação**: cada trinca `(carrinho, dia da semana, turno)` em uma escala deve ter **2 pessoas** — ou **3, se pelo menos uma delas for criança ou idoso** (marca que o administrador põe na pessoa: em "Editar pessoa", na tela da Escala, ou na tela Publicadores). Vale tanto para solicitações de publicadores quanto para adições manuais do administrador. Esse limite **não é imposto ao administrador**; é uma meta que ele persegue manualmente ao revisar a escala. **Para o publicador, a vaga com 2 pessoas é "cheia" e o envio é recusado** (`409`, `codigo: "VAGA_CHEIA"`; o 3º, de criança/idoso, é adicionado só pelo administrador). No envio, na escolha do carrinho, a vaga com uma pessoa mostra o primeiro nome dela ("Com: Maria", seção 5, passo 5) e a cheia fica desabilitada com "Cheio" (dia ou turno sem nenhuma vaga livre também); ao excluir/mover alguém, a vaga volta a aceitar pedidos (calculado a cada request). Quem já tem pedido numa vaga que depois enche mantém o pedido. Para o publicador, "cheia" é sempre **2 ou mais pessoas**, mesmo que uma delas seja criança/idoso. Na tela do administrador o sistema apenas **sinaliza pela cor** cada vaga, sem texto:
   - **vazia** (0 pessoas): sem cor;
   - **incompleta** (1 pessoa, mesmo que seja criança ou idoso): cor de perigo (vermelho) — precisa de atenção;
   - **completa** (2 pessoas, ou 3 com pelo menos uma criança/idoso): cor de sucesso (verde);
   - **com excesso** (3 sem nenhuma criança/idoso, ou 4 ou mais): cor de perigo (vermelho) — precisa de atenção.
2. **Combinação sem solicitação**: se não houver nenhuma solicitação para uma trinca, ela é **ignorada** — não entra na escala e não aparece como pendência para o administrador decidir.
3. **Combinação com excesso**: se a trinca passar do limite da regra 1, o sistema **sinaliza** o excesso na tela do administrador, mas **não bloqueia** nada — o administrador decide sozinho, sem nenhum critério sugerido pelo sistema, quando e como reduzir (movendo para outra vaga — regra 12b — ou, em último caso, excluindo).
4. **Combinação incompleta** (1 solicitação): também é **sinalizada** como precisando de atenção (regra 1) — o administrador procura completá-la (movendo ou adicionando alguém), mas nada é bloqueado. Com 2 solicitações (ou 3 com uma criança/idoso) a trinca está completa.
5. **Escala mensal**: é composta por **todas as solicitações existentes** da escala (não há aprovação); toda trinca sem solicitação simplesmente não aparece na escala.
6. **Janela de envio — abre sozinha, o administrador fecha**: todo dia 15 abre o envio para a escala do mês seguinte; ele só fecha quando o administrador fecha (e pode reabrir) — não há fechamento automático. Com o envio fechado, os publicadores não enviam nem excluem pedidos (seção 4).
7. **Administrador sem restrição de janela**: pode gerenciar (ver, excluir, adicionar) qualquer escala a qualquer momento, independentemente da janela de envio. Depois de fechar o envio, esse é o período esperado para os ajustes finais antes do mês da escala começar.
8. **Sem limite** de quantas trincas um mesmo publicador pode ter em uma escala — pode trabalhar em vários carrinhos/dias/turnos livremente.
9. **Identificação do publicador**: cada publicador tem uma **conta** criada pelo administrador (tela Publicadores — ADR 0001): um **usuário** único (sem diferenciar maiúsculas nem acentos) e uma **senha** de 4 dígitos gerada pelo sistema. Todo o site exige login (seção 5, passo 2); o publicador de cada pedido vem do login, em qualquer aparelho. O **nome** é o da conta: só o administrador o altera (na tela Publicadores ou em "Editar pessoa", na Escala), e a correção vale para todos os pedidos daquela pessoa; o publicador não envia nem edita o nome. A adição manual do administrador também não recebe nome: só escolhe um publicador já cadastrado (seção 6, item 7). **Nomes repetidos são permitidos** (não é bloqueio — os únicos bloqueios automáticos são os da regra 10 e a vaga cheia da regra 1). Nome: obrigatório, até 200 caracteres, sem espaços nas pontas.
10. **Um lugar por horário e bloqueio de duplicidade**: um publicador não pode estar em dois lugares ao mesmo tempo. **No envio do publicador**, ele não pode pedir um `(dia da semana, turno)` em que já tem solicitação na mesma escala, **em qualquer carrinho** — o sistema recusa (`409`, `codigo: "HORARIO_OCUPADO"`) e o formulário mostra o turno desabilitado com "Você já tem pedido neste horário". **Para o administrador** (adição manual e mudança de vaga — regra 12b), estar em outro carrinho no mesmo dia e turno **só é avisado**, nunca bloqueado (ex: dois publicadores com o mesmo nome). Para o administrador continua bloqueada só a duplicidade exata: duas solicitações do mesmo publicador para a mesma combinação `(escala, carrinho, dia da semana, turno)` — o único bloqueio que vale também para ele. Pedidos que já existiam no mesmo horário quando a regra entrou continuam valendo; o administrador os vê pelo aviso. O limite por trinca (regras 1 e 3) bloqueia **só o envio do publicador** (vaga cheia); o administrador nunca é bloqueado por lotação, apenas avisado.
10a. **Carrinho de data especial (escala de um dia só)**: em situações especiais (ex: um evento), o administrador cria um carrinho com uma **data especial** (sempre Segunda a Sexta). Esse carrinho só tem turnos no dia da semana da data, só aparece para os publicadores e na tela da Escala **na escala do mês da data**, e mostra "Somente em dd/mm" no formulário, no histórico, na Escala e na imagem de compartilhamento (numa imagem só dela, fora da imagem do mês). Os publicadores se inscrevem nele pelo formulário normal, com a mesma janela, o mesmo limite de vaga (regra 1) e a mesma duplicidade — e **só até a própria data** (horário de Brasília): a partir do dia seguinte ele some do formulário e o envio é recusado, mesmo com a escala ainda em envio. O administrador não tem esse limite (regra 7). O grupo de cada pedido (normal ou a data especial) é o do carrinho **no momento do pedido** (ou do último mover) e fica gravado no pedido. **Ele não compromete a escala semanal**: para a regra 10, os carrinhos normais formam um grupo e cada data especial forma outro — um pedido no carrinho especial não ocupa o `(dia, turno)` da escala semanal, nem o contrário; dois carrinhos especiais da mesma data continuam conflitando entre si. No formulário, o turno só fica desabilitado se não sobrar carrinho livre do outro grupo; na etapa do carrinho, os do grupo ocupado aparecem desabilitados com "Você já tem pedido neste horário". O aviso do administrador segue o mesmo critério. Mudar a data para outro dia da semana remove os turnos dos outros dias, sem tocar nos pedidos existentes; apagar a data volta a ser um carrinho normal.
11. **Histórico de solicitações**: o publicador logado consulta as solicitações da própria conta. Essa consulta fica **sempre disponível**, mesmo com o envio fechado. Como ele é identificado pela conta (regra 9), trocar de aparelho ou limpar os dados do navegador só pede o login de novo — o histórico continua o mesmo. A tela mostra as escalas do mês corrente e a em envio (seção 5, passo 8).
12. **Exclusão pelo publicador**: através da tela de histórico, o publicador pode excluir uma solicitação sua **somente enquanto a janela de envio estiver aberta e apenas se ela for da escala do mês-alvo (a escala em envio)** — solicitações de escalas que já saíram do envio não podem mais ser excluídas por ele. A exclusão **apaga o registro** — o sistema não guarda solicitações canceladas/excluídas, e o publicador pode voltar a pedir a mesma trinca depois. Fora da janela, a tela inicial não oferece o envio nem a exclusão e orienta o publicador a falar com o administrador. O bloqueio vale também no backend. Uma solicitação excluída libera a vaga que ocupava na trinca `(carrinho, dia da semana, turno)`.
12a. **Sem aprovação — o administrador exclui**: toda solicitação existente já conta na escala; não há Pendente, Aprovada nem Rejeitada. O administrador tira alguém da escala **excluindo** a solicitação, a qualquer momento e em qualquer escala (regra 7). A exclusão é **definitiva** (apaga o registro, com confirmação na tela) e libera o publicador a pedir a mesma trinca de novo. Quando esta regra entrou, as solicitações que estavam Rejeitadas foram apagadas e as Pendentes passaram a contar na escala.
12b. **Mover solicitação (administrador)**: o administrador pode mudar uma solicitação de vaga — outro carrinho, dia da semana e/ou turno **da mesma escala** —, a qualquer momento e em qualquer escala (regra 7). A solicitação continua a mesma (origem e data do pedido não mudam); o destino precisa ser um turno configurado para aquele carrinho naquele dia (regra 17), de carrinho ativo (regra 18) e, se for carrinho de data especial, da escala do mês da data (regra 10a); mover para uma vaga que ficaria com excesso **não é bloqueado**, só avisado (regras 1/3); se a vaga de origem ficar com 1 pessoa, a tela também avisa; o único bloqueio é a duplicidade (regra 10). O publicador vê a nova vaga no seu histórico; não há notificação (regra 14). O sistema nunca sugere quem mover nem para onde.
13. **Critério de desempate exclusivo do administrador**: quando uma trinca passa do limite (regra 1), a escolha de quem fica (e de quem mover ou excluir) é inteiramente do administrador — o sistema não sugere nem aplica nenhum critério. Como apoio (não como critério imposto), o sistema mostra quantas solicitações cada publicador envolvido já tem na mesma escala (regra 16).
14. **Sem notificações**: o sistema não envia avisos (e-mail, push, etc.) ao publicador sobre suas solicitações; a escala oficial é divulgada pelo administrador no grupo de WhatsApp.
15. **Administradores**: qualquer publicador pode ser marcado como administrador (todos com os mesmos poderes, sem papéis administrativos diferentes) e entra pela mesma tela de login, com usuário e senha; continua pedindo vagas como qualquer publicador. A sessão de administrador dura **2 horas**. O acesso configurado no servidor fica só como **administrador de recuperação**, para criar o primeiro administrador ou recuperar o acesso (ADR 0001): ele só acessa a área administrativa e não pede vagas.
15a. **Unir publicadores duplicados**: quando a mesma pessoa tem dois ou mais registros, o administrador abre o registro que fica (destino) e une a ele, de uma vez, um ou mais registros (origens), vendo antes quantos pedidos passam e quantos são descartados. Tudo acontece junto ou nada acontece. Os pedidos das origens passam ao destino, que fica com um só pedido por vaga da mesma escala (duplicidade, regra 4): os que o destino já tem, ou que outra origem já passou, são excluídos; a marca criança/idoso passa ao destino se alguma origem a tinha (nunca desmarca), mas a de administrador não passa (se preciso, o administrador marca o destino depois); nome, usuário e senha do destino não mudam; as origens são apagadas. Lotação e horário ocupado não bloqueiam (só sinalização). Um administrador não une a própria conta a outra (ficaria sem acesso), mas pode unir outras à sua.
15b. **Excluir publicador**: quando alguém sai (ou foi cadastrado por engano), o administrador exclui o publicador, vendo antes quantos pedidos e em quantas escalas serão excluídos. A conta e **todos os pedidos dela, de todas as escalas (passadas inclusive)**, são apagados definitivamente — não há como desfazer (ADR 0002); a pessoa é desconectada e as vagas que ela ocupava ficam livres (podem ficar incompletas na Escala). Não é limitado pela janela nem pela lotação. Um administrador não exclui a própria conta (ficaria sem acesso), mas pode excluir outro administrador. Não existe desativar: para bloquear o acesso por um tempo, o administrador usa **Redefinir senha** (desconecta os aparelhos e mantém os pedidos).
16. **Contagem de apoio ao desempate**: para cada publicador selecionado na tela da Escala (inclusive num grupo excedente), o sistema exibe o total de solicitações (somando todas as trincas) que ele já tem naquela mesma escala — para ajudar o administrador a decidir, sem determinar a decisão.
17. **Turnos por carrinho e dia da semana**: cada carrinho tem, **para cada dia da semana**, seu próprio conjunto de turnos disponíveis, definido pelo administrador como um subconjunto da lista fixa de turnos do sistema (os horários de cada turno são os mesmos em qualquer carrinho e dia que o utilize). Um carrinho pode ter turnos diferentes de outro, e o mesmo carrinho pode ter turnos diferentes em cada dia (ex: Carrinho 01 com 08:00–10:00 na Segunda e só 10:00–12:00 na Terça). O publicador só pode escolher, para um carrinho e dia, um dos turnos configurados para aquela combinação; a adição manual pelo administrador segue a mesma restrição. Quando esta regra entrou, a configuração anterior de turnos por carrinho foi zerada e o administrador reconfigurou cada carrinho.
18. **Remoção de turno de um carrinho / desativação de um carrinho**: quando o administrador remove um turno da configuração de um carrinho (em um ou mais dias da semana), ou desativa um carrinho, isso afeta apenas **novas** solicitações a partir dali: aquele turno/carrinho deixa de ser oferecido e o sistema recusa pedir, adicionar ou mover para ele — **vale para o publicador e para o administrador**. As solicitações que já existiam com essa combinação **não são alteradas nem removidas** — continuam aparecendo normalmente no histórico do publicador e na escala, e o administrador pode movê-las para outra vaga ou excluí-las.
19. **Dias da semana fixos**: o sistema só trabalha com **Segunda a Sexta-feira**. Não existe Sábado nem Domingo como opção em nenhum fluxo (publicador, adição manual do administrador, escala final).
20. **Turnos fixos do sistema**: os turnos não são cadastrados nem editados pelo administrador — são sempre estes 6, fixos: **06:00–08:00, 08:00–10:00, 10:00–12:00, 14:00–16:00, 16:00–18:00, 18:00–20:00**. O papel do administrador é apenas escolher, por carrinho e dia da semana, quais desses 6 ficam disponíveis (regra 17).

## 8. Ciclo de vida de uma Solicitação

```
(publicador envia / admin adiciona) ──► EXISTE (já conta na escala)

EXISTE ──(publicador exclui, só com a janela aberta e na escala do mês-alvo)──► (registro apagado)
EXISTE ──(admin exclui, a qualquer momento)──► (registro apagado)
```

- Não há estados: a solicitação existe (e conta na escala) ou foi excluída (e deixou de existir).
- Não existe *Pendente*, *Aprovada*, *Rejeitada* nem *Cancelada*; desistência do publicador e decisão do administrador são, ambas, exclusões.

## 9. Modelo de Dados (entidades sugeridas)

**Publicador**
- `id` (GUID gerado pelo servidor; os registros anteriores às contas mantêm o id do antigo token anônimo do aparelho)
- `nome` (até 200 caracteres; só o administrador altera)
- `crianca_ou_idoso` (booleano, padrão falso; marcado pelo administrador — regra 1)
- `usuario` (único sem diferenciar maiúsculas nem acentos; vazio nos registros antigos até o administrador definir) e `pin_hash` (só o hash da senha de 4 dígitos)
- `administrador` (booleano) e `versao_sessao` (incrementada ao redefinir ou trocar a senha: desconecta os aparelhos). Não há marca de ativo (ADR 0002): quem sai é excluído (regra 15b)

**Carrinho**
- `id`
- `nome` (ex: "Carrinho 1")
- `descricao` (texto livre opcional, até 500 caracteres, exibido ao publicador abaixo do nome)
- `ativo` (booleano, para poder desativar um carrinho sem apagar histórico)
- `data_especial` (data opcional, Segunda a Sexta; preenchida = carrinho de um dia só — regra 10a)

**Turno**
- `id`
- `hora_inicio`, `hora_fim`
- **Fixos do sistema, não cadastráveis pelo administrador.** São sempre estes 6: 06:00–08:00, 08:00–10:00, 10:00–12:00, 14:00–16:00, 16:00–18:00, 18:00–20:00.

**CarrinhoTurno** (associação: quais turnos cada carrinho tem disponível em cada dia da semana)
- `carrinho_id`
- `dia_semana` (Segunda a Sexta)
- `turno_id`
- Chave: `(carrinho_id, dia_semana, turno_id)`.
- Definida pelo administrador; um carrinho pode ter, em cada dia, qualquer subconjunto dos 6 turnos fixos, diferente de outro carrinho e de outro dia.

**DiaSemana**
- Enum fixo: Segunda, Terça, Quarta, Quinta, Sexta (não precisa de tabela própria). **Não existem Sábado nem Domingo no sistema.**

**Escala**
- `id`
- `mes_referencia` (ano + mês, ex: Outubro/2026 — formato de armazenamento exato é decisão técnica, ver `TECHNICAL_SPEC.md`)
- `envio_fechado` (booleano, padrão falso): marcado quando o administrador fecha o envio dos publicadores para essa escala; desmarcado se ele reabre. A abertura é calculada a partir da data (dia 15); a escala-alvo também.

**Solicitacao**
- `id`
- `publicador_id`
- `escala_id`
- `carrinho_id`
- `dia_semana`
- `turno_id`
- `data_especial` (cópia da data especial do carrinho no momento do pedido/mover; nula = escala semanal) — define o grupo do horário ocupado (regra 10a)
- `origem` (PUBLICADOR | ADMINISTRADOR) — indica se veio do fluxo normal de envio ou foi criada manualmente pelo administrador; não muda ao mover
- `criado_em` (não é exibido; usado para ordenar)
- Restrição de unicidade: `(publicador_id, escala_id, carrinho_id, dia_semana, turno_id)`

**EscalaMensal (grade final)** (pode ser calculada sob demanda, sem precisar de tabela própria)
- Para cada `(escala_id, carrinho_id, dia_semana, turno_id)`: lista das `Solicitacao` existentes (a meta é 2 registros, ou 3 com uma criança/idoso — regra 1).

## 10. Ideias futuras (fora do escopo atual)

- Exportação da escala em PDF/Excel/impressão (a imagem para o WhatsApp já existe — seção 6, item 9).
- Relatórios/histórico consolidado de escalas passadas.

Trabalho novo é planejado em GitHub Issues (`devsuperman/CartSchedule`).
