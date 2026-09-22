import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { apiFetch, ApiError } from "../../api/client";
import { DIAS_SEMANA, DiaSemana } from "../../constants/diasSemana";
import { TURNOS } from "../../constants/turnos";
import { formatarMes } from "../../utils/formatacao";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";

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
    return (
      <Alert variant="destructive">
        <AlertDescription>Escala não informada na URL.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[34rem] flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <h1>Adicionar solicitação</h1>
        <p className="text-muted-foreground">
          Escala de {formatarMes(mes)}. O pedido entra direto como aprovado.
        </p>
      </div>

      {carregandoCarrinhos && <p className="text-muted-foreground">Carregando carrinhos…</p>}
      {erroCarrinhos && (
        <Alert variant="destructive">
          <AlertDescription>{erroCarrinhos}</AlertDescription>
        </Alert>
      )}

      {!carregandoCarrinhos && !erroCarrinhos && (
        <Card asChild>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Label className="flex flex-col items-start gap-1.5">
              Nome do publicador
              <Input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                list="nomes-vistos"
                required
                autoFocus
              />
              <span className="text-sm font-normal text-muted-foreground">
                Se o nome já existir, o pedido vai para o mesmo publicador. Se for novo, ele é criado.
              </span>
              <datalist id="nomes-vistos">
                {nomesVistos.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
            </Label>

            <Label className="flex flex-col items-start gap-1.5">
              Carrinho
              <Select
                value={carrinhoId === "" ? undefined : String(carrinhoId)}
                onValueChange={handleCarrinhoChange}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione um carrinho" />
                </SelectTrigger>
                <SelectContent>
                  {carrinhos.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Label>

            <Label className="flex flex-col items-start gap-1.5">
              Dia da semana
              <Select
                value={diaSemana === "" ? undefined : String(diaSemana)}
                onValueChange={(valor) => setDiaSemana(Number(valor) as DiaSemana)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione um dia" />
                </SelectTrigger>
                <SelectContent>
                  {DIAS_SEMANA.map((d) => (
                    <SelectItem key={d.valor} value={String(d.valor)}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Label>

            <Label className="flex flex-col items-start gap-1.5">
              Turno
              <Select
                value={turnoId === "" ? undefined : String(turnoId)}
                onValueChange={(valor) => setTurnoId(Number(valor))}
                disabled={!carrinhoSelecionado}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={
                      carrinhoSelecionado ? "Selecione um turno" : "Selecione um carrinho primeiro"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {turnosDisponiveis.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.horaInicio}–{t.horaFim}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Label>

            {erroEnvio && (
              <Alert variant="destructive">
                <AlertDescription>{erroEnvio}</AlertDescription>
              </Alert>
            )}
            {confirmacao && (
              <Alert variant="success">
                <AlertDescription>{confirmacao}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" disabled={enviando}>
              {enviando ? "Adicionando…" : "Adicionar solicitação"}
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
}
