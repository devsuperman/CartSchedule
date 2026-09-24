# CartSchedule

Sistema web para organizar o uso de carrinhos de trabalho ao longo do mês.

**Publicadores** solicitam `(carrinho, dia da semana, turno)` em que querem
trabalhar; um **administrador** aprova/rejeita os pedidos e monta a escala
mensal final (meta de no máximo 2 pessoas por combinação).

## Projeto AI Native

Este é um projeto **AI Native**: foi especificado e implementado com agentes
de IA ([Claude Code](https://claude.com/claude-code)) desde o primeiro
commit, não com IA como ajuda pontual.

- **Especificação como contrato para agentes**: [`PLANNING.md`](./PLANNING.md)
  (regras de negócio), [`TECHNICAL_SPEC.md`](./TECHNICAL_SPEC.md)
  (arquitetura) e [`TASKS.md`](./TASKS.md) (tarefas) são a fonte da verdade
  que os agentes leem antes de implementar.
- **Tarefas pensadas para execução paralela**: cada fase é quebrada em
  tarefas com arquivos próprios (Vertical Slices no backend, uma tela por
  arquivo no frontend), para vários agentes trabalharem ao mesmo tempo sem
  conflito. Cada commit leva o ID da tarefa.
- **Contexto operacional versionado**: [`.claude/CLAUDE.md`](./.claude/CLAUDE.md)
  resume stack, convenções e as regras que não podem ser quebradas.
- **Testes automatizados como verificação**: toda mudança de regra ou de tela
  vem com testes (integração na API, componentes no frontend), em vez de
  depender de conferência manual.

## Como funciona

- **Publicador** (`/`): sem cadastro nem senha. Um token anônimo (GUID) é
  gerado no navegador, salvo em `localStorage` e enviado no header
  `X-Publicador-Token`. Escolhe nome, carrinho, dia e turno, e acompanha o
  status (Pendente, Aprovada, Rejeitada) no histórico, ordenado por dia da
  semana, turno e carrinho. Com a janela aberta, pode excluir pedidos seus da escala do
  mês-alvo.
- **Administrador** (`/admin`): login único (usuário/senha via variáveis de
  ambiente, JWT curto). Configura carrinhos e seus turnos por dia da semana, revisa as
  solicitações agrupadas por `(carrinho, dia, turno)`, aprova/rejeita,
  adiciona solicitações manualmente (nascem já aprovadas) e vê a escala
  final (grade Carrinho × Dia × Turno).

### Regras que definem o sistema

- **Só Segunda a Sexta.** A escolha de dia é recorrente (vale para todas as
  ocorrências daquele dia no mês).
- **6 turnos fixos**, não cadastráveis: 06–08, 08–10, 10–12, 14–16, 16–18,
  18–20. O admin só escolhe quais deles cada carrinho oferece em cada dia
  da semana.
- **Janela de envio automática**, sem cron: do dia 15 ao dia 25 do mês, o
  publicador envia para a escala do mês seguinte. Fora disso, o envio fica
  fechado, mas o histórico continua acessível. O admin não é limitado pela
  janela.
- **O limite de 2 por trinca não é bloqueado**, apenas sinalizado
  visualmente. O critério de desempate é do admin; o sistema mostra só uma
  contagem de apoio (quantas solicitações cada publicador já tem na escala).
- **O único bloqueio automático é a duplicidade**: o mesmo publicador não
  pode ter duas solicitações para a mesma `(escala, carrinho, dia, turno)`.
- Sem notificações (e-mail/push) e sem múltiplos administradores.

A fonte da verdade das regras é o [`PLANNING.md`](./PLANNING.md).

## Stack

| Camada | Tecnologia |
|---|---|
| Backend | .NET 10, Minimal API, Vertical Slices, EF Core + Npgsql, FluentValidation |
| Frontend | React 19, TypeScript, Vite, React Router |
| Banco | PostgreSQL (migrations aplicadas automaticamente na subida da API) |

## Estrutura do repositório

```
backend/src/CartSchedule.Api/
  Domain/            entidades e enums
  Infrastructure/    AppDbContext, Migrations, Auth (JWT)
  Shared/            JanelaDeEnvio, EscalaHelpers
  Features/
    Publicadores/    ConsultarJanela, ListarCarrinhosDisponiveis,
                     CriarSolicitacao, ListarHistorico, ExcluirSolicitacao
    Administradores/ Login, GerenciarCarrinhos, GerenciarTurnosDoCarrinho,
                     RevisarEscala/*, ObterEscalaFinal
  Program.cs
frontend/src/
  api/  routes/publicador/  routes/admin/  hooks/  constants/  components/
```

Cada caso de uso do backend é uma pasta em `Features/` com `Endpoint.cs`,
`Request.cs`, `Response.cs` e `Validator.cs`.

## Configuração

Copie `.env.example` para `.env` (nunca commite o `.env`) e preencha:

| Variável | Descrição |
|---|---|
| `POSTGRES_PASSWORD` | Senha do PostgreSQL |
| `ADMIN_USUARIO` | Usuário do administrador |
| `ADMIN_SENHA_HASH` | Hash da senha, gerado pelo `PasswordHasher` do ASP.NET Core (nunca a senha em texto puro) |
| `JWT_CHAVE_SECRETA` | Chave usada para assinar o JWT do admin |

Na API, elas correspondem a `ConnectionStrings__Default`, `Admin__Usuario`,
`Admin__SenhaHash` e `Jwt__ChaveSecreta`. A origem liberada no CORS é
`Cors__FrontendOrigin` (padrão `http://localhost:3000`).

## Executando em desenvolvimento

Pré-requisitos: .NET 10 SDK, Node.js e um PostgreSQL acessível.

**Backend**

```bash
cd backend/src/CartSchedule.Api
# ajuste ConnectionStrings:Default, Admin:* e Jwt:ChaveSecreta
# (appsettings.json, user-secrets ou variáveis de ambiente)
dotnet run
```

As migrations (incluindo o seed dos 6 turnos) são aplicadas no startup.
Health check em `GET /health`.

**Frontend**

```bash
cd frontend
npm install
VITE_API_URL=http://localhost:<porta-da-api> npm run dev
```

Outros scripts: `npm run build`, `npm run lint`, `npm run preview`.

> O CORS da API libera por padrão `http://localhost:3000`, mas o Vite
> serve em `5173`. Rode o Vite com `--port 3000` ou defina
> `Cors__FrontendOrigin=http://localhost:5173` na API.

## Docker

```bash
cp .env.example .env   # preencha os valores
docker compose up --build
```

| Serviço | URL | Observação |
|---|---|---|
| `web` (nginx) | http://localhost:3000 | Publicador em `/`, admin em `/admin` |
| `api` | http://localhost:5000 | `GET /health` |
| `db` (PostgreSQL 16) | localhost:5432 | Dados no volume `db-data` |

- A API espera o banco ficar saudável e aplica as migrations sozinha.
- `ADMIN_SENHA_HASH` contém `$`; no `.env` do compose, escape cada `$` como
  `$$`.
- `VITE_API_URL` é embutida no bundle **em tempo de build** (build arg em
  `docker-compose.yml`) e deve ser a URL da API acessível pelo navegador. Se
  mudar o host/porta, ajuste-a e também `Cors__FrontendOrigin`, e rode
  `docker compose up --build`.

## Produção (AWS)

Deploy em servidor único (AWS Lightsail) com HTTPS automático via Caddy,
usando `docker-compose.prod.yml`. Passo a passo em
[`deploy/README.md`](./deploy/README.md).

## Status

Implementados (Fases 0, 1 e 2): fundação, fluxo do publicador, painel do
administrador e escala final. Docker (Fase 4) configurado. Pendentes: smoke test
end-to-end e exportação da escala (backlog).

## Documentação

| Documento | Conteúdo |
|---|---|
| [`PLANNING.md`](./PLANNING.md) | Regras de negócio, fluxos, estados e modelo de dados (fonte da verdade) |
| [`TECHNICAL_SPEC.md`](./TECHNICAL_SPEC.md) | Arquitetura, endpoints, banco e Docker |
| [`TASKS.md`](./TASKS.md) | Quebra de tarefas para execução paralela por agentes |
| [`.claude/CLAUDE.md`](./.claude/CLAUDE.md) | Resumo operacional para agentes |

Commits seguem o ID da tarefa do `TASKS.md` (ex.: `F1-BE-03: cria slice
CriarSolicitacao`).
