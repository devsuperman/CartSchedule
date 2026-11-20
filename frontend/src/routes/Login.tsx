import { useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { apiFetch, codigoDoErro } from "../api/client";
import { ehAdministrativo, type Papel } from "../api/sessao";
import { useSessao } from "../hooks/useSessao";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

/** Contrato de POST /api/login (login único — ADR 0001). */
interface LoginResponse {
  token: string;
  papel: Papel;
}

/**
 * Login único (/login), a única tela fora da guarda ExigeLogin: usuário + senha para publicadores e
 * administradores, e a senha do administrador de recuperação no mesmo campo. Depois de entrar,
 * volta à página que pediu o login; sem ela, o publicador vai ao início e o administrador ao painel.
 */
export default function Login() {
  const [usuario, setUsuario] = useState("");
  const [pin, setPin] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const { entrar } = useSessao();
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
      entrar({ token: resposta.token, papel: resposta.papel });
      const de = (location.state as { from?: Location } | null)?.from;
      const destino = de ? `${de.pathname}${de.search ?? ""}` : ehAdministrativo(resposta.papel) ? "/admin" : "/";
      navigate(destino, { replace: true });
    } catch (err) {
      const codigo = codigoDoErro(err);
      // Muitas tentativas (429) trazem a própria mensagem do servidor.
      setErro(codigo === "MUITAS_REQUISICOES" && err instanceof Error ? err.message : "Usuário ou senha inválidos.");
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
        Senha
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
