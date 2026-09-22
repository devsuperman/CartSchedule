import { useEffect, useState, type FormEvent } from "react";
import { apiFetch, ApiError } from "../../api/client";
import { TURNOS } from "../../constants/turnos";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

/**
 * Contrato de GET/POST /api/admin/carrinhos e GET/PUT /api/admin/carrinhos/{id}/turnos
 * (TECHNICAL_SPEC.md §2.1, tarefas F2-BE-02/F2-BE-03). `turnoIds` no carrinho é só uma
 * conveniência de leitura — sempre re-sincronizado após uma alteração de turnos.
 */
interface Carrinho {
  id: number;
  nome: string;
  ativo: boolean;
  turnoIds: number[];
}

interface CarrinhoTurnosResponse {
  carrinhoId: number;
  turnoIds: number[];
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
  const [criando, setCriando] = useState(false);
  const [erroCriacao, setErroCriacao] = useState<string | null>(null);

  const [salvandoId, setSalvandoId] = useState<number | null>(null);
  const [erroPorCarrinho, setErroPorCarrinho] = useState<Record<number, string>>({});

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
        body: JSON.stringify({ nome }),
      });
      setCarrinhos((atual) => [...(atual ?? []), criado]);
      setNovoNome("");
    } catch (erro) {
      setErroCriacao(mensagemErro(erro, "Não foi possível criar o carrinho."));
    } finally {
      setCriando(false);
    }
  }

  async function handleAlternarAtivo(carrinho: Carrinho) {
    limparErroCarrinho(carrinho.id);
    setSalvandoId(carrinho.id);
    try {
      const atualizado = await apiFetch<Carrinho>(`/api/admin/carrinhos/${carrinho.id}`, {
        method: "PUT",
        body: JSON.stringify({ nome: carrinho.nome, ativo: !carrinho.ativo }),
      });
      setCarrinhos((atual) =>
        (atual ?? []).map((item) => (item.id === atualizado.id ? atualizado : item)),
      );
    } catch (erro) {
      definirErroCarrinho(carrinho.id, mensagemErro(erro, "Não foi possível atualizar o carrinho."));
    } finally {
      setSalvandoId(null);
    }
  }

  async function handleAlternarTurno(carrinho: Carrinho, turnoId: number) {
    limparErroCarrinho(carrinho.id);
    const jaHabilitado = carrinho.turnoIds.includes(turnoId);
    const novosTurnoIds = jaHabilitado
      ? carrinho.turnoIds.filter((id) => id !== turnoId)
      : [...carrinho.turnoIds, turnoId];

    setSalvandoId(carrinho.id);
    try {
      const resposta = await apiFetch<CarrinhoTurnosResponse>(
        `/api/admin/carrinhos/${carrinho.id}/turnos`,
        {
          method: "PUT",
          body: JSON.stringify({ turnoIds: novosTurnoIds }),
        },
      );
      setCarrinhos((atual) =>
        (atual ?? []).map((item) =>
          item.id === carrinho.id ? { ...item, turnoIds: resposta.turnoIds } : item,
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
          Escolha quais turnos cada carrinho oferece. Desativar um carrinho ou remover um turno não
          altera pedidos que já existem.
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
                required
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
                <div className="flex items-center justify-between gap-4">
                  <h2>{carrinho.nome}</h2>
                  <Label className="font-normal">
                    <Checkbox
                      checked={carrinho.ativo}
                      disabled={salvandoId === carrinho.id}
                      onCheckedChange={() => handleAlternarAtivo(carrinho)}
                    />
                    Ativo
                  </Label>
                </div>

                <fieldset disabled={salvandoId === carrinho.id} className="min-w-0">
                  <legend className="mb-2 font-semibold">Turnos disponíveis</legend>
                  <div className="flex flex-wrap gap-2 tabular-nums">
                    {TURNOS.map((turno) => {
                      const habilitado = carrinho.turnoIds.includes(turno.id);
                      return (
                        <Button
                          key={turno.id}
                          type="button"
                          variant="outline"
                          size="sm"
                          aria-pressed={habilitado}
                          className={cn(
                            habilitado && "border-primary bg-accent text-accent-foreground",
                          )}
                          onClick={() => handleAlternarTurno(carrinho, turno.id)}
                        >
                          {turno.horaInicio}–{turno.horaFim}
                        </Button>
                      );
                    })}
                  </div>
                </fieldset>

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
