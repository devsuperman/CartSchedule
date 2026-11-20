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
          OrigemSolicitacao.cs
      Infrastructure/
        AppDbContext.cs
        Migrations/
        Auth/
          AdminAuthOptions.cs        # usuário/senha (hash) do administrador de recuperação via configuração
          JwtTokenService.cs         # papéis publicador/administrador/recuperacao (Papeis)
      Infrastructure/RateLimiting/   # limites por IP (ver 2.9)
      Shared/
        JanelaDeEnvio.cs             # mês-alvo pela data (dia 15, horário de Brasília) + se o admin fechou o envio (Escala.EnvioFechado)
        EscalaHelpers.cs             # obtém ou cria (lazy) a Escala de um mês de referência
        LotacaoDaVaga.cs             # limite de 2 (vaga cheia) para o publicador, código VAGA_CHEIA
        HorarioOcupado.cs            # filtro do "um lugar por horário" por grupo (normais × cada data especial), código HORARIO_OCUPADO
        DataEspecial.cs              # dia útil da data, mês da data, "cabe na escala"
        Credenciais.cs               # UsuarioNormalizado (sem maiúsculas/acentos) e Pin (4 dígitos, gerado sem ser óbvio)
        ValidationFilter.cs          # filtro de endpoint que roda o FluentValidation do Request
      Features/
        Publicadores/
          ConsultarJanela/           # GET  /api/janela
          ListarCarrinhosDisponiveis/# GET  /api/carrinhos  (id, nome, descricao, dataEspecial — carrinho de data especial só no mês da data —, disponibilidades dia×turno por carrinho, cada uma com ocupacao, cheia e nomes — primeiro nome de quem está na vaga, vazio se cheia — na escala-alvo)
          CriarSolicitacao/          # POST /api/solicitacoes  (409 HORARIO_OCUPADO se o publicador já tem pedido no mesmo dia e turno, em qualquer carrinho do mesmo grupo — normais × cada data especial, HorarioOcupado.NoHorario; 400 se o carrinho especial é de outro mês; 409 VAGA_CHEIA com 2 pessoas na vaga: contagem + insert numa transação com pg_advisory_xact_lock(escalaId); o admin não é bloqueado)
          ListarHistorico/           # GET  /api/solicitacoes  (header X-Publicador-Token; carrinhoNome + carrinhoDescricao + carrinhoDataEspecial; sem data/hora do envio na resposta)
          ExcluirSolicitacao/        # DELETE /api/solicitacoes/{id}  (apaga o registro; não há status)
          AtualizarNome/             # PUT    /api/publicador  (header X-Publicador-Token; 204; não cria o publicador se ainda não existe; sem janela)
        Autenticacao/
          Login/                    # POST /api/login  ({usuario, pin} → {token, papel}; administrador de recuperação ou publicador; 401 CREDENCIAIS_INVALIDAS; 403 PUBLICADOR_INATIVO)
        Administradores/
          GerenciarCarrinhos/       # GET/POST/PUT /api/admin/carrinhos  (nome, descricao opcional, ativo, dataEspecial opcional Seg–Sex; mudar a data de dia remove os turnos dos outros dias)
          GerenciarTurnosDoCarrinho/# GET/PUT       /api/admin/carrinhos/{id}/turnos (disponibilidades dia×turno; carrinho especial só no dia da semana da data; turnos em si são fixos, ver 2.4)
          RevisarEscala/                 # nome de pasta histórico (a antiga tela "Revisão" não existe mais); não renomear sem necessidade
            ExcluirSolicitacao/          # DELETE /api/admin/solicitacoes/{id}  (sem aprovação: o admin exclui; 204/404, sem janela)
            AdicionarSolicitacaoManual/  # POST /api/admin/escalas/{mes}/solicitacoes  ({nome, carrinhoId, diaSemana, turnoId, criancaOuIdoso?}; true marca a pessoa, nunca desmarca)
          ObterEscalaFinal/         # GET  /api/admin/escalas/{mes}/grade  (todas as vagas configuradas + células com pedidos; disponivel; por célula: carrinhoDescricao, carrinhoDataEspecial (carrinho especial só no mês da data); por pedido: solicitacaoId, origem, totalNaEscala, criancaOuIdoso; envio: {aberto} só na escala em envio, senão null)
          AlterarEnvioEscala/       # PUT  /api/admin/escalas/{mes}/envio  ({aberto}; 204; 400 se o mês não é a escala em envio; idempotente; cria a escala se preciso)
          MoverSolicitacao/         # PATCH /api/admin/solicitacoes/{id}  ({carrinhoId, diaSemana, turnoId}; 204; 400 destino não configurado; 409 duplicidade; 404; sem janela; vaga com excesso não bloqueia)
          GerenciarPublicadores/    # GET  /api/admin/publicadores?busca=&incluirInativos=  (desativados só com incluirInativos=true; ehVoce marca o administrador logado; id, nome, usuario, criancaOuIdoso, administrador, ativo, temPin)
                                    # POST /api/admin/publicadores  ({nome, usuario, criancaOuIdoso, administrador} → 201 {id, usuario, pin}; PIN só nesta resposta)
                                    # PUT  /api/admin/publicadores/{id}  ({nome?, usuario?, criancaOuIdoso?, administrador?, ativo?}; ativo=false desconecta os aparelhos; 409 PROPRIA_CONTA ao desativar ou tirar o administrador da própria conta; ausente = não muda; 204, ou 200 {id, usuario, pin} ao dar usuário a registro sem PIN; 409 USUARIO_EM_USO; nomes repetidos permitidos)
                                    # POST /api/admin/publicadores/{id}/pin  (redefine: 200 {id, usuario, pin}; desconecta os aparelhos; 400 SEM_USUARIO se ainda não tem usuário)
          UnirPublicadores/         # GET  /api/admin/publicadores/{origemId}/unir/{destinoId}  (prévia: {pedidosMovidos, pedidosDescartados}); POST na mesma rota executa numa transação: move os pedidos da origem ao destino, descarta os que o destino já tem na mesma (escala, carrinho, dia, turno), criança/idoso da origem passa ao destino (nunca desmarca), apaga a origem; 400 origem = destino; 404 inexistente
```

Cada slice de `Features/` segue o mesmo padrão de arquivos:
- `Endpoint.cs` — extension method que registra a rota (`MapPost`, `MapGet`, etc.).
- `Request.cs` / `Response.cs` — DTOs específicos daquele caso de uso.
- `Validator.cs` — validação de entrada (FluentValidation).
- Lógica do próprio handler, direto no delegate do endpoint (sem camadas extras).

### 2.2 Autenticação (login único — ADR 0001)

- **Login único** `POST /api/login` (`{ usuario, pin }` → `{ token, papel }`), tela `/login` no frontend (`/admin/login` redireciona para ela).
- Primeiro confere o **administrador de recuperação**: usuário + hash da senha via **variáveis de ambiente** (`Admin:Usuario`/`Admin:SenhaHash`, hash do `PasswordHasher` do ASP.NET Core), nunca em código; a senha vai no campo `pin`. Senão, procura o **publicador** pelo usuário normalizado (sem maiúsculas e sem acentos, coluna `UsuarioNormalizado` com índice único) e confere o PIN (`PinHash`, mesmo hasher).
- Usuário inexistente, PIN errado e conta sem PIN → mesma resposta `401` `codigo: "CREDENCIAIS_INVALIDAS"`; conta desativada → `403` `codigo: "PUBLICADOR_INATIVO"`. Sem bloqueio de conta: só o rate limit `login` por IP (2.9).
- **JWT** HMAC SHA256 (chave em `Jwt:ChaveSecreta`), sem refresh token, com o papel em `ClaimTypes.Role` (`Papeis`): `recuperacao` e `administrador` valem **2 horas**; `publicador` vale 180 dias. Tokens de publicador levam o id e `versaoSessao`. A cada request autenticado, `Infrastructure/Auth/ValidacaoDaSessao` (evento `OnTokenValidated`) confere que o publicador existe, está ativo, que a `versaoSessao` do token é a atual e que, se o token é de administrador, a pessoa ainda é administrador; senão `401` (dar administrador não desconecta: o papel novo vem no próximo login). Redefinir o PIN e desativar incrementam `versaoSessao` — é assim que todos os aparelhos são desconectados (reativar não devolve as sessões antigas). O frontend guarda o JWT de administrador em `sessionStorage` (some ao fechar a aba).
- Todas as rotas de `Features/Administradores/*` exigem o token (`RequireAuthorization()`), e a política padrão exige o papel `administrador` ou `recuperacao`: o publicador comum recebe `403`.
- Rotas de `Features/Publicadores/*` continuam públicas (sem autenticação), conforme regra de negócio. Enquanto usam o token anônimo, um publicador desativado recebe `403` `PUBLICADOR_INATIVO` (`Shared/PublicadorInativo`) ao pedir, excluir ou renomear; o histórico continua legível.

### 2.3 Identificação do Publicador (sem cadastro formal)

Resolve as regras 9, 10 e 11 do `PLANNING.md` (sem login, mas com
bloqueio de duplicidade e histórico):

- No primeiro acesso, o frontend gera um **identificador anônimo de dispositivo** (`publicadorToken`, um GUID) e salva no `localStorage`. Antes de qualquer tela do publicador, a guarda `ExigeNome` leva à rota `/nome`, onde ele informa o nome (também salvo no `localStorage`). O nome vai ao backend junto com cada pedido (`POST /api/solicitacoes` cria/atualiza o `Publicador`) e, quando editado em `/nome` ("Olá, Fulano" no cabeçalho), por `PUT /api/publicador`.
- Esse token é enviado em todo request do publicador (ex: header `X-Publicador-Token`).
- No backend, a entidade `Publicador` é identificada por esse token: `Publicador.Id` **é** o GUID do header (não há coluna de token separada), com o `nome` como um campo editável associado a ele. O `Publicador` só passa a existir no banco no primeiro pedido (`POST /api/solicitacoes`); antes disso, `PUT /api/publicador` não cria nada. Cada `POST` sobrescreve o nome com o enviado pelo aparelho.
- O bloqueio de duplicidade (regra 10) e o histórico (regra 11) usam esse `publicadorToken` para saber quais solicitações são "do mesmo publicador".
- Ao usar a adição manual, o administrador escolhe entre os nomes de publicadores já vistos pelo sistema (autocomplete) ou digita um nome novo:
  - Se o nome digitado (com `Trim`) **coincidir exatamente** — comparação ordinal, sensível a maiúsculas e acentos — com um `Publicador` já existente (havendo homônimos, o de pedido mais antigo; quem não tem pedido fica por último; desempate pelo `Id`), a solicitação é associada a esse mesmo registro — inclusive aparecerá no histórico daquele publicador quando ele acessar pelo próprio celular.
  - Caso contrário (nome novo, ou grafia diferente de um nome existente), o backend cria um `Publicador` novo com um token gerado no servidor. Isso é uma consequência aceita da regra de negócio 9 (sem verificação/bloqueio de nomes duplicados) — pequenas diferenças de grafia podem gerar registros distintos para a mesma pessoa; a escala final não é afetada, pois é montada pelos nomes, não pelo token.
- `Publicador.CriancaOuIdoso` (regra 1 do `PLANNING.md`) é só do administrador: marcado em "Editar pessoa" (`PUT /api/admin/publicadores/{id}`) ou na adição manual. O publicador não vê nem altera. O estado de cada vaga (vazia / incompleta / completa / excesso) é calculado **no frontend** a partir da grade (`routes/admin/components/gradeEscala.ts`, `estadoVaga`). No backend, as únicas regras de lotação/horário são as que bloqueiam o **publicador** (`VAGA_CHEIA` com 2+ pessoas e `HORARIO_OCUPADO`, ambas em `CriarSolicitacao`); para o administrador, o backend só barra a duplicidade exata (índice único).

### 2.4 Turnos e dias da semana fixos (dados de seed)

Conforme regras de negócio 19 e 20 (`PLANNING.md`):

- `DiaSemana` é um enum com **apenas 5 valores**: Segunda, Terça,
  Quarta, Quinta, Sexta. Não existem Sábado nem Domingo em lugar
  nenhum do sistema (nem no enum, nem na validação de entrada).
- `Turno` **não tem endpoint de criação/edição** — não há
  `GerenciarTurnos` como slice administrativo. Os 6 turnos são dados
  fixos, inseridos por uma **migration de seed** do EF Core, sempre
  os mesmos: `06:00–08:00`, `08:00–10:00`, `10:00–12:00`,
  `14:00–16:00`, `16:00–18:00`, `18:00–20:00`.
- O único endpoint relacionado a turno que o administrador usa é o de
  **associação** (`GerenciarTurnosDoCarrinho`), que só lê da lista
  fixa de 6 e escreve em `CarrinhoTurno` — nunca cria ou altera um
  `Turno` em si. Cada linha de `CarrinhoTurno` é uma disponibilidade
  `(carrinho, dia_semana, turno)`: o mesmo carrinho pode ter turnos
  diferentes em cada dia (PLANNING.md regra 17). O contrato usa
  `disponibilidades: [{ diaSemana, turnoId }]` (diaSemana 1–5,
  turnoId 1–6) — tanto no `PUT` (substituição completa do conjunto)
  quanto nas respostas de `GET /api/carrinhos` e
  `GET/POST/PUT /api/admin/carrinhos`.
- O frontend também pode tratar essa lista de 6 turnos como uma
  constante compartilhada, evitando uma chamada extra à API só para
  listá-los (ela ainda existe via `GET /api/carrinhos`, que já retorna
  as disponibilidades dia×turno de cada carrinho).

### 2.5 Janela de Envio e Escala — abre pela data, fecha pelo administrador

Não há job agendado nem tarefa de background: a janela de envio (regra
6) e a escala-alvo são **calculadas em tempo real** a cada requisição
(`Shared/JanelaDeEnvio.cs`), a partir da data atual no horário de Brasília
e da flag `Escala.EnvioFechado`:

- Escala-alvo (escala em envio) = a aberta no último dia 15: dia ≥ 15 → mês seguinte; dia 1–14 → mês corrente.
- Janela aberta ⇔ a escala-alvo não tem `EnvioFechado = true` (escala ainda inexistente = aberta).
- O administrador fecha/reabre com `PUT /api/admin/escalas/{mes}/envio` (`{ aberto }`), só para a escala-alvo. Não há fechamento automático; no dia 15 a escala-alvo muda e a anterior deixa de receber pedidos.

Requests recusados por a janela estar fechada (`CriarSolicitacao`, `ExcluirSolicitacao`
do publicador) respondem 400 com a extensão `codigo: "JANELA_FECHADA"` no ProblemDetails
(`JanelaDeEnvio.CodigoJanelaFechada`); o frontend usa esse código — e não o status 400,
compartilhado com outros erros — para mostrar a tela de janela fechada. Uma falha ao
consultar `GET /api/janela` nunca é tratada como janela fechada: a interface mostra o erro
com opção de tentar de novo.

A entidade `Escala` (mês de referência) é criada **sob demanda** (lazy) na primeira vez que é referenciada — seja pelo primeiro envio de um publicador, seja pela primeira ação do administrador naquele mês.

### 2.6 Persistência

- **Entity Framework Core** com provider **Npgsql** (PostgreSQL).
- Migrations versionadas em `Infrastructure/Migrations/`.
- Aplicação das migrations automaticamente na subida do container da API (em todos os ambientes deste projeto, dado o escopo simples — sem múltiplos ambientes/produção complexa por enquanto).

### 2.7 Validação

- **FluentValidation** para validar o formato dos `Request` de cada slice (ex: nome obrigatório até 200, dia 1–5, ids > 0). As regras que dependem do banco ficam no handler: turno disponível para o carrinho **no dia da semana** escolhido, carrinho ativo, carrinho especial na escala do mês da data — valem para o envio do publicador, a adição manual e o mover do admin.
- Erros de validação retornam `400` com detalhes (`ProblemDetails`).

### 2.8 Remoção de turno de um carrinho / desativação de carrinho

Conforme regra de negócio 18 (`PLANNING.md`): remover uma disponibilidade
(dia × turno) de `CarrinhoTurno` ou marcar `Carrinho.ativo = false` **não** altera nem
remove `Solicitacao` já existentes — essas linhas continuam no banco
normalmente, e o histórico/escala continuam exibindo-as. As validações
de "turno disponível para o carrinho naquele dia" e de "carrinho ativo" (2.7) só se
aplicam a **gravar** uma vaga — `CriarSolicitacao`, `AdicionarSolicitacaoManual` e o
destino de `MoverSolicitacao` (400) —, não são reavaliadas retroativamente sobre as
existentes. Excluir uma solicitação de carrinho inativo continua permitido.

> **Pendente no código** (issue #41): hoje os três
> endpoints só verificam `CarrinhoTurno`, não `Carrinho.Ativo` — um carrinho inativo
> que ainda tenha turnos configurados é aceito pela API (a UI já o esconde).

### 2.8a Carrinho de data especial com a data já passada

`ListarCarrinhosDisponiveis` não oferece, e `CriarSolicitacao` recusa (400), carrinho
cuja `DataEspecial` seja anterior a hoje (horário de Brasília, `JanelaDeEnvio.Hoje`).
No próprio dia ainda é aceito. Não vale para o administrador (regra 7).

> **Pendente no código** (issue #41): hoje só se
> verifica o mês da data (`DataEspecial.CabeNaEscala`).

### 2.9 Proteção contra abuso (sem login do publicador)

As rotas do publicador são públicas por decisão de produto; a proteção contra
bots e força bruta é invisível para quem usa o sistema normalmente:

- **Rate limiting por IP** (nativo do ASP.NET, `Infrastructure/RateLimiting/`),
  com limites na seção `RateLimit` da configuração: teto geral de 300 req/min
  em `/api` (`/health` fica de fora), 30 criações/exclusões de solicitação por
  minuto (`publicador-escrita`) e 5 tentativas de login do admin a cada 15
  minutos (`login`). Os limites são generosos porque muitos publicadores podem
  sair pelo mesmo IP (Wi-Fi do salão, CGNAT do celular).
- Excedeu: **429** com `codigo: "MUITAS_REQUISICOES"` no ProblemDetails e header
  `Retry-After`; o frontend mostra "Muitas tentativas. Aguarde um pouco e tente
  novamente." e cada bloqueio é logado como warning com o IP.
- O IP vem do `X-Forwarded-For` (`UseForwardedHeaders`, `ForwardLimit = 2`:
  Caddy → nginx → API). O Caddy descarta esse header quando vem da internet,
  então o cliente não forja o IP. Mudou a cadeia de proxies? Revise o `ForwardLimit`.
- nginx limita o corpo dos requests de `/api` a 16 KB; o Caddy envia HSTS,
  `X-Frame-Options: DENY`, `nosniff` e `Referrer-Policy`.
- Solicitação falsa enviada por alguém que tem o link continua possível — é
  aceito: o admin já revisa todas as solicitações.

### 2.10 CORS

A API habilita CORS só para a origem configurada em `Cors:FrontendOrigin`
(env `Cors__FrontendOrigin`, padrão `http://localhost:3000`). `VITE_API_URL` é o
inverso — o endereço da API embutido no bundle do frontend. Libera os métodos e headers usados pelo cliente
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
        InicioPublicador.tsx      # tela inicial: histórico do mês corrente + escala em envio (só esses dois); botão "Solicitar Nova Escala" (janela aberta) ou aviso de envio fechado
        SolicitarEscala.tsx       # decide entre JanelaFechada e o wizard, conforme useJanela()
        JanelaFechada.tsx         # tela exibida fora da janela de envio
        Nome.tsx                  # rota /nome: nome no primeiro acesso e edição ("Olá, Fulano")
        wizard/                   # formulário em 3 etapas: dia da semana → turno → carrinho (nome + descrição + ocupação); envia um pedido ao confirmar o carrinho e volta a "/"
        components/
          SolicitacaoCard.tsx     # card de uma solicitação (excluir, só com janela aberta e no mês-alvo; sem status nem data/hora)
          ErroJanela.tsx          # erro ao consultar /api/janela, com "tentar novamente"
      admin/
        Login.tsx
        GestaoCarrinhos.tsx       # cadastro/edição de carrinhos (nome, descrição, data especial) e associação com os 6 turnos fixos
        EscalaFinal.tsx           # gestão da escala por toque: vagas com ocupação; mover, adicionar (+), editar nome e excluir
        EscalaCompartilhar.tsx    # /admin/escalas/:mes/compartilhar: visão só leitura para o WhatsApp — uma imagem PNG do mês (grade por dia: turnos × carrinhos) + uma por data especial (html-to-image + Web Share API)
        RedirecionaParaEscala.tsx # /admin/revisao/:mes e /admin/adicionar/:mes (telas antigas) → /admin/escalas/:mes
        components/               # CelulaEscala, ModaisEscala, gradeEscala (tipos + atualização local), ModalEditarNome
    hooks/
      usePublicadorToken.ts       # lê/gera o token; nome no localStorage, compartilhado entre telas (useSyncExternalStore)
      useJanela.ts
      useAdminAuth.ts             # guarda o JWT em sessionStorage (em memória se indisponível) e protege rotas /admin
    components/                   # componentes reutilizáveis de UI
  index.html
  vite.config.ts
  package.json
  Dockerfile
```

### 3.3 Duas áreas da aplicação

- **Área do Publicador** (`/`): fluxo mobile-first (a maioria acessa pelo celular) — nome (só no primeiro acesso), dia da semana, turno, carrinho, envio, histórico com exclusão. Sem login.
- **Área do Administrador** (`/admin/*`): protegida por login (JWT armazenado no cliente); gestão de carrinhos (com associação aos turnos fixos) e a tela da Escala, onde toda a gestão do mês acontece (mover, adicionar, excluir, editar pessoa). Pensada para celular/tablet: seletor de dia no celular, grade Turno × Dia a partir de 768px; ações por toque numa barra fixa no rodapé.

## 4. Banco de Dados — PostgreSQL

Tabelas espelhando o modelo de dados do `PLANNING.md` (seção 9):

| Tabela | Colunas principais |
|---|---|
| `publicadores` | `id` (uuid = token do aparelho), `nome` (até 200), `crianca_ou_idoso` (bool, padrão `false`) |
| `carrinhos` | `id`, `nome`, `descricao` (opcional, até 500), `ativo`, `data_especial` (date, opcional) |
| `turnos` | `id`, `hora_inicio`, `hora_fim` — **tabela com dado fixo (seed)**, sempre as mesmas 6 linhas, sem endpoint de criação/edição |
| `carrinho_turnos` | `carrinho_id`, `dia_semana`, `turno_id` (PK composta) |
| `escalas` | `id`, `mes_referencia` (ex: `2026-10-01`, primeiro dia do mês; na URL da API, `yyyy-MM`), `envio_fechado` (bool, padrão `false`) |
| `solicitacoes` | `id`, `publicador_id`, `escala_id`, `carrinho_id`, `dia_semana`, `turno_id`, `data_especial` (cópia da do carrinho ao gravar/mover), `origem`, `criado_em` — sem `status`: toda solicitação existente conta na escala (as colunas `status`/`decidido_em` foram removidas) |

Índices/constraints relevantes:
- Único: `(publicador_id, escala_id, carrinho_id, dia_semana, turno_id)` em `solicitacoes` (regra 10 — bloqueio de duplicidade). O "um lugar por horário" `(publicador, escala, dia, turno)` não tem índice: só o envio do publicador barra (no código, sob o mesmo lock da vaga cheia); o admin pode, com aviso.
- Único: `(carrinho_id, dia_semana, turno_id)` em `carrinho_turnos` (a própria PK).
- Índice em `(escala_id, carrinho_id, dia_semana, turno_id)` em `solicitacoes`, usado para montar a grade da escala.

Migrations do EF Core cuidam da criação/evolução do schema — não há necessidade de scripts SQL manuais.

## 5. Docker

### 5.1 `docker-compose.yml` (raiz do repositório)

Três serviços. O arquivo real (`docker-compose.yml`) é a referência; o
trecho abaixo é um resumo. Diferenças importantes em relação a ele: as
variáveis sensíveis usam `${VAR:?mensagem}` (falha se faltar), a API recebe
`Cors__FrontendOrigin`, e o `web` recebe `VITE_API_URL` e
`VITE_WHATSAPP_GRUPO_URL` como **build args** (são embutidas no bundle).
Produção usa `docker-compose.prod.yml` + Caddy (ver `deploy/README.md`).

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
    tests/CartSchedule.Api.Tests/   # xUnit + WebApplicationFactory + Testcontainers (PostgreSQL)
    CartSchedule.Api.slnx
    global.json                     # runner Microsoft.Testing.Platform
    Dockerfile
  frontend/
    src/...                         # *.test.tsx (Vitest + Testing Library) ao lado das telas
    package.json
    Dockerfile
  docker-compose.yml
  .env.example
  docs/
    PLANNING.md
    TECHNICAL_SPEC.md
    agents/                       # configuração das skills (issues, labels, domínio)
  README.md
```

