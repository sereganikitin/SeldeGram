# Sidecar binaries

Tauri пакует файлы из этого каталога в установочный пакет приложения.

## sing-box

VPN-движок. Скачать последний релиз с
https://github.com/SagerNet/sing-box/releases — нужен Windows AMD64 zip
(например `sing-box-1.10.7-windows-amd64.zip`).

Достань из архива файл `sing-box.exe` и положи сюда **с именем, под
которое скомпилирован Rust**:

```
binaries/sing-box-x86_64-pc-windows-msvc.exe
```

Tauri суффиксует имя бинарника таргет-triple — это требование того,
чтобы один проект собирал sidecars под разные платформы.

Без этого файла:
- `npm run build` упадёт на стадии bundling external binaries,
- `npm run dev` запустится, но VPN-команды будут возвращать ошибку
  «sing-box binary not found».

Размер бинарника ~17 МБ; в репозиторий он не коммитится, см.
`.gitignore` в родительском каталоге.
