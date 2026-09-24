import { useState, type FormEvent } from "react";
import { apiFetch, ApiError } from "../../../api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
}

/**
 * Modal do administrador para corrigir o nome de um publicador (PUT
 * /api/admin/publicadores/{id}). O nome é do publicador, não do pedido: muda em todos os
 * pedidos dele. Nomes repetidos são permitidos. O erro da API aparece dentro do modal.
 */
export function ModalEditarNome({
  publicador,
  onFechar,
  onSalvo,
}: {
  publicador: PublicadorEmEdicao | null;
  onFechar: () => void;
  onSalvo: (id: string, nome: string) => void;
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
  onSalvo: (id: string, nome: string) => void;
}) {
  const [nome, setNome] = useState(publicador.nome);
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
        body: JSON.stringify({ nome: novoNome }),
      });
      onSalvo(publicador.id, novoNome);
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Não foi possível salvar o nome.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form className="grid gap-4" onSubmit={salvar}>
      <DialogHeader>
        <DialogTitle>Editar nome</DialogTitle>
        <DialogDescription>Muda o nome em todos os pedidos desta pessoa.</DialogDescription>
      </DialogHeader>
      <Input
        aria-label="Nome do publicador"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        maxLength={200}
        autoFocus
        required
      />
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
