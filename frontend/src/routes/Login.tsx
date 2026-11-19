import { useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { apiFetch, ApiError } from "../api/client";
import { useAdminAuth } from "../hooks/useAdminAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

/** Contrato de POST /api/login (login único — ADR 0001). */
interface LoginResponse {
  token: string;
  papel: "publicador" | "administrador" | "recuperacao";
}

/**
 * Login único (/login): usuário + PIN. Serve aos publicadores marcados como administrador e ao
 * administrador de recuperação (cuja senha vai no mesmo campo). Os publicadores comuns ainda
 * não têm área logada: o restante do site segue anônimo até a virada (#49).
 */
export default function Login() {
  const [usuario, setUsuario] = useState("");
  const [pin, setPin] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const { login } = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErro(null);
    setEnviando(true);

    try {
      const resposta = await apiFetch<LoginResponse>("/api/login", {
        method: "POST",
        body: JSON.stringify({ usuario, pin }),
      });
      if (resposta.papel === "publicador") {
        setErro("Por enquanto só administradores entram por aqui.");
        return;
      }
      login(resposta.token);
      const destino = (location.state as { from?: Location })?.from?.pathname ?? "/admin";
      navigate(destino, { replace: true });
    } catch (err) {
      const codigo =
        err instanceof ApiError ? (err.details as { codigo?: string } | null | undefined)?.codigo : undefined;
      // Muitas tentativas (429) e conta desativada trazem a própria mensagem do servidor.
      const mensagemDoServidor = codigo === "MUITAS_REQUISICOES" || codigo === "PUBLICADOR_INATIVO";
      setErro(mensagemDoServidor && err instanceof Error ? err.message : "Usuário ou PIN inválidos.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto flex w-full max-w-[34rem] flex-col gap-4 rounded-lg border border-border bg-card p-5"
    >
      <h1>Entrar</h1>
      <Label className="flex flex-col items-start gap-1.5">
        Usuário
        <Input
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          required
          autoFocus
        />
      </Label>
      <Label className="flex flex-col items-start gap-1.5">
        PIN
        <Input
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          autoComplete="current-password"
          required
        />
      </Label>
      {erro && (
        <Alert variant="destructive">
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" disabled={enviando}>
        {enviando ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}
