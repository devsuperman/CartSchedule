import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "../api/client";

/** Contrato de GET /api/janela (TECHNICAL_SPEC.md §2.5, tarefa F1-BE-01). */
export interface JanelaResponse {
  aberta: boolean;
  /** Primeiro dia do mês-alvo (mês seguinte), formato ISO (ex: "2026-10-01"). */
  mesAlvo: string;
}

interface UseJanelaResult {
  janela: JanelaResponse | null;
  carregando: boolean;
  erro: string | null;
  tentarNovamente: () => void;
}

/** Código que o backend põe no ProblemDetails ao recusar algo por estar fora da janela. */
const CODIGO_JANELA_FECHADA = "JANELA_FECHADA";

/** True se o erro veio do backend recusando o request por a janela de envio estar fechada
 * (e não por qualquer outro 400 — token inválido, turno indisponível, validação…). */
export function ehErroDeJanelaFechada(err: unknown): boolean {
  return (
    err instanceof ApiError &&
    (err.details as { codigo?: string } | null | undefined)?.codigo === CODIGO_JANELA_FECHADA
  );
}

/** Consome GET /api/janela para saber se o envio está aberto e para qual mês. */
export function useJanela(): UseJanelaResult {
  const [janela, setJanela] = useState<JanelaResponse | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let cancelado = false;

    apiFetch<JanelaResponse>("/api/janela")
      .then((resposta) => {
        if (!cancelado) {
          setJanela(resposta);
        }
      })
      .catch((err: unknown) => {
        if (!cancelado) {
          setErro(err instanceof Error ? err.message : "Erro ao consultar a janela de envio.");
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
  }, [tentativa]);

  function tentarNovamente() {
    setCarregando(true);
    setErro(null);
    setTentativa((t) => t + 1);
  }

  return { janela, carregando, erro, tentarNovamente };
}
