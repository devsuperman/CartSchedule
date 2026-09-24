import { useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { apiFetch } from "../../api/client";
import { usePublicadorToken } from "../../hooks/usePublicadorToken";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";

/** Estado de navegação do link "Olá, Fulano": a tela para onde voltar depois de editar. */
export interface OrigemNome {
  de?: string;
}

/**
 * Rota "/nome". Sem nome salvo é o primeiro acesso: pergunta o nome e segue para a tela
 * inicial (que leva ao wizard se for o caso). Com nome salvo é a edição, aberta pelo
 * "Olá, Fulano" do cabeçalho: salva no aparelho e no servidor (PUT /api/publicador), para o
 * administrador ver o nome novo na hora, e volta para a tela de origem. Sem cadastro/login,
 * o nome é um campo livre (PLANNING.md regra 9).
 */
export default function Nome() {
  const navigate = useNavigate();
  const location = useLocation();
  const { nome, setNome } = usePublicadorToken();
  // Decidido só na montagem: salvar o nome no primeiro acesso não vira "edição" no meio do caminho.
  const [primeiroAcesso] = useState(() => nome.trim() === "");
  const [rascunho, setRascunho] = useState(nome);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const destino = (location.state as OrigemNome | null)?.de ?? "/";
  const valido = rascunho.trim() !== "";

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (!valido) return;
    const novoNome = rascunho.trim();
    setNome(novoNome);

    if (primeiroAcesso) {
      // O publicador ainda não existe no servidor: o nome vai junto com o primeiro pedido.
      navigate("/", { replace: true });
      return;
    }

    setSalvando(true);
    setErro(null);
    try {
      await apiFetch("/api/publicador", { method: "PUT", body: JSON.stringify({ nome: novoNome }) });
      navigate(destino, { replace: true });
    } catch {
      setErro("Não foi possível salvar agora. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={enviar}>
      <h1 className="text-xl">{primeiroAcesso ? "Qual é o seu nome?" : "Alterar nome"}</h1>
      <Input
        aria-label="Seu nome"
        placeholder="Nome e sobrenome"
        value={rascunho}
        onChange={(e) => setRascunho(e.target.value)}
        autoComplete="name"
        autoFocus
        maxLength={200}
        required
      />

      {erro && (
        <Alert variant="destructive">
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}

      <div className="flex gap-3">
        {!primeiroAcesso && (
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={salvando}
            onClick={() => navigate(destino, { replace: true })}
          >
            Cancelar
          </Button>
        )}
        <Button type="submit" size="lg" className="flex-1" disabled={!valido || salvando}>
          {primeiroAcesso ? "Continuar" : salvando ? "Salvando…" : "Salvar"}
        </Button>
      </div>
    </form>
  );
}
