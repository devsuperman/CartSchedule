import { useEffect, useState } from "react";
import confetti from "canvas-confetti";
import imagemObrigado from "../../../assets/obrigado.webp";
import { abrirGrupoWhatsapp } from "../../../constants/whatsapp";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const SEGUNDOS_PARA_REDIRECIONAR = 5;

// Cores do tema (index.css): primary, accent, warning e success.
const CORES_CONFETE = ["#0b6e6e", "#dcefee", "#e0a526", "#1d6b41"];

/** Rajada curta de confete dos dois lados da tela. `disableForReducedMotion` respeita quem
 * pediu menos animação no celular. */
function soltarConfete() {
  const base = { particleCount: 60, spread: 70, startVelocity: 45, colors: CORES_CONFETE, disableForReducedMotion: true, zIndex: 60 };
  void confetti({ ...base, angle: 60, origin: { x: 0, y: 0.7 } });
  void confetti({ ...base, angle: 120, origin: { x: 1, y: 0.7 } });
}

/**
 * Agradece o publicador ao terminar e o leva ao grupo do WhatsApp após uma contagem
 * regressiva, com uma animação de joinha (Giphy Q66ZEIpjEQddUOOKGW, versão WebP 300×200) e
 * uma rajada de confete. Fechar o modal cancela o redirecionamento (quem tocou sem querer não sai do site).
 */
export function ModalAgradecimento({
  aberto,
  onAbertoChange,
}: {
  aberto: boolean;
  onAbertoChange: (aberto: boolean) => void;
}) {
  // Baixa a animação antes do toque para ele já estar pronto quando o modal abrir (5 s é pouco).
  useEffect(() => {
    new Image().src = imagemObrigado;
  }, []);

  useEffect(() => {
    if (aberto) soltarConfete();
  }, [aberto]);

  return (
    <Dialog open={aberto} onOpenChange={onAbertoChange}>
      <DialogContent className="justify-items-center text-center">
        <img src={imagemObrigado} alt="" width={300} height={200} className="h-auto w-full max-w-60 rounded-lg" />
        <DialogHeader className="items-center pr-0">
          <DialogTitle>Muito Obrigado!</DialogTitle>
          <DialogDescription>
            Que Jeová abençoe seu trabalho árduo!
          </DialogDescription>
        </DialogHeader>
        <Contagem />
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
      Voltando ao whatsapp em {restantes}…
    </p>
  );
}
