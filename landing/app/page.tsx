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

function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative mx-auto w-[280px] h-[560px] rounded-[40px] bg-slate-900 shadow-2xl p-3 animate-float">
      <div className="absolute top-3 left-1/2 -translate-x-1/2 h-6 w-32 rounded-b-3xl bg-slate-900 z-10" />
      <div className="h-full w-full rounded-[32px] overflow-hidden bg-gradient-to-br from-brand to-brand-dark relative">
        {children}
      </div>
    </div>
  );
}

function ChatPreview() {
  return (
    <div className="absolute inset-0 p-4 flex flex-col">
      <div className="text-white text-sm font-semibold mb-3 mt-6">Алиса</div>
      <div className="flex-1 flex flex-col gap-2">
        <div className="self-start max-w-[70%] bg-white text-slate-900 px-3 py-2 rounded-2xl text-xs">
          Привет! Как дела?
        </div>
        <div className="self-end max-w-[70%] bg-slate-900 text-white px-3 py-2 rounded-2xl text-xs">
          Отлично! Только что попробовал SeldeGram
        </div>
        <div className="self-start max-w-[70%] bg-white text-slate-900 px-3 py-2 rounded-2xl text-xs">
          О, и как тебе? 😊
        </div>
        <div className="self-end max-w-[70%] bg-slate-900 text-white px-3 py-2 rounded-2xl text-xs">
          Просто и быстро. То что нужно!
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <main className="flex-1">
      {/* Header */}
      <header className="w-full px-6 md:px-10 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-brand flex items-center justify-center text-white font-bold text-lg shadow-md">
            S
          </div>
          <span className="font-bold text-lg">SeldeGram</span>
        </div>
        <a
          href={APP_URL}
          className="hidden sm:inline-flex bg-brand hover:bg-brand-dark text-white px-5 py-2 rounded-full font-medium transition"
        >
          Открыть в браузере
        </a>
      </header>

      {/* Hero */}
      <section className="px-6 md:px-10 pt-12 pb-24 md:pt-20 md:pb-32 max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
        <div>
          <h1 className="text-4xl md:text-6xl font-extrabold leading-tight tracking-tight">
            Остаемся на связи{" "}
            <span className="text-brand-dark">не смотря ни на что!</span>
          </h1>
          <p className="mt-6 text-lg text-slate-300 leading-relaxed">
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
            <span className="inline-flex items-center px-7 py-4 rounded-full font-medium text-slate-400 border border-slate-700">
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
      <section className="bg-slate-950 px-6 md:px-10 py-24">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center">Что умеет SeldeGram</h2>
          <p className="mt-4 text-center text-slate-400 max-w-2xl mx-auto">
            Всё необходимое для общения — без лишнего, но с заботой о деталях.
          </p>
          <div className="mt-16 grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="bg-slate-900 p-8 rounded-2xl border border-slate-800 hover:border-brand/40 hover:shadow-lg hover:shadow-brand/10 transition"
              >
                <div className="text-4xl mb-4">{f.icon}</div>
                <h3 className="text-xl font-bold mb-2">{f.title}</h3>
                <p className="text-slate-400 leading-relaxed">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 md:px-10 py-24">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold">Готовы попробовать?</h2>
          <p className="mt-4 text-slate-400 text-lg">
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
      <footer className="px-6 md:px-10 py-10 border-t border-slate-800">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-slate-500 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-brand flex items-center justify-center text-white font-bold">
              S
            </div>
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
