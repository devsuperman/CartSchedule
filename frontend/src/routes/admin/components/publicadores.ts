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
