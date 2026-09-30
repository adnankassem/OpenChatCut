// White-label branding applied at boot. The server serves `OPENCHATCUT_BRAND_DIR` at
// `/brand/*` (server/branding.ts); `loadBrand()` fetches `/brand/brand.json` before the
// first render and applies the parts that live outside React (title, favicon, accent
// colour, default language). Components read the rest through `getBrand()`.
import { ALL_LOCALES, setLocale, type Locale } from './i18n/locale';

export interface BrandGoal {
  /** Chip label. */
  label: string;
  /** One line under the label on the starter chip. */
  description?: string;
  /** Text placed in the composer when the chip is clicked. */
  prompt: string;
  /** Icon name from src/components/icons.tsx; defaults to sparkles. */
  icon?: string;
}

export interface Brand {
  /** Product name shown wherever the upstream name appears (wordmark fallback, labels). */
  name?: string;
  /** Browser tab title; defaults to `name`. */
  title?: string;
  /** Icon file in the brand directory, used as favicon and brand mark. */
  icon?: string;
  /** Wordmark image file in the brand directory; when absent `name` is rendered as text. */
  wordmark?: string;
  /** Rendered width of the wordmark in the title bar (px). */
  wordmarkWidth?: number;
  /** Accent colour overrides applied on top of every skin (hex). */
  accent?: string;
  accentDeep?: string;
  onAccent?: string;
  /** Interface language used until the person picks one. */
  locale?: Locale;
  /** Hide the upstream repository, contact and release-check links. */
  hideUpstreamLinks?: boolean;
  /** Subtitle under the wordmark in the chat header. Empty string hides it; absent keeps the upstream text. */
  tagline?: string;
  /** Extra stylesheet file in the brand directory, loaded after the app styles (fonts, panel tweaks). */
  css?: string;
  /** Editing goals shown ahead of the upstream starter chips and quick actions. */
  goals?: BrandGoal[];
  /** Extra model ids offered in the chat model picker per provider id (for example `openai`), after the saved model. */
  models?: Record<string, string[]>;
  /** Agent settings used until the person changes them in the composer settings (stored per browser). */
  agentDefaults?: Record<string, unknown>;
}

export const UPSTREAM_PRODUCT_NAME = 'OpenChatCut';
const HEX = /^#[0-9a-f]{6}$/i;
let brand: Brand = {};

export function getBrand(): Brand {
  return brand;
}

export function productName(): string {
  return brand.name?.trim() || UPSTREAM_PRODUCT_NAME;
}

export function brandAssetUrl(file: string | undefined): string | null {
  if (!file || file.includes('/') || file.includes('..')) return null;
  return `/brand/${encodeURIComponent(file)}`;
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function hex(value: unknown): string | undefined {
  const text = str(value);
  return text && HEX.test(text) ? text : undefined;
}

function parseModels(raw: unknown): Record<string, string[]> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, string[]> = {};
  for (const [provider, list] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(list)) continue;
    const ids = list.map(str).filter((v): v is string => Boolean(v)).slice(0, 16);
    if (ids.length) out[provider.trim().toLowerCase()] = ids;
  }
  return out;
}

function parseGoals(raw: unknown): BrandGoal[] {
  if (!Array.isArray(raw)) return [];
  const goals: BrandGoal[] = [];
  for (const item of raw.slice(0, 24)) {
    if (!item || typeof item !== 'object') continue;
    const goal = item as Record<string, unknown>;
    const label = str(goal.label);
    const prompt = str(goal.prompt);
    if (!label || !prompt) continue;
    goals.push({ label, prompt, description: str(goal.description), icon: str(goal.icon) });
  }
  return goals;
}

export function parseBrand(raw: unknown): Brand {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const input = raw as Record<string, unknown>;
  const locale = str(input.locale);
  const width = Number(input.wordmarkWidth);
  return {
    name: str(input.name),
    title: str(input.title),
    icon: str(input.icon),
    wordmark: str(input.wordmark),
    wordmarkWidth: Number.isFinite(width) && width > 0 ? width : undefined,
    accent: hex(input.accent),
    accentDeep: hex(input.accentDeep),
    onAccent: hex(input.onAccent),
    locale: locale && (ALL_LOCALES as readonly string[]).includes(locale) ? locale as Locale : undefined,
    hideUpstreamLinks: input.hideUpstreamLinks === true,
    tagline: typeof input.tagline === 'string' ? input.tagline.trim() : undefined,
    css: str(input.css),
    goals: parseGoals(input.goals),
    models: parseModels(input.models),
    agentDefaults: input.agentDefaults && typeof input.agentDefaults === 'object' && !Array.isArray(input.agentDefaults)
      ? input.agentDefaults as Record<string, unknown>
      : undefined,
  };
}

function hexToRgb(value: string): string {
  const n = parseInt(value.slice(1), 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

function applyAccent(next: Brand): void {
  if (!next.accent) return;
  const lines = [`--cc-accent: ${next.accent};`, `--cc-accent-rgb: ${hexToRgb(next.accent)};`];
  if (next.accentDeep) lines.push(`--cc-accent-deep: ${next.accentDeep};`);
  if (next.onAccent) lines.push(`--cc-on-accent: ${next.onAccent};`);
  // Same specificity as the skin blocks (src/skins.ts) and appended after them, so it wins for every skin.
  let style = document.getElementById('cc-brand');
  if (!style) {
    style = document.createElement('style');
    style.id = 'cc-brand';
    document.head.appendChild(style);
  }
  style.textContent = `:root, html[data-cc-skin] {\n  ${lines.join('\n  ')}\n}\n`;
}

function applyDocument(next: Brand): void {
  const title = next.title ?? next.name;
  if (title) document.title = title;
  const icon = brandAssetUrl(next.icon);
  if (icon) {
    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]') ?? document.createElement('link');
    link.rel = 'icon';
    link.href = icon;
    link.removeAttribute('type');
    if (!link.parentNode) document.head.appendChild(link);
  }
  if (next.locale) {
    let stored: string | null = null;
    try { stored = localStorage.getItem('cc.locale'); } catch { /* storage unavailable */ }
    if (!stored) setLocale(next.locale);
  }
  applyAccent(next);
  const css = brandAssetUrl(next.css);
  if (css && !document.getElementById('cc-brand-css')) {
    const link = document.createElement('link');
    link.id = 'cc-brand-css';
    link.rel = 'stylesheet';
    link.href = css;
    document.head.appendChild(link);
  }
}

/** Fetch and apply the brand once. Any failure leaves the upstream defaults in place. */
export async function loadBrand(): Promise<Brand> {
  try {
    const response = await fetch('/brand/brand.json', { cache: 'no-store' });
    if (!response.ok) return brand;
    brand = parseBrand(await response.json());
    if (typeof document !== 'undefined') applyDocument(brand);
  } catch {
    brand = {};
  }
  return brand;
}
