// Генерирует PNG-иконки из SVG через sharp.
// Запуск: cd mobile && npm i -D sharp && node scripts/make-icons.mjs

import sharp from "sharp";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.join(__dirname, "..", "assets");

// Основная иконка (1024×1024) — с розовым градиентным фоном и крабиком
const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#fff0f5"/>
      <stop offset="100%" stop-color="#ffc0d2"/>
    </linearGradient>
    <linearGradient id="crab" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ff9bb5"/>
      <stop offset="100%" stop-color="#e84e76"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" rx="180" fill="url(#bg)"/>
  <!-- Клешни -->
  <ellipse cx="176" cy="560" rx="112" ry="80" fill="url(#crab)"/>
  <ellipse cx="848" cy="560" rx="112" ry="80" fill="url(#crab)"/>
  <!-- Тело -->
  <ellipse cx="512" cy="580" rx="320" ry="224" fill="url(#crab)"/>
  <!-- Глаза -->
  <circle cx="384" cy="450" r="70" fill="#fff"/>
  <circle cx="640" cy="450" r="70" fill="#fff"/>
  <circle cx="388" cy="455" r="36" fill="#3d1a28"/>
  <circle cx="644" cy="455" r="36" fill="#3d1a28"/>
  <circle cx="398" cy="440" r="12" fill="#fff"/>
  <circle cx="654" cy="440" r="12" fill="#fff"/>
  <!-- Лапки -->
  <line x1="240" y1="720" x2="150" y2="850" stroke="#e84e76" stroke-width="56" stroke-linecap="round"/>
  <line x1="352" y1="780" x2="310" y2="912" stroke="#e84e76" stroke-width="56" stroke-linecap="round"/>
  <line x1="672" y1="780" x2="714" y2="912" stroke="#e84e76" stroke-width="56" stroke-linecap="round"/>
  <line x1="784" y1="720" x2="874" y2="850" stroke="#e84e76" stroke-width="56" stroke-linecap="round"/>
  <!-- Улыбка -->
  <path d="M420 620 Q512 680 604 620" stroke="#fff" stroke-width="28" fill="none" stroke-linecap="round"/>
  <!-- Блик -->
  <ellipse cx="420" cy="520" rx="90" ry="25" fill="#ffc4d5" opacity="0.5"/>
</svg>`;

// Adaptive icon foreground (1024×1024) — крабик без фона (прозрачный), сдвинутый в центр safe zone (~66%)
const ADAPTIVE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    <linearGradient id="crab2" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ff9bb5"/>
      <stop offset="100%" stop-color="#e84e76"/>
    </linearGradient>
  </defs>
  <g transform="translate(170, 220) scale(0.66)">
    <ellipse cx="176" cy="560" rx="112" ry="80" fill="url(#crab2)"/>
    <ellipse cx="848" cy="560" rx="112" ry="80" fill="url(#crab2)"/>
    <ellipse cx="512" cy="580" rx="320" ry="224" fill="url(#crab2)"/>
    <circle cx="384" cy="450" r="70" fill="#fff"/>
    <circle cx="640" cy="450" r="70" fill="#fff"/>
    <circle cx="388" cy="455" r="36" fill="#3d1a28"/>
    <circle cx="644" cy="455" r="36" fill="#3d1a28"/>
    <circle cx="398" cy="440" r="12" fill="#fff"/>
    <circle cx="654" cy="440" r="12" fill="#fff"/>
    <line x1="240" y1="720" x2="150" y2="850" stroke="#e84e76" stroke-width="56" stroke-linecap="round"/>
    <line x1="352" y1="780" x2="310" y2="912" stroke="#e84e76" stroke-width="56" stroke-linecap="round"/>
    <line x1="672" y1="780" x2="714" y2="912" stroke="#e84e76" stroke-width="56" stroke-linecap="round"/>
    <line x1="784" y1="720" x2="874" y2="850" stroke="#e84e76" stroke-width="56" stroke-linecap="round"/>
    <path d="M420 620 Q512 680 604 620" stroke="#fff" stroke-width="28" fill="none" stroke-linecap="round"/>
  </g>
</svg>`;

// Splash — крабик на розовом фоне (такой же как icon, но можно проще)
const SPLASH_SVG = ICON_SVG;

// Favicon
const FAVICON_SVG = ICON_SVG;

async function render(svg, outPath, size) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(outPath);
  console.log(`✔ ${path.relative(process.cwd(), outPath)} (${size}×${size})`);
}

async function main() {
  await fs.mkdir(ASSETS, { recursive: true });
  await render(ICON_SVG, path.join(ASSETS, "icon.png"), 1024);
  await render(ADAPTIVE_SVG, path.join(ASSETS, "adaptive-icon.png"), 1024);
  await render(SPLASH_SVG, path.join(ASSETS, "splash-icon.png"), 1024);
  await render(FAVICON_SVG, path.join(ASSETS, "favicon.png"), 48);
  console.log("\nГотово! Теперь пересоберите приложение:");
  console.log("  eas build --platform android --profile preview");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
