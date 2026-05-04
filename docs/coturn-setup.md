# TURN-сервер (coturn) для звонков

Звонки в SeldeGram идут P2P через WebRTC. Когда оба пользователя за «дружелюбным» NAT, хватает STUN'а Google. Но при VPN, симметричном NAT или строгом корпоративном файрволе соединение не устанавливается, и звонок упирается в 30-секундный таймаут.

TURN-сервер выступает релеем: WebRTC-трафик идёт **через него** на 443/TCP или 3478/UDP, и звонок соединяется почти всегда. Минусы — нагрузка на сервер (CPU + трафик) и небольшая задержка.

Этот документ описывает как поднять `coturn` на том же VPS, где живёт SeldeGram.

---

## 1. Установка

```bash
sudo apt update
sudo apt install -y coturn
sudo systemctl enable coturn
```

После установки coturn по умолчанию **отключён**. Включаем:

```bash
sudo sed -i 's/^#TURNSERVER_ENABLED=1/TURNSERVER_ENABLED=1/' /etc/default/coturn
echo 'TURNSERVER_ENABLED=1' | sudo tee -a /etc/default/coturn
```

## 2. Конфигурация

Сгенерируй пароль (запомни его — он же пойдёт в `.env`):

```bash
TURN_PASS=$(openssl rand -hex 16)
echo "TURN_PASS=$TURN_PASS"
```

Отредактируй `/etc/turnserver.conf`:

```bash
sudo tee /etc/turnserver.conf > /dev/null <<EOF
listening-port=3478
tls-listening-port=5349
listening-ip=0.0.0.0
external-ip=72.56.12.105
fingerprint
lt-cred-mech
realm=pinkcrab.ru

# Один статический пользователь — этого достаточно для одного приложения
user=seldegram:$TURN_PASS

# Range UDP-портов для медиа
min-port=49152
max-port=65535

# Защита от использования сервера сторонними клиентами для DDoS
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

# Логи
log-file=/var/log/turnserver/turnserver.log
simple-log
no-stdout-log
EOF
```

> Замени `external-ip` на реальный публичный IP сервера, если он отличается от `72.56.12.105`.

## 3. Файрвол

```bash
sudo ufw allow 3478/udp
sudo ufw allow 3478/tcp
sudo ufw allow 5349/tcp
sudo ufw allow 49152:65535/udp
```

Если используется не ufw, а iptables — открой те же порты любым удобным способом.

В панели Timeweb (если есть внешний firewall на уровне облака) — открой те же диапазоны.

## 4. Запуск

```bash
sudo systemctl restart coturn
sudo systemctl status coturn --no-pager
```

В логе `/var/log/turnserver/turnserver.log` должны появиться строки `RFC 5780 response`.

## 5. Прописать в SeldeGram backend

В `~/SeldeGram/server/.env`:

```ini
TURN_URL=turn:72.56.12.105:3478
TURN_USERNAME=seldegram
TURN_PASSWORD=<тот самый TURN_PASS, который сгенерировали>
```

И рестарт:

```bash
sudo systemctl restart seldegram.service
```

## 6. Проверка

Открой https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/ в браузере, добавь:

- `URL`: `turn:72.56.12.105:3478`
- `username`: `seldegram`
- `password`: `<TURN_PASS>`

Жми **Add Server** → **Gather candidates**. В таблице должны появиться кандидаты с типом `relay`. Если их нет — TURN не работает (проверь файрвол, логи `coturn`).

После этого позвонки в мессенджере будут собирать `relay`-кандидаты и проходить через VPN/NAT.

---

## Безопасность

- Этот конфиг использует **долгоживущий** static credential. Для open-source сервиса лучше short-term HMAC. Для одного приложения c одним пользователем — приемлемо.
- Не выкладывай `TURN_PASSWORD` в git.
- Если сервер начнут эксплуатировать левые WebRTC клиенты — посмотри `/var/log/turnserver/turnserver.log` и при необходимости добавь rate-limiting через `user-quota=10` и `total-quota=100` в `turnserver.conf`.
