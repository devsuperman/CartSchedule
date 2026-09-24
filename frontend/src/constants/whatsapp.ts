/**
 * Link de convite do grupo do WhatsApp por onde o publicador recebe o link do sistema.
 * O botão "Terminei!" abre esse link para o publicador voltar à conversa do grupo — os
 * navegadores não deixam o site fechar a própria aba. Embutido no bundle em build time
 * (VITE_WHATSAPP_GRUPO_URL); vazio = o botão não aparece.
 */
export const GRUPO_WHATSAPP_URL: string = import.meta.env.VITE_WHATSAPP_GRUPO_URL ?? "";
