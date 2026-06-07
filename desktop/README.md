# SeldeGram Desktop (Tauri)

Тонкая Tauri-обёртка над веб-приложением. В продакшене грузит
`https://app.pinkcrab.ru` в системный WebView2. Установщик ~10 МБ.

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

```powershell
cd desktop
npm run build
```

После сборки установщики окажутся в `src-tauri/target/release/bundle/`:
- `msi/` — стандартный .msi
- `nsis/` — .exe-инсталлятор

Окно загружает `dist/index.html`, который мгновенно редиректит на
`https://app.pinkcrab.ru`. Чтобы изменить URL — поправь скрипт в
`dist/index.html`.
