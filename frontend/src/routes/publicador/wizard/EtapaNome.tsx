import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface EtapaNomeProps {
  nome: string;
  onChange: (nome: string) => void;
}

/** Etapa 1 do wizard: nome do publicador. Vem pré-preenchido do localStorage (via
 * usePublicadorToken, no componente pai) mas continua editável — sem cadastro/login,
 * o nome é sempre um campo livre (PLANNING.md regra 9). */
export function EtapaNome({ nome, onChange }: EtapaNomeProps) {
  return (
    <Label className="flex flex-col items-start gap-1.5">
      Seu nome
      <Input
        value={nome}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="name"
        autoFocus
        required
      />
      <span className="text-sm font-normal text-muted-foreground">
        Fica salvo neste aparelho para as próximas vezes.
      </span>
    </Label>
  );
}
