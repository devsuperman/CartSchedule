import { useEffect, useState } from "react";

const CONSULTA = "(min-width: 768px)";

function consultar(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia(CONSULTA).matches
    : false;
}

/** true a partir de tablet (768px, o `md` do Tailwind). Sem `matchMedia` (jsdom), conta como celular. */
export function useTelaLarga(): boolean {
  const [larga, setLarga] = useState(consultar);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia(CONSULTA);
    const atualizar = () => setLarga(media.matches);
    atualizar();
    media.addEventListener("change", atualizar);
    return () => media.removeEventListener("change", atualizar);
  }, []);

  return larga;
}
