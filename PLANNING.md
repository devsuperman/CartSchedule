# CartSchedule — Planejamento do Projeto

## 1. Visão Geral

Sistema web para organizar o uso de carrinhos de trabalho ao longo do mês.
Publicadores solicitam em quais carrinhos, dias da semana e turnos desejam
trabalhar; todo pedido entra direto na escala e um administrador a ajusta,
excluindo os excedentes, buscando o limite de **2 pessoas por carrinho, por dia da
semana, por turno**.

## 2. Atores

- **Publicador**: informa seu nome, escolhe o carrinho, o(s) dia(s) da
  semana e o turno em que quer trabalhar, e envia a solicitação — apenas
  durante a janela de envio automaticamente aberta pelo sistema (ver
  seção 4).
- **Administrador**: visualiza todas as solicitações recebidas para uma
  escala (todas já contam na escala), exclui as que decidir tirar
  (buscando o limite de 2 por combinação), pode adicionar solicitações manualmente a qualquer escala
  a qualquer momento, e gera a escala mensal final.

## 3. Conceitos-chave

| Conceito | Descrição |
|---|---|
| **Escala (mês de referência)** | O mês/ano para o qual a escala está sendo montada (ex: Outubro/2026). |
| **Janela de envio** | Período em que o sistema aceita novas solicitações de Publicadores para a escala do mês seguinte (ver seção 4). |
| **Carrinho** | Um carrinho de trabalho disponível (ex: Carrinho 1, Carrinho 2...). Tem um nome e uma **descrição** opcional (ex: local onde fica), exibida ao publicador abaixo do nome na hora de escolher o carrinho. |
| **Dia da semana** | **Sempre Segunda a Sexta-feira** — são os únicos dias que existem no sistema; não há Sábado nem Domingo. A escolha é **recorrente**: se o publicador escolhe "Segunda-feira", isso vale para todas as segundas-feiras daquele mês — não é uma data específica do calendário. |
| **Turno** | Faixa de horário **fixa do sistema**, não cadastrável pelo administrador. São sempre estes 6 turnos: **06:00–08:00, 08:00–10:00, 10:00–12:00, 14:00–16:00, 16:00–18:00, 18:00–20:00**. Os mesmos horários valem para todos os carrinhos que usarem aquele turno. |
| **Turnos disponíveis do carrinho** | Cada carrinho usa apenas um subconjunto dos turnos fixos, definido pelo administrador **por dia da semana**. Um carrinho pode ter turnos diferentes de outro, e o mesmo carrinho pode ter turnos diferentes em cada dia (ex: Carrinho 01 tem 08:00–10:00 na Segunda, mas só 10:00–12:00 na Terça). |
| **Solicitação** | O pedido para trabalhar em `(carrinho, dia da semana, turno)` dentro de uma escala (mês). Pode ter sido criada por um Publicador (fluxo normal) ou pelo Administrador (adição manual). Não há aprovação: **toda solicitação existente já faz parte da escala**; tirar alguém é excluir a solicitação. |
| **Escala mensal (resultado final)** | Para cada `(carrinho, dia da semana, turno)`, todos os publicadores com solicitação (a meta é até 2). |

## 4. Janela de Envio (automática)

- **Abertura**: todo dia **15** do mês, o sistema abre automaticamente o
  envio de solicitações para a escala do **mês seguinte**.
  - Ex: dia 15 de setembro → abre a escala de Outubro.
- **Fechamento**: a janela fecha ao final do dia **25** do mesmo mês
  (ex: se abriu em 15/09, o último dia para enviar é 25/09).
- **A partir do dia 25**, começa o período em que o **administrador
  realiza os ajustes** (excluindo e adicionando solicitações
  manualmente) e finaliza a escala mensal antes do mês
  seguinte começar.
- **Fora da janela** (do dia 26 ao dia 14 do mês seguinte): o
  Publicador que acessar o site vê uma **mensagem informando que o
  envio de novas solicitações está fechado** (ex: "Envio fechado.
  Abre novamente no dia 15."). O **histórico de suas próprias
  solicitações continua disponível para consulta a qualquer momento**,
  independentemente da janela estar aberta ou fechada (ver regra 11).
- **Apenas uma escala fica aberta por vez** para novos envios de
  Publicadores — sempre a do mês seguinte ao mês corrente, do dia 15
  ao dia 25.
- O Administrador **não é limitado pela janela**: pode ver, excluir
  e adicionar solicitações em qualquer escala (passada, atual
  em aberto, ou futura) a qualquer momento.

## 5. Fluxo do Publicador

1. Acessa o site durante a janela de envio (dias 15 a 25 do mês).
2. No **primeiro acesso** (janela aberta ou fechada), antes de qualquer
   outra coisa, informa seu **nome**. Não há cadastro/login com senha — o
   nome fica salvo no aparelho e não é pedido de novo. A partir daí o site
   mostra **"Olá, {primeiro nome}"** no cabeçalho; tocando nele, o
   publicador corrige o nome a qualquer momento, e a correção vale na hora
   também para o administrador. O formulário de solicitação não pede o
   nome.
3. Seleciona o **carrinho** que deseja usar (vê o nome e, abaixo dele, a descrição do carrinho, quando houver) — só aparecem os carrinhos que têm algum turno configurado.
4. Seleciona o **dia da semana** em que quer trabalhar — dias em que o carrinho escolhido não tem turno nem aparecem.
5. Seleciona o **turno** desejado — apenas entre os turnos que o administrador configurou como disponíveis **para aquele carrinho naquele dia da semana** (carrinhos diferentes, e dias diferentes do mesmo carrinho, podem ter turnos diferentes).
6. Pode repetir os passos 3–5 para pedir mais de uma combinação na mesma escala (ex: Carrinho A / Segunda / Manhã **e** Carrinho B / Quinta / Tarde). O mês/escala já está implícito (é sempre o mês seguinte, definido automaticamente pela janela aberta).
7. Revisa e **envia** as solicitações.
8. A qualquer momento (mesmo fora da janela de envio), pode acessar a tela de **histórico** e ver as solicitações que enviou (as que foram excluídas não existem mais), sem data/hora do envio — a escala oficial é divulgada pelo administrador no grupo de WhatsApp, fora do sistema. Cada pedido mostra em destaque o dia da semana e, ao lado, o turno; por último o carrinho (nome e descrição), e a lista segue essa mesma ordem.
9. Nessa mesma tela de histórico, pode **excluir** uma solicitação sua **somente enquanto a janela de envio estiver aberta e apenas para a escala do mês-alvo**. A exclusão apaga o registro. Fora disso, só o administrador pode excluí-la.

Regra de duplicidade: o mesmo publicador não pode enviar duas vezes a
mesma combinação `(escala, carrinho, dia da semana, turno)`.

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
4. Vê um **resumo geral**: total de solicitações recebidas naquela
   escala e quantas vagas estão com excesso.
5. Vê as solicitações **agrupadas por `(carrinho, dia da semana,
   turno)`**, já sinalizando cada grupo conforme a regra de negócio
   (seção 7):
   - Grupo **vazio** (0 solicitações) → ignorado, nem aparece como pendência.
   - Grupo com **1 ou 2** solicitações → dentro do limite, nada a fazer.
   - Grupo com **mais de 2** solicitações → sinalizado como **excedente**; o administrador escolhe quem sai e exclui essas solicitações.
   Ao lado do nome de cada publicador há um lápis para **corrigir o nome**
   dele (vale para todos os pedidos daquela pessoa).
6. Não há aprovação nem rejeição: toda solicitação já conta na escala. Para cada grupo excedente, o administrador **exclui** (com confirmação — é definitivo) as solicitações que decidir tirar. **O critério de desempate é de uso exclusivo do administrador** — o sistema não sugere nem impõe nenhum critério (ordem de chegada, prioridade, etc.); a escolha de quem fica é inteiramente sua. Para ajudá-lo nessa decisão, o sistema mostra, ao lado de cada publicador do grupo, **quantas solicitações esse publicador já tem na mesma escala** (contando todas as trincas, não só a que está em desempate).
7. **A qualquer momento**, o administrador também pode **adicionar
   manualmente** uma nova solicitação a qualquer escala:
   - Escolhe o carrinho, o dia da semana e o turno — o turno só pode
     ser um dos configurados como disponível para aquele carrinho
     naquele dia da semana (mesma restrição que vale para o publicador, ver item 2).
   - Informa o nome do publicador — pode escolher um publicador já
     cadastrado **ou digitar um nome novo livremente** (o sistema cria
     o publicador automaticamente se ele ainda não existir). Se houver
     mais de um publicador com exatamente esse nome, usa sempre o que
     fez o pedido mais antigo.
   - Vale a mesma **regra de duplicidade** do envio normal (regra 10):
     o sistema não permite criar uma solicitação manual idêntica a
     uma que aquele publicador já tenha na mesma escala.
   - A solicitação criada dessa forma entra na escala como qualquer
     outra.
   - **Não há bloqueio do sistema** caso uma trinca fique com mais de
     2 pessoas (seja por adição manual, seja por envios normais) — a
     tela apenas **sinaliza visualmente** o excesso, e cabe ao
     administrador decidir quando e como ajustar (excluindo alguma
     solicitação daquela trinca).
8. Ao concluir as decisões da escala, o sistema mantém a **escala
   mensal sempre atualizada automaticamente** a partir de todas as
   solicitações existentes (sejam vindas de publicadores ou adicionadas
   manualmente pelo administrador).
9. O administrador visualiza a escala final (grade Carrinho × Dia da
   semana × Turno, com os nomes) e pode compartilhá-la/exportá-la.

## 7. Regras de Negócio

1. **Limite alvo por combinação**: cada trinca `(carrinho, dia da semana, turno)` em uma escala deve ter **no máximo 2 pessoas** — vale tanto para solicitações de publicadores quanto para adições manuais do administrador. Esse limite **não é imposto automaticamente pelo sistema**; é uma meta que o administrador persegue manualmente ao revisar a escala (o sistema apenas sinaliza visualmente quando uma trinca está com excesso).
2. **Combinação sem solicitação**: se não houver nenhuma solicitação para uma trinca, ela é **ignorada** — não entra na escala e não aparece como pendência para o administrador decidir.
3. **Combinação com excesso**: se houver mais de 2 solicitações para a mesma trinca, o sistema **sinaliza** o excesso na tela do administrador, mas **não bloqueia** nada — o administrador decide sozinho, sem nenhum critério sugerido pelo sistema, quando e como reduzir para 2 (excluindo o excedente).
4. **Combinação dentro do limite** (1 ou 2 solicitações): já está resolvida, sem conflito.
5. **Escala mensal**: é composta por **todas as solicitações existentes** da escala (não há aprovação); toda trinca sem solicitação simplesmente não aparece na escala.
6. **Janela de envio automática**: publicadores só enviam solicitações do dia 15 ao dia 25 do mês corrente, sempre para a escala do mês seguinte. Fora disso, o envio fica fechado para eles.
7. **Administrador sem restrição de janela**: pode gerenciar (ver, excluir, adicionar) qualquer escala a qualquer momento, independentemente da janela de envio. A partir do dia 25, esse é o período esperado para os ajustes finais antes do mês seguinte começar.
8. **Sem limite** de quantas trincas um mesmo publicador pode ter em uma escala — pode trabalhar em vários carrinhos/dias/turnos livremente.
9. **Identificação do publicador**: não há cadastro com login e senha — o nome é informado livremente, pelo publicador no primeiro acesso ou na adição manual pelo administrador. O nome pode ser corrigido a qualquer momento pelo próprio publicador ("Olá, Fulano") ou pelo administrador (na revisão da escala); a correção vale para todos os pedidos daquela pessoa. Se depois o publicador enviar um pedido ou editar o nome, prevalece o nome salvo no aparelho dele. **Nomes repetidos são permitidos** (não é bloqueio — a regra 10 continua sendo o único).
10. **Bloqueio de duplicidade (único bloqueio automático do sistema)**: um publicador não pode ter duas solicitações para a mesma combinação `(escala, carrinho, dia da semana, turno)`. Ao tentar enviar uma solicitação idêntica a uma já existente sua, o sistema recusa o novo envio. Vale tanto para o envio normal do publicador quanto para uma adição manual feita pelo administrador em nome dele. Este é o único bloqueio automático de todo o sistema — o limite de 2 por trinca (regras 1 e 3) **não** é bloqueado, apenas sinalizado.
11. **Histórico de solicitações**: o publicador deve conseguir consultar as solicitações que ele mesmo enviou, sem precisar de cadastro formal. Essa consulta fica **sempre disponível**, mesmo fora da janela de envio (dia 26 ao dia 14). A forma de identificá-lo para isso será definida na fase de implementação.
12. **Exclusão pelo publicador**: através da tela de histórico, o publicador pode excluir uma solicitação sua **somente enquanto a janela de envio estiver aberta (dia 15 ao 25) e apenas se ela for da escala do mês-alvo** — solicitações do mês corrente ou de meses passados não podem mais ser excluídas por ele. A exclusão **apaga o registro** — o sistema não guarda solicitações canceladas/excluídas, e o publicador pode voltar a pedir a mesma trinca depois. Fora da janela, a tela inicial não oferece o envio nem a exclusão e orienta o publicador a falar com o administrador. O bloqueio vale também no backend. Uma solicitação excluída libera a vaga que ocupava na trinca `(carrinho, dia da semana, turno)`.
12a. **Sem aprovação — o administrador exclui**: toda solicitação existente já conta na escala; não há Pendente, Aprovada nem Rejeitada. O administrador tira alguém da escala **excluindo** a solicitação, a qualquer momento e em qualquer escala (regra 7). A exclusão é **definitiva** (apaga o registro, com confirmação na tela) e libera o publicador a pedir a mesma trinca de novo. Quando esta regra entrou (Fase 11), as solicitações que estavam Rejeitadas foram apagadas e as Pendentes passaram a contar na escala.
13. **Critério de desempate exclusivo do administrador**: quando há mais de 2 solicitações para a mesma trinca, a escolha de quem fica (e de quais excluir) é inteiramente do administrador — o sistema não sugere nem aplica nenhum critério. Como apoio (não como critério imposto), o sistema mostra quantas solicitações cada publicador envolvido já tem na mesma escala (regra 16).
14. **Sem notificações**: o sistema não envia avisos (e-mail, push, etc.) ao publicador sobre suas solicitações; a escala oficial é divulgada pelo administrador no grupo de WhatsApp.
15. **Um único administrador**: não há necessidade de múltiplos administradores nem de controle de acesso por diferentes papéis administrativos.
16. **Contagem de apoio ao desempate**: para cada publicador presente num grupo excedente (mais de 2 solicitações na mesma trinca), o sistema exibe o total de solicitações (somando todas as trincas) que ele já tem naquela mesma escala — para ajudar o administrador a decidir, sem determinar a decisão.
17. **Turnos por carrinho e dia da semana**: cada carrinho tem, **para cada dia da semana**, seu próprio conjunto de turnos disponíveis, definido pelo administrador como um subconjunto da lista fixa de turnos do sistema (os horários de cada turno são os mesmos em qualquer carrinho e dia que o utilize). Um carrinho pode ter turnos diferentes de outro, e o mesmo carrinho pode ter turnos diferentes em cada dia (ex: Carrinho 01 com 08:00–10:00 na Segunda e só 10:00–12:00 na Terça). O publicador só pode escolher, para um carrinho e dia, um dos turnos configurados para aquela combinação; a adição manual pelo administrador segue a mesma restrição. Quando esta regra entrou (Fase 6), a configuração anterior de turnos por carrinho foi zerada e o administrador reconfigurou cada carrinho.
18. **Remoção de turno de um carrinho / desativação de um carrinho**: quando o administrador remove um turno da configuração de um carrinho (em um ou mais dias da semana), ou desativa um carrinho, isso afeta apenas **novos** envios a partir dali (aquele turno/carrinho deixa de ser oferecido). As solicitações que já existiam com essa combinação **não são alteradas nem removidas** — continuam aparecendo normalmente no histórico do publicador e na escala.
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
- `id`
- `nome`

**Carrinho**
- `id`
- `nome` (ex: "Carrinho 1")
- `descricao` (texto livre opcional, exibido ao publicador abaixo do nome)
- `ativo` (booleano, para poder desativar um carrinho sem apagar histórico)

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
- Status de janela (aberta/fechada) **calculado automaticamente** a partir da data atual — não é um campo editável manualmente.

**Solicitacao**
- `id`
- `publicador_id`
- `escala_id`
- `carrinho_id`
- `dia_semana`
- `turno_id`
- `origem` (PUBLICADOR | ADMINISTRADOR) — indica se veio do fluxo normal de envio ou foi criada manualmente pelo administrador
- `criado_em`
- Restrição de unicidade: `(publicador_id, escala_id, carrinho_id, dia_semana, turno_id)`

**EscalaMensal (grade final)** (pode ser calculada sob demanda, sem precisar de tabela própria)
- Para cada `(escala_id, carrinho_id, dia_semana, turno_id)`: lista das `Solicitacao` existentes (a meta é 0, 1 ou 2 registros).

## 10. Roadmap Sugerido

- **Fase 1 — Solicitação do publicador**: formulário (nome, carrinho, dia da semana — sempre Segunda a Sexta —, turno — um dos 6 turnos fixos, restrito aos configurados para o carrinho e o dia escolhidos) disponível apenas durante a janela automática (dia 15 ao dia 25 do mês), sempre direcionado à escala do mês seguinte, com bloqueio de solicitações duplicadas e tela de histórico próprio (sempre disponível, com opção de exclusão só durante a janela e para a escala do mês-alvo), sem cadastro formal.
- **Fase 2 — Painel do administrador**: cadastro de carrinhos e configuração de quais dos 6 turnos fixos cada carrinho tem disponível em cada dia da semana; listagem/contagem de solicitações por escala, agrupamento por `(carrinho, dia, turno)` com sinalização visual de excesso (mais de 2, sem bloqueio automático desse limite) e contagem de apoio ao desempate por publicador; exclusão livre das solicitações excedentes (critério de desempate exclusivo do administrador); e adição manual de solicitações (com criação de publicador por nome livre) a qualquer escala.
- **Fase 3 — Escala mensal**: geração e visualização da grade final (Carrinho × Dia da semana × Turno) a partir de todas as solicitações da escala.
- **Fase 4 — Melhorias futuras (opcionais)**: exportação da escala (PDF/Excel/impressão) e relatórios/histórico consolidado de escalas passadas.
