import { useState, type FormEvent } from "react";
import { apiFetch, ApiError } from "../../../api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface PublicadorEmEdicao {
  id: string;
  nome: string;
  criancaOuIdoso: boolean;
}

/**
 * "Editar pessoa" (PUT /api/admin/publicadores/{id}): o administrador corrige o nome e marca
 * se a pessoa é criança ou idoso (pode ser a 3ª pessoa da vaga — PLANNING.md regra 1). Os dois
 * são do publicador, não do pedido: mudam em todos os pedidos dele. Nomes repetidos são
 * permitidos. O erro da API aparece dentro do modal.
 */
export function ModalEditarNome({
  publicador,
  onFechar,
  onSalvo,
}: {
  publicador: PublicadorEmEdicao | null;
  onFechar: () => void;
  onSalvo: (publicador: PublicadorEmEdicao) => void;
}) {
  return (
    <Dialog open={publicador !== null} onOpenChange={(aberto) => !aberto && onFechar()}>
      <DialogContent>
        {/* Remonta a cada publicador: o campo sempre começa com o nome atual dele. */}
        {publicador && <Formulario key={publicador.id} publicador={publicador} onSalvo={onSalvo} />}
      </DialogContent>
    </Dialog>
  );
}

function Formulario({
  publicador,
  onSalvo,
}: {
  publicador: PublicadorEmEdicao;
  onSalvo: (publicador: PublicadorEmEdicao) => void;
}) {
  const [nome, setNome] = useState(publicador.nome);
  const [criancaOuIdoso, setCriancaOuIdoso] = useState(publicador.criancaOuIdoso);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const valido = nome.trim() !== "";

  async function salvar(evento: FormEvent) {
    evento.preventDefault();
    if (!valido) return;
    const novoNome = nome.trim();
    setSalvando(true);
    setErro(null);
    try {
      await apiFetch(`/api/admin/publicadores/${publicador.id}`, {
        method: "PUT",
        body: JSON.stringify({ nome: novoNome, criancaOuIdoso }),
      });
      onSalvo({ id: publicador.id, nome: novoNome, criancaOuIdoso });
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form className="grid gap-4" onSubmit={salvar}>
      <DialogHeader>
        <DialogTitle>Editar pessoa</DialogTitle>
        <DialogDescription>Vale para todos os pedidos desta pessoa.</DialogDescription>
      </DialogHeader>
      <Input
        aria-label="Nome do publicador"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        maxLength={200}
        autoFocus
        required
      />
      <CampoCriancaOuIdoso marcado={criancaOuIdoso} onMudar={setCriancaOuIdoso} />
      {erro && (
        <Alert variant="destructive">
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline" disabled={salvando}>
            Cancelar
          </Button>
        </DialogClose>
        <Button type="submit" disabled={!valido || salvando}>
          {salvando ? "Salvando…" : "Salvar"}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Caixa "Criança ou idoso", usada em Editar pessoa e na adição pelo "+". */
export function CampoCriancaOuIdoso({ marcado, onMudar }: { marcado: boolean; onMudar: (marcado: boolean) => void }) {
  return (
    <Label className="min-h-11 font-normal">
      <Checkbox checked={marcado} onCheckedChange={(valor) => onMudar(valor === true)} />
      Criança ou idoso (pode ser a 3ª pessoa da vaga)
    </Label>
  );
}
