FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# O Vite embute VITE_API_URL no bundle em tempo de build (não em runtime).
# Deve ser a URL da API acessível pelo NAVEGADOR do usuário.
ARG VITE_API_URL=http://localhost:5000
ENV VITE_API_URL=$VITE_API_URL
# Link de convite do grupo do WhatsApp para o botão "Terminei!" (vazio = sem botão).
ARG VITE_WHATSAPP_GRUPO_URL=""
ENV VITE_WHATSAPP_GRUPO_URL=$VITE_WHATSAPP_GRUPO_URL
RUN npm run build

FROM nginx:alpine AS final
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
