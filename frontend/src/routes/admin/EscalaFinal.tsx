import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { apiFetch } from "../../api/client";
import { DIAS_SEMANA } from "../../constants/diasSemana";
import { TURNOS } from "../../constants/turnos";
import { formatarMes } from "../../utils/formatacao";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

/** Contrato de GET /api/admin/escalas/{mes}/grade (TECHNICAL_SPEC.md, tarefa F2-BE-07). */
interface PublicadorGrade {
  publicadorId: string;
  publicadorNome: string;
}

interface CelulaGrade {
  carrinhoId: number;
  carrinhoNome: string;
  diaSemana: number;
  turnoId: number;
  publicadores: PublicadorGrade[];
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
      <Alert variant="destructive">
        <AlertDescription>Mês da escala não informado na URL.</AlertDescription>
      </Alert>
    );
  }

  if (carregando) {
    return <p className="text-muted-foreground">Carregando escala final…</p>;
  }

  if (erro) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{erro}</AlertDescription>
      </Alert>
    );
  }

  const listaCelulas = celulas ?? [];

  if (listaCelulas.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <h1>Escala final</h1>
        <Card className="items-center gap-2 py-10 text-center text-muted-foreground">
          <strong className="block text-[1.1rem] text-foreground">
            Nenhum pedido em {formatarMes(mes)}
          </strong>
          Os pedidos aparecem aqui assim que forem enviados ou adicionados.
        </Card>
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

  function publicadoresDaCelula(carrinhoId: number, diaSemana: number, turnoId: number): PublicadorGrade[] {
    const celula = listaCelulas.find(
      (c) => c.carrinhoId === carrinhoId && c.diaSemana === diaSemana && c.turnoId === turnoId,
    );
    return celula?.publicadores ?? [];
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <h1>Escala final</h1>
        <p className="text-muted-foreground">
          {formatarMes(mes)}. Células em vermelho têm mais de 2 pessoas.
        </p>
      </div>

      {carrinhos.map((carrinho) => (
        <section key={carrinho.carrinhoId} className="flex flex-col gap-3">
          <h2>{carrinho.carrinhoNome}</h2>
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table className="min-w-[42rem] tabular-nums">
              <TableHeader>
                <TableRow>
                  <TableHead className="border border-border">Turno</TableHead>
                  {DIAS_SEMANA.map((dia) => (
                    <TableHead key={dia.valor} className="border border-border">
                      {dia.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {TURNOS.map((turno) => (
                  <TableRow key={turno.id}>
                    <TableCell asChild>
                      <th scope="row" className="whitespace-nowrap bg-muted/60 p-2 text-left align-top text-sm font-semibold">
                        {turno.horaInicio}–{turno.horaFim}
                      </th>
                    </TableCell>
                    {DIAS_SEMANA.map((dia) => {
                      const publicadores = publicadoresDaCelula(carrinho.carrinhoId, dia.valor, turno.id);
                      const excedente = publicadores.length > 2;
                      return (
                        <TableCell
                          key={dia.valor}
                          className={cn(
                            "text-sm",
                            publicadores.length === 0 && "text-border-strong",
                            excedente &&
                              "bg-destructive-muted shadow-[inset_3px_0_0_var(--color-destructive)]",
                          )}
                        >
                          {publicadores.length === 0 ? (
                            <span aria-label="Sem ninguém">—</span>
                          ) : (
                            publicadores.map((a) => (
                              <span key={a.publicadorId} className="block">
                                {a.publicadorNome}
                              </span>
                            ))
                          )}
                          {excedente && (
                            <span className="block text-[0.8rem] font-bold text-destructive">
                              {publicadores.length} pessoas
                            </span>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      ))}
    </div>
  );
}
