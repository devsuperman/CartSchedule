import { useEffect, useMemo, useState, type FormEvent } from "react";
import { apiFetch, ApiError } from "../../api/client";
import { CampoCriancaOuIdoso } from "./components/ModalEditarNome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** Item de GET /api/admin/publicadores. O PIN nunca vem, só se a conta já tem um. */
interface Publicador {
  id: string;
  nome: string;
  usuario: string | null;
  criancaOuIdoso: boolean;
  administrador: boolean;
  ativo: boolean;
  temPin: boolean;
}

/** Resposta de criar (ou de dar usuário a um registro antigo): o único momento em que o PIN aparece. */
interface Credenciais {
  id: string;
  usuario: string;
  pin: string;
}

/** Sem maiúsculas e sem acentos, como o backend compara usuários ("jose" acha "José"). */
function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
}

function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? "";
}

type Edicao = { modo: "criar" } | { modo: "editar"; publicador: Publicador };

/**
 * Tela "Publicadores" (/admin/publicadores — ADR 0001): lista com busca, criar conta (o usuário
 * começa como o primeiro nome) e editar nome, usuário, criança/idoso e administrador. Registros
 * antigos aparecem "Sem usuário"; dar um usuário a eles cria o acesso. Depois de criar ou
 * redefinir o PIN, ele aparece uma única vez, com "Copiar mensagem" pronta para o WhatsApp.
 * Redefinir PIN e desativar (com confirmação) desconectam todos os aparelhos da pessoa;
 * desativados somem da lista, a menos que "Mostrar desativados" esteja marcado.
 */
export default function Publicadores() {
  const [publicadores, setPublicadores] = useState<Publicador[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [edicao, setEdicao] = useState<Edicao | null>(null);
  const [acesso, setAcesso] = useState<{ nome: string; credenciais: Credenciais } | null>(null);
  const [mostrarInativos, setMostrarInativos] = useState(false);

  useEffect(() => {
    apiFetch<Publicador[]>(
      mostrarInativos ? "/api/admin/publicadores?incluirInativos=true" : "/api/admin/publicadores",
    )
      .then(setPublicadores)
      .catch((err) => setErro(err instanceof ApiError ? err.message : "Não foi possível carregar os publicadores."));
  }, [mostrarInativos]);

  const visiveis = useMemo(() => {
    const termo = normalizar(busca);
    return (publicadores ?? []).filter(
      (p) =>
        (p.ativo || mostrarInativos) &&
        (!termo || normalizar(p.nome).includes(termo) || (p.usuario !== null && normalizar(p.usuario).includes(termo))),
    );
  }, [publicadores, busca, mostrarInativos]);

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
      <Label className="min-h-11 self-start font-normal">
        <Checkbox checked={mostrarInativos} onCheckedChange={(valor) => setMostrarInativos(valor === true)} />
        Mostrar desativados
      </Label>

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
              {(p.administrador || p.criancaOuIdoso || !p.ativo) && (
                <div className="flex flex-wrap gap-1.5">
                  {!p.ativo && <Badge variant="outline">Desativado</Badge>}
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
              onClick={() => setEdicao({ modo: "editar", publicador: p })}
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
              onSalvo={aoSalvar}
            />
          )}
        </DialogContent>
      </Dialog>

      <DialogoAcesso acesso={acesso} onFechar={() => setAcesso(null)} />
    </section>
  );
}

type AcaoDeAcesso = "pin" | "desativar" | "reativar";

/** Formulário de criar/editar; na edição, também redefinir PIN e desativar/reativar (com confirmação). */
function EdicaoPublicador({
  edicao,
  onSalvo,
}: {
  edicao: Edicao;
  onSalvo: (publicador: Publicador, credenciais: Credenciais | null) => void;
}) {
  const [confirmando, setConfirmando] = useState<AcaoDeAcesso | null>(null);

  if (edicao.modo === "editar" && confirmando) {
    return (
      <ConfirmarAcao
        publicador={edicao.publicador}
        acao={confirmando}
        onVoltar={() => setConfirmando(null)}
        onFeito={onSalvo}
      />
    );
  }

  return (
    <>
      <FormularioPublicador edicao={edicao} onSalvo={onSalvo} />
      {edicao.modo === "editar" && (
        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          {edicao.publicador.usuario !== null && (
            <Button type="button" variant="outline" onClick={() => setConfirmando("pin")}>
              Redefinir PIN
            </Button>
          )}
          {edicao.publicador.ativo ? (
            <Button type="button" variant="destructive" onClick={() => setConfirmando("desativar")}>
              Desativar
            </Button>
          ) : (
            <Button type="button" variant="outline" onClick={() => setConfirmando("reativar")}>
              Reativar
            </Button>
          )}
        </div>
      )}
    </>
  );
}

const TEXTOS_DA_ACAO: Record<AcaoDeAcesso, { titulo: (nome: string) => string; descricao: string; botao: string }> = {
  pin: {
    titulo: (nome) => `Redefinir o PIN de ${nome}?`,
    descricao:
      "Um PIN novo será gerado e mostrado uma única vez. Isso desconecta a pessoa de todos os aparelhos: ela precisará entrar com o PIN novo.",
    botao: "Redefinir PIN",
  },
  desativar: {
    titulo: (nome) => `Desativar ${nome}?`,
    descricao:
      "A pessoa não consegue mais entrar e é desconectada de todos os aparelhos. Os pedidos já feitos continuam na escala.",
    botao: "Desativar",
  },
  reativar: {
    titulo: (nome) => `Reativar ${nome}?`,
    descricao: "A pessoa volta a poder entrar com o mesmo usuário e PIN.",
    botao: "Reativar",
  },
};

function ConfirmarAcao({
  publicador,
  acao,
  onVoltar,
  onFeito,
}: {
  publicador: Publicador;
  acao: AcaoDeAcesso;
  onVoltar: () => void;
  onFeito: (publicador: Publicador, credenciais: Credenciais | null) => void;
}) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const textos = TEXTOS_DA_ACAO[acao];

  async function confirmar() {
    setEnviando(true);
    setErro(null);
    try {
      if (acao === "pin") {
        const credenciais = await apiFetch<Credenciais>(`/api/admin/publicadores/${publicador.id}/pin`, {
          method: "POST",
        });
        onFeito({ ...publicador, temPin: true }, credenciais);
      } else {
        const ativo = acao === "reativar";
        await apiFetch<void>(`/api/admin/publicadores/${publicador.id}`, {
          method: "PUT",
          body: JSON.stringify({ ativo }),
        });
        onFeito({ ...publicador, ativo }, null);
      }
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Não foi possível concluir.");
      setEnviando(false);
    }
  }

  return (
    <div className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{textos.titulo(publicador.nome)}</DialogTitle>
        <DialogDescription>{textos.descricao}</DialogDescription>
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
        <Button
          type="button"
          variant={acao === "desativar" ? "destructive" : "default"}
          onClick={confirmar}
          disabled={enviando}
        >
          {enviando ? "Aguarde…" : textos.botao}
        </Button>
      </DialogFooter>
    </div>
  );
}

function FormularioPublicador({
  edicao,
  onSalvo,
}: {
  edicao: Edicao;
  onSalvo: (publicador: Publicador, credenciais: Credenciais | null) => void;
}) {
  const original = edicao.modo === "editar" ? edicao.publicador : null;
  const [nome, setNome] = useState(original?.nome ?? "");
  const [usuario, setUsuario] = useState(original?.usuario ?? "");
  // Na criação, o usuário acompanha o primeiro nome até o administrador mexer nele.
  const [usuarioEditado, setUsuarioEditado] = useState(original !== null);
  const [criancaOuIdoso, setCriancaOuIdoso] = useState(original?.criancaOuIdoso ?? false);
  const [administrador, setAdministrador] = useState(original?.administrador ?? false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const usuarioLimpo = usuario.trim();
  // Registro antigo pode continuar sem usuário; quem já tem (ou está sendo criado) precisa de um.
  const usuarioObrigatorio = original === null || original.usuario !== null;
  const valido = nome.trim() !== "" && (!usuarioObrigatorio || usuarioLimpo !== "") && !/\s/.test(usuarioLimpo);

  function mudarNome(valor: string) {
    setNome(valor);
    if (!usuarioEditado) setUsuario(primeiroNome(valor));
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
          ativo: original?.ativo ?? true,
          temPin: (original?.temPin ?? false) || credenciais !== null,
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
            : "O PIN é gerado pelo sistema e aparece uma única vez."}
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
            onChange={(e) => {
              setUsuarioEditado(true);
              setUsuario(e.target.value);
            }}
            maxLength={50}
            autoCapitalize="none"
            autoCorrect="off"
            required={usuarioObrigatorio}
            aria-describedby="usuario-dica"
          />
        </Label>
        <span id="usuario-dica" className="text-[0.9rem] text-muted-foreground">
          {original && original.usuario === null
            ? "Ainda sem usuário: preencha para criar o acesso (o PIN é gerado)."
            : "Uma palavra, sem espaços. Maiúsculas e acentos não contam."}
        </span>
      </div>
      <CampoCriancaOuIdoso marcado={criancaOuIdoso} onMudar={setCriancaOuIdoso} />
      <Label className="min-h-11 font-normal">
        <Checkbox checked={administrador} onCheckedChange={(valor) => setAdministrador(valor === true)} />
        Administrador (entra na área administrativa)
      </Label>
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

/** Mensagem pronta para o WhatsApp: link do site, usuário e PIN. */
function mensagemDeAcesso(nome: string, { usuario, pin }: Credenciais): string {
  return [
    `Olá, ${primeiroNome(nome)}! Este é o seu acesso à Escala TPL:`,
    window.location.origin,
    `Usuário: ${usuario}`,
    `PIN: ${pin}`,
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
              <DialogDescription>Envie agora: o PIN não será mostrado de novo.</DialogDescription>
            </DialogHeader>
            <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-2">
              <dt className="text-muted-foreground">Usuário</dt>
              <dd className="text-[1.1rem] font-bold">{acesso.credenciais.usuario}</dd>
              <dt className="text-muted-foreground">PIN</dt>
              <dd className="font-mono text-[1.6rem] font-bold tracking-[0.3em]">{acesso.credenciais.pin}</dd>
            </dl>
            {copiado === "falhou" && (
              <Alert variant="destructive">
                <AlertDescription>Não foi possível copiar. Anote o usuário e o PIN acima.</AlertDescription>
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
