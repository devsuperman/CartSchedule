# CartSchedule — Contexto para Agentes

Sistema web para organizar o uso de carrinhos de trabalho ao longo do mês.
Na interface o sistema se chama **"Escala TPL"** — "CartSchedule" é só o
nome interno (repo, namespaces, pastas); não renomear o código.
Publicadores solicitam `(carrinho, dia da semana, turno)` em que querem
trabalhar; um administrador aprova/rejeita e monta a escala mensal final
(máx. 2 pessoas por combinação).

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
  Shared/                  # JanelaDeEnvio.cs, EscalaHelpers.cs
  Features/
    Publicadores/<Slice>/  # Endpoint.cs, Request.cs, Response.cs, Validator.cs
    Administradores/<Slice>/
  Program.cs

frontend/src/
  api/                     # client.ts + wrappers por área
  routes/publicador/       # NovaSolicitacao, Historico, JanelaFechada
  routes/admin/            # Login, GestaoCarrinhos, RevisaoEscala, AdicionarSolicitacao, EscalaFinal
  hooks/                   # usePublicadorToken, useJanela, useAdminAuth
  constants/                # turnos.ts, diasSemana.ts (espelham enums do backend)
```

## Regras de negócio que NÃO podem ser quebradas

Estas são as decisões mais fáceis de errar por instinto de "boa prática" —
todas são intencionais, confirmadas no `PLANNING.md`:

1. **Dias fixos**: só Segunda a Sexta. Nunca adicionar Sábado/Domingo em
   enum, validação, UI ou seed. A escolha de dia é **recorrente** (vale
   para todas as ocorrências daquele dia no mês), não uma data específica.
2. **Turnos fixos do sistema**: sempre estes 6, nunca cadastráveis pelo
   admin: `06:00–08:00, 08:00–10:00, 10:00–12:00, 14:00–16:00, 16:00–18:00,
   18:00–20:00`. O admin só escolhe, por carrinho, **quais** desses 6 ficam
   disponíveis (`CarrinhoTurno`). Não criar endpoint de CRUD de `Turno`.
3. **Limite de 2 por trinca `(carrinho, dia, turno)` NÃO é bloqueado pelo
   sistema** — é só uma meta que o admin persegue manualmente. O sistema
   apenas **sinaliza visualmente** grupos com mais de 2. Nunca implementar
   uma validação que impeça aprovar/adicionar a 3ª solicitação numa trinca.
4. **O único bloqueio automático do sistema inteiro** é a duplicidade: um
   mesmo publicador não pode ter duas solicitações para a mesma
   `(escala, carrinho, dia_semana, turno)` — vale tanto para envio normal
   quanto para adição manual do admin. Tudo mais é sinalização, não bloqueio.
5. **Sem cadastro/login para o publicador.** Identificação via token
   anônimo (GUID) gerado no frontend e salvo em `localStorage`, enviado no
   header `X-Publicador-Token`. Nome é um campo livre e editável.
6. **Janela de envio automática**, sem job/cron: calculada em tempo real a
   cada request a partir da data do servidor — dia do mês entre 15 e 25 →
   aberta, escala-alvo = mês seguinte; fora disso → fechada. Fora da
   janela, o **histórico do publicador continua sempre acessível** (não é
   afetado pela janela).
7. **Administrador não é limitado pela janela** — pode ver/aprovar/rejeitar/
   adicionar em qualquer escala (passada, atual, futura) a qualquer momento.
8. **Exclusão pelo publicador** (não existe "cancelar" nem status
   Cancelada): só pode excluir uma solicitação sua (Pendente ou Aprovada)
   **com a janela aberta e se ela for da escala do mês-alvo** — validado
   também no backend (`DELETE /api/solicitacoes/{id}`, apaga o registro).
   Fora da janela, a tela inicial mostra um aviso no lugar do botão
   "Solicitar Nova Escala" e a lista fica só leitura. O admin não exclui:
   ele pode reverter a decisão a qualquer momento (Aprovada ↔ Rejeitada).
   Recusas por janela fechada vêm com `codigo: "JANELA_FECHADA"` no
   ProblemDetails — o frontend decide por esse código, nunca por "qualquer 400".
9. **Adição manual do admin**: nasce direto como `APROVADA`. Publicador por
   nome livre — se o nome bater exatamente com um existente, reusa o
   registro; senão, cria um novo (pequenas diferenças de grafia podem
   gerar registros distintos — é uma consequência aceita, não um bug).
9a. **Carrinho** tem `Nome`, `Descricao` (opcional, exibida ao publicador
    abaixo do nome no wizard) e `Ativo`; o admin pode editar nome e
    descrição a qualquer momento.
10. **Remover turno de um carrinho / desativar carrinho**: nunca altera ou
    remove `Solicitacao` já existentes — só afeta novos envios a partir dali.
11. **Um único administrador**, sem múltiplos papéis/permissões — login
    simples usuário/senha via variáveis de ambiente, JWT curto.
12. **Sem notificações** (e-mail/push) de nenhum tipo.
13. **Contagem de apoio ao desempate**: em grupos excedentes (>2
    solicitações), mostrar ao lado de cada publicador quantas solicitações
    (pendentes+aprovadas, todas as trincas) ele já tem na mesma escala —
    é só informação de apoio, o sistema **nunca** decide ou sugere quem
    aprovar.

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
docker compose -f docker-compose.prod.yml up -d --build

# Backend (precisa de PostgreSQL acessível; config via appsettings/user-secrets/env)
cd backend/src/CartSchedule.Api && dotnet run     # migrations + seed dos turnos no startup; GET /health
dotnet build backend/CartSchedule.Api.slnx
dotnet ef migrations add <Nome> -o Infrastructure/Migrations   # rodar dentro de CartSchedule.Api

# Frontend
cd frontend && npm install
VITE_API_URL=http://localhost:5000 npm run dev -- --port 3000   # 3000 = origem CORS padrão da API
npm run build   # tsc -b && vite build
npm run lint    # oxlint
```

Não há projeto de testes (backend nem frontend) por enquanto — validar com
build/lint e rodando a aplicação.

## Armadilhas

- CORS da API libera só `Cors__FrontendOrigin` (padrão `http://localhost:3000`);
  o Vite serve em 5173 por padrão — use `--port 3000` ou ajuste a variável.
- `VITE_API_URL` é embutida no bundle **em build time**; mudar exige rebuild.
- `ADMIN_SENHA_HASH` (hash do `PasswordHasher` do ASP.NET) contém `$`: no
  `.env` do compose, escape cada `$` como `$$`.
- No container da API as variáveis viram `ConnectionStrings__Default`,
  `Admin__Usuario`, `Admin__SenhaHash`, `Jwt__ChaveSecreta`.

## Variáveis de ambiente sensíveis

`POSTGRES_PASSWORD`, `ADMIN_USUARIO`, `ADMIN_SENHA_HASH`,
`JWT_CHAVE_SECRETA` — sempre via `.env` (nunca commitado; ver
`.env.example`), nunca hardcoded em código ou `docker-compose.yml`.
