# CartSchedule — Planejamento do Projeto

## 1. Visão Geral

Sistema web para organizar o uso de carrinhos de trabalho ao longo do mês.
Publicadores solicitam em quais carrinhos, dias da semana e turnos desejam
trabalhar; um administrador analisa os pedidos e monta a escala mensal
final, respeitando o limite de **2 pessoas por carrinho, por dia da
semana, por turno**.

## 2. Atores

- **Publicador**: informa seu nome, escolhe o carrinho, o(s) dia(s) da
  semana e o turno em que quer trabalhar, e envia a solicitação — apenas
  durante a janela de envio automaticamente aberta pelo sistema (ver
  seção 4).
- **Administrador**: visualiza todas as solicitações recebidas para uma
  escala, aprova ou rejeita cada uma (respeitando o limite de 2 por
  combinação), pode adicionar solicitações manualmente a qualquer escala
  a qualquer momento, e gera a escala mensal final.

## 3. Conceitos-chave

| Conceito | Descrição |
|---|---|
| **Escala (mês de referência)** | O mês/ano para o qual a escala está sendo montada (ex: Outubro/2026). |
| **Janela de envio** | Período em que o sistema aceita novas solicitações de Publicadores para a escala do mês seguinte (ver seção 4). |
| **Carrinho** | Um carrinho de trabalho disponível (ex: Carrinho 1, Carrinho 2...). |
| **Dia da semana** | Segunda a Domingo. A escolha é **recorrente**: se o publicador escolhe "Segunda-feira", isso vale para todas as segundas-feiras daquele mês — não é uma data específica do calendário. |
| **Turno** | Faixa de horário fixa e predefinida (ex: Manhã, Tarde, Noite), cadastrada previamente pelo administrador. Existe uma lista única de turnos no sistema, com os mesmos horários para todos os carrinhos. |
| **Turnos disponíveis do carrinho** | Cada carrinho usa apenas um subconjunto dos turnos cadastrados, definido pelo administrador. Um carrinho pode ter turnos diferentes de outro (ex: Carrinho A tem Manhã e Tarde; Carrinho B tem só Noite). |
| **Solicitação** | O pedido para trabalhar em `(carrinho, dia da semana, turno)` dentro de uma escala (mês). Pode ter sido criada por um Publicador (fluxo normal, começa Pendente) ou pelo Administrador (entra direto como Aprovada). |
| **Escala mensal (resultado final)** | Para cada `(carrinho, dia da semana, turno)`, até 2 publicadores aprovados. |

## 4. Janela de Envio (automática)

- **Abertura**: todo dia **15** do mês, o sistema abre automaticamente o
  envio de solicitações para a escala do **mês seguinte**.
  - Ex: dia 15 de setembro → abre a escala de Outubro.
- **Fechamento**: a janela fecha ao final do dia **25** do mesmo mês
  (ex: se abriu em 15/09, o último dia para enviar é 25/09).
- **A partir do dia 25**, começa o período em que o **administrador
  realiza os ajustes** (aprovando, rejeitando e adicionando
  solicitações manualmente) e finaliza a escala mensal antes do mês
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
- O Administrador **não é limitado pela janela**: pode ver, aprovar,
  rejeitar e adicionar solicitações em qualquer escala (passada, atual
  em aberto, ou futura) a qualquer momento.

## 5. Fluxo do Publicador

1. Acessa o site durante a janela de envio (dias 15 a 25 do mês).
2. Informa seu **nome**. Não há cadastro/login com senha — a
   identificação é simples e o sistema deve poupar o publicador de
   redigitar o nome a cada nova visita (a forma técnica de fazer isso
   será definida na fase de implementação).
3. Seleciona o **carrinho** que deseja usar.
4. Seleciona o **dia da semana** em que quer trabalhar.
5. Seleciona o **turno** desejado — apenas entre os turnos que o administrador configurou como disponíveis **para aquele carrinho** (carrinhos diferentes podem ter turnos diferentes).
6. Pode repetir os passos 3–5 para pedir mais de uma combinação na mesma escala (ex: Carrinho A / Segunda / Manhã **e** Carrinho B / Quinta / Tarde). O mês/escala já está implícito (é sempre o mês seguinte, definido automaticamente pela janela aberta).
7. Revisa e **envia** as solicitações.
8. A qualquer momento (mesmo fora da janela de envio), pode acessar a tela de **histórico** e ver o status de cada solicitação que enviou: *Pendente*, *Aprovada*, *Rejeitada* ou *Cancelada*.
9. Nessa mesma tela de histórico, pode **cancelar** qualquer solicitação sua — esteja ela Pendente ou já Aprovada — a qualquer momento.

Regra de duplicidade: o mesmo publicador não pode enviar duas vezes a
mesma combinação `(escala, carrinho, dia da semana, turno)`.

## 6. Fluxo do Administrador

1. Acessa o painel administrativo.
2. **Configura os carrinhos e seus turnos**: cadastra os carrinhos e os
   turnos do sistema, e define, para cada carrinho, quais turnos ele
   tem disponíveis (um carrinho pode ter turnos diferentes de outro).
   Essa configuração vale para os publicadores escolherem e também
   para a adição manual (ver item 7).
3. Seleciona a escala (mês) que deseja gerenciar — pode ser a que está
   com a janela aberta no momento, ou qualquer outra (passada ou
   futura).
4. Vê um **resumo geral**: total de solicitações recebidas naquela
   escala, quantas pendentes/aprovadas/rejeitadas.
5. Vê as solicitações **agrupadas por `(carrinho, dia da semana,
   turno)`**, já sinalizando cada grupo conforme a regra de negócio
   (seção 7):
   - Grupo **vazio** (0 solicitações) → ignorado, nem aparece como pendência.
   - Grupo com **1 ou 2** solicitações → dentro do limite, pode aprovar diretamente.
   - Grupo com **mais de 2** solicitações → sinalizado como **excedente**; o administrador precisa escolher quais 2 aprova e rejeitar as demais.
6. Para cada grupo excedente, o administrador aprova exatamente 2 e rejeita o restante. **O critério de desempate é de uso exclusivo do administrador** — o sistema não sugere nem impõe nenhum critério (ordem de chegada, prioridade, etc.); a escolha de quem aprovar fica inteiramente a seu critério. Para ajudá-lo nessa decisão, o sistema mostra, ao lado de cada publicador do grupo excedente, **quantas solicitações (pendentes + aprovadas) esse publicador já tem na mesma escala** (contando todas as trincas, não só a que está em desempate).
7. **A qualquer momento**, o administrador também pode **adicionar
   manualmente** uma nova solicitação a qualquer escala:
   - Escolhe o carrinho, o dia da semana e o turno — o turno só pode
     ser um dos configurados como disponível para aquele carrinho
     (mesma restrição que vale para o publicador, ver item 2).
   - Informa o nome do publicador — pode escolher um publicador já
     cadastrado **ou digitar um nome novo livremente** (o sistema cria
     o publicador automaticamente se ele ainda não existir).
   - Vale a mesma **regra de duplicidade** do envio normal (regra 10):
     o sistema não permite criar uma solicitação manual idêntica a
     uma que aquele publicador já tenha na mesma escala.
   - A solicitação criada dessa forma **já entra como Aprovada**
     diretamente.
   - **Não há bloqueio do sistema** caso uma trinca fique com mais de
     2 aprovados (seja por adição manual, seja por aprovações
     normais) — a tela apenas **sinaliza visualmente** o excesso, e
     cabe ao administrador decidir quando e como ajustar (rejeitando
     ou removendo alguma solicitação daquela trinca).
8. Ao concluir as decisões da escala, o sistema mantém a **escala
   mensal sempre atualizada automaticamente** a partir de todas as
   solicitações aprovadas (sejam vindas de publicadores ou adicionadas
   manualmente pelo administrador).
9. O administrador visualiza a escala final (grade Carrinho × Dia da
   semana × Turno, com os nomes aprovados) e pode compartilhá-la/exportá-la.

## 7. Regras de Negócio

1. **Limite alvo por combinação**: cada trinca `(carrinho, dia da semana, turno)` em uma escala deve ter **no máximo 2 pessoas aprovadas** — vale tanto para solicitações de publicadores quanto para adições manuais do administrador. Esse limite **não é imposto automaticamente pelo sistema**; é uma meta que o administrador persegue manualmente ao revisar a escala (o sistema apenas sinaliza visualmente quando uma trinca está com excesso).
2. **Combinação sem solicitação**: se não houver nenhuma solicitação para uma trinca, ela é **ignorada** — não entra na escala e não aparece como pendência para o administrador decidir.
3. **Combinação com excesso**: se houver mais de 2 solicitações para a mesma trinca, o sistema **sinaliza** o excesso na tela do administrador, mas **não bloqueia** nada — o administrador decide sozinho, sem nenhum critério sugerido pelo sistema, quando e como reduzir para 2 (rejeitando/removendo o excedente).
4. **Combinação dentro do limite** (1 ou 2 solicitações): podem ser aprovadas diretamente, sem conflito.
5. **Escala mensal**: é composta **apenas pelas solicitações aprovadas**; toda trinca com 0 aprovados simplesmente não aparece na escala.
6. **Janela de envio automática**: publicadores só enviam solicitações do dia 15 ao dia 25 do mês corrente, sempre para a escala do mês seguinte. Fora disso, o envio fica fechado para eles.
7. **Administrador sem restrição de janela**: pode gerenciar (ver, aprovar, rejeitar, adicionar) qualquer escala a qualquer momento, independentemente da janela de envio. A partir do dia 25, esse é o período esperado para os ajustes finais antes do mês seguinte começar.
8. **Sem limite** de quantas trincas um mesmo publicador pode ter aprovadas em uma escala — pode trabalhar em vários carrinhos/dias/turnos livremente.
9. **Identificação do publicador**: não há cadastro com login e senha — o nome é informado livremente, tanto no envio do publicador quanto na adição manual pelo administrador.
10. **Bloqueio de duplicidade (único bloqueio automático do sistema)**: um publicador não pode ter duas solicitações para a mesma combinação `(escala, carrinho, dia da semana, turno)`. Ao tentar enviar uma solicitação idêntica a uma já existente sua, o sistema recusa o novo envio. Vale tanto para o envio normal do publicador quanto para uma adição manual feita pelo administrador em nome dele. Este é o único bloqueio automático de todo o sistema — o limite de 2 por trinca (regras 1 e 3) **não** é bloqueado, apenas sinalizado.
11. **Histórico de solicitações**: o publicador deve conseguir consultar as solicitações que ele mesmo enviou (e o status de cada uma — pendente/aprovada/rejeitada/cancelada), sem precisar de cadastro formal. Essa consulta fica **sempre disponível**, mesmo fora da janela de envio (dia 26 ao dia 14). A forma de identificá-lo para isso será definida na fase de implementação.
12. **Cancelamento pelo publicador**: através da tela de histórico, o publicador pode cancelar qualquer solicitação sua, esteja ela Pendente ou já Aprovada, **a qualquer momento e sem restrição de prazo** — inclusive depois que o mês da escala já começou ou já terminou. Uma solicitação Aprovada que é cancelada libera a vaga que ocupava na trinca `(carrinho, dia da semana, turno)`.
13. **Critério de desempate exclusivo do administrador**: quando há mais de 2 solicitações para a mesma trinca, a escolha de quais aprovar é inteiramente do administrador — o sistema não sugere nem aplica nenhum critério. Como apoio (não como critério imposto), o sistema mostra quantas solicitações (pendentes + aprovadas) cada publicador envolvido já tem na mesma escala (regra 16).
14. **Sem notificações**: o sistema não envia avisos (e-mail, push, etc.) ao publicador sobre o status de suas solicitações; ele consulta o histórico quando quiser.
15. **Um único administrador**: não há necessidade de múltiplos administradores nem de controle de acesso por diferentes papéis administrativos.
16. **Contagem de apoio ao desempate**: para cada publicador presente num grupo excedente (mais de 2 solicitações na mesma trinca), o sistema exibe o total de solicitações (pendentes + aprovadas, somando todas as trincas) que ele já tem naquela mesma escala — para ajudar o administrador a decidir, sem determinar a decisão.
17. **Turnos por carrinho**: cada carrinho tem seu próprio conjunto de turnos disponíveis, definido pelo administrador, como um subconjunto da lista única de turnos do sistema (os horários de cada turno são os mesmos em qualquer carrinho que o utilize). Um carrinho pode ter turnos diferentes de outro. O publicador só pode escolher, para um carrinho, um dos turnos configurados para ele; a adição manual pelo administrador segue a mesma restrição.
18. **Remoção de turno de um carrinho / desativação de um carrinho**: quando o administrador remove um turno da configuração de um carrinho, ou desativa um carrinho, isso afeta apenas **novos** envios a partir dali (aquele turno/carrinho deixa de ser oferecido). As solicitações que já existiam com essa combinação (pendentes, aprovadas, rejeitadas ou canceladas) **não são alteradas nem removidas** — continuam aparecendo normalmente no histórico do publicador e na escala.

## 8. Estados de uma Solicitação

```
PENDENTE ──(admin aprova)──► APROVADA
    │
    ├──(admin rejeita)──► REJEITADA
    │
    └──(publicador cancela)──► CANCELADA

APROVADA ──(publicador cancela)──► CANCELADA

(criada pelo Administrador entra direto como APROVADA)
```

- **Pendente**: recém-enviada por um publicador, aguardando decisão do administrador.
- **Aprovada**: confere vaga na escala mensal (respeitando o limite de 2). Toda solicitação criada manualmente pelo administrador já nasce neste estado.
- **Rejeitada**: não entra na escala (seja por excesso na trinca, seja por outro motivo do administrador).
- **Cancelada**: o próprio publicador cancelou, pela tela de histórico (estando Pendente ou Aprovada). Não entra/deixa de entrar na escala.

## 9. Modelo de Dados (entidades sugeridas)

**Publicador**
- `id`
- `nome`

**Carrinho**
- `id`
- `nome` (ex: "Carrinho 1")
- `ativo` (booleano, para poder desativar um carrinho sem apagar histórico)

**Turno**
- `id`
- `nome` (ex: "Manhã")
- `hora_inicio`, `hora_fim`

**CarrinhoTurno** (associação: quais turnos cada carrinho tem disponível)
- `carrinho_id`
- `turno_id`
- Definida pelo administrador; um carrinho pode ter qualquer subconjunto dos turnos cadastrados, diferente de outro carrinho.

**DiaSemana**
- Enum fixo: Segunda, Terça, Quarta, Quinta, Sexta, Sábado, Domingo (não precisa de tabela própria).

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
- `status` (PENDENTE | APROVADA | REJEITADA | CANCELADA)
- `origem` (PUBLICADOR | ADMINISTRADOR) — indica se veio do fluxo normal de envio ou foi criada manualmente pelo administrador
- `criado_em`
- `decidido_em`
- Restrição de unicidade: `(publicador_id, escala_id, carrinho_id, dia_semana, turno_id)`

**EscalaMensal (grade final)** (pode ser calculada sob demanda, sem precisar de tabela própria)
- Para cada `(escala_id, carrinho_id, dia_semana, turno_id)`: lista das `Solicitacao` com `status = APROVADA` (0, 1 ou 2 registros).

## 10. Roadmap Sugerido

- **Fase 1 — Solicitação do publicador**: formulário (nome, carrinho, dia da semana, turno — restrito aos turnos configurados para o carrinho escolhido) disponível apenas durante a janela automática (dia 15 ao dia 25 do mês), sempre direcionado à escala do mês seguinte, com bloqueio de solicitações duplicadas e tela de histórico próprio (sempre disponível, com opção de cancelamento), sem cadastro formal.
- **Fase 2 — Painel do administrador**: cadastro de carrinhos, turnos e a configuração de quais turnos cada carrinho tem disponível; listagem/contagem de solicitações por escala, agrupamento por `(carrinho, dia, turno)` com sinalização visual de excesso (mais de 2, sem bloqueio automático desse limite) e contagem de apoio ao desempate por publicador; aprovação/rejeição livre (critério de desempate exclusivo do administrador); e adição manual de solicitações (com criação de publicador por nome livre) a qualquer escala.
- **Fase 3 — Escala mensal**: geração e visualização da grade final (Carrinho × Dia da semana × Turno) a partir das solicitações aprovadas.
- **Fase 4 — Melhorias futuras (opcionais)**: exportação da escala (PDF/Excel/impressão) e relatórios/histórico consolidado de escalas passadas.
