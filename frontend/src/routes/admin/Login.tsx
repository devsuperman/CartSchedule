import { useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { apiFetch } from "../../api/client";
import { useAdminAuth } from "../../hooks/useAdminAuth";

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
    <form onSubmit={handleSubmit} className="painel pilha estreita">
      <h1>Entrar como administrador</h1>
      <label className="campo">
        Usuário
        <input
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
          autoComplete="username"
          required
          autoFocus
        />
      </label>
      <label className="campo">
        Senha
        <input
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          autoComplete="current-password"
          required
        />
      </label>
      {erro && (
        <p role="alert" className="aviso aviso--erro">
          {erro}
        </p>
      )}
      <button type="submit" className="btn--primario" disabled={enviando}>
        {enviando ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
