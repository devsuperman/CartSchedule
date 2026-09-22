import { DIAS_SEMANA } from "../constants/diasSemana";
import { TURNOS } from "../constants/turnos";

/** Aceita "2026-10" ou "2026-10-01" e devolve "outubro de 2026". */
export function formatarMes(valor: string): string {
  const [ano, mes] = valor.split("-").map(Number);
  if (!ano || !mes) return valor;
  return new Date(ano, mes - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

export function formatarTurno(turnoId: number): string {
  const turno = TURNOS.find((t) => t.id === turnoId);
  return turno ? `${turno.horaInicio}–${turno.horaFim}` : `Turno ${turnoId}`;
}

export function formatarDia(diaSemana: number): string {
  return DIAS_SEMANA.find((d) => d.valor === diaSemana)?.label ?? `Dia ${diaSemana}`;
}

export const STATUS = {
  Pendente: 1,
  Aprovada: 2,
  Rejeitada: 3,
  Cancelada: 4,
} as const;

export const STATUS_LABELS: Record<number, string> = {
  [STATUS.Pendente]: "Pendente",
  [STATUS.Aprovada]: "Aprovada",
  [STATUS.Rejeitada]: "Rejeitada",
  [STATUS.Cancelada]: "Cancelada",
};

export const STATUS_BADGE_VARIANT: Record<number, "pendente" | "aprovada" | "rejeitada" | "cancelada"> = {
  [STATUS.Pendente]: "pendente",
  [STATUS.Aprovada]: "aprovada",
  [STATUS.Rejeitada]: "rejeitada",
  [STATUS.Cancelada]: "cancelada",
};
