# 0001 — Publicadores com conta (usuário + PIN) em vez de token anônimo

- **Status**: aceita (implantação em etapas: #45 a #50, plano em #44); a marca **ativo** é substituída pela exclusão (ADR 0002, em etapas: #61, #62)
- **Data**: 2026-11-19

## Contexto

O publicador era identificado por um token anônimo (GUID) gerado pelo navegador e guardado
no `localStorage`, com o nome digitado livremente. Na prática:

- a mesma pessoa virava um publicador novo ao trocar de celular, limpar o navegador ou
  digitar o nome de outro jeito — e a marca **criança ou idoso**, posta pelo administrador,
  ficava presa ao registro antigo;
- nomes duplicados se acumulavam e o administrador perdia o controle de quem é quem;
- qualquer pessoa com o link do grupo podia pedir vagas em nome de outra;
- havia um único administrador, com credenciais fixas no servidor.

## Decisão

Cada **publicador** passa a ter uma conta criada pelo administrador (termos no
`GLOSSARY.md`):

- **Usuário** único, escolhido pelo administrador (por padrão, o primeiro nome), comparado
  **sem maiúsculas e sem acentos** ("maria" = "María") — guardado também na forma
  normalizada, com índice único.
- **PIN** de 4 dígitos, gerado pelo sistema (gerador criptográfico, nunca óbvio como 0000 ou
  1234), guardado só como hash (`PasswordHasher` do ASP.NET). O PIN em claro aparece uma única
  vez, na criação ou redefinição; o sistema nunca mostra o PIN atual.
- Marca **administrador** (pode haver vários, todos com os mesmos poderes), marca **ativo** e
  **versão de sessão** (incrementada para desconectar os aparelhos da pessoa).
- Um único `POST /api/login` atende os publicadores e o **administrador de recuperação** —
  as credenciais do servidor (`Admin:Usuario`/`Admin:SenhaHash`), mantidas só para criar o
  primeiro administrador ou recuperar o acesso; ele não é um publicador e não pede vagas.
- Os registros de publicador que já existem **viram as contas**: mesmo `id` e histórico,
  sem usuário/PIN até o administrador defini-los. Duplicados se resolvem unindo registros.
- Sessão: publicador fica logado 180 dias (renovados a cada uso); administrador e
  recuperação, 2 horas.

**Sem bloqueio de conta e PIN de 4 dígitos inclusive para administradores.** É um site
simples, de uma congregação, sem dado sensível além de nomes na escala; bloquear a conta
após erros deixaria a pessoa sem acesso até falar com o administrador, e um PIN maior ou uma
senha forte afastaria quem tem pouca familiaridade com tecnologia. A proteção contra
adivinhar o PIN é só o **rate limit de login por IP**, que já existia.

## Consequências

- A identidade segue a pessoa em qualquer aparelho, junto com o nome e a marca criança/idoso;
  o nome passa a ser alterado só pelo administrador.
- O administrador precisa distribuir usuário e PIN a todos (botão "Copiar mensagem" pronto
  para o WhatsApp) e redefinir o PIN de quem esquecer — não há "esqueci meu PIN" automático
  nem notificações.
- Na virada, ninguém pede nem exclui vagas até receber usuário e PIN; os pedidos existentes
  ficam intactos.
- Um atacante com muitos IPs poderia tentar os 10 000 PINs de um usuário; aceitamos o risco
  pelo baixo valor do que está protegido.
- Fica em aberto, como fase 2 opcional, o login por passkey (WebAuthn).
