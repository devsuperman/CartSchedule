#!/usr/bin/env bash
# Prepara um servidor Ubuntu 24.04 novo (ex.: AWS Lightsail) para rodar o
# CartSchedule: instala Docker, cria swap (o build do .NET/Node precisa de mais
# memória do que os planos de 1 GB têm) e agenda o backup diário do banco.
# Uso (como usuário ubuntu, dentro do repositório clonado):
#   sudo bash deploy/instalar-servidor.sh
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Rode com sudo: sudo bash deploy/instalar-servidor.sh" >&2
  exit 1
fi

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
USUARIO="${SUDO_USER:-ubuntu}"

echo "==> Instalando Docker"
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sh
fi
usermod -aG docker "$USUARIO"
systemctl enable --now docker

echo "==> Criando swap de 2 GB"
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "==> Agendando backup diário do banco (03:30, horário do servidor)"
chmod +x "$REPO_DIR/deploy/backup.sh"
cat > /etc/cron.d/cartschedule-backup <<CRON
30 3 * * * $USUARIO $REPO_DIR/deploy/backup.sh >> /home/$USUARIO/backup-cartschedule.log 2>&1
CRON

echo
echo "Pronto. Saia e entre de novo no SSH (para o grupo docker valer) e siga o deploy/README.md."
