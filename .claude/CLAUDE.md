# CartSchedule — Contexto para Agentes

Sistema web para organizar o uso de carrinhos de trabalho ao longo do mês.
Na interface o sistema se chama **"Escala TPL"** — "CartSchedule" é só o
nome interno (repo, namespaces, pastas); não renomear o código.
Publicadores solicitam `(carrinho, dia da semana, turno)` em que querem
trabalhar; todo pedido aceito já entra na escala (vaga cheia é recusada ao
publicador) e um administrador ajusta/exclui os excedentes (meta de 2
pessoas por combinação, ou 3 com uma criança/idoso).

**Leia sempre, nesta ordem, antes de implementar algo:**
1. [`PLANNING.md`](../PLANNING.md) — regras de negócio (fonte da verdade).
2. [`TECHNICAL_SPEC.md`](../TECHNICAL_SPEC.md) — arquitetura e decisões técnicas.
3. [`TASKS.md`](../TASKS.md) — quebra de tarefas para execução paralela.

Se houver qualquer conflito entre este arquivo e os três acima, os três
acima vencem — este arquivo é um resumo operacional, não a fonte da
verdade.

## Stack

- **Backend**: .NET 10, Minimal API, **Vertical Slices** (uma pasta por
  caso de uso em `Features/`, sem Controllers/Services/Repositories
  genéricos). EF Core + Npgsql. Sem MediatR — `IEndpointRouteBuilder` +
  extension methods bastam.
- **Frontend**: React + TypeScript + Vite + React Router. Sem
  Redux/gerenciador de estado pesado — `useState`/`useEffect` (+ React
  Query opcional).
- **Banco**: PostgreSQL, migrations via EF Core, aplicadas automaticamente
  na subida do container.
- **Execução**: 3 containers via `docker-compose` (`db`, `api`, `web`).

## Estrutura de pastas

```
backend/src/CartSchedule.Api/
  Domain/                 # entidades + Enums/
  Infrastructure/          # AppDbContext, Migrations, Auth
  Shared/                  # JanelaDeEnvio.cs, EscalaHelpers.cs, LotacaoDaVaga.cs, HorarioOcupado.cs
  Features/
    Publicadores/<Slice>/  # Endpoint.cs, Request.cs, Response.cs, Validator.cs
    Administradores/<Slice>/
  Program.cs

frontend/src/
  api/                     # client.ts + wrappers por área
  routes/publicador/       # NovaSolicitacao, Historico, JanelaFechada
  routes/admin/            # Login, GestaoCarrinhos, EscalaFinal (gestão da escala: mover/adicionar/excluir), EscalaCompartilhar (imagem só leitura por carrinho)
  hooks/                   # usePublicadorToken, useJanela, useAdminAuth
  constants/                # turnos.ts, diasSemana.ts (espelham enums do backend)
```

## Regras de negócio que NÃO podem ser quebradas

Estas são as decisões mais fáceis de errar por instinto de "boa prática" —
todas são intencionais, confirmadas no `PLANNING.md`:

1. **Dias fixos**: só Segunda a Sexta. Nunca adicionar Sábado/Domingo em
   enum, validação, UI ou seed. A escolha de dia é **recorrente** (vale
   para todas as ocorrências daquele dia no mês), não uma data específica —
   exceto o **carrinho de data especial** (`Carrinho.DataEspecial`, regra 4a).
2. **Turnos fixos do sistema**: sempre estes 6, nunca cadastráveis pelo
   admin: `06:00–08:00, 08:00–10:00, 10:00–12:00, 14:00–16:00, 16:00–18:00,
   18:00–20:00`. O admin só escolhe, por carrinho **e por dia da semana**,
   **quais** desses 6 ficam disponíveis (`CarrinhoTurno` com chave
   `(carrinho, dia_semana, turno)` — ex: 08–10 só na Segunda). Não criar endpoint de CRUD de `Turno`.
3. **Limite por trinca `(carrinho, dia, turno)` bloqueia só o
   PUBLICADOR**: meta de 2 pessoas, ou 3 se ao menos uma for criança/idoso
   (`Publicador.CriancaOuIdoso`, marcado só pelo admin).
   - **Publicador**: vaga com 2 pessoas = cheia (`LotacaoDaVaga`) →
     `POST /api/solicitacoes` recusa com 409 e `codigo: "VAGA_CHEIA"`
     (contagem + insert na mesma transação, com lock por escala). O
     `GET /api/carrinhos` traz `ocupacao`/`cheia` por vaga; o wizard (dia → turno →
     carrinho) mostra "1 pessoa nesta vaga" e desabilita o cheio com "Cheio" (vaga
     vazia sem texto — nada de "Vago"); dia/turno sem vaga livre ficam desabilitados; turno em que ele já tem pedido fica
     desabilitado com "Você já tem pedido neste horário" (regra 4). Contagem
     calculada a cada request: excluir/mover alguém libera a vaga. Quem já
     tinha pedido numa vaga que encheu depois mantém o pedido.
   - **Admin nunca é bloqueado por lotação** (adicionar, mover, completar o
     3º criança/idoso, exceder): na tela da Escala o sistema só **sinaliza
     pela cor, sem texto** (`estadoVaga` em `gradeEscala.ts`): vazia sem cor,
     1 pessoa (incompleta) e excesso em vermelho, completa em verde. Nunca
     estender o bloqueio de vaga cheia às ações do admin.
4. **Bloqueios automáticos são só três**: a **duplicidade** — um mesmo
   publicador não pode ter duas solicitações para a mesma
   `(escala, carrinho, dia_semana, turno)`, vale para envio normal, adição
   manual e mover do admin (único bloqueio que vale também para o admin) —;
   o **horário ocupado no envio do publicador** — ele não pede um
   `(dia, turno)` em que já tem pedido, em qualquer carrinho (409
   `codigo: "HORARIO_OCUPADO"`; sem índice no banco; o admin só é **avisado**
   nos modais de mover/adicionar) — e a **vaga cheia no envio do publicador**
   (regra 3). Tudo mais é sinalização, não bloqueio.
4a. **Carrinho de data especial** (escala de um dia só, PLANNING.md regra 10a):
   `Carrinho.DataEspecial` (Seg–Sex) — turnos só no dia da semana da data, aparece só
   na escala do mês da data, "Somente em dd/mm" na UI. Para o horário ocupado, normais
   e cada data especial são grupos separados (`HorarioOcupado.NoHorario`): pedir o
   especial não ocupa o horário da escala semanal, nem o contrário.
5. **Sem cadastro/login para o publicador.** Identificação via token
   anônimo (GUID) gerado no frontend e salvo em `localStorage`, enviado no
   header `X-Publicador-Token`. Nome é um campo livre, pedido no primeiro
   acesso (rota `/nome`, guarda `ExigeNome`) e fora do wizard; editável
   pelo publicador ("Olá, Fulano" → `PUT /api/publicador`) e pelo admin
   (`PUT /api/admin/publicadores/{id}`). Nomes repetidos são permitidos.
6. **Janela de envio: abre sozinha no dia 15, só o admin fecha**, sem
   job/cron: calculada a cada request (`JanelaDeEnvio`). Escala-alvo = a
   aberta no último dia 15 (dia ≥ 15 → mês seguinte; dia 1–14 → mês
   corrente); aberta enquanto `Escala.EnvioFechado` for false. O admin
   fecha/reabre na tela da Escala (`PUT /api/admin/escalas/{mes}/envio`,
   só para a escala-alvo). **Nunca reintroduzir fechamento automático por
   data.** Fora da janela, o **histórico do publicador continua sempre
   acessível** (não é afetado pela janela).
7. **Administrador não é limitado pela janela** — pode ver/excluir/
   adicionar em qualquer escala (passada, atual, futura) a qualquer momento.
7a. **Sem aprovação nem status**: toda `Solicitacao` existente já conta na
    escala (não há Pendente/Aprovada/Rejeitada). Tirar alguém = **excluir**
    o registro, definitivamente — nunca reintroduzir um status.
8. **Exclusão pelo publicador** (não existe "cancelar"): só pode excluir
   uma solicitação sua **com a janela aberta e se ela for da escala do mês-alvo** — validado
   também no backend (`DELETE /api/solicitacoes/{id}`, apaga o registro).
   Fora da janela, a tela inicial mostra um aviso no lugar do botão
   "Solicitar Nova Escala" e a lista fica só leitura. O admin exclui
   qualquer solicitação a qualquer momento (`DELETE /api/admin/solicitacoes/{id}`,
   com modal de confirmação na tela).
   Recusas por janela fechada vêm com `codigo: "JANELA_FECHADA"` no
   ProblemDetails — o frontend decide por esse código, nunca por "qualquer 400".
9. **Adição manual do admin**: entra na escala como qualquer outra. Publicador por
   nome livre — se o nome bater exatamente com um existente, reusa o
   registro; senão, cria um novo (pequenas diferenças de grafia podem
   gerar registros distintos — é uma consequência aceita, não um bug).
9a. **Carrinho** tem `Nome`, `Descricao` (opcional, exibida ao publicador
    abaixo do nome no wizard) e `Ativo`; o admin pode editar nome e
    descrição a qualquer momento.
9b. **Mover (admin)** é a ação principal da gestão: `PATCH /api/admin/solicitacoes/{id}`
    muda a vaga `(carrinho, dia, turno)` dentro da mesma escala, mantendo o registro.
    Destino precisa estar configurado; destino com excesso ou origem com 1 pessoa só
    avisam (também se a pessoa já está em outro carrinho no mesmo horário); duplicidade → 409.
    Toda a gestão (mover, adicionar pelo "+", editar pessoa — nome e criança/idoso —, excluir — discreto,
    último recurso) fica na tela da Escala (`/admin/escalas/:mes`), feita para
    toque em celular/tablet; não há mais telas Revisão/Adicionar.
10. **Remover turno de um carrinho (em qualquer dia) / desativar carrinho**: nunca altera ou
    remove `Solicitacao` já existentes — só afeta novos envios a partir dali.
11. **Um único administrador**, sem múltiplos papéis/permissões — login
    simples usuário/senha via variáveis de ambiente, JWT curto.
12. **Sem notificações** (e-mail/push) de nenhum tipo.
13. **Contagem de apoio ao desempate**: ao selecionar uma pessoa na tela da
    Escala, mostrar quantas solicitações (todas as trincas) ela já tem na
    mesma escala — é só informação de apoio, o sistema **nunca** decide ou
    sugere quem mover ou excluir.

## Convenções de execução paralela (múltiplos agentes)

- Cada slice de backend (`Features/<Área>/<Slice>/`) e cada tela de
  frontend (`routes/<área>/<Tela>.tsx`) é autocontido — trabalhe só dentro
  da própria pasta/arquivo sempre que a tarefa permitir.
- `Program.cs` e `App.tsx` são pontos de fusão compartilhados por várias
  tarefas: adicione **apenas a linha da própria tarefa** (o registro do
  próprio grupo de rotas / da própria rota React), evite tocar em outras
  linhas desses arquivos que não sejam suas.
- Nunca crie um slice de CRUD de `Turno` (turnos são fixos/seed, não
  gerenciáveis) nem endpoints/rotas para Sábado/Domingo.
- Ao implementar uma tarefa de `TASKS.md`, siga o ID da tarefa no nome do
  commit (ex: `F1-BE-03: cria slice CriarSolicitacao`) para rastreabilidade.
- Consulte `TASKS.md` para dependências antes de começar — Fase 0
  (domínio, `AppDbContext`, scaffolding) precisa estar mergeada antes de
  qualquer slice de Fase 1/2.

## Comandos

```bash
# Tudo via Docker (web :3000, api :5000, db :5432)
cp .env.example .env && docker compose up --build

# Produção (servidor único, HTTPS via Caddy; guia em deploy/README.md)
# Deploy automático a cada merge na main (.github/workflows/deploy.yml):
# testes → imagens no ghcr.io (tag = SHA) → SSH → deploy/atualizar.sh <sha>
bash deploy/atualizar.sh latest   # no servidor, à mão (ou <sha> para rollback)

# Backend (precisa de PostgreSQL acessível; config via appsettings/user-secrets/env)
cd backend/src/CartSchedule.Api && dotnet run     # migrations + seed dos turnos no startup; GET /health
dotnet build backend/CartSchedule.Api.slnx
dotnet ef migrations add <Nome> -o Infrastructure/Migrations   # rodar dentro de CartSchedule.Api

# Frontend
cd frontend && npm install
VITE_API_URL=http://localhost:5000 npm run dev -- --port 3000   # 3000 = origem CORS padrão da API
npm run build   # tsc -b && vite build
npm run lint    # oxlint
npm test        # vitest (componentes, jsdom)

# Testes do backend (precisam de Docker: Testcontainers sobe um PostgreSQL)
dotnet test --solution backend/CartSchedule.Api.slnx
```

## Testes

**Toda mudança de regra ou de tela vem com testes automatizados** — não
depender de teste manual no navegador/curl a cada alteração.

- **Backend** (`backend/tests/CartSchedule.Api.Tests`, xUnit v3): testes de
  integração que sobem a API real (`WebApplicationFactory`) contra um
  PostgreSQL em container, com as migrations do startup. Herde de
  `ApiTestBase` (banco limpo a cada teste, atalhos de login/carrinho/turnos)
  e use o contrato JSON em camelCase, como o frontend. A data é controlada
  por `Fixture.Relogio.Agora` — o código nunca lê `DateTime.UtcNow` para
  regra de negócio; injete `TimeProvider`. `backend/global.json` liga o
  runner Microsoft.Testing.Platform (exigido pelo `dotnet test` do .NET 10).
- **Frontend** (Vitest + Testing Library, `*.test.tsx` ao lado da tela):
  mocke só `apiFetch` (`vi.mock` do `api/client`, mantendo `ApiError`) e
  interaja como o usuário (`getByRole`, `userEvent`). `src/test/setup.ts`
  tem os polyfills que o Radix Select precisa no jsdom.
- Sem .NET 10/Node na máquina? Rode nos containers oficiais:
  `docker run --rm -u "$(id -u):$(id -g)" --group-add "$(stat -c %g /var/run/docker.sock)" -e HOME=/tmp -v /var/run/docker.sock:/var/run/docker.sock -v "$PWD/backend":/src -w /src mcr.microsoft.com/dotnet/sdk:10.0 dotnet test --solution CartSchedule.Api.slnx`
  e `docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD/frontend":/app -w /app node:22-alpine npm test`.

## Armadilhas

- CORS da API libera só `Cors__FrontendOrigin` (padrão `http://localhost:3000`);
  o Vite serve em 5173 por padrão — use `--port 3000` ou ajuste a variável.
- `VITE_API_URL` e `VITE_WHATSAPP_GRUPO_URL` (vinda de `WHATSAPP_GRUPO_URL` no
  `.env`, link do botão "Terminei!") são embutidas no bundle **em build time**;
  mudar exige rebuild.
- `ADMIN_SENHA_HASH` (hash do `PasswordHasher` do ASP.NET) contém `$`: no
  `.env` do compose, escape cada `$` como `$$`.
- Rate limiting por IP (`Infrastructure/RateLimiting/`) usa o `X-Forwarded-For`
  com `ForwardLimit = 2` (Caddy → nginx → API): mudou a cadeia de proxies,
  revise. Os testes rodam com limites altos (`ApiFixture`); para testar o
  limite, suba um host com `RateLimit:*` baixo (ver `RateLimitingTests`).
- No container da API as variáveis viram `ConnectionStrings__Default`,
  `Admin__Usuario`, `Admin__SenhaHash`, `Jwt__ChaveSecreta`.

## Variáveis de ambiente sensíveis

`POSTGRES_PASSWORD`, `ADMIN_USUARIO`, `ADMIN_SENHA_HASH`,
`JWT_CHAVE_SECRETA` — sempre via `.env` (nunca commitado; ver
`.env.example`), nunca hardcoded em código ou `docker-compose.yml`.

## Fluxo de issues (GitHub Action `claude.yml`)

O Claude é acionado por `@claude` em comentários de issue (só do dono do
repo) ou pelo label `aprovado`.

1. **Análise (padrão)**: leia a issue, `PLANNING.md`, `TECHNICAL_SPEC.md` e o
   código relevante. Comente na issue as dúvidas objetivas (numeradas) e a
   proposta resumida. **Não altere código nem abra PR** nesta etapa.
2. **Implementação**: só quando o comentário disser "implementar" (ou a issue
   tiver o label `aprovado`). Crie uma branch, implemente com testes
   (seção Testes), respeite as regras de negócio acima e abra um PR que
   referencie a issue (`Closes #N`).
3. Se o pedido conflitar com o `PLANNING.md`, pergunte em vez de implementar.
