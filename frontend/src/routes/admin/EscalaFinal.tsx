import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { apiFetch } from "../../api/client";
import { DIAS_SEMANA } from "../../constants/diasSemana";
import { TURNOS } from "../../constants/turnos";
import { formatarMes } from "../../utils/formatacao";

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
    return (
      <p role="alert" className="aviso aviso--erro">
        Mês da escala não informado na URL.
      </p>
    );
  }

  if (carregando) {
    return <p className="carregando">Carregando escala final…</p>;
  }

  if (erro) {
    return (
      <p role="alert" className="aviso aviso--erro">
        {erro}
      </p>
    );
  }

  const listaCelulas = celulas ?? [];

  if (listaCelulas.length === 0) {
    return (
      <div className="pilha">
        <h1>Escala final</h1>
        <div className="estado-vazio painel">
          <strong>Nada aprovado em {formatarMes(mes)}</strong>
          Aprove pedidos na revisão da escala para montar a grade.
        </div>
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
    <div className="pilha">
      <div className="pagina-titulo">
        <h1>Escala final</h1>
        <p className="subtitulo">
          {formatarMes(mes)}. Células em vermelho têm mais de 2 pessoas.
        </p>
      </div>

      {carrinhos.map((carrinho) => (
        <section key={carrinho.carrinhoId} className="pilha">
          <h2>{carrinho.carrinhoNome}</h2>
          <div className="tabela-wrap">
            <table className="escala">
              <thead>
                <tr>
                  <th scope="col">Turno</th>
                  {DIAS_SEMANA.map((dia) => (
                    <th key={dia.valor} scope="col">
                      {dia.label}
                    </th>
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
                      const excedente = aprovados.length > 2;
                      const classe =
                        aprovados.length === 0
                          ? "escala__vazia"
                          : excedente
                            ? "escala__excedente"
                            : undefined;
                      return (
                        <td key={dia.valor} className={classe}>
                          {aprovados.length === 0 ? (
                            <span aria-label="Sem ninguém">—</span>
                          ) : (
                            aprovados.map((a) => <span key={a.publicadorId}>{a.publicadorNome}</span>)
                          )}
                          {excedente && (
                            <span className="escala__aviso">{aprovados.length} pessoas</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
