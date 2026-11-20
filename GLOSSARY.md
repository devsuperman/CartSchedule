# Escala TPL

Organiza quem trabalha em cada carrinho, dia da semana e turno ao longo do mês.
Regras de negócio completas em `docs/PLANNING.md` (fonte da verdade).

## Pessoas e acesso

**Publicador**:
Uma pessoa cadastrada pelo administrador, com conta própria, que pode pedir vagas na escala.
_Avoid_: Usuário (para a pessoa), membro, voluntário

**Administrador**:
Um publicador marcado como administrador; também pode pedir vagas como qualquer publicador.
_Avoid_: Admin (na documentação de negócio), gestor

**Administrador de recuperação**:
Acesso de emergência configurado fora do sistema, usado só para criar o primeiro administrador ou recuperar o acesso; não é um publicador.
_Avoid_: Superusuário, root

**Usuário**:
O identificador único com que o publicador entra no sistema, escolhido pelo administrador (por padrão, o primeiro nome).
_Avoid_: Login, apelido

**Nome**:
Como o publicador aparece na escala; só o administrador altera.
_Avoid_: Nome de exibição, nome de usuário

**Senha**:
O segredo de 4 dígitos que, com o usuário, dá acesso à conta; gerada pelo sistema, redefinida pelo administrador e trocável pelo próprio publicador. No código continua `Pin` (identificadores, rotas, JSON, `PIN_FRACO`).
_Avoid_: PIN, código

**Excluir publicador**:
Apagar definitivamente o publicador e todos os seus pedidos, de todas as escalas; não há como desfazer.
_Avoid_: Remover, apagar

**Criança ou idoso**:
Marca que o administrador põe no publicador; quem a tem pode ser a 3ª pessoa de uma vaga sem excesso.
_Avoid_: Prioridade, especial
