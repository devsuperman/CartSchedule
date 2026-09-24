import { useEffect, useState, type FormEvent } from "react";
import { apiFetch, ApiError } from "../../api/client";
import { TURNOS } from "../../constants/turnos";
import { DIAS_SEMANA, type DiaSemana } from "../../constants/diasSemana";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

/**
 * Contrato de GET/POST/PUT /api/admin/carrinhos e GET/PUT /api/admin/carrinhos/{id}/turnos
 * (TECHNICAL_SPEC.md §2.1/§2.4, tarefas F2-BE-02/F2-BE-03/F5-BE-01/F6-BE-02). `disponibilidades`
 * no carrinho (pares dia da semana × turno) é só uma conveniência de leitura — sempre
 * re-sincronizada após uma alteração. `descricao` é opcional (o backend grava texto em
 * branco como null).
 */
interface Disponibilidade {
  diaSemana: DiaSemana;
  turnoId: number;
}

interface Carrinho {
  id: number;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  disponibilidades: Disponibilidade[];
}

interface CarrinhoTurnosResponse {
  carrinhoId: number;
  disponibilidades: Disponibilidade[];
}

function temDisponibilidade(carrinho: Carrinho, diaSemana: DiaSemana, turnoId: number): boolean {
  return carrinho.disponibilidades.some((d) => d.diaSemana === diaSemana && d.turnoId === turnoId);
}

function mensagemErro(erro: unknown, fallback: string): string {
  if (erro instanceof ApiError) {
    return erro.message || fallback;
  }
  return fallback;
}

export default function GestaoCarrinhos() {
  const [carrinhos, setCarrinhos] = useState<Carrinho[] | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroLista, setErroLista] = useState<string | null>(null);

  const [novoNome, setNovoNome] = useState("");
  const [novaDescricao, setNovaDescricao] = useState("");
  const [criando, setCriando] = useState(false);
  const [erroCriacao, setErroCriacao] = useState<string | null>(null);

  const [salvandoId, setSalvandoId] = useState<number | null>(null);
  const [erroPorCarrinho, setErroPorCarrinho] = useState<Record<number, string>>({});

  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [nomeEdicao, setNomeEdicao] = useState("");
  const [descricaoEdicao, setDescricaoEdicao] = useState("");

  useEffect(() => {
    carregarCarrinhos();
  }, []);

  async function carregarCarrinhos() {
    setCarregando(true);
    setErroLista(null);
    try {
      const dados = await apiFetch<Carrinho[]>("/api/admin/carrinhos");
      setCarrinhos(dados);
    } catch (erro) {
      setErroLista(mensagemErro(erro, "Não foi possível carregar os carrinhos."));
    } finally {
      setCarregando(false);
    }
  }

  function limparErroCarrinho(id: number) {
    setErroPorCarrinho((atual) => {
      if (!(id in atual)) return atual;
      const { [id]: _removido, ...resto } = atual;
      return resto;
    });
  }

  function definirErroCarrinho(id: number, mensagem: string) {
    setErroPorCarrinho((atual) => ({ ...atual, [id]: mensagem }));
  }

  async function handleCriarCarrinho(event: FormEvent) {
    event.preventDefault();
    const nome = novoNome.trim();
    if (!nome) return;

    setCriando(true);
    setErroCriacao(null);
    try {
      const criado = await apiFetch<Carrinho>("/api/admin/carrinhos", {
        method: "POST",
        body: JSON.stringify({ nome, descricao: novaDescricao.trim() || null }),
      });
      setCarrinhos((atual) => [...(atual ?? []), criado]);
      setNovoNome("");
      setNovaDescricao("");
    } catch (erro) {
      setErroCriacao(mensagemErro(erro, "Não foi possível criar o carrinho."));
    } finally {
      setCriando(false);
    }
  }

  /** PUT /api/admin/carrinhos/{id} sempre recebe o cadastro inteiro (nome, descrição,
   * ativo) — quem chama repassa os valores atuais do que não quer mudar. */
  async function atualizarCarrinho(
    carrinho: Carrinho,
    dados: { nome: string; descricao: string | null; ativo: boolean },
  ): Promise<boolean> {
    limparErroCarrinho(carrinho.id);
    setSalvandoId(carrinho.id);
    try {
      const atualizado = await apiFetch<Carrinho>(`/api/admin/carrinhos/${carrinho.id}`, {
        method: "PUT",
        body: JSON.stringify(dados),
      });
      setCarrinhos((atual) =>
        (atual ?? []).map((item) => (item.id === atualizado.id ? atualizado : item)),
      );
      return true;
    } catch (erro) {
      definirErroCarrinho(carrinho.id, mensagemErro(erro, "Não foi possível atualizar o carrinho."));
      return false;
    } finally {
      setSalvandoId(null);
    }
  }

  function handleAlternarAtivo(carrinho: Carrinho) {
    atualizarCarrinho(carrinho, {
      nome: carrinho.nome,
      descricao: carrinho.descricao,
      ativo: !carrinho.ativo,
    });
  }

  function handleIniciarEdicao(carrinho: Carrinho) {
    limparErroCarrinho(carrinho.id);
    setEditandoId(carrinho.id);
    setNomeEdicao(carrinho.nome);
    setDescricaoEdicao(carrinho.descricao ?? "");
  }

  function handleCancelarEdicao(carrinho: Carrinho) {
    limparErroCarrinho(carrinho.id);
    setEditandoId(null);
  }

  async function handleSalvarEdicao(event: FormEvent, carrinho: Carrinho) {
    event.preventDefault();
    const nome = nomeEdicao.trim();
    if (!nome) return;

    const salvou = await atualizarCarrinho(carrinho, {
      nome,
      descricao: descricaoEdicao.trim() || null,
      ativo: carrinho.ativo,
    });
    if (salvou) setEditandoId(null);
  }

  async function handleAlternarTurno(carrinho: Carrinho, diaSemana: DiaSemana, turnoId: number) {
    limparErroCarrinho(carrinho.id);
    const novasDisponibilidades = temDisponibilidade(carrinho, diaSemana, turnoId)
      ? carrinho.disponibilidades.filter((d) => !(d.diaSemana === diaSemana && d.turnoId === turnoId))
      : [...carrinho.disponibilidades, { diaSemana, turnoId }];

    setSalvandoId(carrinho.id);
    try {
      const resposta = await apiFetch<CarrinhoTurnosResponse>(
        `/api/admin/carrinhos/${carrinho.id}/turnos`,
        {
          method: "PUT",
          body: JSON.stringify({ disponibilidades: novasDisponibilidades }),
        },
      );
      setCarrinhos((atual) =>
        (atual ?? []).map((item) =>
          item.id === carrinho.id ? { ...item, disponibilidades: resposta.disponibilidades } : item,
        ),
      );
    } catch (erro) {
      definirErroCarrinho(carrinho.id, mensagemErro(erro, "Não foi possível atualizar os turnos."));
    } finally {
      setSalvandoId(null);
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <h1>Carrinhos</h1>
        <p className="text-muted-foreground">
          Escolha em quais dias e turnos cada carrinho funciona. Desativar um carrinho ou desmarcar
          um turno não altera pedidos que já existem.
        </p>
      </div>

      <Card asChild>
        <form onSubmit={handleCriarCarrinho} className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <Label className="flex min-w-48 flex-1 flex-col items-start gap-1.5">
              Novo carrinho
              <Input
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
                placeholder="Ex.: Carrinho 1"
                maxLength={200}
                required
              />
            </Label>
            <Label className="flex min-w-48 flex-1 flex-col items-start gap-1.5">
              Descrição (opcional)
              <Input
                value={novaDescricao}
                onChange={(e) => setNovaDescricao(e.target.value)}
                placeholder="Ex.: em frente à estação central"
                maxLength={500}
              />
            </Label>
            <Button type="submit" disabled={criando}>
              {criando ? "Criando…" : "Criar carrinho"}
            </Button>
          </div>
          {erroCriacao && (
            <Alert variant="destructive">
              <AlertDescription>{erroCriacao}</AlertDescription>
            </Alert>
          )}
        </form>
      </Card>

      {carregando && <p className="text-muted-foreground">Carregando carrinhos…</p>}
      {erroLista && (
        <Alert variant="destructive">
          <AlertDescription>{erroLista}</AlertDescription>
        </Alert>
      )}

      {!carregando && !erroLista && carrinhos && carrinhos.length === 0 && (
        <Card className="items-center gap-2 py-10 text-center text-muted-foreground">
          <strong className="block text-[1.1rem] text-foreground">Nenhum carrinho cadastrado</strong>
          Crie o primeiro carrinho acima para liberar pedidos.
        </Card>
      )}

      {!carregando && !erroLista && carrinhos && carrinhos.length > 0 && (
        <ul className="flex list-none flex-col gap-3 p-0">
          {carrinhos.map((carrinho) => (
            <li key={carrinho.id}>
              <Card>
                <div className="flex items-start justify-between gap-4">
                  {editandoId === carrinho.id ? (
                    <form
                      onSubmit={(e) => handleSalvarEdicao(e, carrinho)}
                      className="flex min-w-0 flex-1 flex-col gap-3"
                    >
                      <Label className="flex flex-col items-start gap-1.5">
                        Nome
                        <Input
                          value={nomeEdicao}
                          onChange={(e) => setNomeEdicao(e.target.value)}
                          maxLength={200}
                          required
                          autoFocus
                        />
                      </Label>
                      <Label className="flex flex-col items-start gap-1.5">
                        Descrição (opcional)
                        <Input
                          value={descricaoEdicao}
                          onChange={(e) => setDescricaoEdicao(e.target.value)}
                          maxLength={500}
                        />
                      </Label>
                      <div className="flex flex-wrap gap-2">
                        <Button type="submit" size="sm" disabled={salvandoId === carrinho.id}>
                          {salvandoId === carrinho.id ? "Salvando…" : "Salvar"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={salvandoId === carrinho.id}
                          onClick={() => handleCancelarEdicao(carrinho)}
                        >
                          Cancelar edição
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <h2 className="break-words">{carrinho.nome}</h2>
                      {carrinho.descricao && (
                        <p className="break-words text-muted-foreground">{carrinho.descricao}</p>
                      )}
                      <div>
                        <Button
                          type="button"
                          variant="link"
                          size="sm"
                          className="h-auto px-0 py-1"
                          disabled={salvandoId === carrinho.id}
                          onClick={() => handleIniciarEdicao(carrinho)}
                        >
                          Editar
                        </Button>
                      </div>
                    </div>
                  )}
                  <Label className="shrink-0 font-normal">
                    <Checkbox
                      checked={carrinho.ativo}
                      disabled={salvandoId === carrinho.id}
                      onCheckedChange={() => handleAlternarAtivo(carrinho)}
                    />
                    Ativo
                  </Label>
                </div>

                <fieldset disabled={salvandoId === carrinho.id} className="min-w-0">
                  <legend className="mb-2 font-semibold">Turnos disponíveis por dia</legend>
                  <div className="overflow-x-auto">
                    <table className="w-full border-separate border-spacing-1 text-sm tabular-nums">
                      <thead>
                        <tr>
                          <th scope="col" className="sr-only">
                            Turno
                          </th>
                          {DIAS_SEMANA.map((dia) => (
                            <th key={dia.valor} scope="col" className="font-semibold">
                              <abbr title={dia.label} className="no-underline">
                                {dia.curto}
                              </abbr>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {TURNOS.map((turno) => (
                          <tr key={turno.id}>
                            {/* <wbr>: em telas estreitas o horário quebra em 2 linhas para
                                as 5 colunas de dias caberem sem rolagem horizontal. */}
                            <th scope="row" className="pr-1 text-left font-normal">
                              {turno.horaInicio}–<wbr />
                              {turno.horaFim}
                            </th>
                            {DIAS_SEMANA.map((dia) => {
                              const habilitado = temDisponibilidade(carrinho, dia.valor, turno.id);
                              return (
                                <td key={dia.valor} className="p-0">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    aria-pressed={habilitado}
                                    aria-label={`${dia.label} ${turno.horaInicio}–${turno.horaFim}`}
                                    className={cn(
                                      "h-9 w-full min-w-8 px-0",
                                      habilitado && "border-primary bg-accent text-accent-foreground",
                                    )}
                                    onClick={() => handleAlternarTurno(carrinho, dia.valor, turno.id)}
                                  >
                                    {habilitado ? "✓" : ""}
                                  </Button>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </fieldset>

                {carrinho.ativo && carrinho.disponibilidades.length === 0 && (
                  <Alert variant="warning" className="py-2 text-[0.95rem]">
                    <AlertDescription>
                      Nenhum turno marcado — este carrinho não aparece para os publicadores.
                    </AlertDescription>
                  </Alert>
                )}

                {erroPorCarrinho[carrinho.id] && (
                  <Alert variant="destructive" className="py-2 text-[0.95rem]">
                    <AlertDescription>{erroPorCarrinho[carrinho.id]}</AlertDescription>
                  </Alert>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
