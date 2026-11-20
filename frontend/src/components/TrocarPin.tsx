import { useState, type FormEvent } from "react";
import { apiFetch, ApiError } from "../api/client";
import { iniciarSessao, type Sessao } from "../api/sessao";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const FORMATO_PIN = /^[0-9]{4}$/;

/** Mensagens por `codigo` do PUT /api/eu/pin; o 400 de formato já é barrado aqui antes. */
const MENSAGENS: Record<string, string> = {
  PIN_ATUAL_INVALIDO: "O PIN atual não confere.",
  PIN_FRACO: "Esse PIN é fácil de adivinhar. Evite números todos iguais ou em sequência (como 1234).",
};

/**
 * "Trocar PIN" do menu "Olá" (issue #50): PIN atual + o novo duas vezes. A API devolve um token
 * novo — este aparelho continua logado e os outros aparelhos da pessoa são desconectados.
 */
export function TrocarPin({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  return (
    <Dialog open={aberto} onOpenChange={(abrir) => !abrir && onFechar()}>
      <DialogContent>{aberto && <FormularioTrocarPin onFechar={onFechar} />}</DialogContent>
    </Dialog>
  );
}

function FormularioTrocarPin({ onFechar }: { onFechar: () => void }) {
  const [pinAtual, setPinAtual] = useState("");
  const [pinNovo, setPinNovo] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [trocado, setTrocado] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErro(null);
    if (!FORMATO_PIN.test(pinNovo)) {
      setErro("O PIN novo precisa ter exatamente 4 dígitos.");
      return;
    }
    if (pinNovo !== confirmacao) {
      setErro("A confirmação não é igual ao PIN novo.");
      return;
    }

    setEnviando(true);
    try {
      const sessao = await apiFetch<Sessao>("/api/eu/pin", {
        method: "PUT",
        body: JSON.stringify({ pinAtual, pinNovo }),
      });
      iniciarSessao(sessao);
      setTrocado(true);
    } catch (err) {
      const codigo =
        err instanceof ApiError ? (err.details as { codigo?: string } | null | undefined)?.codigo : undefined;
      setErro((codigo && MENSAGENS[codigo]) ?? "Não foi possível trocar o PIN. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  if (trocado) {
    return (
      <div className="grid gap-4">
        <DialogHeader>
          <DialogTitle>PIN trocado</DialogTitle>
          <DialogDescription>
            Use o PIN novo para entrar. Seus outros aparelhos foram desconectados.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" onClick={onFechar}>
            Entendi
          </Button>
        </DialogFooter>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>Trocar PIN</DialogTitle>
        <DialogDescription>
          O PIN novo tem 4 dígitos. Ao trocar, seus outros aparelhos são desconectados.
        </DialogDescription>
      </DialogHeader>
      <CampoPin rotulo="PIN atual" valor={pinAtual} onMudar={setPinAtual} autoComplete="current-password" autoFocus />
      <CampoPin rotulo="PIN novo" valor={pinNovo} onMudar={setPinNovo} autoComplete="new-password" />
      <CampoPin rotulo="Confirme o PIN novo" valor={confirmacao} onMudar={setConfirmacao} autoComplete="new-password" />
      {erro && (
        <Alert variant="destructive">
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onFechar} disabled={enviando}>
          Cancelar
        </Button>
        <Button type="submit" disabled={enviando}>
          {enviando ? "Trocando…" : "Trocar PIN"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function CampoPin({
  rotulo,
  valor,
  onMudar,
  autoComplete,
  autoFocus,
}: {
  rotulo: string;
  valor: string;
  onMudar: (valor: string) => void;
  autoComplete: string;
  autoFocus?: boolean;
}) {
  return (
    <Label className="flex flex-col items-start gap-1.5">
      {rotulo}
      <Input
        type="password"
        inputMode="numeric"
        maxLength={4}
        value={valor}
        onChange={(e) => onMudar(e.target.value)}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        required
      />
    </Label>
  );
}
