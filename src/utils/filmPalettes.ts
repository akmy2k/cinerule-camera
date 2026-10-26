import { ColorChannel } from '../types';
import { hexToRgb } from './colorAnalyzer';

/**
 * Reference 60-30-10 palettes from well-known films.
 *
 * Hex values are approximations sampled by eye from familiar stills; they are a
 * teaching aid for art direction, not measured grades. Each entry explains how
 * the film distributes dominant / secondary / accent and gives a practical
 * on-set move to reproduce the idea.
 */
export interface FilmPalette {
  id: string;
  film: string;
  year: number;
  dp: string;                // cinematographer
  family: 'warm' | 'cool' | 'complementary' | 'mono-accent' | 'pastel' | 'neon';
  dominant: string;          // ~60%
  secondary: string;         // ~30%
  accent: string;            // ~10%
  lesson: string;            // how the proportion works in the film
  onSet: string;             // how to do it on a real set
}

export const FILM_PALETTES: FilmPalette[] = [
  {
    id: 'schindler', film: "Schindler's List", year: 1993, dp: 'Janusz Kamiński', family: 'mono-accent',
    dominant: '#3a3a3a', secondary: '#9a9a9a', accent: '#b3202a',
    lesson: 'The extreme case: a black-and-white world where the accent is a single red coat, far under 10%. The smaller the accent, the louder it gets.',
    onSet: 'Strip saturation from wardrobe and set dressing, then let exactly one prop or costume carry colour.',
  },
  {
    id: 'amelie', film: 'Amélie', year: 2001, dp: 'Bruno Delbonnel', family: 'complementary',
    dominant: '#3f5a2a', secondary: '#a8321f', accent: '#e0a92e',
    lesson: 'Green owns the frame, red carries the supporting set pieces, and gold light is the accent that makes the world feel like a memory.',
    onSet: 'Repaint walls and props into two complementary families; use warm practicals for the gold accent instead of adding more objects.',
  },
  {
    id: 'furyroad', film: 'Mad Max: Fury Road', year: 2015, dp: 'John Seale', family: 'complementary',
    dominant: '#d27a2c', secondary: '#2c6f86', accent: '#f2e6c8',
    lesson: 'Orange desert at 60, teal sky at 30, and the bleached white of dust, chrome and war-boy paint as the accent.',
    onSet: 'Shoot with sky in the frame for the 30%; keep costumes in the desert family so faces read against the teal.',
  },
  {
    id: 'budapest', film: 'The Grand Budapest Hotel', year: 2014, dp: 'Robert Yeoman', family: 'pastel',
    dominant: '#e8a6b3', secondary: '#5b3a6e', accent: '#c4262e',
    lesson: 'Pastel pink architecture dominates, deep purple uniforms structure the frame, and saturated red (elevator, carpets) is reserved for punctuation.',
    onSet: 'Pick the set colour first, then costume the ensemble in one darker supporting colour so groups read as blocks.',
  },
  {
    id: 'br2049', film: 'Blade Runner 2049', year: 2017, dp: 'Roger Deakins', family: 'mono-accent',
    dominant: '#c9762c', secondary: '#5a3a22', accent: '#e8d9b5',
    lesson: 'The Las Vegas sequence is almost monochrome: orange haze and its shadow, with pale highlights as the only relief. Proportion carries mood when hue does not.',
    onSet: 'Haze plus a single coloured key source collapses the palette; place the subject where the brightest value lives.',
  },
  {
    id: 'moonlight', film: 'Moonlight', year: 2016, dp: 'James Laxton', family: 'cool',
    dominant: '#1f3f73', secondary: '#2f8f8a', accent: '#c2307a',
    lesson: 'Blue and teal hold skin and night; magenta appears in light and wardrobe as the emotional accent.',
    onSet: 'Light skin with cyan-blue fill and save a magenta source (a sign, a neon, a shirt) for the beat that matters.',
  },
  {
    id: 'moodforlove', film: 'In the Mood for Love', year: 2000, dp: 'Christopher Doyle, Mark Lee Ping-bing', family: 'warm',
    dominant: '#6e1414', secondary: '#2d3b2a', accent: '#e0a243',
    lesson: 'Deep reds and corridors of shadow at 60, muted green walls and cheongsams at 30, lamp-amber as the accent that warms the faces.',
    onSet: 'Use the location as the dominant, wardrobe as the secondary, and practical lamps as the accent.',
  },
  {
    id: 'matrix', film: 'The Matrix', year: 1999, dp: 'Bill Pope', family: 'mono-accent',
    dominant: '#2b3a2a', secondary: '#0d0f0d', accent: '#9fd36b',
    lesson: 'A green-tinted world with black wardrobe as the secondary; the accent is the brightest phosphor green, kept to screens and highlights.',
    onSet: 'Tint fluorescent fixtures green, dress everyone in black, and let screens provide the accent.',
  },
  {
    id: 'her', film: 'Her', year: 2013, dp: 'Hoyte van Hoytema', family: 'warm',
    dominant: '#d77a5f', secondary: '#e9d6bf', accent: '#b02a2a',
    lesson: 'Soft coral and peach dominate with cream as the support; the red shirt is the accent that keeps the warm world from going flat.',
    onSet: 'Remove blue from the set entirely, then pick one saturated wardrobe colour from the same family.',
  },
  {
    id: 'drive', film: 'Drive', year: 2011, dp: 'Newton Thomas Sigel', family: 'neon',
    dominant: '#12303f', secondary: '#c48a3a', accent: '#e43f8f',
    lesson: 'Teal night at 60, sodium-orange streetlight at 30, hot pink titles and neon as the accent.',
    onSet: 'Shoot night exteriors with mixed sodium and cool ambient; add one pink practical or graphic for the accent.',
  },
  {
    id: 'fightclub', film: 'Fight Club', year: 1999, dp: 'Jeff Cronenweth', family: 'mono-accent',
    dominant: '#4a4f2c', secondary: '#1b1c16', accent: '#c9a23a',
    lesson: 'Sickly green-yellow fluorescents dominate, dirty blacks support, and tungsten amber is the accent, the only warmth in the frame.',
    onSet: 'Leave fluorescent fixtures uncorrected; one tungsten source becomes the accent automatically.',
  },
  {
    id: 'shining', film: 'The Shining', year: 1980, dp: 'John Alcott', family: 'warm',
    dominant: '#8a3a22', secondary: '#d9a44a', accent: '#8fb3d6',
    lesson: 'Rust-orange carpet and wood dominate, gold support, and the twins’ pale blue dresses cut in as the cold accent.',
    onSet: 'Build the warm set, then dress the character you want the audience to fear for in the cold complement.',
  },
  {
    id: 'suspiria', film: 'Suspiria', year: 1977, dp: 'Luciano Tovoli', family: 'neon',
    dominant: '#7a0f1a', secondary: '#15265e', accent: '#2f9a4a',
    lesson: 'Saturated red at 60 and deep blue at 30, with a green accent that makes the palette feel poisoned.',
    onSet: 'Use coloured gels as the palette: two big washes for dominant and secondary, a small hard green source as accent.',
  },
  {
    id: 'joker', film: 'Joker', year: 2019, dp: 'Lawrence Sher', family: 'complementary',
    dominant: '#2c4440', secondary: '#6b6a3c', accent: '#c4442a',
    lesson: 'Murky teal-green city and olive interiors; the red-orange suit is the accent, and the film saves it for the transformation.',
    onSet: 'Keep the world drab and cool for most of the film so a single warm costume change reads as an event.',
  },
  {
    id: 'lalaland', film: 'La La Land', year: 2016, dp: 'Linus Sandgren', family: 'pastel',
    dominant: '#3c3a7a', secondary: '#7a5ea8', accent: '#f2d23a',
    lesson: 'Magic-hour purple and violet dominate the dance sequence; the yellow dress is the accent that pulls the eye through the choreography.',
    onSet: 'Schedule for the light you want as dominant, then costume the lead in its complement.',
  },
  {
    id: 'dune', film: 'Dune', year: 2021, dp: 'Greig Fraser', family: 'warm',
    dominant: '#b8915e', secondary: '#4c4a46', accent: '#2f5f8a',
    lesson: 'Sand and ochre dominate, slate-grey architecture and stillsuits support, and Fremen blue (eyes, water) is a rare accent.',
    onSet: 'Let natural landscape be the 60, keep built sets neutral, and reserve blue for story objects.',
  },
  {
    id: 'barbie', film: 'Barbie', year: 2023, dp: 'Rodrigo Prieto', family: 'pastel',
    dominant: '#f08cb8', secondary: '#7fc6e8', accent: '#f2d23a',
    lesson: 'Pink is the world, sky-blue is the support, and yellow pops in props and wardrobe as the accent.',
    onSet: 'Paint the set one hue in several tints; pick one opposite hue for the 30 and one high-key colour for the 10.',
  },
  {
    id: 'obrother', film: 'O Brother, Where Art Thou?', year: 2000, dp: 'Roger Deakins', family: 'warm',
    dominant: '#b8a15a', secondary: '#5d5232', accent: '#7aa0b8',
    lesson: 'A digitally sepia’d Mississippi: straw-yellow at 60, umber shadow at 30, pale sky blue left in as the accent.',
    onSet: 'Shoot in natural greens and pull them toward yellow in the grade; keep one cool element to stop it reading as a filter.',
  },
];

// ---------------------------------------------------------------- colour math

interface Lab { L: number; a: number; b: number; }

function srgbToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

export function hexToLab(hex: string): Lab {
  const rgb = hexToRgb(hex) || { r: 128, g: 128, b: 128 };
  const r = srgbToLinear(rgb.r), g = srgbToLinear(rgb.g), b = srgbToLinear(rgb.b);
  // sRGB D65 -> XYZ
  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  const y = (r * 0.2126 + g * 0.7152 + b * 0.0722);
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x), fy = f(y), fz = f(z);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

/** CIE76 colour difference. ~2 is barely visible, ~10 is clearly different, 50+ is a different colour family. */
export function deltaE(hexA: string, hexB: string): number {
  const A = hexToLab(hexA), B = hexToLab(hexB);
  return Math.sqrt((A.L - B.L) ** 2 + (A.a - B.a) ** 2 + (A.b - B.b) ** 2);
}

function chroma(hex: string): number {
  const { a, b } = hexToLab(hex);
  return Math.sqrt(a * a + b * b);
}

function hueDeg(hex: string): number {
  const { a, b } = hexToLab(hex);
  const h = (Math.atan2(b, a) * 180) / Math.PI;
  return h < 0 ? h + 360 : h;
}

// ------------------------------------------------------------ palette match

export interface PaletteMatch {
  score: number;        // 0-100 overall
  hueScore: number;     // 0-100 how close the colours are
  roleDeltas: number[]; // ΔE per role (dominant, secondary, accent)
  tip: string;
}

const ROLE_NAMES = ['dominant', 'secondary', 'accent'];

/**
 * Compare live 60-30-10 channels (sorted dominant→accent) against a reference
 * palette. Colour closeness is weighted by role (dominant matters most), then
 * blended with how close the proportions are to 60/30/10.
 */
export function matchPalette(colors: ColorChannel[], ref: FilmPalette): PaletteMatch {
  const target = [ref.dominant, ref.secondary, ref.accent];
  const weights = [0.5, 0.3, 0.2];
  const roleDeltas = target.map((hex, i) => (colors[i] ? deltaE(colors[i].hex, hex) : 100));
  // ΔE 0 -> 100 pts, ΔE 60+ -> 0 pts
  const hueScore = Math.round(
    roleDeltas.reduce((sum, d, i) => sum + weights[i] * Math.max(0, 100 - (d / 60) * 100), 0)
  );
  const proportionScore = scoreSixtyThirtyTen(colors);
  const score = Math.round(hueScore * 0.75 + proportionScore * 0.25);

  // The tip names the role that is furthest off.
  let worst = 0;
  roleDeltas.forEach((d, i) => { if (d * weights[i] > roleDeltas[worst] * weights[worst]) worst = i; });
  const want = target[worst];
  const have = colors[worst]?.hex ?? '#888888';
  const lighter = hexToLab(want).L - hexToLab(have).L;
  const moreChroma = chroma(want) - chroma(have);
  const parts: string[] = [];
  if (Math.abs(lighter) > 12) parts.push(lighter > 0 ? 'brighter' : 'darker');
  if (Math.abs(moreChroma) > 12) parts.push(moreChroma > 0 ? 'more saturated' : 'more muted');
  const tip = score >= 80
    ? `Close to ${ref.film}. Hold the frame.`
    : `To get closer to ${ref.film}, push the ${ROLE_NAMES[worst]} toward ${want}${parts.length ? ` (${parts.join(', ')})` : ''}.`;

  return { score, hueScore, roleDeltas, tip };
}

/** 0-100 score for how close proportions are to 60/30/10 (same formula as the analyzer). */
export function scoreSixtyThirtyTen(colors: ColorChannel[]): number {
  if (colors.length < 3) return 0;
  const error =
    Math.abs(colors[0].percentage - 60) +
    Math.abs(colors[1].percentage - 30) +
    Math.abs(colors[2].percentage - 10);
  return Math.max(0, Math.min(100, Math.round(100 - (error / 80) * 100)));
}

// ------------------------------------------------------------ harmony read

export interface HarmonyRead {
  scheme: string;         // e.g. "Complementary"
  accentPop: number;      // 0-100 how strongly the accent separates from the rest
  note: string;
}

/** Name the colour relationship between dominant and accent, and rate whether the accent actually pops. */
export function readHarmony(colors: ColorChannel[]): HarmonyRead {
  if (colors.length < 3) return { scheme: '—', accentPop: 0, note: '' };
  const [dom, sec, acc] = colors.map(c => c.hex);
  const chromas = [dom, sec, acc].map(chroma);

  // Pop = how far the accent sits from both other colours, plus chroma advantage.
  const sep = Math.min(deltaE(acc, dom), deltaE(acc, sec));
  const chromaLead = chromas[2] - Math.max(chromas[0], chromas[1]);
  const accentPop = Math.max(0, Math.min(100, Math.round(sep * 1.4 + chromaLead * 0.8)));

  let scheme: string;
  if (Math.max(...chromas) < 12) {
    scheme = 'Neutral / Monochrome';
  } else if (chromas[0] < 12 && chromas[1] < 12) {
    scheme = 'Neutral + Accent';
  } else {
    const diff = Math.abs(hueDeg(dom) - hueDeg(acc)) % 360;
    const angle = diff > 180 ? 360 - diff : diff;
    if (angle < 35) scheme = 'Analogous';
    else if (angle > 145) scheme = 'Complementary';
    else if (angle > 95) scheme = 'Triadic / Split';
    else scheme = 'Adjacent contrast';
  }

  let note: string;
  if (accentPop >= 60) note = 'Accent separates cleanly. It will pull the eye first.';
  else if (accentPop >= 35) note = 'Accent reads, but could be cleaner: isolate it or raise its saturation.';
  else note = 'Accent is getting lost. Pick a prop or light with stronger contrast to the dominant.';

  return { scheme, accentPop, note };
}
