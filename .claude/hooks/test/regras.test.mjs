// Testes da lógica dos hooks: node --test .claude/hooks/test/
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ehCodigoVigiado,
  violacoes,
  ehArquivoDeSegredo,
  motivoBloqueioGit,
  trechoNaoPermitidoParaRevisor,
  classificarAlterados,
} from "../lib/regras.mjs";

test("vigia só código de produção do backend e do frontend", () => {
  assert.ok(ehCodigoVigiado("backend/src/CartSchedule.Api/Domain/Enums/DiaSemana.cs"));
  assert.ok(ehCodigoVigiado("frontend/src/constants/diasSemana.ts"));
  assert.ok(ehCodigoVigiado("frontend/src/routes/admin/EscalaFinal.tsx"));
  assert.ok(!ehCodigoVigiado("frontend/src/routes/admin/EscalaFinal.test.tsx"));
  assert.ok(!ehCodigoVigiado("backend/tests/CartSchedule.Api.Tests/X.cs"));
  assert.ok(!ehCodigoVigiado("backend/src/CartSchedule.Api/Infrastructure/Migrations/2026_X.cs"));
  assert.ok(!ehCodigoVigiado("PLANNING.md"));
});

test("bloqueia Sábado/Domingo em código, com ou sem acento", () => {
  assert.equal(violacoes("    Sabado = 6,").length, 1);
  assert.equal(violacoes('  { valor: 7, rotulo: "Domingo" },').length, 1);
  assert.equal(violacoes('const d = "sábado";').length, 1);
});

test("bloqueia status de aprovação", () => {
  assert.equal(violacoes("public StatusSolicitacao Status { get; set; }").length, 1);
  assert.equal(violacoes('<Badge>Pendente</Badge>').length, 1);
  assert.equal(violacoes("if (s.Aprovada) {").length, 1);
});

test("aceita comentários, palavras parecidas e DayOfWeek em inglês", () => {
  assert.equal(violacoes("/// Nunca adicionar Sábado/Domingo (PLANNING.md regra 19).").length, 0);
  assert.equal(violacoes("/** só Segunda a Sexta, nunca Sábado/Domingo. */").length, 0);
  assert.equal(violacoes("var x = 1; // não existe Domingo").length, 0);
  assert.equal(violacoes("/// sempre disponível independentemente da janela").length, 0);
  assert.equal(violacoes("if (data.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday) continue;").length, 0);
  assert.equal(violacoes('const url = "http://exemplo/domingo";').length, 1, "// de URL não é comentário");
});

test("não bloqueia linha que já existia antes da edição", () => {
  const antigo = '  rotulo: "Domingo",\n  x: 1,';
  const novo = '  rotulo: "Domingo",\n  x: 2,';
  assert.equal(violacoes(novo, antigo).length, 0);
});

test("protege .env mas não o .env.example", () => {
  assert.ok(ehArquivoDeSegredo(".env"));
  assert.ok(ehArquivoDeSegredo("deploy/.env.prod"));
  assert.ok(ehArquivoDeSegredo("prod.env"));
  assert.ok(!ehArquivoDeSegredo(".env.example"));
  assert.ok(!ehArquivoDeSegredo("src/environment.ts"));
});

test("git push: bloqueia main, force e mirror", () => {
  assert.ok(motivoBloqueioGit("git push origin main"));
  assert.ok(motivoBloqueioGit("git push -u origin HEAD:main"));
  assert.ok(motivoBloqueioGit("git push origin feature:refs/heads/master"));
  assert.ok(motivoBloqueioGit("git push --force origin minha-branch"));
  assert.ok(motivoBloqueioGit("git push -uf origin minha-branch"));
  assert.ok(motivoBloqueioGit("git push origin +minha-branch"));
  assert.ok(motivoBloqueioGit("git push --mirror"));
  assert.ok(motivoBloqueioGit("git add . && git commit -m x && git push origin main"));
  assert.ok(motivoBloqueioGit("git push", "main"), "push sem destino estando na main");
  assert.ok(motivoBloqueioGit("git push origin HEAD", "main"));
});

test("git push: libera branch de trabalho e force-with-lease", () => {
  assert.equal(motivoBloqueioGit("git push -u origin claude/minha-branch"), null);
  assert.equal(motivoBloqueioGit("git push", "claude/minha-branch"), null);
  assert.equal(motivoBloqueioGit("git push --force-with-lease origin claude/x"), null);
  assert.equal(motivoBloqueioGit("git push origin main-nova-tela"), null);
  assert.equal(motivoBloqueioGit("git fetch origin main"), null);
});

test("revisor: só leitura, build e testes", () => {
  assert.equal(trechoNaoPermitidoParaRevisor("git diff origin/main...HEAD"), null);
  assert.equal(trechoNaoPermitidoParaRevisor("cd frontend && npm test 2>&1 | tail -50"), null);
  assert.equal(trechoNaoPermitidoParaRevisor("dotnet test --solution backend/CartSchedule.Api.slnx"), null);
  assert.equal(trechoNaoPermitidoParaRevisor("npx vitest related --run src/x.tsx >/dev/null"), null);
  assert.ok(trechoNaoPermitidoParaRevisor("git commit -m x"));
  assert.ok(trechoNaoPermitidoParaRevisor("git diff > patch.txt"));
  assert.ok(trechoNaoPermitidoParaRevisor("sed -i s/a/b/ x.cs"));
  assert.ok(trechoNaoPermitidoParaRevisor("rm -rf frontend"));
  assert.ok(trechoNaoPermitidoParaRevisor("find . -name '*.tmp' -delete"));
});

test("Stop: separa o que é frontend e backend", () => {
  const r = classificarAlterados(["frontend/src/App.tsx", "backend/src/X.cs", "PLANNING.md", ".claude/hooks/x.mjs"]);
  assert.deepEqual(r, { frontend: ["frontend/src/App.tsx"], backend: ["backend/src/X.cs"] });
});
