import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { apiFetch } from "../../api/client";
import { DIAS_SEMANA } from "../../constants/diasSemana";
import { TURNOS } from "../../constants/turnos";

/** Contrato de GET /api/admin/escalas/{mes}/grade (TECHNICAL_SPEC.md, tarefa F2-BE-07). */
interface AprovadoGrade {
  publicadorId: string;
  publicadorNome: string;
}

interface CelulaGrade {
  carrinhoId: number;
  carrinhoNome: string;
  diaSemana: number;
  turnoId: number;
  aprovados: AprovadoGrade[];
}

interface EscalaGradeResponse {
  mes: string;
  celulas: CelulaGrade[];
}

/** Um carrinho distinto presente na grade. */
interface CarrinhoGrade {
  carrinhoId: number;
  carrinhoNome: string;
}

export default function EscalaFinal() {
  const { mes } = useParams<{ mes: string }>();
  const [celulas, setCelulas] = useState<CelulaGrade[] | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!mes) {
      return;
    }

    let cancelado = false;
    setCarregando(true);
    setErro(null);

    apiFetch<EscalaGradeResponse>(`/api/admin/escalas/${mes}/grade`)
      .then((resposta) => {
        if (!cancelado) {
          setCelulas(resposta.celulas);
        }
      })
      .catch(() => {
        if (!cancelado) {
          setErro("Não foi possível carregar a escala final. Tente novamente.");
        }
      })
      .finally(() => {
        if (!cancelado) {
          setCarregando(false);
        }
      });

    return () => {
      cancelado = true;
    };
  }, [mes]);

  if (!mes) {
    return <p role="alert">Mês da escala não informado na URL.</p>;
  }

  if (carregando) {
    return <p>Carregando escala final...</p>;
  }

  if (erro) {
    return <p role="alert">{erro}</p>;
  }

  const listaCelulas = celulas ?? [];

  if (listaCelulas.length === 0) {
    return (
      <div>
        <h1>Escala final — {mes}</h1>
        <p>Nenhuma solicitação aprovada ainda para este mês.</p>
      </div>
    );
  }

  // Deriva o conjunto de carrinhos distintos presentes na resposta, mantendo a ordem de aparição.
  const carrinhos: CarrinhoGrade[] = [];
  const carrinhosVistos = new Set<number>();
  for (const celula of listaCelulas) {
    if (!carrinhosVistos.has(celula.carrinhoId)) {
      carrinhosVistos.add(celula.carrinhoId);
      carrinhos.push({ carrinhoId: celula.carrinhoId, carrinhoNome: celula.carrinhoNome });
    }
  }

  function aprovadosDaCelula(carrinhoId: number, diaSemana: number, turnoId: number): AprovadoGrade[] {
    const celula = listaCelulas.find(
      (c) => c.carrinhoId === carrinhoId && c.diaSemana === diaSemana && c.turnoId === turnoId,
    );
    return celula?.aprovados ?? [];
  }

  return (
    <div>
      <h1>Escala final — {mes}</h1>

      {carrinhos.map((carrinho) => (
        <section key={carrinho.carrinhoId} className="escala-final__carrinho">
          <h2>{carrinho.carrinhoNome}</h2>
          <table className="escala-final__tabela">
            <thead>
              <tr>
                <th>Turno</th>
                {DIAS_SEMANA.map((dia) => (
                  <th key={dia.valor}>{dia.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TURNOS.map((turno) => (
                <tr key={turno.id}>
                  <th scope="row">
                    {turno.horaInicio}–{turno.horaFim}
                  </th>
                  {DIAS_SEMANA.map((dia) => {
                    const aprovados = aprovadosDaCelula(carrinho.carrinhoId, dia.valor, turno.id);
                    return (
                      <td key={dia.valor}>
                        {aprovados.length === 0
                          ? "—"
                          : aprovados.map((a) => a.publicadorNome).join(", ")}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
