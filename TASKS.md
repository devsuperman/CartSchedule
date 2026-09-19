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

## Backlog (Fase 5 — opcional, fora do escopo inicial)

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
