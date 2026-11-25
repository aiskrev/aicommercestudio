import type { Locale } from "@/i18n/config";

/**
 * Copy of the Velora hero bento (docs/audits/velora-upstream-audit.md → homepage source map). Labels only: no
 * clients, results, numbers or live data. Every demonstration is marked as illustrative.
 */
export interface VeloraHomeCopy {
  stripLabel: string;
  strip: string[];
  morph: string[];
  beamTitle: string;
  beamText: string;
  dockLabel: string;
  cardTitle: string;
  cardText: string;
  cardLayers: string[];
  listLabel: string;
  list: { title: string; detail: string }[];
  marquee: string[][];
  orbitLabel: string;
  loadersLabel: string;
  globeLabel: string;
  tiles: Record<"globe" | "morph" | "beam" | "dock" | "card" | "list" | "marquee" | "orbit" | "loaders", string>;
  illustrative: string;
  stackLabel: string;
  stack: string[];
}

const bg: VeloraHomeCopy = {
  stripLabel: "Процес",
  strip: ["обхват", "дизайн", "изработка", "тестове", "пускане", "поддръжка"],
  morph: ["Сайтове", "Магазини", "Интеграции", "Автоматизация", "Поддръжка"],
  beamTitle: "Писмена оферта с ясен обхват",
  beamText: "Описваме какво влиза и какво не, преди да започнем.",
  dockLabel: "Бърз достъп до услугите",
  cardTitle: "Слоеве на едно решение",
  cardText: "Сайт, API, CRM и автоматизация — всеки слой на своето място.",
  cardLayers: ["Сайт или магазин", "API и интеграции", "Автоматизация с одобрение"],
  listLabel: "Примерен поток",
  list: [
    { title: "Запитване от сайта", detail: "получено" },
    { title: "Данните са проверени", detail: "задължителни полета" },
    { title: "AI класифицира", detail: "тип и услуга" },
    { title: "Записано в CRM", detail: "контакт и история" },
    { title: "Чернова на отговор", detail: "чака одобрение от човек" },
  ],
  marquee: [
    ["Фирмени сайтове", "Онлайн магазини", "Клиентски портали", "Уеб приложения", "Калкулатори", "Резервации"],
    ["Интеграции с API", "CRM", "Автоматизация", "AI агенти", "Поддръжка", "SEO основи"],
  ],
  orbitLabel: "Свързани системи",
  loadersLabel: "Индикатори за обработка",
  globeLabel: "Илюстрация: глобус със свързани точки. Плъзнете или използвайте стрелките, за да го завъртите.",
  tiles: {
    globe: "Свързани системи",
    morph: "Какво изграждаме",
    beam: "Как работим",
    dock: "Услуги",
    card: "Архитектура",
    list: "AI поток",
    marquee: "Възможности",
    orbit: "Интеграции",
    loaders: "Обработка",
  },
  illustrative: "Илюстрация",
  stackLabel: "Технологиите, на които работи и този сайт",
  stack: ["Next.js", "React", "TypeScript", "Tailwind CSS", "Python", "FastAPI", "PostgreSQL", "Docker", "Playwright"],
};

const en: VeloraHomeCopy = {
  stripLabel: "Process",
  strip: ["scope", "design", "build", "test", "launch", "care"],
  morph: ["Websites", "Stores", "Integrations", "Automation", "Care"],
  beamTitle: "A written quote with a clear scope",
  beamText: "We write down what is in and what is out before we start.",
  dockLabel: "Quick access to the services",
  cardTitle: "The layers of one solution",
  cardText: "Website, API, CRM and automation — each layer in its place.",
  cardLayers: ["Website or store", "API and integrations", "Automation with approval"],
  listLabel: "Sample flow",
  list: [
    { title: "Enquiry from the website", detail: "received" },
    { title: "Data checked", detail: "required fields" },
    { title: "AI classifies", detail: "type and service" },
    { title: "Saved to the CRM", detail: "contact and history" },
    { title: "Draft reply", detail: "waiting for a person" },
  ],
  marquee: [
    ["Business websites", "Online stores", "Customer portals", "Web applications", "Calculators", "Bookings"],
    ["API integrations", "CRM", "Automation", "AI agents", "Care plans", "SEO foundations"],
  ],
  orbitLabel: "Connected systems",
  loadersLabel: "Processing indicators",
  globeLabel: "Illustration: a globe with connected points. Drag it or use the arrow keys to turn it.",
  tiles: {
    globe: "Connected systems",
    morph: "What we build",
    beam: "How we work",
    dock: "Services",
    card: "Architecture",
    list: "AI flow",
    marquee: "Capabilities",
    orbit: "Integrations",
    loaders: "Processing",
  },
  illustrative: "Illustration",
  stackLabel: "The technologies this website runs on",
  stack: ["Next.js", "React", "TypeScript", "Tailwind CSS", "Python", "FastAPI", "PostgreSQL", "Docker", "Playwright"],
};

export function veloraHomeCopy(locale: Locale): VeloraHomeCopy {
  return locale === "en" ? en : bg;
}
