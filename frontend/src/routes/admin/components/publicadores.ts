/** Item de GET /api/admin/publicadores. O PIN nunca vem, só se a conta já tem um. */
export interface Publicador {
  id: string;
  nome: string;
  usuario: string | null;
  criancaOuIdoso: boolean;
  administrador: boolean;
  ativo: boolean;
  temPin: boolean;
  /** O administrador logado: a tela não oferece desativar nem tirar o próprio administrador. */
  ehVoce: boolean;
}

/** Resposta de criar (ou de dar usuário a um registro antigo): o único momento em que o PIN aparece. */
export interface Credenciais {
  id: string;
  usuario: string;
  pin: string;
}

/** Sem maiúsculas e sem acentos, como o backend compara usuários ("jose" acha "José"). */
export function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
}

/** Busca por nome ou usuário; `termo` já normalizado (vazio = todos). */
export function combinaComBusca(publicador: Pick<Publicador, "nome" | "usuario">, termo: string): boolean {
  return (
    !termo ||
    normalizar(publicador.nome).includes(termo) ||
    (publicador.usuario !== null && normalizar(publicador.usuario).includes(termo))
  );
}

export function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? "";
}

/** Mensagem pronta para o WhatsApp: link do site, usuário e PIN. */
export function mensagemDeAcesso(nome: string, { usuario, pin }: Credenciais): string {
  return [
    `Olá, ${primeiroNome(nome)}! Este é o seu acesso à Escala TPL:`,
    window.location.origin,
    `Usuário: ${usuario}`,
    `PIN: ${pin}`,
  ].join("\n");
}
