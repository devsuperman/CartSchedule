import { useEffect, useMemo, useState, type FormEvent } from "react";
import { apiFetch, ApiError } from "../../api/client";
import { CampoCriancaOuIdoso } from "./components/ModalEditarNome";
import { combinaComBusca, normalizar, type Publicador } from "./components/publicadores";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** Resposta de criar (ou de dar usuário a um registro antigo): o único momento em que a senha aparece. */
interface Credenciais {
  id: string;
  usuario: string;
  pin: string;
}

function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? "";
}

type Edicao = { modo: "criar" } | { modo: "editar"; publicador: Publicador };

/** Prévia e resultado de unir: GET/POST /api/admin/publicadores/{origem}/unir/{destino}. */
interface ResultadoDaUniao {
  pedidosMovidos: number;
  pedidosDescartados: number;
}

/** Prévia da exclusão: GET /api/admin/publicadores/{id}/exclusao. */
interface PreviaDaExclusao {
  pedidos: number;
  escalas: number;
}

/** "1 pedido passa" / "3 pedidos passam": a contagem com o verbo concordando. */
function rotuloPedidos(n: number, verboSingular: string, verboPlural: string): string {
  return n === 1 ? `1 pedido ${verboSingular}` : `${n} pedidos ${verboPlural}`;
}

/**
 * Tela "Publicadores" (/admin/publicadores — ADR 0001): lista com busca, criar conta (o usuário
 * começa como o primeiro nome) e editar nome, usuário, criança/idoso e administrador. Registros
 * antigos aparecem "Sem usuário"; dar um usuário a eles cria o acesso. Depois de criar ou
 * redefinir a senha, ela aparece uma única vez, com "Copiar mensagem" pronta para o WhatsApp.
 * Redefinir senha (com confirmação) desconecta todos os aparelhos da pessoa — é também o jeito de
 * bloquear o acesso por um tempo (ADR 0002); a lista mostra todos.
 * "Unir a outro registro" (issue #47) junta dois registros da mesma pessoa: os pedidos passam ao
 * registro escolhido, os que ele já tem na mesma vaga são descartados e o registro editado é
 * apagado — com prévia das contagens antes de confirmar.
 * "Excluir" (issue #61, ADR 0002) apaga a pessoa e todos os pedidos dela, de todas as escalas,
 * com prévia de quantos pedidos e em quantas escalas; não na própria conta.
 */
export default function Publicadores() {
  const [publicadores, setPublicadores] = useState<Publicador[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [edicao, setEdicao] = useState<Edicao | null>(null);
  const [acesso, setAcesso] = useState<{ nome: string; credenciais: Credenciais } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Publicador[]>("/api/admin/publicadores")
      .then(setPublicadores)
      .catch((err) => setErro(err instanceof ApiError ? err.message : "Não foi possível carregar os publicadores."));
  }, []);

  const visiveis = useMemo(() => {
    const termo = normalizar(busca);
    return (publicadores ?? []).filter((p) => combinaComBusca(p, termo));
  }, [publicadores, busca]);

  function aoSalvar(publicador: Publicador, credenciais: Credenciais | null) {
    setPublicadores((atuais) => {
      const lista = atuais ?? [];
      const existe = lista.some((p) => p.id === publicador.id);
      const nova = existe ? lista.map((p) => (p.id === publicador.id ? publicador : p)) : [...lista, publicador];
      return nova.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    });
    setEdicao(null);
    if (credenciais) setAcesso({ nome: publicador.nome, credenciais });
  }

  function aoUnir(origem: Publicador, destino: Publicador) {
    // A marca criança/idoso da origem passa ao destino (o backend nunca desmarca).
    setPublicadores((atuais) =>
      (atuais ?? [])
        .filter((p) => p.id !== origem.id)
        .map((p) => (p.id === destino.id ? { ...p, criancaOuIdoso: p.criancaOuIdoso || origem.criancaOuIdoso } : p)),
    );
    setEdicao(null);
    setAviso(`${origem.nome} foi unido a ${destino.nome}.`);
  }

  function aoExcluir(excluido: Publicador) {
    setPublicadores((atuais) => (atuais ?? []).filter((p) => p.id !== excluido.id));
    setEdicao(null);
    setAviso(`${excluido.nome} foi excluído.`);
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1>Publicadores</h1>
        <Button type="button" onClick={() => setEdicao({ modo: "criar" })}>
          Novo publicador
        </Button>
      </div>

      <Input
        type="search"
        aria-label="Buscar publicador"
        placeholder="Buscar por nome ou usuário"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
      />

      <p role="status" className={cn("text-[0.95rem] font-semibold text-success", !aviso && "sr-only")}>
        {aviso}
      </p>
      {erro && (
        <Alert variant="destructive">
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}
      {publicadores === null && !erro && <p className="text-muted-foreground">Carregando…</p>}
      {publicadores !== null && visiveis.length === 0 && (
        <p className="text-muted-foreground">Nenhum publicador encontrado.</p>
      )}

      <ul className="flex list-none flex-col gap-2 p-0">
        {visiveis.map((p) => (
          <li
            key={p.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3"
          >
            <div className="flex min-w-0 flex-col gap-1">
              <strong className="truncate">{p.nome}</strong>
              <span className="text-[0.95rem] text-muted-foreground">
                {p.usuario ?? <em>Sem usuário</em>}
              </span>
              {(p.administrador || p.criancaOuIdoso) && (
                <div className="flex flex-wrap gap-1.5">
                  {p.administrador && <Badge>Administrador</Badge>}
                  {p.criancaOuIdoso && <Badge variant="secondary">Criança ou idoso</Badge>}
                </div>
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              className="min-h-11 shrink-0"
              aria-label={`Editar ${p.nome}`}
              onClick={() => {
                setAviso(null);
                setEdicao({ modo: "editar", publicador: p });
              }}
            >
              Editar
            </Button>
          </li>
        ))}
      </ul>

      <Dialog open={edicao !== null} onOpenChange={(aberto) => !aberto && setEdicao(null)}>
        <DialogContent>
          {edicao && (
            <EdicaoPublicador
              key={edicao.modo === "editar" ? edicao.publicador.id : "novo"}
              edicao={edicao}
              todos={publicadores ?? []}
              onSalvo={aoSalvar}
              onUnido={aoUnir}
              onExcluido={aoExcluir}
            />
          )}
        </DialogContent>
      </Dialog>

      <DialogoAcesso acesso={acesso} onFechar={() => setAcesso(null)} />
    </section>
  );
}

/** O que o administrador digitou no formulário; fica aqui para não se perder ao abrir uma confirmação. */
interface Rascunho {
  nome: string;
  usuario: string;
  /** Na criação, o usuário acompanha o primeiro nome até o administrador mexer nele. */
  usuarioEditado: boolean;
  criancaOuIdoso: boolean;
  administrador: boolean;
}

function rascunhoInicial(original: Publicador | null): Rascunho {
  return {
    nome: original?.nome ?? "",
    usuario: original?.usuario ?? "",
    usuarioEditado: original !== null,
    criancaOuIdoso: original?.criancaOuIdoso ?? false,
    administrador: original?.administrador ?? false,
  };
}

/**
 * Formulário de criar/editar; na edição, também redefinir a senha, unir a outro registro e excluir
 * (cada um com confirmação).
 */
function EdicaoPublicador({
  edicao,
  todos,
  onSalvo,
  onUnido,
  onExcluido,
}: {
  edicao: Edicao;
  todos: Publicador[];
  onSalvo: (publicador: Publicador, credenciais: Credenciais | null) => void;
  onUnido: (origem: Publicador, destino: Publicador) => void;
  onExcluido: (publicador: Publicador) => void;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const [unindo, setUnindo] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [rascunho, setRascunho] = useState(() =>
    rascunhoInicial(edicao.modo === "editar" ? edicao.publicador : null),
  );

  if (edicao.modo === "editar" && unindo) {
    return (
      <UnirPublicador
        origem={edicao.publicador}
        candidatos={todos.filter((p) => p.id !== edicao.publicador.id)}
        onVoltar={() => setUnindo(false)}
        onUnido={onUnido}
      />
    );
  }

  if (edicao.modo === "editar" && excluindo) {
    return (
      <ExcluirPublicador
        publicador={edicao.publicador}
        onVoltar={() => setExcluindo(false)}
        onExcluido={onExcluido}
      />
    );
  }

  if (edicao.modo === "editar" && confirmando) {
    return (
      <ConfirmarRedefinirPin
        publicador={edicao.publicador}
        onVoltar={() => setConfirmando(false)}
        onFeito={onSalvo}
      />
    );
  }

  return (
    <>
      <FormularioPublicador
        edicao={edicao}
        rascunho={rascunho}
        onMudar={(mudanca) => setRascunho((atual) => ({ ...atual, ...mudanca }))}
        onSalvo={onSalvo}
      />
      {edicao.modo === "editar" && (
        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          {edicao.publicador.usuario !== null && (
            <Button type="button" variant="outline" onClick={() => setConfirmando(true)}>
              Redefinir senha
            </Button>
          )}
          {/* Unir apaga o registro editado: não na própria conta, que ficaria sem acesso. */}
          {!edicao.publicador.ehVoce && (
            <Button type="button" variant="outline" onClick={() => setUnindo(true)}>
              Unir a outro registro
            </Button>
          )}
          {/* Excluir apaga a conta: não na própria, que ficaria sem acesso. */}
          {!edicao.publicador.ehVoce && (
            <Button type="button" variant="destructive" onClick={() => setExcluindo(true)}>
              Excluir
            </Button>
          )}
        </div>
      )}
    </>
  );
}

function ConfirmarRedefinirPin({
  publicador,
  onVoltar,
  onFeito,
}: {
  publicador: Publicador;
  onVoltar: () => void;
  onFeito: (publicador: Publicador, credenciais: Credenciais | null) => void;
}) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function confirmar() {
    setEnviando(true);
    setErro(null);
    try {
      const credenciais = await apiFetch<Credenciais>(`/api/admin/publicadores/${publicador.id}/pin`, {
        method: "POST",
      });
      onFeito({ ...publicador, temPin: true }, credenciais);
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Não foi possível concluir.");
      setEnviando(false);
    }
  }

  return (
    <div className="grid gap-4">
      <DialogHeader>
        <DialogTitle>Redefinir a senha de {publicador.nome}?</DialogTitle>
        <DialogDescription>
          Uma senha nova será gerada e mostrada uma única vez. Isso desconecta a pessoa de todos os aparelhos: ela
          precisará entrar com a senha nova.
        </DialogDescription>
      </DialogHeader>
      {erro && (
        <Alert variant="destructive">
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onVoltar} disabled={enviando}>
          Voltar
        </Button>
        <Button type="button" onClick={confirmar} disabled={enviando}>
          {enviando ? "Aguarde…" : "Redefinir senha"}
        </Button>
      </DialogFooter>
    </div>
  );
}

/**
 * "Unir B em A": B é o registro editado (origem, será apagado); A é escolhido aqui (destino,
 * fica). Ao escolher A, busca a prévia — quantos pedidos passam e quantos são descartados.
 */
function UnirPublicador({
  origem,
  candidatos,
  onVoltar,
  onUnido,
}: {
  origem: Publicador;
  candidatos: Publicador[];
  onVoltar: () => void;
  onUnido: (origem: Publicador, destino: Publicador) => void;
}) {
  const [busca, setBusca] = useState("");
  const [destino, setDestino] = useState<Publicador | null>(null);
  const [previa, setPrevia] = useState<ResultadoDaUniao | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const rota = destino && `/api/admin/publicadores/${origem.id}/unir/${destino.id}`;

  useEffect(() => {
    if (!rota) return;
    // Trocar de destino rápido dispara prévias sobrepostas: só a do destino atual vale.
    let atual = true;
    apiFetch<ResultadoDaUniao>(rota)
      .then((resultado) => atual && setPrevia(resultado))
      .catch(
        (err) => atual && setErro(err instanceof ApiError ? err.message : "Não foi possível calcular a prévia."),
      );
    return () => {
      atual = false;
    };
  }, [rota]);

  const termo = normalizar(busca);
  // O escolhido continua visível mesmo que a busca mude depois.
  const visiveis = candidatos.filter((p) => p.id === destino?.id || combinaComBusca(p, termo));

  function escolher(publicador: Publicador) {
    setDestino(publicador);
    setPrevia(null);
    setErro(null);
  }

  async function confirmar() {
    if (!destino || !rota) return;
    setEnviando(true);
    setErro(null);
    try {
      await apiFetch<ResultadoDaUniao>(rota, { method: "POST" });
      onUnido(origem, destino);
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Não foi possível unir.");
      setEnviando(false);
    }
  }

  return (
    <div className="grid gap-4">
      <DialogHeader>
        <DialogTitle>Unir {origem.nome} a outro registro</DialogTitle>
        <DialogDescription>
          Escolha o registro que fica. Os pedidos de {origem.nome} passam para ele e {origem.nome} é apagado.
        </DialogDescription>
      </DialogHeader>
      <Input
        type="search"
        aria-label="Buscar registro que fica"
        placeholder="Buscar por nome ou usuário"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
      />
      <fieldset className="flex max-h-64 flex-col gap-1 overflow-y-auto border-0 p-0">
        <legend className="sr-only">Registro que fica</legend>
        {visiveis.length === 0 && <p className="text-muted-foreground">Nenhum publicador encontrado.</p>}
        {visiveis.map((p) => (
          <Label
            key={p.id}
            className="min-h-11 rounded-md border border-border px-3 py-2 font-normal has-[:checked]:border-primary"
          >
            <input
              type="radio"
              name="destino"
              className="size-4"
              checked={destino?.id === p.id}
              onChange={() => escolher(p)}
            />
            <span className="flex flex-col">
              <span>{p.nome}</span>
              <span className="text-[0.9rem] text-muted-foreground">{p.usuario ?? "Sem usuário"}</span>
            </span>
          </Label>
        ))}
      </fieldset>
      {destino && previa && (
        <div className="grid gap-1 rounded-md bg-muted px-3 py-2">
          <p>
            {previa.pedidosMovidos === 0
              ? `Nenhum pedido para passar a ${destino.nome}.`
              : `${rotuloPedidos(previa.pedidosMovidos, "passa", "passam")} para ${destino.nome}.`}
          </p>
          {previa.pedidosDescartados > 0 && (
            <p>
              {rotuloPedidos(previa.pedidosDescartados, "será descartado", "serão descartados")}: {destino.nome}{" "}
              já tem a mesma vaga.
            </p>
          )}
          <p>
            {origem.nome} será apagado. Nome, usuário e senha de {destino.nome} continuam os mesmos
            {origem.usuario !== null && ` — o usuário ${origem.usuario} deixa de entrar`}.
          </p>
        </div>
      )}
      {erro && (
        <Alert variant="destructive">
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onVoltar} disabled={enviando}>
          Voltar
        </Button>
        <Button type="button" variant="destructive" onClick={confirmar} disabled={!previa || enviando}>
          {enviando ? "Aguarde…" : "Unir"}
        </Button>
      </DialogFooter>
    </div>
  );
}

/** "3 pedidos em 2 escalas" / "1 pedido em 1 escala". */
function rotuloDaPrevia({ pedidos, escalas }: PreviaDaExclusao): string {
  return `${pedidos === 1 ? "1 pedido" : `${pedidos} pedidos`} em ${escalas === 1 ? "1 escala" : `${escalas} escalas`}`;
}

/**
 * Confirmação de "Excluir": busca a prévia (quantos pedidos, em quantas escalas) e, ao
 * confirmar, apaga a pessoa e todos os pedidos dela, de todas as escalas — sem desfazer.
 */
function ExcluirPublicador({
  publicador,
  onVoltar,
  onExcluido,
}: {
  publicador: Publicador;
  onVoltar: () => void;
  onExcluido: (publicador: Publicador) => void;
}) {
  const [previa, setPrevia] = useState<PreviaDaExclusao | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let atual = true;
    apiFetch<PreviaDaExclusao>(`/api/admin/publicadores/${publicador.id}/exclusao`)
      .then((resultado) => atual && setPrevia(resultado))
      .catch(
        (err) => atual && setErro(err instanceof ApiError ? err.message : "Não foi possível calcular a prévia."),
      );
    return () => {
      atual = false;
    };
  }, [publicador.id]);

  async function confirmar() {
    setEnviando(true);
    setErro(null);
    try {
      await apiFetch<void>(`/api/admin/publicadores/${publicador.id}`, { method: "DELETE" });
      onExcluido(publicador);
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Não foi possível excluir.");
      setEnviando(false);
    }
  }

  return (
    <div className="grid gap-4">
      <DialogHeader>
        <DialogTitle>Excluir {publicador.nome}?</DialogTitle>
        <DialogDescription>
          A conta e todos os pedidos de {publicador.nome}, de todas as escalas, serão excluídos. Não dá para
          desfazer.
        </DialogDescription>
      </DialogHeader>
      {previa && (
        <p className="rounded-md bg-muted px-3 py-2">
          {previa.pedidos === 0
            ? `${publicador.nome} não tem pedidos.`
            : `${publicador.nome} tem ${rotuloDaPrevia(previa)}. ${previa.pedidos === 1 ? "Ele será excluído" : "Eles serão excluídos"} junto com a conta.`}
        </p>
      )}
      {erro && (
        <Alert variant="destructive">
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onVoltar} disabled={enviando}>
          Voltar
        </Button>
        <Button type="button" variant="destructive" onClick={confirmar} disabled={!previa || enviando}>
          {enviando ? "Aguarde…" : "Excluir"}
        </Button>
      </DialogFooter>
    </div>
  );
}

function FormularioPublicador({
  edicao,
  rascunho,
  onMudar,
  onSalvo,
}: {
  edicao: Edicao;
  rascunho: Rascunho;
  onMudar: (mudanca: Partial<Rascunho>) => void;
  onSalvo: (publicador: Publicador, credenciais: Credenciais | null) => void;
}) {
  const original = edicao.modo === "editar" ? edicao.publicador : null;
  const { nome, usuario, usuarioEditado, criancaOuIdoso, administrador } = rascunho;
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const usuarioLimpo = usuario.trim();
  // Registro antigo pode continuar sem usuário; quem já tem (ou está sendo criado) precisa de um.
  const usuarioObrigatorio = original === null || original.usuario !== null;
  const valido = nome.trim() !== "" && (!usuarioObrigatorio || usuarioLimpo !== "") && !/\s/.test(usuarioLimpo);

  function mudarNome(valor: string) {
    onMudar(usuarioEditado ? { nome: valor } : { nome: valor, usuario: primeiroNome(valor) });
  }

  async function salvar(evento: FormEvent) {
    evento.preventDefault();
    if (!valido) return;
    setSalvando(true);
    setErro(null);
    const corpo = {
      nome: nome.trim(),
      ...(usuarioLimpo !== "" && { usuario: usuarioLimpo }),
      criancaOuIdoso,
      administrador,
    };
    try {
      const resposta = await apiFetch<Credenciais | undefined>(
        original ? `/api/admin/publicadores/${original.id}` : "/api/admin/publicadores",
        { method: original ? "PUT" : "POST", body: JSON.stringify(corpo) },
      );
      const credenciais = resposta?.pin ? resposta : null;
      onSalvo(
        {
          id: original?.id ?? resposta!.id,
          nome: corpo.nome,
          usuario: usuarioLimpo || null,
          criancaOuIdoso,
          administrador,
          temPin: (original?.temPin ?? false) || credenciais !== null,
          ehVoce: original?.ehVoce ?? false,
        },
        credenciais,
      );
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form className="grid gap-4" onSubmit={salvar}>
      <DialogHeader>
        <DialogTitle>{original ? "Editar publicador" : "Novo publicador"}</DialogTitle>
        <DialogDescription>
          {original
            ? "Nome e criança/idoso valem para todos os pedidos desta pessoa."
            : "A senha é gerada pelo sistema e aparece uma única vez."}
        </DialogDescription>
      </DialogHeader>
      <Label className="flex flex-col items-start gap-1.5">
        Nome
        <Input value={nome} onChange={(e) => mudarNome(e.target.value)} maxLength={200} autoFocus required />
      </Label>
      <div className="flex flex-col gap-1.5">
        <Label className="flex flex-col items-start gap-1.5">
          Usuário
          <Input
            value={usuario}
            onChange={(e) => onMudar({ usuarioEditado: true, usuario: e.target.value })}
            maxLength={50}
            autoCapitalize="none"
            autoCorrect="off"
            required={usuarioObrigatorio}
            aria-describedby="usuario-dica"
          />
        </Label>
        <span id="usuario-dica" className="text-[0.9rem] text-muted-foreground">
          {original && original.usuario === null
            ? "Ainda sem usuário: preencha para criar o acesso (a senha é gerada)."
            : "Uma palavra, sem espaços. Maiúsculas e acentos não contam."}
        </span>
      </div>
      <CampoCriancaOuIdoso marcado={criancaOuIdoso} onMudar={(valor) => onMudar({ criancaOuIdoso: valor })} />
      <div className="flex flex-col gap-1.5">
        <Label className="min-h-11 font-normal">
          <Checkbox
            checked={administrador}
            disabled={original?.ehVoce}
            onCheckedChange={(valor) => onMudar({ administrador: valor === true })}
          />
          Administrador (entra na área administrativa)
        </Label>
        {original?.ehVoce && (
          <span className="text-[0.9rem] text-muted-foreground">
            Você não pode tirar o próprio administrador. Peça a outro administrador.
          </span>
        )}
      </div>
      {erro && (
        <Alert variant="destructive">
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline" disabled={salvando}>
            Cancelar
          </Button>
        </DialogClose>
        <Button type="submit" disabled={!valido || salvando}>
          {salvando ? "Salvando…" : original ? "Salvar" : "Criar"}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Mensagem pronta para o WhatsApp: link do site, usuário e senha. */
function mensagemDeAcesso(nome: string, { usuario, pin }: Credenciais): string {
  return [
    `Olá, ${primeiroNome(nome)}! Este é o seu acesso à Escala TPL:`,
    window.location.origin,
    `Usuário: ${usuario}`,
    `Senha: ${pin}`,
  ].join("\n");
}

function DialogoAcesso({
  acesso,
  onFechar,
}: {
  acesso: { nome: string; credenciais: Credenciais } | null;
  onFechar: () => void;
}) {
  const [copiado, setCopiado] = useState<"sim" | "falhou" | null>(null);

  async function copiar() {
    if (!acesso) return;
    try {
      await navigator.clipboard.writeText(mensagemDeAcesso(acesso.nome, acesso.credenciais));
      setCopiado("sim");
    } catch {
      setCopiado("falhou");
    }
  }

  return (
    <Dialog
      open={acesso !== null}
      onOpenChange={(aberto) => {
        if (!aberto) {
          setCopiado(null);
          onFechar();
        }
      }}
    >
      <DialogContent>
        {acesso && (
          <div className="grid gap-4">
            <DialogHeader>
              <DialogTitle>Acesso de {acesso.nome}</DialogTitle>
              <DialogDescription>Envie agora: a senha não será mostrada de novo.</DialogDescription>
            </DialogHeader>
            <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-2">
              <dt className="text-muted-foreground">Usuário</dt>
              <dd className="text-[1.1rem] font-bold">{acesso.credenciais.usuario}</dd>
              <dt className="text-muted-foreground">Senha</dt>
              <dd className="font-mono text-[1.6rem] font-bold tracking-[0.3em]">{acesso.credenciais.pin}</dd>
            </dl>
            {copiado === "falhou" && (
              <Alert variant="destructive">
                <AlertDescription>Não foi possível copiar. Anote o usuário e a senha acima.</AlertDescription>
              </Alert>
            )}
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Pronto
                </Button>
              </DialogClose>
              <Button type="button" onClick={copiar}>
                {copiado === "sim" ? "Mensagem copiada" : "Copiar mensagem"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
