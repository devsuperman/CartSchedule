# Deploy na AWS (Lightsail, servidor único)

Foco: **publicar fácil e barato**. Tudo roda numa única instância do
[Amazon Lightsail](https://lightsail.aws.amazon.com) com Docker Compose:

```
Internet ──443/80──▶ caddy (HTTPS automático) ──▶ web (nginx: SPA + /api/*) ──▶ api ──▶ db (PostgreSQL)
```

- Só o Caddy expõe portas (80/443). Banco e API ficam na rede interna do Docker.
- Front e API no **mesmo domínio** (`/api/*` é repassado pelo nginx), então não
  há configuração de CORS nem URL da API para ajustar.
- Certificado HTTPS (Let's Encrypt) emitido e renovado sozinho pelo Caddy.

Custo aproximado: plano Linux de **1 GB de RAM (~US$ 7/mês)**, com IP estático
incluso enquanto estiver anexado à instância. Se o build ficar lento demais,
suba para o de 2 GB (~US$ 12/mês). Confira os preços atuais no console.

## 1. Criar a instância

1. Lightsail → **Create instance** → região **São Paulo** (menor latência).
2. Plataforma **Linux/Unix** → *OS Only* → **Ubuntu 24.04 LTS**.
3. Escolha o plano (1 GB ou 2 GB) e crie.
4. Aba **Networking** da instância:
   - **Attach static IP** (senão o IP muda ao reiniciar).
   - Em *IPv4 Firewall*, adicione a regra **HTTPS (443)**. SSH (22) e HTTP (80)
     já vêm liberados.

## 2. Apontar o domínio

Crie um registro **A** do seu domínio (ex.: `escala.seudominio.com.br`) para o
IP estático. Espere o DNS propagar (`ping escala.seudominio.com.br` deve
responder com o IP).

> Sem domínio? Use `IP-COM-TRACOS.sslip.io` (ex.: `3-12-45-67.sslip.io`): é
> gratuito e já aponta para o IP. Serve para começar, mas um domínio próprio
> é mais confiável (o sslip.io é compartilhado e pode esbarrar em limites do
> Let's Encrypt).

## 3. Preparar o servidor

Conecte pelo botão **Connect using SSH** do Lightsail (ou `ssh ubuntu@IP`):

```bash
git clone https://github.com/devsuperman/CartSchedule.git
cd CartSchedule
sudo bash deploy/instalar-servidor.sh   # Docker, swap de 2 GB e backup diário
exit                                    # saia e conecte de novo (grupo docker)
```

> Repositório privado: clone com um *Personal Access Token* do GitHub
> (somente leitura) no lugar da senha, ou cadastre uma *deploy key*.

## 4. Configurar os segredos

```bash
cd ~/CartSchedule
cp .env.example .env
python3 deploy/gerar-segredos.py   # pede a senha do admin e imprime os valores
nano .env                          # cole os valores e preencha ADMIN_USUARIO e DOMINIO
chmod 600 .env
```

`DOMINIO` vai sem `https://` (ex.: `escala.seudominio.com.br`).

Opcional: `WHATSAPP_GRUPO_URL` com o link de convite do grupo do WhatsApp
(WhatsApp → dados do grupo → *Convidar via link*). Ele liga o botão
"Terminei!", que devolve o publicador para o grupo. Quem abre o site vê esse
link. Com o [deploy automático](#deploy-automático) esse valor vem da variável
`WHATSAPP_GRUPO_URL` do GitHub, e não do `.env`.

## 5. Subir

As imagens da API e do front são geradas pelo GitHub Actions a cada merge na
`main` e publicadas no `ghcr.io` (ver [Deploy automático](#deploy-automático)).
Para subir a última versão:

```bash
bash deploy/atualizar.sh latest
docker compose -f docker-compose.prod.yml ps
```

> Ainda sem nenhuma imagem publicada (antes do primeiro merge com o deploy
> automático)? Builde no próprio servidor:
> `docker compose -f docker-compose.prod.yml up -d --build` (leva alguns minutos).

As migrations e o seed dos turnos rodam sozinhos quando a API sobe. Depois acesse `https://SEU_DOMINIO` (publicador) e
`https://SEU_DOMINIO/admin` (administrador).

## Deploy automático

Cada merge na `main` dispara o workflow **Deploy**
(`.github/workflows/deploy.yml`), sem aprovação manual:

1. **Testes** do backend e do frontend (o mesmo `ci.yml` que roda nos PRs).
   Falhou → nada é publicado.
2. **Build** das imagens `cartschedule-api` e `cartschedule-web`, publicadas no
   `ghcr.io/devsuperman/` com a tag = SHA do commit (e `latest`).
3. **SSH no servidor**: `git pull` até o commit (compose, Caddyfile e scripts) e
   `deploy/atualizar.sh <sha>`, que faz backup do banco, baixa as imagens,
   recria os containers e espera a API responder em `/health`. Se ela não
   responder, volta sozinho para a versão anterior e o workflow fica vermelho.

O servidor não builda nada (só baixa as imagens), então o plano de 1 GB basta.
Os segredos da aplicação (`.env`) **continuam só no servidor**. O GitHub guarda
apenas o acesso SSH.

### Configuração (uma vez)

**No servidor** (`ssh ubuntu@IP`, com o repositório já em `~/CartSchedule`):

```bash
# Chave exclusiva do deploy, sem senha (o GitHub Actions usa a privada)
ssh-keygen -t ed25519 -N "" -C "github-actions-deploy" -f ~/deploy_key
cat ~/deploy_key.pub >> ~/.ssh/authorized_keys
cat ~/deploy_key          # copie para o secret LIGHTSAIL_SSH_KEY e depois:
rm ~/deploy_key ~/deploy_key.pub
```

O repositório no servidor precisa estar na branch `main` e sem alterações
locais: o deploy só avança por *fast-forward* e falha, sem mexer em nada, se
alguém editou arquivos versionados direto no servidor. O `.env` não é
versionado e por isso não atrapalha.

**No seu computador**, gere o conteúdo do `known_hosts`. Com ele o Actions só
conecta no seu servidor:

```bash
ssh-keyscan -t ed25519 IP_ESTATICO
```

**No GitHub** (repositório → *Settings*):

- *Environments* → **New environment** `production` → *Environment secrets*:
  - `LIGHTSAIL_HOST`: o IP estático.
  - `LIGHTSAIL_SSH_KEY`: a chave privada inteira (de `-----BEGIN` até `END-----`).
  - `LIGHTSAIL_KNOWN_HOSTS`: a saída do `ssh-keyscan` acima.
- *Secrets and variables* → *Actions* → aba **Variables** (do repositório):
  - `WHATSAPP_GRUPO_URL` (opcional): link do botão "Terminei!". Agora ele é
    embutido no build do GitHub, não no `.env` do servidor; mudou → rode o
    workflow de novo (*Actions → Deploy → Run workflow*).
  - `LIGHTSAIL_USER` (opcional): usuário SSH, se não for `ubuntu`.
- *Branches* → **Add branch ruleset** para a `main`: exija PR e os checks
  **Backend (dotnet test)** e **Frontend (lint, test, build)**. Assim nada
  quebrado chega a ser mergeado.

**Depois do primeiro deploy**, em *github.com/devsuperman → Packages*, abra
`cartschedule-api` e `cartschedule-web` → *Package settings* → **Change
visibility → Public**. Pacotes novos do ghcr.io nascem privados, e o servidor
baixa as imagens sem login (o repositório já é público, então as imagens não
expõem nada novo). Até fazer isso, o primeiro deploy falha no `pull`. Depois
de mudar, rode *Actions → Deploy → Run workflow*.

### Rollback

*Actions → Deploy → Run workflow* com o campo **tag** = SHA de um commit da
`main` já publicado. Testes e build são pulados e o servidor volta para
aquelas imagens. Pelo terminal do servidor: `bash deploy/atualizar.sh <sha>`.

> Uma versão antiga da API não desfaz migrations novas do banco. Se a versão
> com problema trouxe migration, restaure também o backup feito antes do
> deploy (`~/backups`, ver abaixo).

## Operação do dia a dia

```bash
cd ~/CartSchedule
alias dc='docker compose -f docker-compose.prod.yml'

# Atualizar: é automático a cada merge na main (ver abaixo). À mão:
git pull && bash deploy/atualizar.sh latest

# Logs
dc logs -f api
dc logs -f caddy     # problemas de HTTPS/certificado aparecem aqui
```

### Backups

- **Dump diário**: `deploy/backup.sh` roda todo dia às 03:30 (agendado pelo
  `instalar-servidor.sh`) e mantém os 14 últimos em `~/backups`. Para rodar na
  hora: `./deploy/backup.sh`.
- **Snapshots da instância**: no Lightsail, aba **Snapshots** → ative
  *Automatic snapshots*. Custa centavos por GB e cobre o servidor inteiro,
  inclusive `~/backups`.
- **Cópia fora do servidor (opcional)**: crie um bucket S3, instale e configure a
  AWS CLI (`sudo snap install aws-cli --classic && aws configure`, com uma
  chave IAM que só pode gravar nesse bucket) e defina `BACKUP_S3_BUCKET` no
  `.env`.

Restaurar um dump:

```bash
gunzip -c ~/backups/cartschedule-AAAAMMDD-HHMMSS.sql.gz \
  | docker compose -f docker-compose.prod.yml exec -T db psql -U cartschedule -d cartschedule
```

### Segurança

O sistema não tem login para o publicador; a API limita requisições por IP
(bots e força bruta no login do admin recebem 429 — aparece como warning em
`dc logs api`). Do lado do servidor, confira:

- **Firewall do Lightsail** só com 22, 80 e 443 (banco e API não ficam expostos).
- **SSH só por chave** (o padrão do Lightsail) — não habilite senha.
- **Atualizações automáticas** do Ubuntu:
  `systemctl status unattended-upgrades` deve estar ativo.
- **Senha do admin forte**, gerada pelo `deploy/gerar-segredos.py`.
- **Backup fora do servidor** (snapshots automáticos ou S3, acima).
- Ataque pesado (muitos IPs ao mesmo tempo)? Coloque o domínio atrás do
  Cloudflare (plano grátis, proxy ligado) — não precisa mudar código, mas aí o
  IP do cliente passa a vir no `CF-Connecting-IP` e o rate limit precisa ser
  ajustado para lê-lo.

### Problemas comuns

- **HTTPS não sobe**: o DNS ainda não aponta para o IP, ou a porta 443 não foi
  liberada no firewall do Lightsail. Veja `dc logs caddy`.
- **Build morre por falta de memória**: confirme a swap (`swapon --show`) ou
  suba o plano para 2 GB.
- **Login do admin falha**: gere de novo o hash com `deploy/gerar-segredos.py`,
  atualize o `.env` e rode `dc up -d` para recriar a API.
