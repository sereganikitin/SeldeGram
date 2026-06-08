# CraboGram Desktop (Tauri)

Тонкая Tauri-обёртка над веб-приложением. В продакшене грузит
`https://app.pinkcrab.ru` в системный WebView2. Установщик ~3 МБ.

## Что поставить один раз

1. **Rust** (через rustup): https://rustup.rs/
2. **Microsoft C++ Build Tools** — для компиляции Rust на Windows.
   Скачать «Build Tools for Visual Studio» и поставить компонент
   «Desktop development with C++».
3. **WebView2 Runtime** — почти всегда уже установлен на Win10/11
   (часть Edge). Проверить можно так: `Get-AppxPackage -Name "Microsoft.WebView2"`
   в PowerShell — или просто запустить и посмотреть, попросит ли установщик.
4. **Tauri CLI** — ставится из этого каталога:

   ```powershell
   cd desktop
   npm install
   ```

## Иконки

Положи мастер-иконку 1024×1024 (PNG) в `src-tauri/icons/source.png`,
затем сгенерируй все нужные размеры:

```powershell
cd desktop
npm run icon -- src-tauri/icons/source.png
```

Подойдёт `mobile/assets/icon.png`. Без иконок `tauri build` упадёт,
а `tauri dev` запустится.

## Дев-режим

В одном терминале запусти web (он должен слушать на `http://localhost:3000`):

```powershell
cd web
npm run dev
```

В другом:

```powershell
cd desktop
npm run dev
```

Tauri откроет окно и подключится к `localhost:3000`.

## Продакшн-сборка

### Установочные варианты

```powershell
cd desktop
npm run build
```

После сборки в `src-tauri/target/release/bundle/`:
- `nsis/CraboGram_1.0.0_x64-setup.exe` — устанавливает в `%LocalAppData%\Programs`,
  **не требует прав администратора**.
- `msi/CraboGram_1.0.0_x64_en-US.msi` — для развёртывания через GPO/SCCM,
  тоже per-user (currentUser scope).

### Портативный вариант

```powershell
cd desktop
npm run build:portable
```

Кроме обычных установщиков положит в
`src-tauri/target/release/portable/CraboGram-portable.exe` —
самодостаточный exe, ассеты вшиты в бинарник, установка не нужна.
Скопировал на флешку → запустил на любой машине с WebView2 (он же
есть на любой Win10/11 благодаря Edge).

Окно загружает `dist/index.html`, который мгновенно редиректит на
`https://app.pinkcrab.ru`. Чтобы изменить URL — поправь скрипт в
`dist/index.html`.

## VPN-клиент

Десктоп-приложение умеет подключаться к VPN-серверам через встроенный
sing-box-движок. Поддерживаемые протоколы: **VLESS** (TLS / Reality, ws /
grpc / http), **Hysteria 2**, **Shadowsocks**, **SOCKS5**, плюс импорт
произвольного sing-box outbound JSON.

### Подготовка

Скачай `sing-box.exe` для Windows AMD64 с
https://github.com/SagerNet/sing-box/releases и положи в
`src-tauri/binaries/sing-box-x86_64-pc-windows-msvc.exe`. Подробности в
[src-tauri/binaries/README.md](src-tauri/binaries/README.md).

Без бинарника `npm run build` упадёт на bundling-стадии.

### Использование

В сайдбаре приложения появится значок **Shield** — открывается VPN-модалка.
Импортируй профиль одним из трёх способов:

- **Ссылка**: `vless://`, `hy2://`, `hysteria2://`, `ss://`, `socks5://`
  — либо вставь руками, либо «Из буфера».
- **JSON**: outbound из sing-box формата (`{"type":"vless",...}`),
  целиком файл конфига (`{"outbounds":[...]}`) или массив outbounds —
  парсер сам найдёт прокси-outbound.
- **.json файл**: то же что JSON, но из файла на диске.

Профили сохраняются в `$APP_DATA/vpn-profiles.json`
(Windows: `%RoamingAppData%\ru.infoseledka.crabogram.desktop\`).

### Текущее ограничение MVP

Связка sing-box ↔ WebView2 пока не **автоматически** подключена. При
нажатии «Подключить»:
1. Запускается sing-box-sidecar, поднимает локальный SOCKS5 на
   `127.0.0.1:47180`.
2. Профиль роутится через выбранный outbound.
3. WebView2 при этом всё ещё ходит напрямую — её прокси не переключается
   автоматически.

Следующая итерация: пересоздание WebView с `proxy_url` при коннекте.
