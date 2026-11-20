import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { apiFetch, ApiError } from "../../../api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
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
import { CampoCriancaOuIdoso } from "./ModalEditarNome";
import { PainelAcesso } from "./PainelAcesso";
import { combinaComBusca, normalizar, primeiroNome, type Credenciais, type Publicador } from "./publicadores";
import {
  descreverCelula,
  estadoCom,
  estadoSem,
  vagaNoMesmoHorario,
  type CelulaGrade,
  type PedidoGrade,
} from "./gradeEscala";

function mensagemErro(erro: unknown, duplicado: string, fallback: string): string {
  if (erro instanceof ApiError && erro.status === 409) return duplicado;
  return erro instanceof ApiError ? erro.message : fallback;
}

function Aviso({ children }: { children: ReactNode }) {
  return (
    <Alert className="border-warning bg-warning-muted text-foreground">
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}

/** Aviso (nunca bloqueio — regra 3) quando a vaga passaria da meta da regra 1. */
function AvisoExcesso({ destino, nome, criancaOuIdoso }: { destino: CelulaGrade; nome: string; criancaOuIdoso: boolean }) {
  if (estadoCom(destino, { criancaOuIdoso }) !== "excesso") return null;
  const n = destino.publicadores.length;
  return (
    <Aviso>
      Essa vaga já tem {n} {n === 1 ? "pessoa" : "pessoas"}. Com {nome}, ficará com excesso.
    </Aviso>
  );
}

/** Aviso quando quem sai deixa a vaga de origem com uma pessoa só. */
function AvisoOrigem({ origem, pedido }: { origem: CelulaGrade; pedido: PedidoGrade }) {
  if (estadoSem(origem, pedido.solicitacaoId) !== "incompleta") return null;
  const fica = origem.publicadores.find((p) => p.solicitacaoId !== pedido.solicitacaoId)!;
  return (
    <Aviso>
      {descreverCelula(origem)} ficará só com {fica.publicadorNome}.
    </Aviso>
  );
}

/** Aviso (nunca bloqueio — regra 10) quando a pessoa já está em outro carrinho nesse horário. */
function AvisoHorario({ nome, outra }: { nome: string; outra: CelulaGrade | null }) {
  if (!outra) return null;
  return (
    <Aviso>
      {nome} já está em {descreverCelula(outra)}, no mesmo horário.
    </Aviso>
  );
}

export interface Movimento {
  pedido: PedidoGrade;
  origem: CelulaGrade;
  destino: CelulaGrade;
}

/** Confirma a mudança de vaga: PATCH /api/admin/solicitacoes/{id}. */
export function ModalMover({
  movimento,
  celulas,
  onFechar,
  onMovido,
}: {
  movimento: Movimento | null;
  celulas: readonly CelulaGrade[];
  onFechar: () => void;
  onMovido: (movimento: Movimento) => void;
}) {
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function mover(m: Movimento) {
    setSalvando(true);
    setErro(null);
    try {
      await apiFetch(`/api/admin/solicitacoes/${m.pedido.solicitacaoId}`, {
        method: "PATCH",
        body: JSON.stringify({
          carrinhoId: m.destino.carrinhoId,
          diaSemana: m.destino.diaSemana,
          turnoId: m.destino.turnoId,
        }),
      });
      onMovido(m);
    } catch (e) {
      setErro(mensagemErro(e, `${m.pedido.publicadorNome} já tem um pedido nessa vaga.`, "Não foi possível mover."));
    } finally {
      setSalvando(false);
    }
  }

  function fechar() {
    if (salvando) return;
    setErro(null);
    onFechar();
  }

  return (
    <Dialog open={movimento !== null} onOpenChange={(aberto) => !aberto && fechar()}>
      <DialogContent>
        {movimento && (
          <>
            <DialogHeader>
              <DialogTitle>Mover {movimento.pedido.publicadorNome}?</DialogTitle>
              <DialogDescription>
                De {descreverCelula(movimento.origem)} para {descreverCelula(movimento.destino)}.
              </DialogDescription>
            </DialogHeader>
            <AvisoExcesso
              destino={movimento.destino}
              nome={movimento.pedido.publicadorNome}
              criancaOuIdoso={movimento.pedido.criancaOuIdoso}
            />
            <AvisoOrigem origem={movimento.origem} pedido={movimento.pedido} />
            <AvisoHorario
              nome={movimento.pedido.publicadorNome}
              outra={vagaNoMesmoHorario(
                celulas,
                movimento.destino,
                (p) => p.publicadorId === movimento.pedido.publicadorId,
                movimento.pedido.solicitacaoId,
              )}
            />
            {erro && (
              <Alert variant="destructive">
                <AlertDescription>{erro}</AlertDescription>
              </Alert>
            )}
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={salvando}>
                  Voltar
                </Button>
              </DialogClose>
              <Button type="button" disabled={salvando} onClick={() => mover(movimento)}>
                {salvando ? "Movendo…" : "Mover"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export interface Exclusao {
  pedido: PedidoGrade;
  celula: CelulaGrade;
}

/** Último recurso: DELETE /api/admin/solicitacoes/{id}, definitivo. */
export function ModalExcluir({
  exclusao,
  onFechar,
  onExcluido,
}: {
  exclusao: Exclusao | null;
  onFechar: () => void;
  onExcluido: (exclusao: Exclusao) => void;
}) {
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function excluir(ex: Exclusao) {
    setExcluindo(true);
    setErro(null);
    try {
      await apiFetch(`/api/admin/solicitacoes/${ex.pedido.solicitacaoId}`, { method: "DELETE" });
      onExcluido(ex);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Falha ao excluir.");
    } finally {
      setExcluindo(false);
    }
  }

  function fechar() {
    if (excluindo) return;
    setErro(null);
    onFechar();
  }

  return (
    <Dialog open={exclusao !== null} onOpenChange={(aberto) => !aberto && fechar()}>
      <DialogContent>
        {exclusao && (
          <>
            <DialogHeader>
              <DialogTitle>Excluir pedido?</DialogTitle>
              <DialogDescription>
                {exclusao.pedido.publicadorNome} — {descreverCelula(exclusao.celula)}. Isso não pode ser
                desfeito. Para trocar de vaga, use Mover.
              </DialogDescription>
            </DialogHeader>
            {erro && (
              <Alert variant="destructive">
                <AlertDescription>{erro}</AlertDescription>
              </Alert>
            )}
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={excluindo}>
                  Voltar
                </Button>
              </DialogClose>
              <Button
                type="button"
                variant="destructive"
                disabled={excluindo}
                onClick={() => excluir(exclusao)}
              >
                {excluindo ? "Excluindo…" : "Excluir"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Resposta de POST /api/admin/escalas/{mes}/solicitacoes. */
interface SolicitacaoCriada {
  id: number;
  publicadorId: string;
  publicadorNome: string;
  origem: number;
  criancaOuIdoso: boolean;
}

type EtapaAdicionar =
  | { etapa: "buscar" }
  | { etapa: "novo" }
  | { etapa: "acesso"; nome: string; credenciais: Credenciais; erro: string | null };

/**
 * Adição manual numa vaga (regra 9): POST /api/admin/escalas/{mes}/solicitacoes com um
 * publicador existente e ativo, escolhido pela busca (nome ou usuário, sem maiúsculas nem
 * acentos). Nome livre não cria ninguém: "Novo publicador" cria a conta ali mesmo
 * (POST /api/admin/publicadores), adiciona à vaga e mostra o PIN uma única vez. Quem já está
 * na vaga aparece desabilitado; excesso e outro carrinho no mesmo horário só avisam.
 */
export function ModalAdicionar({
  mes,
  celula,
  celulas,
  onFechar,
  onAdicionado,
}: {
  mes: string;
  celula: CelulaGrade | null;
  celulas: readonly CelulaGrade[];
  onFechar: () => void;
  onAdicionado: (celula: CelulaGrade, criada: SolicitacaoCriada) => void;
}) {
  return (
    <Dialog open={celula !== null} onOpenChange={(aberto) => !aberto && onFechar()}>
      <DialogContent>
        {celula && (
          <FluxoAdicionar
            key={`${celula.carrinhoId}-${celula.diaSemana}-${celula.turnoId}`}
            mes={mes}
            celula={celula}
            celulas={celulas}
            onFechar={onFechar}
            onAdicionado={onAdicionado}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function FluxoAdicionar({
  mes,
  celula,
  celulas,
  onFechar,
  onAdicionado,
}: {
  mes: string;
  celula: CelulaGrade;
  celulas: readonly CelulaGrade[];
  onFechar: () => void;
  onAdicionado: (celula: CelulaGrade, criada: SolicitacaoCriada) => void;
}) {
  const [etapa, setEtapa] = useState<EtapaAdicionar>({ etapa: "buscar" });
  const [busca, setBusca] = useState("");

  function adicionar(publicadorId: string) {
    return apiFetch<SolicitacaoCriada>(`/api/admin/escalas/${mes}/solicitacoes`, {
      method: "POST",
      body: JSON.stringify({
        publicadorId,
        carrinhoId: celula.carrinhoId,
        diaSemana: celula.diaSemana,
        turnoId: celula.turnoId,
      }),
    });
  }

  if (etapa.etapa === "acesso") {
    return (
      <PainelAcesso nome={etapa.nome} credenciais={etapa.credenciais}>
        {etapa.erro ? (
          <Alert variant="destructive">
            <AlertDescription>
              A conta foi criada, mas não foi possível adicionar à vaga: {etapa.erro} Use o + da vaga de novo.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert className="border-success bg-success-muted text-foreground">
            <AlertDescription>Adicionado em {descreverCelula(celula)}.</AlertDescription>
          </Alert>
        )}
      </PainelAcesso>
    );
  }

  if (etapa.etapa === "novo") {
    return (
      <FormularioNovoPublicador
        celula={celula}
        nomeInicial={busca.trim()}
        onVoltar={() => setEtapa({ etapa: "buscar" })}
        onCriado={async (nome, credenciais) => {
          let erro: string | null = null;
          try {
            onAdicionado(celula, await adicionar(credenciais.id));
          } catch (e) {
            erro = e instanceof ApiError ? e.message : "Erro inesperado.";
          }
          setEtapa({ etapa: "acesso", nome, credenciais, erro });
        }}
      />
    );
  }

  return (
    <BuscarPublicador
      celula={celula}
      celulas={celulas}
      busca={busca}
      onBuscar={setBusca}
      onNovo={() => setEtapa({ etapa: "novo" })}
      onAdicionar={async (publicadorId) => {
        onAdicionado(celula, await adicionar(publicadorId));
        onFechar();
      }}
    />
  );
}

function BuscarPublicador({
  celula,
  celulas,
  busca,
  onBuscar,
  onNovo,
  onAdicionar,
}: {
  celula: CelulaGrade;
  celulas: readonly CelulaGrade[];
  busca: string;
  onBuscar: (busca: string) => void;
  onNovo: () => void;
  onAdicionar: (publicadorId: string) => Promise<void>;
}) {
  const [publicadores, setPublicadores] = useState<Publicador[] | null>(null);
  const [escolhido, setEscolhido] = useState<Publicador | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let atual = true;
    apiFetch<Publicador[]>("/api/admin/publicadores")
      .then((lista) => atual && setPublicadores(lista))
      .catch((e) => atual && setErro(e instanceof ApiError ? e.message : "Não foi possível carregar os publicadores."));
    return () => {
      atual = false;
    };
  }, []);

  const naVaga = new Set(celula.publicadores.map((p) => p.publicadorId));
  const termo = normalizar(busca);
  const visiveis = (publicadores ?? []).filter((p) => combinaComBusca(p, termo));

  async function adicionar(evento: FormEvent) {
    evento.preventDefault();
    if (!escolhido) return;
    setSalvando(true);
    setErro(null);
    try {
      await onAdicionar(escolhido.id);
    } catch (e) {
      setErro(mensagemErro(e, "Essa pessoa já está nessa vaga.", "Não foi possível adicionar."));
      setSalvando(false);
    }
  }

  return (
    <form className="grid gap-4" onSubmit={adicionar}>
      <DialogHeader>
        <DialogTitle>Adicionar pessoa</DialogTitle>
        <DialogDescription>{descreverCelula(celula)}.</DialogDescription>
      </DialogHeader>
      <Input
        type="search"
        aria-label="Buscar publicador"
        placeholder="Nome ou usuário"
        value={busca}
        onChange={(e) => onBuscar(e.target.value)}
        autoComplete="off"
        autoFocus
      />
      {publicadores === null && !erro && <p className="text-muted-foreground">Carregando…</p>}
      {publicadores !== null && visiveis.length === 0 && <p className="text-muted-foreground">Ninguém encontrado.</p>}
      {visiveis.length > 0 && (
        <ul className="grid max-h-64 gap-1 overflow-y-auto" aria-label="Publicadores">
          {visiveis.map((p) => {
            const jaNaVaga = naVaga.has(p.id);
            const selecionado = escolhido?.id === p.id;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  disabled={jaNaVaga}
                  aria-pressed={selecionado}
                  onClick={() => setEscolhido(p)}
                  className={cn(
                    "flex min-h-11 w-full flex-col items-start rounded-md border px-3 py-1.5 text-left disabled:opacity-60",
                    selecionado ? "border-primary bg-primary/10" : "border-border",
                  )}
                >
                  <span className="font-medium">{p.nome}</span>
                  <span className="text-[0.9rem] text-muted-foreground">
                    {jaNaVaga ? "Já está nessa vaga" : (p.usuario ?? "Sem usuário")}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <Button type="button" variant="outline" onClick={onNovo}>
        Novo publicador
      </Button>
      {escolhido && (
        <>
          <AvisoExcesso destino={celula} nome={escolhido.nome} criancaOuIdoso={escolhido.criancaOuIdoso} />
          <AvisoHorario
            nome={escolhido.nome}
            outra={vagaNoMesmoHorario(celulas, celula, (p) => p.publicadorId === escolhido.id)}
          />
        </>
      )}
      {erro && (
        <Alert variant="destructive">
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline" disabled={salvando}>
            Voltar
          </Button>
        </DialogClose>
        <Button type="submit" disabled={!escolhido || salvando}>
          {salvando ? "Adicionando…" : "Adicionar"}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Cria a conta (nome, usuário = primeiro nome por padrão, criança/idoso), sem sair da Escala. */
function FormularioNovoPublicador({
  celula,
  nomeInicial,
  onVoltar,
  onCriado,
}: {
  celula: CelulaGrade;
  nomeInicial: string;
  onVoltar: () => void;
  onCriado: (nome: string, credenciais: Credenciais) => Promise<void>;
}) {
  const [nome, setNome] = useState(nomeInicial);
  const [usuario, setUsuario] = useState(primeiroNome(nomeInicial));
  const [usuarioEditado, setUsuarioEditado] = useState(false);
  const [criancaOuIdoso, setCriancaOuIdoso] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const usuarioLimpo = usuario.trim();
  const valido = nome.trim() !== "" && usuarioLimpo !== "" && !/\s/.test(usuarioLimpo);

  function mudarNome(valor: string) {
    setNome(valor);
    if (!usuarioEditado) setUsuario(primeiroNome(valor));
  }

  async function criar(evento: FormEvent) {
    evento.preventDefault();
    if (!valido) return;
    setSalvando(true);
    setErro(null);
    let credenciais: Credenciais;
    try {
      credenciais = await apiFetch<Credenciais>("/api/admin/publicadores", {
        method: "POST",
        body: JSON.stringify({ nome: nome.trim(), usuario: usuarioLimpo, criancaOuIdoso, administrador: false }),
      });
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível criar o publicador.");
      setSalvando(false);
      return;
    }
    await onCriado(nome.trim(), credenciais);
  }

  return (
    <form className="grid gap-4" onSubmit={criar}>
      <DialogHeader>
        <DialogTitle>Novo publicador</DialogTitle>
        <DialogDescription>
          Será adicionado em {descreverCelula(celula)}. O PIN é gerado pelo sistema e aparece uma única vez.
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
            required
            aria-describedby="novo-usuario-dica"
          />
        </Label>
        <span id="novo-usuario-dica" className="text-[0.9rem] text-muted-foreground">
          Uma palavra, sem espaços. Maiúsculas e acentos não contam.
        </span>
      </div>
      <CampoCriancaOuIdoso marcado={criancaOuIdoso} onMudar={setCriancaOuIdoso} />
      <AvisoExcesso destino={celula} nome={nome.trim() || "essa pessoa"} criancaOuIdoso={criancaOuIdoso} />
      {erro && (
        <Alert variant="destructive">
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" disabled={salvando} onClick={onVoltar}>
          Voltar
        </Button>
        <Button type="submit" disabled={!valido || salvando}>
          {salvando ? "Criando…" : "Criar e adicionar"}
        </Button>
      </DialogFooter>
    </form>
  );
}

/**
 * Confirma fechar ou reabrir o envio de pedidos dos publicadores para a escala em envio:
 * PUT /api/admin/escalas/{mes}/envio. A abertura é automática no dia 15; fechar é só aqui.
 */
export function ModalEnvio({
  mes,
  abrir,
  onFechar,
  onAlterado,
}: {
  mes: string;
  /** null = modal fechado; true = reabrir o envio; false = fechar o envio. */
  abrir: boolean | null;
  onFechar: () => void;
  onAlterado: (aberto: boolean) => void;
}) {
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function alterar(aberto: boolean) {
    setSalvando(true);
    setErro(null);
    try {
      await apiFetch(`/api/admin/escalas/${mes}/envio`, { method: "PUT", body: JSON.stringify({ aberto }) });
      onAlterado(aberto);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível alterar o envio.");
    } finally {
      setSalvando(false);
    }
  }

  function fechar() {
    if (salvando) return;
    setErro(null);
    onFechar();
  }

  return (
    <Dialog open={abrir !== null} onOpenChange={(aberto) => !aberto && fechar()}>
      <DialogContent>
        {abrir !== null && (
          <>
            <DialogHeader>
              <DialogTitle>{abrir ? "Reabrir o envio?" : "Fechar o envio?"}</DialogTitle>
              <DialogDescription>
                {abrir
                  ? "Os publicadores voltam a poder enviar e excluir pedidos para esta escala."
                  : "Os publicadores não poderão mais enviar nem excluir pedidos para esta escala. Você pode reabrir depois."}
              </DialogDescription>
            </DialogHeader>
            {erro && (
              <Alert variant="destructive">
                <AlertDescription>{erro}</AlertDescription>
              </Alert>
            )}
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={salvando}>
                  Voltar
                </Button>
              </DialogClose>
              <Button type="button" disabled={salvando} onClick={() => alterar(abrir)}>
                {salvando ? "Salvando…" : abrir ? "Reabrir envio" : "Fechar envio"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
