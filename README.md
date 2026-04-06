# SeldeGram

E2EE-мессенджер (личные чаты, группы, каналы, медиа, стикеры). Без звонков.

## Стек

- **Backend:** Node.js + TypeScript + NestJS, PostgreSQL, Redis, MinIO (S3), WebSocket
- **Mobile:** React Native (iOS + Android), libsignal, SQLite
- **Инфра:** Docker Compose, Nginx (на VPS), Timeweb VPS
- **E2EE:** libsignal (Signal Protocol)

## Структура репозитория

```
seldegram/
├── server/      # NestJS бэкенд
├── mobile/      # React Native клиент (добавится дальше)
├── shared/      # Общие TS типы клиент/сервер
└── docker/      # docker-compose для локальной разработки
```

## Что нужно установить (Windows)

1. **Node.js 20 LTS** — https://nodejs.org
2. **Docker Desktop** — https://www.docker.com/products/docker-desktop
3. **Git** — уже стоит

Проверка:
```bash
node -v   # должно быть v20.x
docker -v
```

## Первый запуск

```bash
# 1. Установить зависимости (из корня репо)
npm install

# 2. Поднять инфраструктуру (Postgres, Redis, MinIO, Mailhog)
npm run dev:infra

# 3. Скопировать env-файл
cp server/.env.example server/.env

# 4. Запустить сервер в режиме разработки
npm run dev:server
```

После запуска проверь: http://localhost:3000/health — должен вернуть `{"status":"ok",...}`.

### Где что крутится

| Сервис      | URL / порт                | Назначение                          |
|-------------|---------------------------|-------------------------------------|
| Server API  | http://localhost:3000     | NestJS бэкенд                       |
| PostgreSQL  | localhost:5432            | Основная БД                         |
| Redis       | localhost:6379            | Очереди, presence                   |
| MinIO API   | http://localhost:9000     | S3-совместимое хранилище медиа      |
| MinIO UI    | http://localhost:9001     | Веб-консоль (seldegram / seldegram_dev_password) |
| Mailhog UI  | http://localhost:8025     | Просмотр писем (для регистрации)    |

Mailhog ловит все исходящие письма от сервера в dev-режиме — реальные SMTP не нужны.

## Этапы разработки

- [x] **Этап 0** — Фундамент: монорепо, Docker, скелет сервера
- [ ] **Этап 1** — Auth по email, схема БД, WebSocket-шлюз
- [ ] **Этап 2** — RN-клиент без E2EE (отладка транспорта)
- [ ] **Этап 3** — E2EE личных чатов (libsignal)
- [ ] **Этап 4** — Медиа через MinIO
- [ ] **Этап 5** — Группы (Sender Keys)
- [ ] **Этап 6** — Каналы
- [ ] **Этап 7** — Стикеры
- [ ] **Этап 8** — Push, реакции, multi-device

## Важно про E2EE

Сервер **никогда** не видит содержимое сообщений — только зашифрованные blob'ы. Это значит:
- Поиск по сообщениям — только на устройстве
- Бэкап — только зашифрованный
- Push приходят зашифрованными, расшифровываются на телефоне

Своё крипто писать **нельзя**. Используем `@signalapp/libsignal-client`.
