# CartSchedule — Plano de Tarefas de Implementação

Este documento quebra a implementação descrita em [`PLANNING.md`](./PLANNING.md)
e [`TECHNICAL_SPEC.md`](./TECHNICAL_SPEC.md) em tarefas concretas, pensadas
para serem executadas **em paralelo por vários agentes**. Cada tarefa lista
suas dependências, os arquivos que toca e critérios de pronto, para que
agentes diferentes possam trabalhar em pastas/arquivos distintos sem pisar
uns nos outros.

Convenção de ID: `F<fase>-<área>-<número>` (ex: `F1-BE-02`). `BE` = backend,
`FE` = frontend, `INFRA` = docker/repo.

## Como paralelizar

- **Uma tarefa = um agente = um conjunto de arquivos próprio.** Sempre que
  possível, cada slice de backend (`Features/.../NomeDoSlice/`) e cada tela
  de frontend (`routes/.../Nome.tsx`) é uma pasta/arquivo isolado — dois
  agentes trabalhando em slices diferentes não geram conflito de merge.
- **Pontos de fusão (cuidado):** `Program.cs` (registro de cada grupo de
  rotas) e `App.tsx` (registro de cada rota React) são tocados por várias
  tarefas. Cada agente deve adicionar **apenas a própria linha** nesses
  arquivos e commitar isso separadamente do resto do slice, para reduzir
  conflito; se possível, prefira que um agente "integrador" absorva essas
  linhas no fim de cada fase.
- **Fase 0 é bloqueante.** Nenhuma tarefa de Fase 1 em diante pode começar
  antes de Fase 0 estar mergeada (todo o resto depende do Domain e do
  `AppDbContext`).
- Dentro de uma mesma fase, **backend e frontend podem rodar em paralelo**
  entre si (o frontend pode ser construído contra os contratos descritos no
  `TECHNICAL_SPEC.md` mesmo antes do backend estar pronto; ajustar depois
  contra a API real).
- Tarefas dentro da mesma fase e mesma área (ex: todos os slices de
  Publicador) **podem rodar totalmente em paralelo** entre si — não têm
  dependência umas nas outras, só da Fase 0.

---

## Fase 0 — Fundação (sequencial / bloqueante)

Idealmente executada por **um único agente** (ou 2, em sequência), pois os
arquivos são compartilhados por tudo que vem depois.

### F0-INFRA-01 — Scaffolding do repositório
- **Entrega**: estrutura de pastas `backend/` e `frontend/` vazias mas
  funcionais: `backend/CartSchedule.Api.sln`, projeto
  `backend/src/CartSchedule.Api/CartSchedule.Api.csproj` (net10.0, Minimal
  API), `frontend/package.json` + `vite.config.ts` (React + TS), `.env.example`
  na raiz com as variáveis citadas em `TECHNICAL_SPEC.md` §5.4.
- **Depende de**: nada.
- **Arquivos**: `backend/**` (scaffold), `frontend/**` (scaffold), `.env.example`.

### F0-BE-01 — Domain: entidades e enums
- **Entrega**: `Domain/Publicador.cs`, `Carrinho.cs`, `Turno.cs`,
  `CarrinhoTurno.cs`, `Escala.cs`, `Solicitacao.cs`,
  `Domain/Enums/DiaSemana.cs` (5 valores, sem Sábado/Domingo),
  `StatusSolicitacao.cs` (Pendente/Aprovada/Rejeitada/Cancelada),
  `OrigemSolicitacao.cs` (Publicador/Administrador).
- **Depende de**: F0-INFRA-01.
- **Arquivos**: `backend/src/CartSchedule.Api/Domain/**`.

### F0-BE-02 — AppDbContext, migration inicial e seed dos turnos
- **Entrega**: `Infrastructure/AppDbContext.cs` (Npgsql), configuração de
  unique constraints (`(publicador_id, escala_id, carrinho_id, dia_semana,
  turno_id)` em `solicitacoes`; `(carrinho_id, turno_id)` em
  `carrinho_turnos`), migration inicial + migration/seed com os 6 turnos
  fixos (`06:00–08:00` … `18:00–20:00`).
- **Depende de**: F0-BE-01.
- **Arquivos**: `backend/src/CartSchedule.Api/Infrastructure/**`.

### F0-BE-03 — Shared: janela de envio e helpers de escala
- **Entrega**: `Shared/JanelaDeEnvio.cs` (aberta se dia do mês entre 15 e
  25; calcula a escala-alvo = mês seguinte) e `Shared/EscalaHelpers.cs`
  (resolve/cria `Escala` sob demanda para um mês de referência).
- **Depende de**: F0-BE-01.
- **Arquivos**: `backend/src/CartSchedule.Api/Shared/**`.

### F0-BE-04 — Program.cs base
- **Entrega**: composição inicial da app: DI do `AppDbContext`, CORS
  liberando a origem do frontend e os headers `X-Publicador-Token` /
  `Authorization`, aplicação automática de migrations no startup,
  `ProblemDetails` para erros de validação, endpoint de health check.
  **Não** registra ainda nenhum slice de feature (isso é tarefa de cada
  slice, fase 1+).
- **Depende de**: F0-BE-02.
- **Arquivos**: `backend/src/CartSchedule.Api/Program.cs`,
  `appsettings.json`.

### F0-FE-01 — Scaffold do frontend
- **Entrega**: `main.tsx`, `App.tsx` com `React Router` já configurado (só
  com uma rota placeholder por área — `/` e `/admin`), `api/client.ts`
  (wrapper `fetch`, injeta `X-Publicador-Token` quando existir no
  `localStorage` e `Authorization` quando existir token admin em memória),
  layout base/estilos globais.
- **Depende de**: F0-INFRA-01.
- **Arquivos**: `frontend/src/main.tsx`, `App.tsx`, `api/client.ts`,
  `components/**` (layout base).

### F0-INFRA-02 — Constantes compartilhadas de domínio no frontend
- **Entrega**: `frontend/src/constants/turnos.ts` (os 6 turnos fixos) e
  `constants/diasSemana.ts` (Segunda–Sexta), espelhando os enums do
  backend — usados por todas as telas de Fase 1/2 sem chamada extra à API.
- **Depende de**: F0-FE-01.
- **Arquivos**: `frontend/src/constants/**`.

**Saída da Fase 0**: build do backend compila, `docker-compose up db api`
sobe com migrations aplicadas e seed de turnos; frontend compila e serve
uma casca navegável entre `/` e `/admin`.

---

## Fase 1 — Fluxo do Publicador (paralelizável)

Todas as tarefas abaixo dependem **apenas** da Fase 0 e podem ser feitas
por agentes diferentes, simultaneamente.

### Backend

| ID | Slice | Rota | Regras principais |
|---|---|---|---|
| F1-BE-01 | `Features/Publicadores/ConsultarJanela` | `GET /api/janela` | Usa `JanelaDeEnvio`; retorna aberta/fechada + mês-alvo. |
| F1-BE-02 | `Features/Publicadores/ListarCarrinhosDisponiveis` | `GET /api/carrinhos` | Só carrinhos `ativo=true`, com os turnos habilitados de cada um. |
| F1-BE-03 | `Features/Publicadores/CriarSolicitacao` | `POST /api/solicitacoes` | Cria/recupera `Publicador` pelo `X-Publicador-Token`; valida turno pertence ao carrinho; bloqueia duplicidade (regra 10, único bloqueio automático do sistema); nasce `PENDENTE`, `origem=PUBLICADOR`; **só aceita fora da checagem de janela para o mês corretamente calculado** (rejeita se a janela estiver fechada). |
| F1-BE-04 | `Features/Publicadores/ListarHistorico` | `GET /api/solicitacoes?publicadorId=` | Sempre disponível (mesmo com janela fechada); filtra pelo token do publicador. |
| F1-BE-05 | `Features/Publicadores/CancelarSolicitacao` | `POST /api/solicitacoes/{id}/cancelar` | Permite cancelar Pendente ou Aprovada, sem restrição de prazo; só o próprio publicador (valida token). |

Cada uma dessas é uma pasta isolada em `Features/Publicadores/<Slice>/`
com `Endpoint.cs`, `Request.cs`, `Response.cs`, `Validator.cs`. O único
ponto compartilhado é a linha de registro em `Program.cs`
(`app.MapGrupoPublicadores()` ou uma linha por slice) — manter esse diff
mínimo.

### Frontend

| ID | Tela | Depende de (contrato) |
|---|---|---|
| F1-FE-01 | `hooks/usePublicadorToken.ts` (gera/lê GUID + nome no `localStorage`) | F0-FE-01 |
| F1-FE-02 | `hooks/useJanela.ts` (consome `GET /api/janela`) | F1-BE-01 (ou mock do contrato) |
| F1-FE-03 | `routes/publicador/NovaSolicitacao.tsx` (form: nome, carrinho, dia da semana, turno — turnos restritos aos do carrinho escolhido; permite repetir para múltiplas solicitações antes de enviar) | F1-BE-02, F1-BE-03 |
| F1-FE-04 | `routes/publicador/Historico.tsx` (lista solicitações + status + botão cancelar) | F1-BE-04, F1-BE-05 |
| F1-FE-05 | `routes/publicador/JanelaFechada.tsx` (mensagem "Envio fechado. Abre novamente no dia 15.") + roteamento condicional que a mostra quando `useJanela` indica fechada | F1-FE-02 |

`F1-FE-01` e `F1-FE-02` são pré-requisitos leves para `F1-FE-03/04/05`, mas
como são hooks pequenos e isolados, podem ser feitos pelo mesmo agente que
pega a primeira tela, ou por um agente dedicado a hooks liberado primeiro
para não bloquear os demais.

---

## Fase 2 — Painel do Administrador (paralelizável)

Depende da Fase 0. Pode rodar **em paralelo com a Fase 1** (áreas de
código completamente distintas: `Features/Administradores/*` no backend,
`routes/admin/*` no frontend) — só recomenda-se, por prudência, terminar
`F0-BE-04`/`F0-FE-01` antes de iniciar, o que já é pré-requisito de toda a
Fase 1 também.

### Backend

| ID | Slice | Rota | Regras principais |
|---|---|---|---|
| F2-BE-01 | `Infrastructure/Auth` + `Features/Administradores/Login` | `POST /api/admin/login` | Usuário/senha via env vars (`Admin__Usuario`, `Admin__SenhaHash`), hash de senha, emite JWT curto. Base para `RequireAuthorization()` das demais rotas admin. **Prioridade alta** — as demais tarefas de backend admin dependem do middleware de auth que esta tarefa configura em `Program.cs`. |
| F2-BE-02 | `Features/Administradores/GerenciarCarrinhos` | `GET/POST/PUT /api/admin/carrinhos` | CRUD de carrinhos, incluindo `ativo`. |
| F2-BE-03 | `Features/Administradores/GerenciarTurnosDoCarrinho` | `GET/PUT /api/admin/carrinhos/{id}/turnos` | Só associa/desassocia dentre os 6 turnos fixos (nunca cria `Turno`); remover turno não afeta solicitações já existentes (regra 18). |
| F2-BE-04 | `Features/Administradores/RevisarEscala/ListarSolicitacoesAgrupadas` | `GET /api/admin/escalas/{mes}/solicitacoes` | Agrupa por `(carrinho, dia_semana, turno)`; ignora grupos vazios; sinaliza grupos com >2 como excedente; para cada publicador em grupo excedente, retorna contagem de solicitações (pendentes+aprovadas) dele na mesma escala (regra 16, apoio ao desempate — nunca um critério imposto). |
| F2-BE-05 | `Features/Administradores/RevisarEscala/AprovarSolicitacao` + `RejeitarSolicitacao` | `POST /api/admin/solicitacoes/{id}/aprovar` \| `/rejeitar` | Não bloqueia aprovar acima de 2 (regra 1/3 — só sinalização, sem bloqueio automático). |
| F2-BE-06 | `Features/Administradores/RevisarEscala/AdicionarSolicitacaoManual` | `POST /api/admin/escalas/{mes}/solicitacoes` | Publicador por nome livre (reusa se nome bate exatamente, senão cria novo — regra 9/consequência aceita); mesma restrição de turno-pertence-ao-carrinho; mesma regra de duplicidade (regra 10); nasce direto `APROVADA`, `origem=ADMINISTRADOR`. |
| F2-BE-07 | `Features/Administradores/ObterEscalaFinal` | `GET /api/admin/escalas/{mes}/grade` | Grade `Carrinho × Dia × Turno` calculada sob demanda a partir das `Solicitacao` com `status=APROVADA` (sem tabela própria). |

`F2-BE-01` deve ser priorizada/feita primeiro dentro da Fase 2 (ou por um
agente que a entrega rápido), pois `F2-BE-02..07` presumem
`RequireAuthorization()` já disponível — mas como o Minimal API permite
adicionar `.RequireAuthorization()` por grupo de rota de forma
independente, os demais agentes podem desenvolver a lógica do próprio
slice em paralelo e só integrar a exigência de auth ao final, sem ficar
bloqueados esperando.

### Frontend

| ID | Tela | Depende de (contrato) |
|---|---|---|
| F2-FE-01 | `hooks/useAdminAuth.ts` + `routes/admin/Login.tsx` + guarda de rota `/admin/*` | F2-BE-01 |
| F2-FE-02 | `routes/admin/GestaoCarrinhos.tsx` (CRUD carrinhos + associação com os 6 turnos fixos) | F2-BE-02, F2-BE-03 |
| F2-FE-03 | `routes/admin/RevisaoEscala.tsx` (grupos por carrinho/dia/turno, sinalização de excesso, contagem de apoio ao desempate, aprovar/rejeitar) | F2-BE-04, F2-BE-05 |
| F2-FE-04 | `routes/admin/AdicionarSolicitacao.tsx` (adição manual, autocomplete de publicadores existentes + nome livre) | F2-BE-06 |
| F2-FE-05 | `routes/admin/EscalaFinal.tsx` (grade final) | F2-BE-07 |

Assim como no backend, `F2-FE-01` é pré-requisito leve das demais (rotas
protegidas), mas pode ser feita rapidamente por um agente dedicado sem
bloquear os outros, que podem construir a UI contra o contrato e plugar a
guarda de rota depois.

---

## Fase 3 — Escala Mensal (grade final)

Coberta pelas tarefas `F2-BE-07` e `F2-FE-05` acima — não há tarefas
adicionais além de garantir que a grade é acessível também fora do fluxo
de revisão (ex: link direto `/admin/escalas/:mes`).

---

## Fase 4 — Integração final e Docker (após Fases 1 e 2 mergeadas)

### F4-INFRA-01 — Dockerfile do backend (multi-stage)
- **Entrega**: `backend/Dockerfile` — estágio SDK (`dotnet publish`) +
  estágio runtime ASP.NET; aplica migrations automaticamente no startup
  (`context.Database.Migrate()`, já configurado em F0-BE-04).
- **Depende de**: F0-BE-04.
- **Arquivos**: `backend/Dockerfile`.

### F4-INFRA-02 — Dockerfile do frontend (multi-stage)
- **Entrega**: `frontend/Dockerfile` — estágio Node (`npm install && npm
  run build`) + estágio `nginx` servindo o build estático.
- **Depende de**: F0-FE-01.
- **Arquivos**: `frontend/Dockerfile`.

### F4-INFRA-03 — `docker-compose.yml` final
- **Entrega**: `docker-compose.yml` na raiz com os 3 serviços (`db`, `api`,
  `web`) conforme `TECHNICAL_SPEC.md` §5.1, variáveis via `.env`; healthcheck
  do Postgres; `depends_on: condition: service_healthy`.
- **Depende de**: F4-INFRA-01, F4-INFRA-02.
- **Arquivos**: `docker-compose.yml`, `.env.example` (revisão final).

### F4-QA-01 — Smoke test end-to-end
- **Entrega**: roteiro (manual ou script) validando: publicador cria
  solicitação dentro da janela → aparece pendente no admin → admin aprova
  → aparece na grade final → publicador cancela → some da grade;
  publicador tenta duplicar → é bloqueado; fora da janela → tela de
  bloqueio aparece mas histórico continua acessível.
- **Depende de**: todas as tarefas de Fase 1, 2 e Fase 4 de docker.
- **Arquivos**: nenhum arquivo de produto — só validação (pode gerar um
  `docs/smoke-test.md` opcional com o roteiro e resultado).

### F4-DOC-01 — README final
- **Entrega**: `README.md` com instruções de setup (`.env`, `docker-compose
  up`), URLs padrão dos 3 serviços, e link para `PLANNING.md` /
  `TECHNICAL_SPEC.md`.
- **Depende de**: F4-INFRA-03.
- **Arquivos**: `README.md`.

---

## Fase 5 — Ajustes pós-uso (paralelizável)

Depende das Fases 0–4 já mergeadas. Ajustes pedidos depois do primeiro uso
real. As regras correspondentes já estão em `PLANNING.md` (regras 9, 11,
12, 12a, 18, seção 8 e modelo de dados) e em `TECHNICAL_SPEC.md`.

São **3 trilhas sem arquivos em comum** — podem rodar em agentes
simultâneos:

| Trilha | Tarefas | Arquivos que toca |
|---|---|---|
| A — Nome do sistema | F5-FE-01 | `components/Layout.tsx`, `index.html` |
| B — Carrinho: descrição + edição | F5-BE-01, F5-FE-02, F5-FE-03 | `Domain/Carrinho.cs`, `AppDbContext`, migration, `GerenciarCarrinhos/`, `ListarCarrinhosDisponiveis/`, `GestaoCarrinhos.tsx`, `wizard/SolicitacaoWizard.tsx`, `wizard/EtapaCarrinho.tsx` |
| C — Excluir em vez de cancelar + histórico sem data | F5-BE-02, F5-FE-04 | `CancelarSolicitacao/` → `ExcluirSolicitacao/`, `StatusSolicitacao.cs`, `ListarHistorico/`, `Program.cs` (1 linha), migration só-SQL, `InicioPublicador.tsx`, `SolicitacaoCard.tsx`, `utils/formatacao.ts`, `RevisaoEscala.tsx` (comentário) |

Único ponto de atenção entre trilhas: **migrations**. `F5-BE-01` é a dona
da migration de schema da fase. A migration de `F5-BE-02` só deve ser
gerada depois de `F5-BE-01` estar mergeada (o `AppDbContextModelSnapshot.cs`
é regenerado a cada `dotnet ef migrations add` e daria conflito). O resto
de `F5-BE-02` pode ser feito antes, em paralelo.

### Trilha A — Nome do sistema

#### F5-FE-01 — Exibir "Escala TPL" em vez de "CartSchedule"
- **Por quê:** os usuários não sabem o que é "CartSchedule".
- **Arquivos:** `frontend/src/components/Layout.tsx` (nome no header),
  `frontend/index.html` (`<title>`).
- **Não fazer:** renomear repo, pastas, namespaces, projeto .NET,
  containers ou `package.json` — "CartSchedule" continua sendo o nome
  interno.
- **Pronto quando:** o header e a aba do navegador mostram "Escala TPL";
  `grep -rn CartSchedule frontend/src frontend/index.html` não retorna nada
  visível ao usuário; `npm run build` e `npm run lint` passam.

### Trilha B — Carrinho: descrição + edição pelo admin

#### F5-BE-01 — Campo `Descricao` no carrinho (backend)
- **Domain:** `Descricao` (`string?`) em `Domain/Carrinho.cs`.
- **AppDbContext:** `HasMaxLength(500)`, não obrigatório.
- **Migration:** `dotnet ef migrations add AdicionaDescricaoCarrinho -o Infrastructure/Migrations`.
  Carrinhos existentes ficam com `NULL`.
- **`Features/Administradores/GerenciarCarrinhos`:** `Descricao` em
  `CriarCarrinhoRequest`, `AtualizarCarrinhoRequest` e `CarrinhoResponse`;
  validator com `MaximumLength(500)` (opcional). Normalizar texto em
  branco para `null`. O `PUT /api/admin/carrinhos/{id}` já existente passa
  a ser o endpoint de edição (nome, descrição, ativo) — não criar outro.
- **`Features/Publicadores/ListarCarrinhosDisponiveis`:** `Descricao` em
  `CarrinhoDisponivelResponse`.
- **Contrato:** `descricao: string | null` em `GET /api/carrinhos`,
  `GET/POST/PUT /api/admin/carrinhos`.
- **Pronto quando:** `dotnet build` passa; a API sobe aplicando a
  migration; criar/editar carrinho com e sem descrição funciona.

#### F5-FE-02 — Admin edita o cadastro do carrinho
- **Arquivo:** `frontend/src/routes/admin/GestaoCarrinhos.tsx`.
- **O que muda:**
  - Tipo `Carrinho` ganha `descricao: string | null`.
  - Formulário de criação ganha campo **Descrição** (opcional).
  - Cada card de carrinho ganha ação **Editar** que troca o título por
    campos de nome e descrição, com **Salvar** / **Cancelar edição**.
    Salvar chama `PUT /api/admin/carrinhos/{id}` com `{ nome, descricao, ativo }`
    (preservando o `ativo` atual). Erro aparece no card, como os demais.
  - O toggle de ativo (`handleAlternarAtivo`) passa a mandar também a
    `descricao` atual, para não apagá-la.
  - Descrição (quando houver) aparece abaixo do nome no card, fora do modo
    edição.
- **Depende de:** contrato de F5-BE-01 (pode começar em paralelo).
- **Pronto quando:** dá para criar carrinho com descrição, editar nome e
  descrição, e ativar/desativar sem perder a descrição; `npm run build` e
  `npm run lint` passam.

#### F5-FE-03 — Publicador vê a descrição ao escolher o carrinho
- **Arquivos:** `frontend/src/routes/publicador/wizard/SolicitacaoWizard.tsx`
  (tipo `Carrinho` ganha `descricao: string | null`),
  `frontend/src/routes/publicador/wizard/EtapaCarrinho.tsx`.
- **O que muda:** cada opção mostra o nome e, **abaixo dele**, a descrição
  em texto menor (só se não vazia). O texto precisa continuar legível no
  estado selecionado (fundo `primary`) e quebrar linha em telas estreitas
  (hoje o botão é de uma linha só: ajustar altura/`whitespace-normal`).
- **Depende de:** contrato de F5-BE-01 (pode começar em paralelo).
- **Pronto quando:** carrinho com descrição mostra as duas linhas; sem
  descrição, só o nome; layout ok em 360px; `npm run build`/`lint` passam.

### Trilha C — Excluir em vez de cancelar + histórico sem data

#### F5-BE-02 — `ExcluirSolicitacao` substitui `CancelarSolicitacao`
- **Slice:** apagar `Features/Publicadores/CancelarSolicitacao/` e criar
  `Features/Publicadores/ExcluirSolicitacao/Endpoint.cs` com
  `DELETE /api/solicitacoes/{id}`. Mesmas validações de hoje: header
  `X-Publicador-Token`, 404, 403 se não for do publicador, só
  Pendente/Aprovada, janela aberta (400 com `codigo: "JANELA_FECHADA"`) e
  escala do mês-alvo. Em vez de mudar status: `db.Solicitacoes.Remove(...)`.
  Responde 204.
- **`Program.cs`:** trocar só a linha `app.MapCancelarSolicitacao();` por
  `app.MapExcluirSolicitacao();` (e o `using`).
- **Enum:** remover `Cancelada = 4` de `Domain/Enums/StatusSolicitacao.cs`;
  ajustar os comentários que citam Cancelada em `AprovarSolicitacao`,
  `RejeitarSolicitacao` e `ListarSolicitacoesAgrupadas`.
- **`ListarHistorico`:** remover `CriadoEm` do `ListarHistoricoResponse`
  (a ordenação no servidor continua por `CriadoEm` desc).
- **Migration só-SQL** `RemoveSolicitacoesCanceladas`, com
  `migrationBuilder.Sql("DELETE FROM solicitacoes WHERE \"Status\" = 4;")`
  no `Up` (sem `Down` de dados). **Gerar só depois de F5-BE-01 mergeada.**
  Isso também libera quem tinha cancelado a re-solicitar a mesma trinca
  (o índice único de duplicidade contava as canceladas).
- **Pronto quando:** `dotnet build` passa; excluir com janela aberta
  retorna 204 e a linha some; re-enviar a mesma trinca depois funciona;
  com janela fechada retorna 400 `JANELA_FECHADA`.

#### F5-FE-04 — Publicador exclui pedido; histórico sem data/hora
- **Arquivos:** `frontend/src/routes/publicador/InicioPublicador.tsx`,
  `frontend/src/routes/publicador/components/SolicitacaoCard.tsx`,
  `frontend/src/utils/formatacao.ts`, `frontend/src/routes/admin/RevisaoEscala.tsx`
  (só o comentário de status).
- **O que muda:**
  - `InicioPublicador`: `cancelarSolicitacao` → `excluirSolicitacao`,
    chama `DELETE /api/solicitacoes/{id}` e **remove o item da lista** (em
    vez de marcar status). Aviso de janela fechada: "para excluir um
    pedido, fale com o administrador".
  - `SolicitacaoCard`: botão **"Excluir pedido"** com confirmação inline
    (ex.: "Excluir este pedido?" + Confirmar/Voltar — nunca
    `window.confirm`); props renomeadas (`exclusaoPermitida`,
    `excluindo`, `onExcluir`). Remover o trecho "Enviado em …", o campo
    `criadoEm` do tipo e a função `formatarDataHora`.
  - `formatacao.ts`: remover `Cancelada` de `STATUS`, labels e variantes.
- **Depende de:** contrato de F5-BE-02 (pode começar em paralelo).
- **Pronto quando:** o card mostra carrinho, dia e turno sem data/hora;
  excluir com confirmação some da lista; fora da janela não há botão;
  `grep -rni cancelad frontend/src` não encontra nada;
  `npm run build`/`lint` passam.

### Verificação da Fase 5 (após as 3 trilhas mergeadas)

`dotnet build backend/CartSchedule.Api.slnx`, `npm run build`,
`npm run lint`, e `docker compose up --build` (com data do servidor dentro
da janela, dias 15–25):
1. Header "Escala TPL".
2. Admin cria um carrinho com descrição, edita nome/descrição,
   desativa/ativa sem perder a descrição.
3. No wizard, o carrinho mostra a descrição abaixo do nome.
4. Publicador envia um pedido, exclui, e envia a mesma trinca de novo sem
   erro de duplicidade.
5. Histórico sem data/hora do envio.

---

## Fase 6 — Turnos por dia da semana

Depende da Fase 5 mergeada. Nova regra (`PLANNING.md` regras 17, 18 e 20,
modelo de dados; `TECHNICAL_SPEC.md` §2.4/§2.7/§2.8): os turnos
disponíveis de cada carrinho passam a ser definidos **por dia da semana**
(ex: Carrinho 01 com 08:00–10:00 na Segunda e só 10:00–12:00 na Terça).
`CarrinhoTurno` ganha `DiaSemana` e a PK vira
`(carrinho_id, dia_semana, turno_id)`. A configuração antiga é **zerada**
na migration (o admin reconfigura) — nenhuma `Solicitacao` é tocada.

Contrato (fixado aqui, permite FE e BE em paralelo) — `turnoIds` some em
todos os lugares e vira:

```jsonc
"disponibilidades": [{ "diaSemana": 1, "turnoId": 2 }]  // diaSemana 1–5, turnoId 1–6
```

- `GET /api/carrinhos` → `{ id, nome, descricao, disponibilidades }`
- `GET/POST/PUT /api/admin/carrinhos` → `{ id, nome, descricao, ativo, disponibilidades }`
- `GET/PUT /api/admin/carrinhos/{id}/turnos` → corpo `{ disponibilidades }`,
  resposta `{ carrinhoId, disponibilidades }` (PUT = substituição completa).

| ID | Entrega | Critério de aceite |
|---|---|---|
| F6-BE-01 | `Domain/CarrinhoTurno.cs` (+`DiaSemana`), `AppDbContext` (PK composta nova), migration `CarrinhoTurnoPorDiaSemana` | Migration apaga `carrinho_turnos` antes de trocar a PK (Up e Down); `solicitacoes` intacta. Única dona da migration da fase. |
| F6-BE-02 | `GerenciarTurnosDoCarrinho/`, `GerenciarCarrinhos/` | Contrato admin com `disponibilidades`; valida dia 1–5 e turno 1–6; diff por `(dia, turno)`. |
| F6-BE-03 | `ListarCarrinhosDisponiveis/`, `CriarSolicitacao/`, `AdicionarSolicitacaoManual/` | Resposta pública com `disponibilidades`; envio e adição manual recusam (400) turno não habilitado para o carrinho **naquele dia**. Limite de 2 continua sem bloqueio. |
| F6-FE-01 | `routes/admin/GestaoCarrinhos.tsx` | Grade dia × turno por carrinho (cada clique salva); aviso quando carrinho ativo não tem nenhuma disponibilidade. |
| F6-FE-02 | `wizard/SolicitacaoWizard.tsx`, `EtapaDiaSemana.tsx`, `EtapaCarrinho.tsx`, `EtapaTurno.tsx` | Dia sem turno em nenhum carrinho fica desabilitado; só aparecem carrinhos com turno no dia; turnos filtrados por carrinho+dia; trocar o dia limpa carrinho/turno incompatíveis. |
| F6-FE-03 | `routes/admin/AdicionarSolicitacao.tsx` | Turnos filtrados por carrinho **e** dia; trocar o dia limpa o turno. |

Dependências: F6-BE-02/03 dependem de F6-BE-01. As tarefas FE só dependem
do contrato acima. Nenhuma tarefa compartilha arquivos (`Program.cs` e
`App.tsx` não mudam).

### Verificação da Fase 6

`dotnet build`, `npm run build`, `npm run lint`, `docker compose up --build`:
1. `carrinho_turnos` vazia após a migration; `solicitacoes` intacta.
2. Admin marca Carrinho 01 Seg 08–10 e Ter 10–12; recarrega e persiste.
3. Wizard (janela aberta): Segunda → Carrinho 01 → só 08–10; Terça → só
   10–12; dia sem nenhum turno fica desabilitado.
4. `POST /api/solicitacoes` e `POST /api/admin/escalas/{mes}/solicitacoes`
   com (Carrinho 01, Terça, 08–10) → 400; trio válido → 201; 3ª aprovação
   numa trinca continua permitida; duplicidade continua 409.

---

## Fase 7 — Ajustes de leitura do publicador

Depende da Fase 6 mergeada. Ajustes de apresentação — nenhuma regra de
negócio muda (`Program.cs` e `App.tsx` intocados). Único ajuste de contrato,
aditivo: `GET /api/solicitacoes` ganha `carrinhoDescricao: string | null`.

| ID | Entrega | Critério de aceite |
|---|---|---|
| F7-FE-01 | `wizard/SolicitacaoWizard.tsx` | Mês-alvo ("Escala de outubro de 2026") em destaque no topo de **todas** as etapas do wizard. |
| F7-FE-02 | `routes/publicador/InicioPublicador.tsx` | Dentro de cada mês, pedidos ordenados por dia da semana (Segunda → Sexta), depois turno e depois carrinho; meses do mais recente para o mais antigo. Ordenação só no frontend. |
| F7-DOC-01 | `README.md` | Declara que o projeto é AI Native e corrige trechos desatualizados (exclusão em vez de cancelamento, turnos por dia). |
| F7-FE-03 | `wizard/*` | Ordem das etapas: nome → **carrinho** → dia → turno. Só aparecem carrinhos com algum turno configurado; dias sem turno no carrinho escolhido ficam desabilitados (ocultos a partir do F7-FE-05); trocar o carrinho limpa dia/turno incompatíveis. |
| F7-BE-01 | `Features/Publicadores/ListarHistorico/` | `GET /api/solicitacoes` devolve `carrinhoDescricao` (null quando o carrinho não tem descrição). |
| F7-FE-04 | `components/SolicitacaoCard.tsx`, `InicioPublicador.tsx` | Card do histórico: dia da semana em destaque, depois turno, por último carrinho (nome + descrição). Sem título por dia na lista (o card já destaca o dia). |
| F7-FE-05 | `InicioPublicador.tsx`, `SolicitacaoCard.tsx`, `wizard/EtapaNome.tsx`, `EtapaDiaSemana.tsx`, `SolicitacaoWizard.tsx` | Menos texto nas telas do publicador: sem "Minhas escalas"/"Pedidos deste mês e do próximo"; sem status no card e sem as rejeitadas na lista; título da lista "Minhas solicitações para <mês>"; etapa do nome sem rótulo/ajuda; etapa do dia sem "Vale para todas as semanas…" e sem os dias em que o carrinho não tem turno. |
| F7-FE-06 | `components/SolicitacaoCard.tsx` | Card do histórico: turno ao lado do dia da semana, com o mesmo destaque; carrinho (nome + descrição) na linha de baixo. |
| F7-FE-07 | `wizard/SolicitacaoWizard.tsx`, `EtapaNome.tsx` | Com nome já salvo no navegador, o wizard abre direto na etapa do carrinho; o nome só é alterado tocando em "Voltar". Sem nome salvo, começa pela etapa do nome como antes. |
| F7-FE-08 | `components/SolicitacaoCard.tsx` | "Excluir pedido" vira um link pequeno e discreto (cinza, vermelho só no hover) abaixo da descrição do carrinho, sem disputar espaço com o dia e o turno; confirmação continua no próprio card. |

Nenhuma tarefa compartilha arquivos (`F7-FE-04` só depende do contrato
acima e ajusta a lista do `F7-FE-02` depois dele); podem rodar em paralelo.

### Verificação da Fase 7

`npm test`, `npm run lint`, `npm run build` e `dotnet test`.

---

## Backlog (Fase 8 — opcional, fora do escopo inicial)

Não paralelizar ainda — só entra depois que Fases 0–4 estiverem completas
e validadas:

- Exportação da escala final (PDF/Excel/impressão).
- Relatórios/histórico consolidado de escalas passadas.

---

## Resumo de paralelismo máximo

- **Fase 0**: sequencial, 1–2 agentes (bloqueante).
- **Fase 1 + Fase 2**: até **~17 agentes simultâneos** (5 slices BE + 5
  telas FE de Publicador, 7 slices BE + 5 telas FE de Administrador),
  todos partindo do mesmo ponto pós-Fase-0, cada um em arquivos próprios.
- **Fase 4**: 2–3 agentes (Dockerfiles em paralelo; compose e smoke test
  depois de tudo integrado).
- **Fase 5**: até **5 agentes simultâneos** em 3 trilhas sem arquivos em
  comum — A (`F5-FE-01`), B (`F5-BE-01`, `F5-FE-02`, `F5-FE-03`) e C
  (`F5-BE-02`, `F5-FE-04`; um agente por área). Só a migration de
  `F5-BE-02` espera `F5-BE-01` estar mergeada.
- **Fase 6**: até **5 agentes** — `F6-BE-01` primeiro (migration), depois
  `F6-BE-02`/`F6-BE-03`; as 3 tarefas FE podem rodar desde o início
  (contrato fixado no próprio TASKS.md).
- **Fase 7**: até **3 agentes** por rodada — primeiro `F7-FE-01`,
  `F7-FE-02` e `F7-DOC-01`; depois `F7-FE-03`, `F7-BE-01` e `F7-FE-04`,
  em arquivos distintos (docs atualizadas à parte).
