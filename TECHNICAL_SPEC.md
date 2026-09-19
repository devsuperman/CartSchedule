# CartSchedule — Especificação Técnica

Este documento descreve a implementação técnica do projeto, com base nas
regras de negócio definidas em [`PLANNING.md`](./PLANNING.md). Cobre
arquitetura, backend, frontend, banco de dados e containers Docker.

## 1. Visão Geral da Arquitetura

```
┌─────────────┐      HTTP       ┌──────────────────┐      SQL      ┌──────────────┐
│   React     │ ───────────────► │  .NET 10 API      │ ─────────────► │  PostgreSQL   │
│  (frontend) │ ◄─────────────── │  Minimal API +     │ ◄───────────── │              │
│             │                  │  Vertical Slices   │                │              │
└─────────────┘                  └──────────────────┘                └──────────────┘
```

- **Frontend**: React (SPA), consumido tanto pelo Publicador (celular) quanto pelo Administrador (painel).
- **Backend**: API .NET 10, estilo Minimal API, organizada em **Vertical Slices** (uma pasta por funcionalidade, não por camada técnica).
- **Banco de dados**: PostgreSQL.
- **Execução**: os três (frontend, backend, banco) rodam como containers Docker, orquestrados por `docker-compose`.

## 2. Backend — API .NET 10

### 2.1 Estilo: Minimal API + Vertical Slices

Em vez de Controllers e camadas horizontais (Controllers / Services /
Repositories espalhados), o código é organizado por **funcionalidade**:
cada caso de uso (ex: "Publicador cria uma solicitação") vive em uma
única pasta, com tudo que ele precisa (endpoint, request, response,
validação, lógica). Isso evita acoplamento desnecessário entre
funcionalidades que não têm relação entre si.

Não é necessário nenhum framework adicional (como MediatR) para isso —
o próprio `IEndpointRouteBuilder` do Minimal API, com `MapGroup` e
extension methods por slice, é suficiente e mantém o espírito
"minimal". O `DbContext` do Entity Framework Core é injetado
diretamente no handler de cada slice (sem camada de Repository —
overhead desnecessário em vertical slices).

Estrutura de pastas sugerida:

```
backend/
  src/
    CartSchedule.Api/
      Program.cs                     # composição da app, mapeia todos os grupos de slices
      appsettings.json
      Domain/
        Publicador.cs
        Carrinho.cs
        Turno.cs
        CarrinhoTurno.cs
        Escala.cs
        Solicitacao.cs
        Enums/
          DiaSemana.cs
          StatusSolicitacao.cs
          OrigemSolicitacao.cs
      Infrastructure/
        AppDbContext.cs
        Migrations/
        Auth/
          AdminAuthOptions.cs        # usuário/senha (hash) via configuração
          JwtTokenService.cs
      Shared/
        JanelaDeEnvio.cs             # calcula, a partir da data atual, se a janela está aberta e para qual mês
        EscalaHelpers.cs             # cálculo da escala do "mês seguinte"
      Features/
        Publicadores/
          ConsultarJanela/           # GET  /api/janela
          ListarCarrinhosDisponiveis/# GET  /api/carrinhos  (com turnos habilitados por carrinho)
          CriarSolicitacao/          # POST /api/solicitacoes
          ListarHistorico/           # GET  /api/solicitacoes?publicadorId=...
          CancelarSolicitacao/       # POST /api/solicitacoes/{id}/cancelar
        Administradores/
          Login/                    # POST /api/admin/login
          GerenciarCarrinhos/       # GET/POST/PUT /api/admin/carrinhos
          GerenciarTurnos/          # GET/POST      /api/admin/turnos
          GerenciarTurnosDoCarrinho/# PUT           /api/admin/carrinhos/{id}/turnos
          RevisarEscala/
            ListarSolicitacoesAgrupadas/ # GET  /api/admin/escalas/{mes}/solicitacoes
            AprovarSolicitacao/          # POST /api/admin/solicitacoes/{id}/aprovar
            RejeitarSolicitacao/         # POST /api/admin/solicitacoes/{id}/rejeitar
            AdicionarSolicitacaoManual/  # POST /api/admin/escalas/{mes}/solicitacoes
          ObterEscalaFinal/         # GET  /api/admin/escalas/{mes}/grade
```

Cada slice de `Features/` segue o mesmo padrão de arquivos:
- `Endpoint.cs` — extension method que registra a rota (`MapPost`, `MapGet`, etc.).
- `Request.cs` / `Response.cs` — DTOs específicos daquele caso de uso.
- `Validator.cs` — validação de entrada (FluentValidation).
- Lógica do próprio handler, direto no delegate do endpoint (sem camadas extras).

### 2.2 Autenticação do Administrador

- Login simples com **usuário e senha** (não há múltiplos administradores — apenas uma conta).
- Credenciais (usuário + hash da senha) definidas via **variáveis de ambiente** no deploy, não em código.
- Senha armazenada com hash (`PasswordHasher` do ASP.NET Core ou BCrypt), nunca em texto puro.
- `POST /api/admin/login` valida usuário/senha e retorna um **JWT** de curta duração.
- Todas as rotas de `Features/Administradores/*` exigem esse token (`[Authorize]` / `RequireAuthorization()` no Minimal API).
- Rotas de `Features/Publicadores/*` continuam públicas (sem autenticação), conforme regra de negócio.

### 2.3 Identificação do Publicador (sem cadastro formal)

Resolve as regras 9, 10 e 11 do `PLANNING.md` (sem login, mas com
bloqueio de duplicidade e histórico):

- No primeiro acesso, o frontend gera um **identificador anônimo de dispositivo** (`publicadorToken`, um GUID) e salva no `localStorage`, junto com o nome informado.
- Esse token é enviado em todo request do publicador (ex: header `X-Publicador-Token`).
- No backend, a entidade `Publicador` é identificada por esse token (chave técnica), com o `nome` como um campo editável associado a ele.
- O bloqueio de duplicidade (regra 10) e o histórico (regra 11) usam esse `publicadorToken` para saber quais solicitações são "do mesmo publicador".
- Ao usar a adição manual, o administrador escolhe entre os nomes de publicadores já vistos pelo sistema (autocomplete) ou digita um nome novo:
  - Se o nome digitado **coincidir exatamente** com um `Publicador` já existente, a solicitação é associada a esse mesmo registro — inclusive aparecerá no histórico daquele publicador quando ele acessar pelo próprio celular.
  - Caso contrário (nome novo, ou grafia diferente de um nome existente), o backend cria um `Publicador` novo com um token gerado no servidor. Isso é uma consequência aceita da regra de negócio 9 (sem verificação/bloqueio de nomes duplicados) — pequenas diferenças de grafia podem gerar registros distintos para a mesma pessoa; a escala final não é afetada, pois é montada pelos nomes aprovados, não pelo token.

### 2.4 Janela de Envio e Escala — cálculo automático

Não há job agendado nem tarefa de background: a janela de envio (regra
6) e a escala-alvo (mês seguinte) são **calculadas em tempo real** a
partir da data atual do servidor, toda vez que uma requisição chega
(função utilitária em `Shared/JanelaDeEnvio.cs`):

- Dia do mês entre 15 e 25 (inclusive) → janela aberta; escala-alvo = mês seguinte ao atual.
- Fora desse intervalo → janela fechada.

A entidade `Escala` (mês de referência) é criada **sob demanda** (lazy) na primeira vez que é referenciada — seja pelo primeiro envio de um publicador, seja pela primeira ação do administrador naquele mês.

### 2.5 Persistência

- **Entity Framework Core** com provider **Npgsql** (PostgreSQL).
- Migrations versionadas em `Infrastructure/Migrations/`.
- Aplicação das migrations automaticamente na subida do container da API (em todos os ambientes deste projeto, dado o escopo simples — sem múltiplos ambientes/produção complexa por enquanto).

### 2.6 Validação

- **FluentValidation** para validar os `Request` de cada slice (ex: nome obrigatório, carrinho/turno/dia válidos, turno pertence ao carrinho escolhido no momento do envio).
- Erros de validação retornam `400` com detalhes (`ProblemDetails`).

### 2.7 Remoção de turno de um carrinho / desativação de carrinho

Conforme regra de negócio 18 (`PLANNING.md`): remover um turno de um
`CarrinhoTurno` ou marcar `Carrinho.ativo = false` **não** altera nem
remove `Solicitacao` já existentes — essas linhas continuam no banco
normalmente, e o histórico/escala continuam exibindo-as. A validação
de "turno pertence ao carrinho" (2.6) só se aplica à **criação** de
novas solicitações, não é reavaliada retroativamente sobre as
existentes.

### 2.8 CORS

A API habilita CORS para a origem do frontend (`VITE_API_URL`/URL do
container `web`), permitindo os métodos e headers usados pelo cliente
(incluindo o header customizado `X-Publicador-Token` e
`Authorization` para o admin).

## 3. Frontend — React

### 3.1 Stack

- **React** + **TypeScript**, com **Vite** como bundler/dev server.
- **React Router** para as rotas.
- Cliente HTTP simples (`fetch` + um wrapper leve, ou `axios`) para consumir a API.
- Sem gerenciador de estado global pesado (Redux etc.) — o estado do app é simples o suficiente para `useState`/`useEffect` e cache leve de requisições (ex: React Query, opcional).

### 3.2 Estrutura de pastas sugerida

```
frontend/
  src/
    main.tsx
    App.tsx                      # roteamento
    api/
      client.ts                  # wrapper HTTP (inclui X-Publicador-Token e Authorization quando aplicável)
      publicadores.ts
      administradores.ts
    routes/
      publicador/
        NovaSolicitacao.tsx       # formulário: nome, carrinho, dia da semana, turno
        Historico.tsx             # lista + cancelamento
        JanelaFechada.tsx         # tela exibida fora da janela de envio
      admin/
        Login.tsx
        RevisaoEscala.tsx         # solicitações agrupadas por carrinho/dia/turno + desempate
        AdicionarSolicitacao.tsx  # adição manual
        GestaoCarrinhos.tsx       # cadastro de carrinhos, turnos e associação carrinho-turno
        EscalaFinal.tsx           # grade final do mês
    hooks/
      usePublicadorToken.ts       # lê/gera o token e o nome salvos no localStorage
      useJanela.ts
      useAdminAuth.ts             # guarda o JWT (em memória ou sessionStorage) e protege rotas /admin
    components/                   # componentes reutilizáveis de UI
  index.html
  vite.config.ts
  package.json
  Dockerfile
```

### 3.3 Duas áreas da aplicação

- **Área do Publicador** (`/`): fluxo mobile-first (a maioria acessa pelo celular) — nome, carrinho, dia da semana, turno, envio, histórico com cancelamento. Sem login.
- **Área do Administrador** (`/admin/*`): protegida por login (JWT armazenado no cliente); painel de revisão de escala, gestão de carrinhos/turnos e escala final.

## 4. Banco de Dados — PostgreSQL

Tabelas espelhando o modelo de dados do `PLANNING.md` (seção 9):

| Tabela | Colunas principais |
|---|---|
| `publicadores` | `id` (uuid/token), `nome` |
| `carrinhos` | `id`, `nome`, `ativo` |
| `turnos` | `id`, `nome`, `hora_inicio`, `hora_fim` |
| `carrinho_turnos` | `carrinho_id`, `turno_id` (PK composta) |
| `escalas` | `id`, `mes_referencia` (ex: `2026-10-01`, primeiro dia do mês) |
| `solicitacoes` | `id`, `publicador_id`, `escala_id`, `carrinho_id`, `dia_semana`, `turno_id`, `status`, `origem`, `criado_em`, `decidido_em` |

Índices/constraints relevantes:
- Único: `(publicador_id, escala_id, carrinho_id, dia_semana, turno_id)` em `solicitacoes` (regra 10 — bloqueio de duplicidade).
- Único: `(carrinho_id, turno_id)` em `carrinho_turnos`.
- Índice em `(escala_id, carrinho_id, dia_semana, turno_id)` em `solicitacoes`, usado tanto para montar os grupos de aprovação quanto a grade final.

Migrations do EF Core cuidam da criação/evolução do schema — não há necessidade de scripts SQL manuais.

## 5. Docker

### 5.1 `docker-compose.yml` (raiz do repositório)

Três serviços:

```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: cartschedule
      POSTGRES_USER: cartschedule
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - db-data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U cartschedule"]
      interval: 5s
      timeout: 5s
      retries: 5

  api:
    build: ./backend
    depends_on:
      db:
        condition: service_healthy
    environment:
      ConnectionStrings__Default: "Host=db;Database=cartschedule;Username=cartschedule;Password=${POSTGRES_PASSWORD}"
      Admin__Usuario: ${ADMIN_USUARIO}
      Admin__SenhaHash: ${ADMIN_SENHA_HASH}
      Jwt__ChaveSecreta: ${JWT_CHAVE_SECRETA}
    ports:
      - "5000:8080"

  web:
    build: ./frontend
    depends_on:
      - api
    environment:
      VITE_API_URL: "http://localhost:5000"
    ports:
      - "3000:80"

volumes:
  db-data:
```

### 5.2 Dockerfile da API (multi-stage)

- Estágio de build: imagem SDK do .NET 10, `dotnet publish`.
- Estágio final: imagem runtime (ASP.NET), copia só o publish — imagem final enxuta.
- Aplica migrations automaticamente ao iniciar (`dotnet ef database update` embutido na inicialização do `Program.cs`, ou `context.Database.Migrate()`).

### 5.3 Dockerfile do Frontend (multi-stage)

- Estágio de build: imagem Node, `npm install` + `npm run build` (gera estático via Vite).
- Estágio final: imagem `nginx` leve, servindo os arquivos estáticos gerados.

### 5.4 Variáveis de ambiente sensíveis

- `POSTGRES_PASSWORD`, `ADMIN_USUARIO`, `ADMIN_SENHA_HASH`, `JWT_CHAVE_SECRETA` ficam em um arquivo `.env` (fora do controle de versão, `.gitignore`), nunca commitadas.

## 6. Estrutura do Repositório

```
CartSchedule/
  backend/
    src/CartSchedule.Api/...
    CartSchedule.Api.sln
    Dockerfile
  frontend/
    src/...
    package.json
    Dockerfile
  docker-compose.yml
  .env.example
  PLANNING.md
  TECHNICAL_SPEC.md
  README.md
```

## 7. Roadmap Técnico

Alinhado ao roadmap de negócio (`PLANNING.md`, seção 10):

- **Fase 1**: modelo de dados + migrations; slices do Publicador (janela, carrinhos disponíveis, criar solicitação, histórico, cancelamento); frontend da área do Publicador; `docker-compose` funcional com os 3 serviços.
- **Fase 2**: autenticação do administrador (login + JWT); slices de gestão de carrinhos/turnos; slices de revisão de escala (listagem agrupada, aprovar/rejeitar, contagem de apoio ao desempate, adição manual); frontend da área do Administrador.
- **Fase 3**: slice e tela da escala mensal final (grade Carrinho × Dia × Turno).
- **Fase 4 (opcional, futura)**: exportação da escala (PDF/Excel), relatórios de escalas passadas.
