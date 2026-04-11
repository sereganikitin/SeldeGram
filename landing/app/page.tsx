const APP_URL = "https://app.infoseledka.ru";

const FEATURES = [
  {
    icon: "💬",
    title: "Чаты, группы и каналы",
    text: "Личные сообщения, групповые обсуждения и публичные каналы — всё в одном приложении.",
  },
  {
    icon: "📷",
    title: "Медиа до 50 МБ",
    text: "Фотографии, видео и любые файлы — отправляйте быстро, без потери качества.",
  },
  {
    icon: "🔔",
    title: "Push-уведомления",
    text: "Узнавайте о новых сообщениях мгновенно. Никаких пропущенных весточек.",
  },
  {
    icon: "😀",
    title: "Стикеры",
    text: "Установите готовые паки или создайте собственный — поделитесь с друзьями по @ссылке.",
  },
  {
    icon: "🌗",
    title: "Тёмная тема и обои",
    text: "Светлая, тёмная или системная. Свои обои для каждого чата — как захочется.",
  },
  {
    icon: "⚡",
    title: "Реалтайм",
    text: "Сообщения, индикатор «печатает», прочитано/доставлено — всё мгновенно.",
  },
];

function CrabLogo({ size = 36 }: { size?: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size}>
      <defs>
        <linearGradient id="crab-logo" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ff9bb5" />
          <stop offset="100%" stopColor="#e84e76" />
        </linearGradient>
      </defs>
      <ellipse cx="11" cy="34" rx="7" ry="5" fill="url(#crab-logo)" />
      <ellipse cx="53" cy="34" rx="7" ry="5" fill="url(#crab-logo)" />
      <ellipse cx="32" cy="36" rx="20" ry="14" fill="url(#crab-logo)" />
      <circle cx="24" cy="28" r="4" fill="#fff" />
      <circle cx="40" cy="28" r="4" fill="#fff" />
      <circle cx="24" cy="28" r="2" fill="#3d1a28" />
      <circle cx="40" cy="28" r="2" fill="#3d1a28" />
      <line x1="15" y1="44" x2="10" y2="52" stroke="#e84e76" strokeWidth="3" strokeLinecap="round" />
      <line x1="22" y1="48" x2="20" y2="56" stroke="#e84e76" strokeWidth="3" strokeLinecap="round" />
      <line x1="42" y1="48" x2="44" y2="56" stroke="#e84e76" strokeWidth="3" strokeLinecap="round" />
      <line x1="49" y1="44" x2="54" y2="52" stroke="#e84e76" strokeWidth="3" strokeLinecap="round" />
      <path d="M28 38 Q32 41 36 38" stroke="#fff" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function Fish({ x, y, size = 40, flip = false, color = "#ff8fa8" }: { x: number; y: number; size?: number; flip?: boolean; color?: string }) {
  return (
    <svg
      viewBox="0 0 40 20"
      width={size}
      height={size / 2}
      className="absolute"
      style={{ left: x, top: y, transform: flip ? "scaleX(-1)" : undefined }}
    >
      <ellipse cx="20" cy="10" rx="18" ry="9" fill={color} opacity="0.7" />
      <polygon points="2,10 -10,2 -10,18" fill={color} opacity="0.7" />
      <circle cx="30" cy="7" r="1.8" fill="#fff" />
      <circle cx="30" cy="7" r="0.8" fill="#3d1a28" />
    </svg>
  );
}

function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative mx-auto w-[280px] h-[560px] rounded-[40px] bg-ink shadow-2xl shadow-brand/30 p-3 animate-float">
      <div className="absolute top-3 left-1/2 -translate-x-1/2 h-6 w-32 rounded-b-3xl bg-ink z-10" />
      <div className="h-full w-full rounded-[32px] overflow-hidden bg-gradient-to-br from-[#ffe8f0] via-[#ffd4e1] to-[#ffc0d2] relative">
        {children}
      </div>
    </div>
  );
}

function ChatPreview() {
  return (
    <div className="absolute inset-0 p-4 flex flex-col">
      <div className="text-ink text-sm font-semibold mb-3 mt-6">Алиса 🦀</div>
      <div className="flex-1 flex flex-col gap-2">
        <div className="self-start max-w-[70%] bg-white text-ink px-3 py-2 rounded-2xl text-xs shadow-sm">
          Привет! Как дела?
        </div>
        <div className="self-end max-w-[70%] bg-brand text-white px-3 py-2 rounded-2xl text-xs shadow-sm">
          Отлично! Только что попробовал SeldeGram
        </div>
        <div className="self-start max-w-[70%] bg-white text-ink px-3 py-2 rounded-2xl text-xs shadow-sm">
          О, и как тебе? 😊
        </div>
        <div className="self-end max-w-[70%] bg-brand text-white px-3 py-2 rounded-2xl text-xs shadow-sm">
          Просто и быстро. То что нужно!
        </div>
        <div className="self-start max-w-[70%] px-3 py-1 text-xs text-ink-muted italic">
          Алиса печатает...
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <main className="flex-1 relative overflow-hidden">
      {/* Декоративные рыбки на фоне */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <Fish x={40} y={120} size={50} color="#ff9bb5" />
        <Fish x={-20} y={400} size={70} color="#ffb3c5" flip />
        <Fish x={80} y={700} size={55} color="#ff8fa8" />
      </div>

      {/* Header */}
      <header className="relative w-full px-6 md:px-10 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CrabLogo size={44} />
          <span className="font-bold text-xl text-ink">SeldeGram</span>
        </div>
        <a
          href={APP_URL}
          className="hidden sm:inline-flex bg-brand hover:bg-brand-dark text-white px-5 py-2 rounded-full font-medium transition shadow-md shadow-brand/20"
        >
          Открыть в браузере
        </a>
      </header>

      {/* Hero */}
      <section className="relative px-6 md:px-10 pt-12 pb-24 md:pt-20 md:pb-32 max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
        <div>
          <h1 className="text-4xl md:text-6xl font-extrabold leading-tight tracking-tight text-ink">
            Остаемся на связи{" "}
            <span className="text-brand-dark">не смотря ни на что!</span>
          </h1>
          <p className="mt-6 text-lg text-ink-muted leading-relaxed">
            SeldeGram — простой и быстрый мессенджер. Пишите друзьям, создавайте группы и каналы,
            делитесь фото, видео и стикерами. Всё это с push-уведомлениями и тёмной темой.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <a
              href={APP_URL}
              className="bg-brand hover:bg-brand-dark text-white px-7 py-4 rounded-full font-semibold text-lg shadow-lg shadow-brand/30 transition"
            >
              Открыть в браузере
            </a>
            <span className="inline-flex items-center px-7 py-4 rounded-full font-medium text-ink-muted border border-cream-border">
              📱 Скоро в App Store
            </span>
          </div>
        </div>
        <div className="flex justify-center">
          <PhoneFrame>
            <ChatPreview />
          </PhoneFrame>
        </div>
      </section>

      {/* Features */}
      <section className="relative bg-cream-alt px-6 md:px-10 py-24">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-ink">Что умеет SeldeGram</h2>
          <p className="mt-4 text-center text-ink-muted max-w-2xl mx-auto">
            Всё необходимое для общения — без лишнего, но с заботой о деталях.
          </p>
          <div className="mt-16 grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="bg-white p-8 rounded-2xl border border-cream-border hover:border-brand/40 hover:shadow-lg hover:shadow-brand/10 transition"
              >
                <div className="text-4xl mb-4">{f.icon}</div>
                <h3 className="text-xl font-bold mb-2 text-ink">{f.title}</h3>
                <p className="text-ink-muted leading-relaxed">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative px-6 md:px-10 py-24">
        <div className="max-w-3xl mx-auto text-center">
          <div className="flex justify-center mb-6">
            <CrabLogo size={64} />
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-ink">Готовы попробовать?</h2>
          <p className="mt-4 text-ink-muted text-lg">
            Регистрация занимает 30 секунд. Никаких номеров телефонов — только email.
          </p>
          <a
            href={APP_URL}
            className="mt-10 inline-block bg-brand hover:bg-brand-dark text-white px-10 py-5 rounded-full font-semibold text-lg shadow-xl shadow-brand/30 transition"
          >
            Открыть SeldeGram →
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative px-6 md:px-10 py-10 border-t border-cream-border">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-ink-muted text-sm">
          <div className="flex items-center gap-2">
            <CrabLogo size={28} />
            <span>© 2026 SeldeGram</span>
          </div>
          <div className="flex gap-6">
            <a href={APP_URL} className="hover:text-brand-dark transition">
              Веб-приложение
            </a>
            <a href="mailto:hello@infoseledka.ru" className="hover:text-brand-dark transition">
              Контакты
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
