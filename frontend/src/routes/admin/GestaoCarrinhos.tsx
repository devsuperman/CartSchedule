import { useEffect, useState, type FormEvent } from "react";
import { apiFetch, ApiError } from "../../api/client";
import { TURNOS } from "../../constants/turnos";

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
    <section className="pilha">
      <div className="pagina-titulo">
        <h1>Carrinhos</h1>
        <p className="subtitulo">
          Escolha quais turnos cada carrinho oferece. Desativar um carrinho ou remover um turno não
          altera pedidos que já existem.
        </p>
      </div>

      <form onSubmit={handleCriarCarrinho} className="painel pilha">
        <div className="form-inline">
          <label className="campo">
            Novo carrinho
            <input
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              placeholder="Ex.: Carrinho 1"
              required
            />
          </label>
          <button type="submit" className="btn--primario" disabled={criando}>
            {criando ? "Criando…" : "Criar carrinho"}
          </button>
        </div>
        {erroCriacao && (
          <p role="alert" className="aviso aviso--erro">
            {erroCriacao}
          </p>
        )}
      </form>

      {carregando && <p className="carregando">Carregando carrinhos…</p>}
      {erroLista && (
        <p role="alert" className="aviso aviso--erro">
          {erroLista}
        </p>
      )}

      {!carregando && !erroLista && carrinhos && carrinhos.length === 0 && (
        <div className="estado-vazio painel">
          <strong>Nenhum carrinho cadastrado</strong>
          Crie o primeiro carrinho acima para liberar pedidos.
        </div>
      )}

      {!carregando && !erroLista && carrinhos && carrinhos.length > 0 && (
        <ul className="lista-cartoes">
          {carrinhos.map((carrinho) => (
            <li key={carrinho.id} className="painel carrinho-item">
              <div className="carrinho-item__cabecalho">
                <h2>{carrinho.nome}</h2>
                <label>
                  <input
                    type="checkbox"
                    checked={carrinho.ativo}
                    disabled={salvandoId === carrinho.id}
                    onChange={() => handleAlternarAtivo(carrinho)}
                  />
                  Ativo
                </label>
              </div>

              <fieldset disabled={salvandoId === carrinho.id}>
                <legend>Turnos disponíveis</legend>
                <div className="turnos-toggle">
                  {TURNOS.map((turno) => (
                    <button
                      key={turno.id}
                      type="button"
                      aria-pressed={carrinho.turnoIds.includes(turno.id)}
                      onClick={() => handleAlternarTurno(carrinho, turno.id)}
                    >
                      {turno.horaInicio}–{turno.horaFim}
                    </button>
                  ))}
                </div>
              </fieldset>

              {erroPorCarrinho[carrinho.id] && (
                <p role="alert" className="aviso aviso--erro aviso--linha" style={{ marginTop: "0.75rem" }}>
                  {erroPorCarrinho[carrinho.id]}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
