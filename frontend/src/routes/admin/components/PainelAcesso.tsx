import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DialogClose, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { mensagemDeAcesso, type Credenciais } from "./publicadores";

/**
 * Conteúdo do diálogo que mostra usuário e PIN — a única vez (criação ou redefinição) —, com
 * "Copiar mensagem" pronta para o WhatsApp. "Pronto" fecha o diálogo em que está. `children`
 * entra entre as credenciais e os botões (ex: o resultado de adicionar à vaga).
 */
export function PainelAcesso({
  nome,
  credenciais,
  children,
}: {
  nome: string;
  credenciais: Credenciais;
  children?: ReactNode;
}) {
  const [copiado, setCopiado] = useState<"sim" | "falhou" | null>(null);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(mensagemDeAcesso(nome, credenciais));
      setCopiado("sim");
    } catch {
      setCopiado("falhou");
    }
  }

  return (
    <div className="grid gap-4">
      <DialogHeader>
        <DialogTitle>Acesso de {nome}</DialogTitle>
        <DialogDescription>Envie agora: o PIN não será mostrado de novo.</DialogDescription>
      </DialogHeader>
      <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-2">
        <dt className="text-muted-foreground">Usuário</dt>
        <dd className="text-[1.1rem] font-bold">{credenciais.usuario}</dd>
        <dt className="text-muted-foreground">PIN</dt>
        <dd className="font-mono text-[1.6rem] font-bold tracking-[0.3em]">{credenciais.pin}</dd>
      </dl>
      {children}
      {copiado === "falhou" && (
        <Alert variant="destructive">
          <AlertDescription>Não foi possível copiar. Anote o usuário e o PIN acima.</AlertDescription>
        </Alert>
      )}
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Pronto
          </Button>
        </DialogClose>
        <Button type="button" onClick={copiar}>
          {copiado === "sim" ? "Mensagem copiada" : "Copiar mensagem"}
        </Button>
      </DialogFooter>
    </div>
  );
}
