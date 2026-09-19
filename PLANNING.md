# CartSchedule — Planejamento do Projeto

## 1. Visão Geral

Sistema web para organizar o uso de carrinhos de trabalho ao longo do mês.
Funcionários solicitam em quais carrinhos, dias da semana e turnos desejam
trabalhar; um administrador analisa os pedidos e monta a escala mensal
final, respeitando o limite de **2 pessoas por carrinho, por dia da
semana, por turno**.

## 2. Atores

- **Funcionário**: informa seu nome, escolhe o mês, o carrinho, o(s) dia(s)
  da semana e o turno em que quer trabalhar, e envia a solicitação.
- **Administrador**: visualiza todas as solicitações recebidas no mês,
  aprova ou rejeita cada uma (respeitando o limite de 2 por combinação) e
  gera a escala mensal final.

## 3. Conceitos-chave

| Conceito | Descrição |
|---|---|
| **Mês de referência** | O mês/ano para o qual a escala está sendo montada (ex: Outubro/2026). |
| **Carrinho** | Um carrinho de trabalho disponível (ex: Carrinho 1, Carrinho 2...). |
| **Dia da semana** | Segunda a Domingo. A escolha é **recorrente**: se o funcionário escolhe "Segunda-feira", isso vale para todas as segundas-feiras daquele mês — não é uma data específica do calendário. |
| **Turno** | Faixa de horário fixa e predefinida (ex: Manhã, Tarde, Noite), cadastrada previamente pelo administrador. |
| **Solicitação** | O pedido de um funcionário para trabalhar em `(carrinho, dia da semana, turno)` dentro do mês de referência. |
| **Escala mensal** | O resultado final: para cada `(carrinho, dia da semana, turno)`, até 2 funcionários aprovados. |

## 4. Fluxo do Funcionário

1. Acessa o site.
2. Informa seu **nome** (identificação simples; ver seção 8 sobre autenticação).
3. Visualiza/seleciona o **mês** em questão.
4. Seleciona o **carrinho** que deseja usar.
5. Seleciona o **dia da semana** em que quer trabalhar.
6. Seleciona o **turno** desejado.
7. Pode repetir os passos 4–6 para pedir mais de uma combinação no mesmo mês (ex: Carrinho A / Segunda / Manhã **e** Carrinho B / Quinta / Tarde).
8. Revisa e **envia** as solicitações.
9. (Recomendado) Consegue ver depois o status de cada solicitação: *Pendente*, *Aprovada* ou *Rejeitada*.

Regra de duplicidade: o mesmo funcionário não pode enviar duas vezes a
mesma combinação `(mês, carrinho, dia da semana, turno)`.

## 5. Fluxo do Administrador

1. Acessa o painel administrativo.
2. Seleciona o mês em questão.
3. Vê um **resumo geral**: total de solicitações recebidas no mês, quantas pendentes/aprovadas/rejeitadas.
4. Vê as solicitações **agrupadas por `(carrinho, dia da semana, turno)`**, já sinalizando cada grupo conforme a regra de negócio (seção 6):
   - Grupo **vazio** (0 solicitações) → ignorado, nem aparece como pendência.
   - Grupo com **1 ou 2** solicitações → dentro do limite, pode aprovar diretamente.
   - Grupo com **mais de 2** solicitações → sinalizado como **excedente**; o administrador precisa escolher quais 2 aprova e rejeitar as demais.
5. Para cada grupo excedente, o administrador aprova exatamente 2 e rejeita o restante (critério de desempate fica a cargo do administrador — ex: ordem de chegada, mostrada na tela).
6. Ao concluir as decisões do mês, o sistema **gera automaticamente a escala mensal** a partir de todas as solicitações aprovadas.
7. O administrador visualiza a escala final (grade Carrinho × Dia da semana × Turno, com os nomes aprovados) e pode compartilhá-la/exportá-la.

## 6. Regras de Negócio

1. **Limite por combinação**: cada trinca `(carrinho, dia da semana, turno)` no mês pode ter **no máximo 2 pessoas aprovadas**.
2. **Combinação sem solicitação**: se não houver nenhuma solicitação para uma trinca, ela é **ignorada** — não entra na escala e não aparece como pendência para o administrador decidir.
3. **Combinação com excesso**: se houver mais de 2 solicitações para a mesma trinca, o administrador **precisa agir**, removendo (rejeitando) o excesso até restarem só 2 aprovadas.
4. **Combinação dentro do limite** (1 ou 2 solicitações): podem ser aprovadas diretamente, sem conflito.
5. **Escala mensal**: é composta **apenas pelas solicitações aprovadas**; toda trinca com 0 aprovados simplesmente não aparece na escala.
6. **Sem limite (por padrão) de quantas trincas um mesmo funcionário pode ter aprovadas** no mês — pode trabalhar em vários carrinhos/dias/turnos, a menos que o administrador decida limitar isso no futuro (ver seção 8).

## 7. Estados de uma Solicitação

```
PENDENTE ──► APROVADA
    │
    └──────► REJEITADA
```

- **Pendente**: recém-enviada, aguardando decisão do administrador.
- **Aprovada**: confere vaga na escala mensal (respeitando o limite de 2).
- **Rejeitada**: não entra na escala (seja por excesso na trinca, seja por outro motivo do administrador).

## 8. Modelo de Dados (entidades sugeridas)

**Funcionario**
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

**DiaSemana**
- Enum fixo: Segunda, Terça, Quarta, Quinta, Sexta, Sábado, Domingo (não precisa de tabela própria).

**Solicitacao**
- `id`
- `funcionario_id`
- `mes_referencia` (ano + mês, ex: "2026-10")
- `carrinho_id`
- `dia_semana`
- `turno_id`
- `status` (PENDENTE | APROVADA | REJEITADA)
- `criado_em`
- `decidido_em`
- Restrição de unicidade: `(funcionario_id, mes_referencia, carrinho_id, dia_semana, turno_id)`

**EscalaMensal** (pode ser calculada sob demanda, sem precisar de tabela própria)
- Para cada `(mes_referencia, carrinho_id, dia_semana, turno_id)`: lista das `Solicitacao` com `status = APROVADA` (0, 1 ou 2 registros).

## 9. Pontos em Aberto (para decidirmos antes de implementar)

- **Identificação do funcionário**: só pelo nome digitado (sem login/senha) é suficiente, ou é melhor ter cadastro/login para evitar nomes duplicados ou confusão entre duas pessoas com o mesmo nome?
- **Prazo de envio**: existe uma data limite no mês para enviar solicitações antes do administrador fechar a escala? Ou o admin decide manualmente quando "fechar" o mês?
- **Critério de desempate** quando há mais de 2 solicitações: ordem de chegada, prioridade manual do administrador, ou outro critério (ex: quem já trabalhou menos naquele mês)?
- **Cancelamento**: o funcionário pode cancelar/editar uma solicitação enquanto ela está pendente? E depois de aprovada?
- **Limite de carga por funcionário**: deve haver um número máximo de turnos/combinações que um mesmo funcionário pode ter aprovado no mês?
- **Notificação**: o funcionário precisa ser avisado (e-mail, notificação na tela) quando sua solicitação for aprovada/rejeitada?
- **Múltiplos administradores**: haverá mais de um administrador gerenciando o sistema? Precisa de controle de acesso por papel (funcionário vs. administrador)?

## 10. Roadmap Sugerido

- **Fase 1 — Solicitação do funcionário**: formulário (nome, mês, carrinho, dia da semana, turno) + listagem das próprias solicitações e status.
- **Fase 2 — Painel do administrador**: listagem/contagem de solicitações do mês, agrupamento por `(carrinho, dia, turno)`, aprovação/rejeição com aplicação automática do limite de 2.
- **Fase 3 — Escala mensal**: geração e visualização da grade final (Carrinho × Dia da semana × Turno) a partir das solicitações aprovadas.
- **Fase 4 — Melhorias**: notificações, exportação da escala (PDF/Excel/impressão), histórico de meses anteriores, autenticação/login, regras de prioridade/desempate configuráveis.
