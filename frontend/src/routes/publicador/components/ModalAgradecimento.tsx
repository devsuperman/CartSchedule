import { useEffect, useState } from "react";
import { abrirGrupoWhatsapp, GRUPO_WHATSAPP_URL } from "../../../constants/whatsapp";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const SEGUNDOS_PARA_REDIRECIONAR = 5;

/**
 * Agradece o publicador ao terminar e o leva ao grupo do WhatsApp após uma contagem
 * regressiva. Fechar o modal cancela o redirecionamento (quem tocou sem querer não sai do
 * site). O link "Ir para o WhatsApp agora" existe porque, no celular, uma navegação
 * disparada por timer pode abrir a página web do chat.whatsapp.com em vez do app — um toque
 * direto garante o app.
 */
export function ModalAgradecimento({
  aberto,
  onAbertoChange,
}: {
  aberto: boolean;
  onAbertoChange: (aberto: boolean) => void;
}) {
  return (
    <Dialog open={aberto} onOpenChange={onAbertoChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Muito Obrigado!</DialogTitle>
          <DialogDescription>
            Que Jeová abençoe seu trabalho árduo! Vamos te redirecionar pro whatsapp
          </DialogDescription>
        </DialogHeader>
        <Contagem />
        <DialogFooter>
          <Button asChild size="lg" className="w-full">
            <a href={GRUPO_WHATSAPP_URL}>Ir para o WhatsApp agora</a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Montada só com o modal aberto (o Radix desmonta o conteúdo ao fechar): montar inicia a
 * contagem e desmontar a cancela. */
function Contagem() {
  const [restantes, setRestantes] = useState(SEGUNDOS_PARA_REDIRECIONAR);

  useEffect(() => {
    const inicio = Date.now();
    const intervalo = setInterval(() => {
      const faltam = SEGUNDOS_PARA_REDIRECIONAR - Math.floor((Date.now() - inicio) / 1000);
      setRestantes(Math.max(faltam, 0));
      if (faltam <= 0) {
        clearInterval(intervalo);
        abrirGrupoWhatsapp();
      }
    }, 1000);

    return () => clearInterval(intervalo);
  }, []);

  return (
    <p className="text-sm text-muted-foreground tabular-nums" aria-live="polite">
      Redirecionando em {restantes}…
    </p>
  );
}
