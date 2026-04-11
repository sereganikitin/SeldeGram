// SVG-сцены обоев (нежно-розовая гамма с рыбками и крабиками).
// Экспортируем как raw SVG строки — рендерим через react-native-svg SvgXml.
// SVG растягивается на весь экран через preserveAspectRatio="xMidYMid slice".

function fish(x: number, y: number, scale: number, color: string, flip = false) {
  const t = `translate(${x},${y}) scale(${flip ? -scale : scale}, ${scale})`;
  return `<g transform="${t}">
    <ellipse cx="20" cy="10" rx="18" ry="9" fill="${color}"/>
    <polygon points="2,10 -10,2 -10,18" fill="${color}"/>
    <circle cx="30" cy="7" r="1.8" fill="#fff"/>
    <circle cx="30" cy="7" r="0.8" fill="#333"/>
  </g>`;
}

function crab(x: number, y: number, scale: number, color: string) {
  const t = `translate(${x},${y}) scale(${scale})`;
  return `<g transform="${t}">
    <ellipse cx="20" cy="18" rx="18" ry="12" fill="${color}"/>
    <circle cx="14" cy="10" r="3" fill="#fff"/>
    <circle cx="26" cy="10" r="3" fill="#fff"/>
    <circle cx="14" cy="10" r="1.5" fill="#333"/>
    <circle cx="26" cy="10" r="1.5" fill="#333"/>
    <ellipse cx="-4" cy="22" rx="5" ry="4" fill="${color}"/>
    <ellipse cx="44" cy="22" rx="5" ry="4" fill="${color}"/>
    <line x1="6" y1="26" x2="2" y2="34" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
    <line x1="12" y1="28" x2="10" y2="36" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
    <line x1="28" y1="28" x2="30" y2="36" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
    <line x1="34" y1="26" x2="38" y2="34" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
  </g>`;
}

function bubble(x: number, y: number, r: number, opacity = 0.6) {
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity="${opacity}"/>`;
}

// 400x800 — ориентация телефона
export const PINK_FISH_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="800" viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffe8f0"/>
      <stop offset="100%" stop-color="#ffc4d5"/>
    </linearGradient>
  </defs>
  <rect width="400" height="800" fill="url(#bg)"/>
  <g opacity="0.6">
    ${fish(40, 80, 2, '#ff8fa8')}
    ${fish(250, 160, 1.6, '#ffa5b8', true)}
    ${fish(80, 260, 1.8, '#ff7a99')}
    ${fish(280, 340, 1.4, '#ffb3c5', true)}
    ${fish(50, 440, 2.2, '#ff9bb5')}
    ${fish(260, 540, 1.7, '#ff8098', true)}
    ${fish(100, 640, 1.5, '#ffa5b8')}
    ${fish(290, 720, 2, '#ff7a99', true)}
    ${bubble(160, 60, 4, 0.7)}
    ${bubble(170, 45, 2.5, 0.5)}
    ${bubble(320, 200, 3, 0.6)}
    ${bubble(60, 380, 3, 0.6)}
    ${bubble(200, 500, 4, 0.6)}
    ${bubble(350, 620, 2.5, 0.5)}
    ${bubble(140, 750, 3, 0.5)}
  </g>
</svg>`;

export const CORAL_CRAB_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="800" viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="bg2" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffe1d1"/>
      <stop offset="100%" stop-color="#ffbfc7"/>
    </linearGradient>
  </defs>
  <rect width="400" height="800" fill="url(#bg2)"/>
  <g opacity="0.65">
    ${crab(60, 100, 1.8, '#ff7575')}
    ${crab(250, 220, 1.5, '#ff8585')}
    ${crab(90, 360, 2, '#ff6f6f')}
    ${crab(270, 480, 1.6, '#ff8080')}
    ${crab(50, 580, 1.7, '#ff7a7a')}
    ${crab(280, 680, 1.4, '#ff9090')}
    ${bubble(180, 80, 3, 0.5)}
    ${bubble(340, 160, 2.5, 0.5)}
    ${bubble(160, 300, 3, 0.5)}
    ${bubble(60, 480, 2.5, 0.5)}
    ${bubble(210, 560, 3, 0.5)}
    ${bubble(350, 620, 2, 0.5)}
  </g>
</svg>`;

export const PINK_SEA_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="800" viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="bg3" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#fff0f5"/>
      <stop offset="50%" stop-color="#ffdbe8"/>
      <stop offset="100%" stop-color="#ffc0d2"/>
    </linearGradient>
  </defs>
  <rect width="400" height="800" fill="url(#bg3)"/>
  <g opacity="0.6">
    <path d="M0 120 Q50 100 100 120 T200 120 T300 120 T400 120" stroke="#ff9bb8" stroke-width="2" fill="none" opacity="0.4"/>
    <path d="M0 300 Q60 280 120 300 T240 300 T360 300 T480 300" stroke="#ff9bb8" stroke-width="2" fill="none" opacity="0.4"/>
    <path d="M0 500 Q50 480 100 500 T200 500 T300 500 T400 500" stroke="#ff9bb8" stroke-width="2" fill="none" opacity="0.4"/>
    <path d="M0 680 Q60 660 120 680 T240 680 T360 680 T480 680" stroke="#ff9bb8" stroke-width="2" fill="none" opacity="0.4"/>
    ${fish(60, 60, 2, '#ff8fa8')}
    ${crab(240, 140, 1.6, '#ff7a8e')}
    ${fish(80, 220, 1.5, '#ffa5b8', true)}
    ${fish(260, 330, 2, '#ff8fa8')}
    ${crab(50, 400, 1.5, '#ff7a8e')}
    ${fish(270, 470, 1.7, '#ffb3c5', true)}
    ${fish(60, 560, 1.8, '#ff7a99')}
    ${crab(260, 620, 1.4, '#ff8a9c')}
    ${fish(80, 710, 1.6, '#ffa5b8', true)}
    ${bubble(180, 100, 4, 0.6)}
    ${bubble(170, 80, 2.5, 0.5)}
    ${bubble(320, 260, 3, 0.5)}
    ${bubble(120, 440, 3, 0.5)}
    ${bubble(320, 540, 2.5, 0.5)}
    ${bubble(200, 680, 4, 0.6)}
  </g>
</svg>`;

export const WALLPAPER_SVGS: Record<string, string> = {
  pink_fish: PINK_FISH_SVG,
  coral_crab: CORAL_CRAB_SVG,
  pink_sea: PINK_SEA_SVG,
};
