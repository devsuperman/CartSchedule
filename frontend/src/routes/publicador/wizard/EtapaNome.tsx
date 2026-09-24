import { Input } from "@/components/ui/input";

interface EtapaNomeProps {
  nome: string;
  onChange: (nome: string) => void;
}

/** Etapa 1 do wizard: nome do publicador. Vem pré-preenchido do localStorage (via
 * usePublicadorToken, no componente pai) mas continua editável — sem cadastro/login,
 * o nome é sempre um campo livre (PLANNING.md regra 9). */
export function EtapaNome({ nome, onChange }: EtapaNomeProps) {
  return (
    // Sem rótulo visível: o título da etapa ("Qual é o seu nome?") já faz a pergunta.
    <Input
      aria-label="Seu nome"
      value={nome}
      onChange={(e) => onChange(e.target.value)}
      autoComplete="name"
      autoFocus
      required
    />
  );
}
