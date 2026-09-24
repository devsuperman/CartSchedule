import { DIAS_SEMANA } from "../constants/diasSemana";
import { TURNOS } from "../constants/turnos";

/** Aceita "2026-10" ou "2026-10-01" e devolve "outubro de 2026". */
export function formatarMes(valor: string): string {
  const [ano, mes] = valor.split("-").map(Number);
  if (!ano || !mes) return valor;
  return new Date(ano, mes - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

/** Aceita "2026-10" ou "2026-10-01" e devolve só o nome do mês: "outubro". */
export function formatarNomeMes(valor: string): string {
  const [ano, mes] = valor.split("-").map(Number);
  if (!ano || !mes) return valor;
  return new Date(ano, mes - 1, 1).toLocaleDateString("pt-BR", { month: "long" });
}

export function formatarTurno(turnoId: number): string {
  const turno = TURNOS.find((t) => t.id === turnoId);
  return turno ? `${turno.horaInicio}–${turno.horaFim}` : `Turno ${turnoId}`;
}

export function formatarDia(diaSemana: number): string {
  return DIAS_SEMANA.find((d) => d.valor === diaSemana)?.label ?? `Dia ${diaSemana}`;
}
