#!/usr/bin/env bash
# Один раз настраивает coturn для звонков SeldeGram + прописывает TURN-креды
# в server/.env и перезапускает Nest.
#
# Использование (на проде, под sudo):
#   cd ~/SeldeGram && sudo bash scripts/setup-turn.sh
#
# Если что-то уже настроено — переустанавливать не будет, просто перепишет
# конфиг и .env.
set -euo pipefail

echo "== SeldeGram TURN setup =="

# 1. Установка coturn (если ещё нет)
if ! command -v turnserver >/dev/null 2>&1; then
  echo "[1/7] Installing coturn..."
  apt-get update -qq
  DEBIAN_FRONTEND=noninteractive apt-get install -y coturn
else
  echo "[1/7] coturn already installed"
fi

# 2. Включаем демон в /etc/default/coturn
echo "[2/7] Enabling coturn daemon..."
if grep -q '^TURNSERVER_ENABLED' /etc/default/coturn 2>/dev/null; then
  sed -i 's/^#*TURNSERVER_ENABLED.*/TURNSERVER_ENABLED=1/' /etc/default/coturn
else
  echo "TURNSERVER_ENABLED=1" >> /etc/default/coturn
fi

# 3. Определяем внешний IP (если не задан явно через переменную)
EXTERNAL_IP="${TURN_EXTERNAL_IP:-}"
if [ -z "$EXTERNAL_IP" ]; then
  EXTERNAL_IP=$(curl -fsS --max-time 5 https://ifconfig.me || true)
fi
if [ -z "$EXTERNAL_IP" ]; then
  echo "ERROR: could not detect external IP. Re-run as: TURN_EXTERNAL_IP=<your.public.ip> sudo bash $0"
  exit 1
fi
echo "[3/7] External IP: $EXTERNAL_IP"

# 4. Сгенерировать или подхватить существующий TURN_PASSWORD
ENV_FILE="/home/seldegram/SeldeGram/server/.env"
if [ -f "$ENV_FILE" ] && grep -q '^TURN_PASSWORD=' "$ENV_FILE"; then
  TURN_PASS=$(grep '^TURN_PASSWORD=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'" )
  echo "[4/7] Reusing existing TURN_PASSWORD from $ENV_FILE"
else
  TURN_PASS=$(openssl rand -hex 16)
  echo "[4/7] Generated new TURN_PASSWORD"
fi
TURN_USER="seldegram"

# 5. Пишем /etc/turnserver.conf
echo "[5/7] Writing /etc/turnserver.conf..."
cat > /etc/turnserver.conf <<EOF
listening-port=3478
tls-listening-port=5349
listening-ip=0.0.0.0
external-ip=$EXTERNAL_IP
fingerprint
lt-cred-mech
realm=pinkcrab.ru
user=$TURN_USER:$TURN_PASS
min-port=49152
max-port=65535
no-multicast-peers
denied-peer-ip=0.0.0.0-0.255.255.255
denied-peer-ip=10.0.0.0-10.255.255.255
denied-peer-ip=100.64.0.0-100.127.255.255
denied-peer-ip=127.0.0.0-127.255.255.255
denied-peer-ip=169.254.0.0-169.254.255.255
denied-peer-ip=172.16.0.0-172.31.255.255
denied-peer-ip=192.0.0.0-192.0.0.255
denied-peer-ip=192.168.0.0-192.168.255.255
denied-peer-ip=198.18.0.0-198.19.255.255
denied-peer-ip=224.0.0.0-239.255.255.255
denied-peer-ip=240.0.0.0-255.255.255.255
log-file=/var/log/turnserver/turnserver.log
simple-log
no-stdout-log
EOF
mkdir -p /var/log/turnserver
chown -R turnserver:turnserver /var/log/turnserver 2>/dev/null || true

# 6. Открываем порты в ufw (если включён)
echo "[6/7] Opening firewall ports..."
if command -v ufw >/dev/null 2>&1 && ufw status | grep -q 'Status: active'; then
  ufw allow 3478/udp >/dev/null
  ufw allow 3478/tcp >/dev/null
  ufw allow 5349/tcp >/dev/null
  ufw allow 49152:65535/udp >/dev/null
  echo "  ufw rules added (3478, 5349, 49152-65535)"
else
  echo "  ufw not active — skipping. Если у Timeweb Cloud есть внешний firewall в панели — открой порты 3478/UDP+TCP, 5349/TCP и 49152-65535/UDP вручную."
fi

# 7. Прописываем TURN_* в .env и рестартим
echo "[7/7] Updating $ENV_FILE and restarting services..."
if [ ! -f "$ENV_FILE" ]; then
  echo "WARN: $ENV_FILE not found — TURN не подключится к Nest. Создай файл и перезапусти скрипт."
else
  # Удаляем старые TURN_* строки и добавляем заново
  sed -i '/^TURN_URL=/d;/^TURN_USERNAME=/d;/^TURN_PASSWORD=/d' "$ENV_FILE"
  cat >> "$ENV_FILE" <<EOF
TURN_URL=turn:$EXTERNAL_IP:3478
TURN_USERNAME=$TURN_USER
TURN_PASSWORD=$TURN_PASS
EOF
  chown seldegram:seldegram "$ENV_FILE" || true
fi

systemctl enable coturn >/dev/null
systemctl restart coturn
systemctl restart seldegram.service || true

echo
echo "== Done =="
echo "TURN URL:      turn:$EXTERNAL_IP:3478"
echo "TURN_USERNAME: $TURN_USER"
echo "TURN_PASSWORD: $TURN_PASS"
echo
echo "Проверь ICE-кандидаты в браузере:"
echo "  https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/"
echo "  В таблице ожидаются строки с типом 'relay'."
