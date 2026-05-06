import fs from 'node:fs';
import path from 'node:path';
import SunCalc from 'suncalc';

const MEDIA_DIR = process.env.UPLOADS_DIR || '/var/www/21bristoe-media';
const SITE_CONFIG_PATH = path.join(MEDIA_DIR, 'site-config.json');
const MANIFEST_PATH = path.join(MEDIA_DIR, 'manifest.json');
const VISITOR_STATS_PATH = '/var/lib/bristoe-stats/visitors.json';
const LAT = 39.6576;
const LNG = -77.1763;

export interface HomeMember {
  name: string;
  emoji: string;
  role: string;
  bio: string;
  cardClass: string;
  photoFile: string | null;
}

export interface LinkItem {
  icon: string;
  title: string;
  description: string;
  href: string;
}

export interface HomePageData {
  meta: {
    title: string;
    description: string;
    canonicalUrl: string;
    ogImage: string;
  };
  hero: {
    preHeading: string;
    subtitle: string;
    location: string;
  };
  sky: {
    sunrise: string;
    sunset: string;
    moonEmoji: string;
    moonName: string;
  };
  welcome: {
    label: string;
    heading: string;
    seasonalNote: string;
    paragraphs: string[];
    accentAddress: string;
    accentCity: string;
    members: HomeMember[];
  };
  neighborhood: {
    label: string;
    heading: string;
    description: string;
    highlights: LinkItem[];
  };
  limon: {
    sectionLabel: string;
    fallbackSubtitle: string;
    name: string;
    bio: string;
    quote: string;
    quoteAttribution: string;
    facts: Array<{ label: string; value: string }>;
  };
  quickLinks: {
    label: string;
    heading: string;
    description: string;
    links: LinkItem[];
  };
  visitorGuide: {
    label: string;
    heading: string;
    description: string;
    tips: Array<{ icon: string; title: string; body: string }>;
  };
  footer: FooterData;
  weather: WeatherData | null;
}

export interface FooterData {
  year: number;
  visitorCount: number | null;
  brand: string;
  location: string;
  tagline: string;
}

export interface WeatherData {
  current: { temp: number; code: number };
  daily: Array<{ label: string; high: number; low: number; code: number }>;
  fetchedAt: string;
}

const defaultMembers: HomeMember[] = [
  {
    name: 'Faber',
    emoji: '👨',
    role: 'Co-owner',
    bio: 'Loves a good cocktail, a well-crafted home project, and getting into the weeds on anything tech.',
    cardClass: 'bg-warm-50 border-warm-200',
    photoFile: null
  },
  {
    name: 'Kasey',
    emoji: '👩',
    role: 'Co-owner',
    bio: 'Great cook, great eye for design, and the reason 21 Bristoe actually feels like a home.',
    cardClass: 'bg-sage-50 border-sage-200',
    photoFile: null
  },
  {
    name: 'Limón',
    emoji: '🐕',
    role: 'Chief Joy Officer',
    bio: 'Certified zoomie expert. Will greet you at the door, steal your spot on the couch, and charm everyone in the room.',
    cardClass: 'bg-warm-100 border-warm-300',
    photoFile: null
  }
];

function readJson(file: string): any {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return {};
  }
}

function readSiteConfig(): any {
  return readJson(SITE_CONFIG_PATH);
}

function readManifest(): any {
  return readJson(MANIFEST_PATH);
}

function fmtTime(d: unknown): string {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York'
  });
}

function seasonalNote(): string {
  const month = new Date().getMonth();
  if (month === 11) return 'Happy holidays from 21 Bristoe — wishing you warmth and joy this season.';
  if (month <= 1) return "Good winter from 21 Bristoe — hope you're staying cozy.";
  if (month <= 4) return 'Good spring from 21 Bristoe — glad you stopped by.';
  if (month <= 7) return "Good summer from 21 Bristoe — hope it's a great one.";
  return "Good autumn from 21 Bristoe — it's our favorite time of year.";
}

function getSky() {
  const now = new Date();
  const times = SunCalc.getTimes(now, LAT, LNG);
  const { phase } = SunCalc.getMoonIllumination(now) as { phase: number };
  const moonEmoji =
    phase < 0.0625 ? '🌑'
    : phase < 0.1875 ? '🌒'
    : phase < 0.3125 ? '🌓'
    : phase < 0.4375 ? '🌔'
    : phase < 0.5625 ? '🌕'
    : phase < 0.6875 ? '🌖'
    : phase < 0.8125 ? '🌗'
    : phase < 0.9375 ? '🌘'
    : '🌑';
  const moonName =
    phase < 0.0625 ? 'New Moon'
    : phase < 0.1875 ? 'Waxing Crescent'
    : phase < 0.3125 ? 'First Quarter'
    : phase < 0.4375 ? 'Waxing Gibbous'
    : phase < 0.5625 ? 'Full Moon'
    : phase < 0.6875 ? 'Waning Gibbous'
    : phase < 0.8125 ? 'Last Quarter'
    : phase < 0.9375 ? 'Waning Crescent'
    : 'New Moon';

  return {
    sunrise: fmtTime(times.sunrise),
    sunset: fmtTime(times.sunset),
    moonEmoji,
    moonName
  };
}

export function getFooterData(config = readSiteConfig()): FooterData {
  let visitorCount: number | null = null;
  try {
    const data = JSON.parse(fs.readFileSync(VISITOR_STATS_PATH, 'utf8'));
    if (typeof data.count === 'number') visitorCount = data.count;
    else if (Array.isArray(data.uniqueHashes)) visitorCount = data.uniqueHashes.length;
  } catch {
    visitorCount = null;
  }

  const ft = config.sectionText?.footer || {};
  return {
    year: new Date().getFullYear(),
    visitorCount,
    brand: ft.brand || '21 Bristoe',
    location: ft.location || 'Meades Crossing · Taneytown, Maryland',
    tagline: ft.tagline || 'Home of Faber, Kasey & Limón'
  };
}

export async function getWeather(): Promise<WeatherData | null> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LNG}` +
    `&current_weather=true&daily=temperature_2m_max,temperature_2m_min,weathercode` +
    `&temperature_unit=fahrenheit&timezone=America%2FNew_York&forecast_days=3`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = await res.json() as any;
    const d = data.daily;
    return {
      current: {
        temp: Math.round(data.current_weather.temperature),
        code: data.current_weather.weathercode
      },
      daily: (d.time as string[]).map((dateStr, i) => ({
        label: new Date(`${dateStr}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short' }),
        high: Math.round(d.temperature_2m_max[i]),
        low: Math.round(d.temperature_2m_min[i]),
        code: d.weathercode[i]
      })),
      fetchedAt: new Date().toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'America/New_York'
      })
    };
  } catch {
    return null;
  }
}

export async function getHomePageData(): Promise<HomePageData> {
  const cfg = readSiteConfig();
  const manifest = readManifest();
  const hero = cfg.hero || {};
  const sectionText = cfg.sectionText || {};
  const wt = sectionText.welcome || {};
  const nt = sectionText.neighborhood || {};
  const qt = sectionText.quickLinks || {};
  const lt = sectionText.limon || {};
  const vt = sectionText.visitorGuide || {};
  const limon = cfg.limon || {};

  const members = Array.isArray(cfg.members) && cfg.members.length > 0
    ? cfg.members.map((m: Partial<HomeMember>, i: number) => ({
        ...defaultMembers[i],
        ...m,
        cardClass: defaultMembers[i]?.cardClass ?? defaultMembers[0].cardClass
      }))
    : defaultMembers;

  const ogImage = manifest.ogImageFile ? `/uploads/${manifest.ogImageFile}` : '/og-image.png';

  return {
    meta: {
      title: '21 Bristoe',
      description: 'Welcome home — Faber, Kasey, and Limón at Meades Crossing, Taneytown, Maryland.',
      canonicalUrl: 'https://21bristoe.com/',
      ogImage
    },
    hero: {
      preHeading: sectionText.hero?.preHeading || 'Welcome Home',
      subtitle: hero.subtitle || 'Home of Faber, Kasey & Limón',
      location: hero.location || 'Meades Crossing · Taneytown, Maryland'
    },
    sky: getSky(),
    welcome: {
      label: wt.label || 'The Household',
      heading: wt.heading || 'Welcome to Our Home',
      seasonalNote: seasonalNote(),
      paragraphs: [
        wt.para1 || "We're Faber and Kasey, and we've made our home here in Meades Crossing — a neighborhood in Taneytown, Maryland that we're proud to be part of.",
        wt.para2 || "Whether it's a quiet evening on the back porch, a morning walk through the neighborhood, or hosting friends over a good meal and a great drink, 21 Bristoe is where life happens for us.",
        wt.para3 || "This little corner of the internet is our household portal — a place to share what we're up to, what we love, and yes, plenty of Limón content."
      ],
      accentAddress: wt.accentAddress || '21 Bristoe Station Rd',
      accentCity: wt.accentCity || 'Taneytown, MD',
      members
    },
    neighborhood: {
      label: nt.label || 'Where We Live',
      heading: nt.heading || 'Our Neighborhood',
      description: nt.description || 'Meades Crossing in Taneytown, Maryland — a slice of real community in the heart of Carroll County.',
      highlights: Array.isArray(cfg.neighborhoodHighlights) && cfg.neighborhoodHighlights.length > 0
        ? cfg.neighborhoodHighlights
        : [
            { icon: '🏘️', title: 'Meades Crossing', description: 'A welcoming planned community in Carroll County — quiet streets, friendly neighbors, and a real sense of place just outside the bustle of the city.' },
            { icon: '🌿', title: 'Taneytown Charm', description: 'Founded in 1754, Taneytown blends small-town warmth with modern convenience. Parks, local shops, and a thriving community make it a place worth calling home.' },
            { icon: '🌄', title: 'Maryland Countryside', description: 'Rolling hills, open farmland, and scenic vistas — Carroll County offers the kind of wide-open beauty that never gets old on a morning walk or evening drive.' },
            { icon: '🐾', title: 'Dog-Friendly', description: 'From trails to open green spaces, the neighborhood is perfect for four-legged residents. Limón approves.' }
          ]
    },
    limon: {
      sectionLabel: lt.sectionLabel || 'Meet the Resident Expert',
      fallbackSubtitle: lt.fallbackSubtitle || 'The Golden Girl',
      name: limon.name || 'Limón',
      bio: limon.bio || "Limón is our golden retriever and the undisputed heart of the household. Named for the sunshine-yellow coat and the bright energy she brings to every single morning. Whether she's greeting you at the door, stealing a spot on the couch, or doing zoomies through the backyard — life with Limón is never boring.",
      quote: limon.quote || 'She has never met a stranger. She has also never turned down a treat.',
      quoteAttribution: limon.quoteAttribution || 'Faber & Kasey',
      facts: [
        { label: 'Breed', value: limon.breed || 'Golden Retriever' },
        { label: 'Specialty', value: limon.specialty || 'Maximum cuteness' },
        { label: 'Hobbies', value: limon.hobbies || 'Walks, naps, zoomies' },
        { label: 'Mood', value: limon.mood || 'Always happy to see you' }
      ]
    },
    quickLinks: {
      label: qt.label || 'Around the House',
      heading: qt.heading || 'Quick Links',
      description: qt.description || "The household's most-used links and resources, one click away.",
      links: Array.isArray(cfg.quickLinks) && cfg.quickLinks.length > 0
        ? cfg.quickLinks
        : [
            { icon: '🍹', title: 'Drink Hub', description: 'Browse our cocktail recipes, home bar inventory, and drink recommendations.', href: '/drinks/' },
            { icon: '📊', title: 'Stats Dashboard', description: 'Live house status, TV on-time, weather, drinks leaderboard, and household trends.', href: '/stats/' },
            { icon: '🏛️', title: 'Carroll County', description: 'Local government, services, parks, and community resources for Carroll County residents.', href: 'https://ccgovernment.carr.org' },
            { icon: '🗺️', title: 'Taneytown, MD', description: 'Explore Taneytown on the map — parks, local businesses, and all the spots we love.', href: 'https://www.google.com/maps/search/Taneytown+MD' }
          ]
    },
    visitorGuide: {
      label: vt.label || 'For Visitors',
      heading: vt.heading || 'Coming Over?',
      description: vt.description || "Here's everything you need to know before you arrive.",
      tips: Array.isArray(cfg.visitorTips) && cfg.visitorTips.length > 0
        ? cfg.visitorTips
        : [
            { icon: '🚗', title: 'Parking', body: "There's usually room in the driveway, plus easy street parking on Bristoe Station Rd right out front." },
            { icon: '🚪', title: 'The Door', body: 'Come to the front door — ring the bell and give us just a moment.' },
            { icon: '🐕', title: 'Meeting Limón', body: "She will be very excited to meet you. She's friendly — just be ready for an enthusiastic welcome (and possibly a zoomie)." },
            { icon: '📶', title: 'Guest Wi-Fi', body: 'Ask us for the guest network name and password when you arrive.' }
          ]
    },
    footer: getFooterData(cfg),
    weather: await getWeather()
  };
}

export function wmoIcon(code: number): string {
  if (code === 0) return '☀️';
  if (code <= 2) return code === 1 ? '🌤️' : '⛅';
  if (code === 3) return '☁️';
  if (code <= 48) return '🌫️';
  if (code <= 55) return '🌦️';
  if (code <= 65) return '🌧️';
  if (code <= 75) return code <= 71 ? '🌨️' : '❄️';
  if (code <= 82) return code <= 80 ? '🌦️' : '🌧️';
  if (code <= 86) return '🌨️';
  return '⛈️';
}

export function wmoDesc(code: number): string {
  if (code === 0) return 'Clear sky';
  if (code === 1) return 'Mainly clear';
  if (code === 2) return 'Partly cloudy';
  if (code === 3) return 'Overcast';
  if (code <= 48) return 'Foggy';
  if (code <= 53) return code <= 51 ? 'Light drizzle' : 'Drizzle';
  if (code === 55) return 'Dense drizzle';
  if (code <= 63) return code <= 61 ? 'Light rain' : 'Rain';
  if (code === 65) return 'Heavy rain';
  if (code <= 73) return code <= 71 ? 'Light snow' : 'Snow';
  if (code === 75) return 'Heavy snow';
  if (code <= 82) return 'Rain showers';
  if (code <= 86) return 'Snow showers';
  return 'Thunderstorm';
}
