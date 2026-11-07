---
name: feature
description: Fluxo completo de uma issue ou pedido do CartSchedule — análise (subagente analista-requisitos) → aprovação do usuário → implementação com testes → revisão (subagente revisor-regras + segurança) → PR. Use quando o usuário digitar /feature, pedir para analisar ou implementar uma issue (#N), ou quando a GitHub Action for acionada por @claude / label aprovado numa issue.
argument-hint: "<#issue | descrição do pedido> [implementar]"
---

# /feature — da issue ao PR

Pedido: `$ARGUMENTS`

O fluxo tem **duas fases separadas por uma aprovação humana**. Nunca escreva código na
Fase 1, e nunca pule a Fase 1 sem uma análise aprovada.

```
Fase 1: contexto → analista-requisitos → relatório ao usuário → PARA
                                  (usuário responde / diz "implementar")
Fase 2: implementar + testes → revisor-regras (+ segurança) → corrigir → PR
```

## 0. Contexto e fase

1. **Pedido**: se veio `#N` ou um link de issue, leia a issue inteira, com os
   comentários (na sessão local, pela ferramenta do GitHub `issue_read`; na GitHub Action,
   o contexto da issue já vem no prompt). Se veio texto livre, ele é o pedido.
2. **Fase**:
   - **Fase 2** se: `$ARGUMENTS` ou o comentário que te acionou contém "implementar"; ou a
     issue tem o label `aprovado`; ou o usuário aprovou a análise nesta conversa.
   - Senão, **Fase 1**.
   - Fase 2 sem análise anterior (nem na conversa, nem nos comentários da issue)? Rode a
     Fase 1 primeiro e pare. O label/"implementar" autoriza implementar **uma análise
     que já existe**, não substitui a análise.

## Fase 1 — Análise (não altera nada)

1. Chame o subagente **`analista-requisitos`** passando o título, o corpo e os comentários
   relevantes da issue (ou o pedido em texto). Ele lê o `PLANNING.md`, o
   `TECHNICAL_SPEC.md` e o código, e devolve: entendimento, conflitos, perguntas,
   critérios de aceite (CA1, CA2…), onde mexer e plano de testes.
2. Confira o relatório: se ele contraria o `PLANNING.md` sem marcar conflito, corrija
   antes de mostrar.
3. Entregue o relatório:
   - **GitHub Action**: é o seu comentário na issue. Termine com:
     `Responda as perguntas e comente "@claude implementar" (ou aplique o label aprovado) para eu implementar.`
   - **Sessão local**: mostre o relatório e pergunte se pode implementar (e as perguntas
     em aberto). **Encerre o turno** e espere a resposta.
4. **Pare aqui.** Nada de branch, commit ou edição nesta fase.

## Fase 2 — Implementação

### 2.1 Preparar
- Junte a análise aprovada e as respostas do usuário às perguntas: os **critérios de
  aceite finais** são a base de tudo. Se uma resposta mudou um CA, use a versão nova.
- Leia o `.claude/CLAUDE.md` (regras, testes, convenções) e as partes do `PLANNING.md`
  e do `TECHNICAL_SPEC.md` que a análise apontou.
- Branch: na sessão local, use a branch indicada para a sessão; se não houver, crie
  `feature/<N>-<slug-curto>` a partir da `main` atualizada. Na Action, a Action cuida da
  branch.

### 2.2 Implementar
- Siga a arquitetura do `CLAUDE.md`: vertical slice em `Features/<Área>/<Slice>/`, tela em
  `routes/<área>/<Tela>.tsx`, só a sua linha em `Program.cs` / `App.tsx`.
- **Testes junto com o código**, um ou mais por CA (`ApiTestBase` no backend,
  `*.test.tsx` no frontend), incluindo os casos de recusa.
- Regra de negócio mudou? Atualize o `PLANNING.md` (e o resumo no `.claude/CLAUDE.md`, se
  for uma regra crítica) no mesmo PR.
- Os hooks vão bloquear termos proibidos e rodar lint/build/testes relacionados. Se um
  hook bloquear uma regra de negócio, **não contorne**: volte ao usuário.

### 2.3 Revisar
1. Chame o subagente **`revisor-regras`** passando os critérios de aceite finais e as
   respostas do usuário. Ele roda os testes e devolve um veredito.
2. **Segurança**: se o diff toca autenticação/JWT, `X-Publicador-Token`, endpoints novos ou
   alterados, entrada do usuário, rate limiting, `Infrastructure/` ou deploy:
   - se a skill `security-review` estiver disponível, invoque-a;
   - senão, confira você mesmo: rotas `/api/admin/*` exigem o JWT do admin; o publicador
     só lê/exclui o que é dele (pelo token); entrada validada no `Validator.cs`; nada de
     SQL montado com string; nenhum segredo em código, log ou resposta de erro.
3. `MUDANÇAS NECESSÁRIAS` ou achado de segurança → corrija e chame o revisor de novo.
   **No máximo 2 rodadas**; se ainda falhar, pare e explique ao usuário o que sobrou.
   `APROVADO COM RESSALVAS` → corrija o que for barato, e liste o resto no PR.

### 2.4 PR
- Commits claros (com o ID da tarefa do `TASKS.md`, se houver).
- Push da branch e PR com:
  - `Closes #N`;
  - os critérios de aceite como checklist, cada um com o teste que o cobre;
  - o veredito do revisor e o que foi rodado (✅/‼️/⏭️ — nunca diga que passou sem rodar);
  - perguntas que ficaram para o usuário, se houver.
- **GitHub Action**: ela faz o push e publica o link para criar o PR — use esse texto
  como corpo do PR no seu comentário final.

## Resposta final ao usuário
Curta: o que foi feito, o link do PR (ou o link de criação, na Action), o veredito do
revisor e qualquer pendência que precise de decisão.
