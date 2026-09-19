/** Espelha Domain/Turno.cs + o seed de Infrastructure/AppDbContext.cs — nunca cadastrável pelo admin. */
export interface Turno {
  id: number;
  horaInicio: string;
  horaFim: string;
}

export const TURNOS: readonly Turno[] = [
  { id: 1, horaInicio: "06:00", horaFim: "08:00" },
  { id: 2, horaInicio: "08:00", horaFim: "10:00" },
  { id: 3, horaInicio: "10:00", horaFim: "12:00" },
  { id: 4, horaInicio: "14:00", horaFim: "16:00" },
  { id: 5, horaInicio: "16:00", horaFim: "18:00" },
  { id: 6, horaInicio: "18:00", horaFim: "20:00" },
];
