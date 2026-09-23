import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ErroJanelaProps {
  onTentarNovamente: () => void;
}

/** Falha ao consultar GET /api/janela. Não dá para saber se o prazo está aberto — nunca
 * tratar isso como "envio fechado". */
export function ErroJanela({ onTentarNovamente }: ErroJanelaProps) {
  return (
    <Alert variant="destructive">
      <AlertDescription className="flex flex-col items-start gap-3">
        Não foi possível verificar o prazo de envio. Confira sua conexão e tente novamente.
        <Button type="button" variant="outline" size="sm" onClick={onTentarNovamente}>
          Tentar novamente
        </Button>
      </AlertDescription>
    </Alert>
  );
}
