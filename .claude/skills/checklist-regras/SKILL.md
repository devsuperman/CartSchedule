---
name: checklist-regras
description: Checklist das regras de negócio do CartSchedule (Escala TPL) para revisar um diff — dias Seg–Sex, 6 turnos fixos, vaga cheia só bloqueia o publicador, sem status de aprovação, janela de envio, duplicidade/horário ocupado, data especial, testes obrigatórios. Use ao revisar ou antes de abrir um PR que mexe em regra, endpoint ou tela.
---

# Checklist de regras de negócio

Fonte da verdade: `PLANNING.md` (seção 7) e o resumo em `.claude/CLAUDE.md`.
Em caso de dúvida, **leia o trecho do PLANNING.md** em vez de confiar neste resumo.

Para cada item: só marque como problema se o **diff** viola ou ameaça a regra.
"Como checar" diz onde olhar.

## A. Regras fixas (o instinto de "boa prática" costuma quebrar)

| # | Regra | Como checar |
|---|---|---|
| A1 | Só **Segunda a Sexta**. Nada de Sábado/Domingo em enum, validação, UI, seed ou rota. | `Domain/Enums/DiaSemana.cs`, `frontend/src/constants/diasSemana.ts`. Validators aceitam só 1–5. (O hook `guarda-edicao` já bloqueia as palavras; procure também números 0/6/7 aceitos.) |
| A2 | Escolha de dia é **recorrente** (todas as segundas do mês), não data — exceto carrinho de **data especial**. | Nenhuma `DateOnly` nova em `Solicitacao`. Data só em `Carrinho.DataEspecial`. |
| A3 | **6 turnos fixos** (06–08, 08–10, 10–12, 14–16, 16–18, 18–20), seed; nunca CRUD de `Turno`. | Sem slice `Features/*/…Turno…` que crie/edite/apague turno. `constants/turnos.ts` espelha o backend. Admin só escolhe `CarrinhoTurno (carrinho, dia, turno)`. |
| A4 | **Sem status/aprovação**: toda `Solicitacao` já conta; tirar = **excluir** o registro. | Nenhum campo `Status`, `Aprovada`, `Pendente`, "soft delete" (`Excluida`, `DeletedAt`). |
| A5 | **Sem notificações** (e-mail/push). | Nenhum pacote/serviço de e-mail, push, SMS. |
| A6 | **Um único admin**, login por variáveis de ambiente, JWT curto, sem papéis. | Sem tabela de usuários/roles. |
| A7 | Publicador **sem cadastro/login**: token GUID no `localStorage`, header `X-Publicador-Token`. Nome livre, repetido é permitido. | Sem senha/e-mail para publicador; sem índice único em `Nome`. |

## B. Bloqueios — são só três (e só o 1º vale para o admin)

| # | Regra | Como checar |
|---|---|---|
| B1 | **Duplicidade**: mesmo publicador não repete `(escala, carrinho, dia, turno)` — vale para envio, adição manual e mover do admin (409). | Índice único + tratamento em `CriarSolicitacao`, adição manual e `PATCH` de mover. |
| B2 | **Horário ocupado**: só no envio do **publicador** (409 `HORARIO_OCUPADO`), qualquer carrinho; normais e cada data especial são grupos separados (`Shared/HorarioOcupado.cs`). Admin só é **avisado**. | Sem índice no banco para isso. Admin nunca recebe 409 por horário. |
| B3 | **Vaga cheia**: 2 pessoas (ou 3 com criança/idoso) bloqueia **só o publicador** (409 `VAGA_CHEIA`), contagem + insert na mesma transação com lock (`Shared/LotacaoDaVaga.cs`). | Contagem calculada no request (nada de coluna "ocupacao" persistida). Quem já estava mantém o pedido. |
| B4 | **Admin nunca é bloqueado por lotação**: na tela da Escala só **cor, sem texto** (`estadoVaga` em `frontend/src/routes/admin/components/gradeEscala.ts`): vazia sem cor, 1 pessoa/excesso vermelho, completa verde. | Procure qualquer `disabled`/409/erro por lotação em fluxo de admin. |
| B5 | Qualquer outra coisa é **sinalização**, não bloqueio. | Novo 4xx em regra que não seja B1–B3 nem janela (C1) = problema. |

## C. Janela de envio e exclusão

| # | Regra | Como checar |
|---|---|---|
| C1 | Janela **abre sozinha no dia 15**, só o admin fecha (`Escala.EnvioFechado`), calculada a cada request em `Shared/JanelaDeEnvio.cs`; **nunca** job/cron nem fechamento automático por data. | Sem `BackgroundService`/Hangfire/cron. Dia ≥ 15 → mês seguinte; 1–14 → mês corrente. |
| C2 | Regra de negócio usa `TimeProvider` (testes usam `Fixture.Relogio.Agora`), **nunca** `DateTime.Now/UtcNow`. | `grep -n "DateTime\.\(Utc\)\?Now" backend/src`. |
| C3 | Recusa por janela fechada vem com `codigo: "JANELA_FECHADA"`; o frontend decide **pelo código**, nunca por "qualquer 400". | No frontend, `ApiError` checado por `codigo`. |
| C4 | Histórico do publicador **sempre acessível**, mesmo com a janela fechada. | `ListarHistorico` não consulta a janela. |
| C5 | Publicador só exclui o **próprio** pedido, com janela aberta e da escala-alvo (validado no backend). Admin exclui qualquer um, sempre, com modal de confirmação. | Checagem de dono via token; nada de "cancelar". |
| C6 | Admin **não é limitado pela janela** em nenhuma escala (passada, atual, futura). | Endpoints `/api/admin/*` não consultam `JanelaDeEnvio` para bloquear. |

## D. Admin e carrinhos

| # | Regra | Como checar |
|---|---|---|
| D1 | **Mover** (`PATCH /api/admin/solicitacoes/{id}`) muda a vaga na **mesma escala**, mantém o registro; destino precisa estar configurado; excesso/origem com 1/horário ocupado só **avisam**; duplicidade → 409. | |
| D2 | **Adição manual**: nome igual (exato) reusa o publicador; senão cria. Grafia diferente gerar registro novo é **aceito**, não bug. | Não "corrigir" com fuzzy match. |
| D3 | Remover turno de carrinho / desativar carrinho **nunca** altera `Solicitacao` existentes. | Sem cascade delete/update de solicitações. |
| D4 | Contagem de apoio (quantas solicitações a pessoa tem na escala) é **só informação**: o sistema nunca sugere quem mover/excluir. | Sem ordenação/"sugestão" automática. |
| D5 | Carrinho de **data especial**: turnos só no dia da semana da data, aparece só na escala do mês dela, "Somente em dd/mm" na UI. | `Shared/DataEspecial.cs`. |
| D6 | Gestão toda na tela da Escala (`/admin/escalas/:mes`), feita para **toque em celular/tablet**. | Alvos de toque grandes; nada que dependa de hover. |

## E. Arquitetura e testes

| # | Regra | Como checar |
|---|---|---|
| E1 | **Vertical slices**: `Features/<Área>/<Slice>/` com `Endpoint/Request/Response/Validator`; sem Controllers/Services/Repositories genéricos nem MediatR. | |
| E2 | `Program.cs` / `App.tsx`: só a linha da própria tarefa. | Diff nesses arquivos deve ser mínimo. |
| E3 | Contrato JSON em **camelCase**; erros como ProblemDetails com `codigo`. | |
| E4 | **Toda mudança de regra ou tela tem teste automatizado**: backend herda `ApiTestBase` (xUnit, Testcontainers); frontend `*.test.tsx` ao lado da tela, mockando só `apiFetch` e usando `getByRole`/`userEvent`. | Para cada critério de aceite, aponte o teste que o cobre — ou diga que falta. |
| E5 | Segredos só via `.env` (nunca commitado). | Sem senha/chave em código ou `docker-compose.yml`. |
