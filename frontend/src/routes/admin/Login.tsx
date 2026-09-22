import { useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { apiFetch } from "../../api/client";
import { useAdminAuth } from "../../hooks/useAdminAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

/** Contrato de POST /api/admin/login (TECHNICAL_SPEC.md §2.2, tarefa F2-BE-01). */
interface LoginResponse {
  token: string;
}

export default function Login() {
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
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
      const resposta = await apiFetch<LoginResponse>("/api/admin/login", {
        method: "POST",
        body: JSON.stringify({ usuario, senha }),
      });
      login(resposta.token);
      const destino = (location.state as { from?: Location })?.from?.pathname ?? "/admin";
      navigate(destino, { replace: true });
    } catch {
      setErro("Usuário ou senha inválidos.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto flex w-full max-w-[34rem] flex-col gap-4 rounded-lg border border-border bg-card p-5"
    >
      <h1>Entrar como administrador</h1>
      <Label className="flex flex-col items-start gap-1.5">
        Usuário
        <Input
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
          autoComplete="username"
          required
          autoFocus
        />
      </Label>
      <Label className="flex flex-col items-start gap-1.5">
        Senha
        <Input
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
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
