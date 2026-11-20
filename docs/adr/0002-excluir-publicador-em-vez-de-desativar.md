# 0002 — Excluir publicador em vez de desativar

- **Status**: aceita (implantação em etapas: #61 traz a exclusão, #62 remove a marca **ativo** da ADR 0001; plano em #60)
- **Data**: 2026-11-20

O administrador passa a **excluir** o publicador que saiu, apagando definitivamente a conta
e todos os seus pedidos, de todas as escalas (passadas inclusive); a marca **ativo**, o
"Desativar/Reativar" e o "Mostrar desativados" deixam de existir. Preferimos uma lista de
publicadores limpa e uma regra a menos ("ativo" pesava em login, sessão, busca e adição
manual) ao histórico das escalas passadas, que não tem uso depois do mês. Um marcador de
"pessoa excluída" foi descartado por ser a mesma desativação com outro nome.

## Consequências

- Não há como desfazer: a exclusão abre uma confirmação com a prévia de quantos pedidos (e em
  quantas escalas) serão excluídos, como em "Unir publicadores".
- As escalas passadas e suas imagens de compartilhamento deixam de mostrar a pessoa; as vagas
  podem ficar incompletas (vermelhas).
- O administrador não exclui a própria conta; pode excluir outro administrador.
- Bloqueio temporário de acesso agora é **Redefinir PIN** (desconecta os aparelhos e mantém
  os pedidos).
- Na migração, quem estava desativado volta como conta **sem PIN** (não entra até o
  administrador definir um PIN) — nada é apagado sem a prévia do administrador.
