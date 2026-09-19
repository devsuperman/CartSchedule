import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { apiFetch, ApiError } from "../../api/client";
import { DIAS_SEMANA, DiaSemana } from "../../constants/diasSemana";
import { TURNOS } from "../../constants/turnos";

/** Contrato de GET /api/carrinhos (TECHNICAL_SPEC.md §2.1, tarefa F1-BE-02). */
interface Carrinho {
  id: number;
  nome: string;
  turnoIds: number[];
}

/**
 * Contrato de POST /api/admin/escalas/{mes}/solicitacoes
 * (TECHNICAL_SPEC.md §2.1, tarefa F2-BE-06 / PLANNING.md §6 item 7, regra 9).
 */
interface SolicitacaoCriadaResponse {
  id: number;
  publicadorId: number;
  publicadorNome: string;
  carrinhoId: number;
  diaSemana: DiaSemana;
  turnoId: number;
  status: string;
  origem: string;
}

export default function AdicionarSolicitacao() {
  const { mes } = useParams<{ mes: string }>();

  const [carrinhos, setCarrinhos] = useState<Carrinho[]>([]);
  const [carregandoCarrinhos, setCarregandoCarrinhos] = useState(true);
  const [erroCarrinhos, setErroCarrinhos] = useState<string | null>(null);

  const [nome, setNome] = useState("");
  const [carrinhoId, setCarrinhoId] = useState<number | "">("");
  const [diaSemana, setDiaSemana] = useState<DiaSemana | "">("");
  const [turnoId, setTurnoId] = useState<number | "">("");

  const [nomesVistos, setNomesVistos] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  const [confirmacao, setConfirmacao] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;

    apiFetch<Carrinho[]>("/api/carrinhos")
      .then((dados) => {
        if (cancelado) return;
        setCarrinhos(dados);
      })
      .catch(() => {
        if (cancelado) return;
        setErroCarrinhos("Não foi possível carregar a lista de carrinhos.");
      })
      .finally(() => {
        if (!cancelado) setCarregandoCarrinhos(false);
      });

    return () => {
      cancelado = true;
    };
  }, []);

  const carrinhoSelecionado = carrinhos.find((c) => c.id === carrinhoId);
  const turnosDisponiveis = carrinhoSelecionado
    ? TURNOS.filter((t) => carrinhoSelecionado.turnoIds.includes(t.id))
    : [];

  function handleCarrinhoChange(valor: string) {
    const novoId = valor === "" ? "" : Number(valor);
    setCarrinhoId(novoId);
    setTurnoId("");
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErroEnvio(null);
    setConfirmacao(null);

    if (!mes || carrinhoId === "" || diaSemana === "" || turnoId === "") {
      setErroEnvio("Preencha todos os campos antes de enviar.");
      return;
    }

    setEnviando(true);
    try {
      const resposta = await apiFetch<SolicitacaoCriadaResponse>(
        `/api/admin/escalas/${mes}/solicitacoes`,
        {
          method: "POST",
          body: JSON.stringify({
            nome: nome.trim(),
            carrinhoId,
            diaSemana,
            turnoId,
          }),
        },
      );

      setConfirmacao(`Solicitação de ${resposta.publicadorNome} adicionada e aprovada.`);
      setNomesVistos((atual) =>
        atual.includes(resposta.publicadorNome) ? atual : [...atual, resposta.publicadorNome],
      );

      // Reseta apenas o nome e o turno — carrinho e dia da semana costumam se
      // repetir quando o admin adiciona várias pessoas seguidas na mesma trinca.
      setNome("");
      setTurnoId("");
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setErroEnvio(
          "Esse publicador já tem uma solicitação idêntica (mesmo carrinho, dia e turno) nessa escala.",
        );
      } else {
        setErroEnvio("Não foi possível adicionar a solicitação. Tente novamente.");
      }
    } finally {
      setEnviando(false);
    }
  }

  if (!mes) {
    return <p role="alert">Escala não informada na URL.</p>;
  }

  return (
    <div>
      <h1>Adicionar solicitação — escala {mes}</h1>
      <p>A solicitação é criada diretamente como Aprovada.</p>

      {carregandoCarrinhos && <p>Carregando carrinhos...</p>}
      {erroCarrinhos && <p role="alert">{erroCarrinhos}</p>}

      {!carregandoCarrinhos && !erroCarrinhos && (
        <form onSubmit={handleSubmit}>
          <label className="form-field">
            Nome do publicador
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              list="nomes-vistos"
              required
              autoFocus
            />
            <datalist id="nomes-vistos">
              {nomesVistos.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </label>

          <label className="form-field">
            Carrinho
            <select
              value={carrinhoId}
              onChange={(e) => handleCarrinhoChange(e.target.value)}
              required
            >
              <option value="" disabled>
                Selecione um carrinho
              </option>
              {carrinhos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field">
            Dia da semana
            <select
              value={diaSemana}
              onChange={(e) => setDiaSemana(e.target.value === "" ? "" : (Number(e.target.value) as DiaSemana))}
              required
            >
              <option value="" disabled>
                Selecione um dia
              </option>
              {DIAS_SEMANA.map((d) => (
                <option key={d.valor} value={d.valor}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field">
            Turno
            <select
              value={turnoId}
              onChange={(e) => setTurnoId(e.target.value === "" ? "" : Number(e.target.value))}
              required
              disabled={!carrinhoSelecionado}
            >
              <option value="" disabled>
                {carrinhoSelecionado ? "Selecione um turno" : "Selecione um carrinho primeiro"}
              </option>
              {turnosDisponiveis.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.horaInicio}–{t.horaFim}
                </option>
              ))}
            </select>
          </label>

          {erroEnvio && <p role="alert">{erroEnvio}</p>}
          {confirmacao && <p className="form-success">{confirmacao}</p>}

          <button type="submit" disabled={enviando}>
            {enviando ? "Adicionando..." : "Adicionar solicitação"}
          </button>
        </form>
      )}
    </div>
  );
}
