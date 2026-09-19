import { useEffect, useState } from "react";
import { apiFetch } from "../api/client";

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
}

/** Consome GET /api/janela para saber se o envio está aberto e para qual mês. */
export function useJanela(): UseJanelaResult {
  const [janela, setJanela] = useState<JanelaResponse | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

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
  }, []);

  return { janela, carregando, erro };
}
