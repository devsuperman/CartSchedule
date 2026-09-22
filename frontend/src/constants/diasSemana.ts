/** Espelha Domain/Enums/DiaSemana.cs — só Segunda a Sexta, nunca Sábado/Domingo. */
export const DiaSemana = {
  Segunda: 1,
  Terca: 2,
  Quarta: 3,
  Quinta: 4,
  Sexta: 5,
} as const;

export type DiaSemana = (typeof DiaSemana)[keyof typeof DiaSemana];

export const DIAS_SEMANA: readonly { valor: DiaSemana; label: string; curto: string }[] = [
  { valor: DiaSemana.Segunda, label: "Segunda-feira", curto: "Seg" },
  { valor: DiaSemana.Terca, label: "Terça-feira", curto: "Ter" },
  { valor: DiaSemana.Quarta, label: "Quarta-feira", curto: "Qua" },
  { valor: DiaSemana.Quinta, label: "Quinta-feira", curto: "Qui" },
  { valor: DiaSemana.Sexta, label: "Sexta-feira", curto: "Sex" },
];
